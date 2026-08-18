package com.campusvibe.clubadmin;

import com.campusvibe.auth.EmailNotVerifiedException;
import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.exception.RequestValidationException;
import com.campusvibe.exception.ResourceNotFoundException;
import com.campusvibe.mail.AppMailProperties;
import com.campusvibe.mail.MailSender;
import com.campusvibe.user.User;
import com.campusvibe.user.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Reads and writes club administration assignments.
 *
 * <p>Authorisation is <em>not</em> done here — callers reach this service only
 * after {@code ClubPermissionService} has cleared them via {@code @PreAuthorize}.
 * Keeping the check at the controller boundary means there is exactly one place
 * to look to answer "who may call this", rather than a permission test buried
 * halfway down a service method.
 *
 * <p><strong>One exception, and it is deliberate.</strong> Accepting and
 * declining an invitation check the caller inside this class, in
 * {@link #claimableBy}. There is no {@code @PreAuthorize} expression that could
 * do it: the question is not "does this user hold a role" but "is this
 * particular invitation addressed to this particular account, and has that
 * account proven the address" — which needs the invitation row in hand.
 */
@Service
public class ClubAdminService {

    /**
     * What the Administrators tab shows: the people who can act today, plus
     * anyone invited and not yet through the door. Revoked and expired rows are
     * history and belong in the activity log, not in a list of the current team.
     */
    private static final EnumSet<AssignmentStatus> LIVE =
            EnumSet.of(AssignmentStatus.ACTIVE, AssignmentStatus.PENDING);

    private final ClubAdminAssignmentRepository assignmentRepository;
    private final ClubRepository clubRepository;
    private final UserRepository userRepository;
    private final MailSender mailSender;
    private final AppMailProperties mailProperties;

    public ClubAdminService(ClubAdminAssignmentRepository assignmentRepository,
                            ClubRepository clubRepository,
                            UserRepository userRepository,
                            MailSender mailSender,
                            AppMailProperties mailProperties) {
        this.assignmentRepository = assignmentRepository;
        this.clubRepository = clubRepository;
        this.userRepository = userRepository;
        this.mailSender = mailSender;
        this.mailProperties = mailProperties;
    }

    // --- reads --------------------------------------------------------------

    /** Every club the user may manage. Empty for an ordinary member. */
    @Transactional(readOnly = true)
    public List<ManagedClubDTO> listManagedClubs(Long userId) {
        return assignmentRepository
                .findByUserIdAndStatus(userId, AssignmentStatus.ACTIVE)
                .stream()
                .map(assignment -> toManagedClubDto(assignment.getClub(), assignment.getRole()))
                .toList();
    }

    /**
     * The club's management team, owner first and then admins by join date.
     *
     * <p>The owner-first sort happens here rather than in the query because
     * {@code role} is stored as text: {@code ORDER BY role} would sort
     * "CLUB_ADMIN" above "CLUB_OWNER". Comparing by enum ordinal says what is
     * actually meant, and a club's exec team is small enough that ordering a
     * handful of rows in memory costs nothing.
     */
    @Transactional(readOnly = true)
    public List<ClubAdminDTO> listAdmins(String clubId) {
        return assignmentRepository
                .findByClubIdAndStatusInOrderByCreatedAtAsc(clubId, LIVE)
                .stream()
                .sorted(Comparator.comparing(ClubAdminAssignment::getRole))
                .map(ClubAdminService::toDto)
                .toList();
    }

    /**
     * Every invitation waiting on this person.
     *
     * <p>Returned to anyone signed in, confirmed address or not. Seeing that a
     * club has invited you gives nothing away — you are the addressee — and
     * hiding the invitation from an unconfirmed account would leave them with a
     * link in their inbox and an empty screen, unable to tell what they are
     * meant to do next. {@link #claimableBy} is where the rule is enforced.
     */
    @Transactional(readOnly = true)
    public List<ClubInvitationDTO> listInvitations(User user) {
        return assignmentRepository
                .findInvitationsFor(user.getId(), user.getEmail(), AssignmentStatus.PENDING)
                .stream()
                .map(this::toInvitationDto)
                .toList();
    }

    // --- writes -------------------------------------------------------------

    /**
     * Installs a club's first owner.
     *
     * <p>This is the bootstrap path from §9 of the governance doc: clubs launch
     * with nobody in charge, and a platform admin puts the first person there by
     * approving their request. Every subsequent change of hands is an ownership
     * transfer instead, which is why this refuses a club that already has an
     * owner rather than replacing them — a platform admin approving a stale
     * request must not be able to depose a sitting owner by accident.
     *
     * @param grantedByUserId the platform admin who approved, recorded for
     *                        accountability
     */
    @Transactional
    public ClubAdminAssignment assignFirstOwner(Club club, User user, Long grantedByUserId) {
        if (assignmentRepository.existsByClubIdAndRoleAndStatus(
                club.getId(), ClubRole.CLUB_OWNER, AssignmentStatus.ACTIVE)) {
            throw new RequestValidationException(
                    "Club [%s] already has an owner; transfer ownership instead".formatted(club.getId()));
        }

        // The (club_id, user_id) partial unique index covers PENDING and ACTIVE
        // rows, so an existing live assignment would fail at the database with
        // a constraint violation rather than a message anyone can act on.
        if (assignmentRepository.existsByClubIdAndUserIdAndStatusIn(
                club.getId(), user.getId(), LIVE)) {
            throw new RequestValidationException(
                    "%s already administers club [%s]".formatted(user.getEmail(), club.getId()));
        }

        ClubAdminAssignment assignment = new ClubAdminAssignment();
        assignment.setClub(club);
        assignment.setUser(user);
        assignment.setRole(ClubRole.CLUB_OWNER);
        assignment.setInvitedByUserId(grantedByUserId);
        assignment.activate();
        return assignmentRepository.save(assignment);
    }

    /**
     * Invites someone to administer the club, by address.
     *
     * <p>The address need not have an account. Student exec teams turn over in
     * the summer and the incoming treasurer is frequently not on CampusVibe
     * yet; refusing to invite them would mean telling the owner to go and chase
     * a signup first. When the address <em>does</em> resolve, the account is
     * recorded on the row straight away, which both puts a real name in the
     * Administrators list and brings the invitation under the
     * {@code one_live_assignment_per_club_user} index.
     *
     * <p>Nothing is granted here. The row is PENDING, and PENDING grants
     * exactly nothing — {@code ClubPermissionService} asks for ACTIVE. §6 is
     * explicit that nobody becomes an administrator without accepting, so an
     * invitation is an offer and never an appointment.
     */
    @Transactional
    public ClubAdminDTO invite(String clubId, String rawEmail, User invitedBy) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Club [%s] not found".formatted(clubId)));

        String email = normalise(rawEmail);
        Optional<User> existing = userRepository.findByEmail(email);

        existing.ifPresent(invitee -> {
            if (assignmentRepository.existsByClubIdAndUserIdAndStatusIn(clubId, invitee.getId(), LIVE)) {
                throw new RequestValidationException(
                        "%s is already on this club's team, or has an invitation waiting."
                                .formatted(invitee.getName()));
            }
        });

        if (assignmentRepository.existsByClubIdAndInvitedEmailIgnoreCaseAndStatusIn(clubId, email, LIVE)) {
            throw new RequestValidationException(
                    "There is already an invitation waiting for %s.".formatted(email));
        }

        ClubAdminAssignment invitation = new ClubAdminAssignment();
        invitation.setClub(club);
        invitation.setUser(existing.orElse(null));
        invitation.setInvitedEmail(email);
        invitation.setRole(ClubRole.CLUB_ADMIN);
        invitation.setStatus(AssignmentStatus.PENDING);
        invitation.setInvitedByUserId(invitedBy.getId());

        ClubAdminAssignment saved = saveGuardingIndexes(invitation);

        sendInvitationEmail(club, email, invitedBy, existing.isPresent());
        notifyClubInbox(club,
                "%s was invited to administer %s".formatted(email, club.getName()),
                """
                %s invited %s to help administer %s on CampusVibe.

                Nothing has changed yet. The invitation only becomes an
                administrator role once that person accepts it, signed in to a
                CampusVibe account with this address confirmed.

                If this was not expected, the club owner can cancel the
                invitation from Manage club, under Administrators.
                """.formatted(invitedBy.getName(), email, club.getName()));

        return toDto(saved);
    }

    /**
     * Removes an administrator, or cancels an invitation nobody has accepted.
     * Both are the same act on the same row, which is why there is one method
     * and one endpoint rather than two of each.
     *
     * <p>The row becomes REVOKED and stays. §7 asks for that explicitly: "who
     * could manage this club last spring" has to remain answerable, and a
     * DELETE would take the answer with it.
     *
     * <p>Owner rows are refused for everybody, platform admins included. An
     * owner removing themselves would leave the club with nobody able to invite
     * anyone (§36), and an owner removed by someone else is an ownership change
     * wearing a disguise — both belong in transfer, which ends the old role and
     * starts the new one in a single transaction.
     */
    @Transactional
    public void revoke(String clubId, Long assignmentId, User actor) {
        ClubAdminAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Assignment [%d] not found".formatted(assignmentId)));

        // Checked rather than assumed: @PreAuthorize cleared the caller for the
        // club named in the path, so without this an owner of one club could
        // revoke in another simply by sending its assignment id (§25).
        if (!assignment.getClub().getId().equals(clubId)) {
            throw new ResourceNotFoundException(
                    "Assignment [%d] does not belong to club [%s]".formatted(assignmentId, clubId));
        }

        if (assignment.getRole() == ClubRole.CLUB_OWNER) {
            throw new RequestValidationException(
                    "A club owner cannot be removed. Transfer ownership instead.");
        }

        if (!LIVE.contains(assignment.getStatus())) {
            throw new RequestValidationException("That person has already been removed.");
        }

        boolean wasInvitation = assignment.getStatus() == AssignmentStatus.PENDING;
        String address = addressOf(assignment);
        Club club = assignment.getClub();

        assignment.revoke(actor.getId());
        assignmentRepository.save(assignment);

        if (wasInvitation) {
            notifyClubInbox(club,
                    "An invitation to administer %s was cancelled".formatted(club.getName()),
                    """
                    %s cancelled the CampusVibe administrator invitation for %s.

                    Nothing was granted; the invitation had not been accepted.
                    """.formatted(actor.getName(), address));
            return;
        }

        mailSender.send(address,
                "You no longer administer %s".formatted(club.getName()),
                """
                Hi,

                Your administrator access to %s on CampusVibe has ended.

                Your own account is untouched. Saved events, the clubs you
                follow and your profile are all still there; only the club role
                has gone. If you think this was a mistake, speak to the club's
                owner.
                """.formatted(club.getName()));

        notifyClubInbox(club,
                "An administrator was removed from %s".formatted(club.getName()),
                """
                %s removed %s as an administrator of %s on CampusVibe.

                Their access ended immediately.
                """.formatted(actor.getName(), address, club.getName()));
    }

    /**
     * Accepts an invitation, turning it into real authority.
     *
     * <p>The signed-in account <em>is</em> the proof here — there is no token in
     * the link, because a token would be a second and weaker credential: it can
     * be forwarded, it sits in an inbox, and it shows only that whoever holds it
     * read the message. Requiring the invitee to sign in and post shows the same
     * thing and more.
     */
    @Transactional
    public ManagedClubDTO acceptInvitation(Long invitationId, User user) {
        ClubAdminAssignment invitation = claimableBy(invitationId, user);
        Club club = invitation.getClub();

        if (assignmentRepository.existsByClubIdAndUserIdAndStatus(
                club.getId(), user.getId(), AssignmentStatus.ACTIVE)) {
            throw new RequestValidationException(
                    "You already administer %s.".formatted(club.getName()));
        }

        invitation.claimBy(user);
        // Flushed here rather than at commit so that a race between two
        // invitations to the same person becomes a 400 with a sentence in it,
        // instead of escaping as a 500 after the response has been chosen.
        saveGuardingIndexes(invitation,
                "You already administer %s.".formatted(club.getName()));

        notifyClubInbox(club,
                "%s is now an administrator of %s".formatted(user.getName(), club.getName()),
                """
                %s accepted an invitation to administer %s on CampusVibe, and can
                now manage the club page and its events.

                If this was not expected, the club owner can remove them from
                Manage club, under Administrators.
                """.formatted(user.getName(), club.getName()));

        return toManagedClubDto(club, invitation.getRole());
    }

    /**
     * Declines an invitation. The row is REVOKED by the invitee rather than
     * deleted, so the owner can see it was answered instead of wondering
     * whether the mail ever arrived.
     */
    @Transactional
    public void declineInvitation(Long invitationId, User user) {
        ClubAdminAssignment invitation = claimableBy(invitationId, user);
        Club club = invitation.getClub();

        invitation.revoke(user.getId());
        assignmentRepository.save(invitation);

        notifyClubInbox(club,
                "An invitation to administer %s was declined".formatted(club.getName()),
                """
                %s declined the invitation to administer %s on CampusVibe.
                """.formatted(user.getName(), club.getName()));
    }

    // --- claiming -----------------------------------------------------------

    /**
     * Loads an invitation and proves it belongs to this account.
     *
     * <p><strong>The confirmed-address rule is the security boundary of this
     * whole feature.</strong> An invitation names an address, and matching it
     * against {@code user.getEmail()} alone would mean anyone who had registered
     * that address could claim it. Registration does not require confirming the
     * address — {@code campusvibe.auth.require-verified-email} is off by default
     * — so without this check the attack is: read a club's published exec list,
     * register the incoming treasurer's address before they do, and wait for the
     * owner to send the invitation straight to you.
     *
     * <p>Google accounts arrive confirmed and local accounts are sent a
     * confirmation link at sign-up, so for nearly everyone this costs a click
     * they have already made. Declining is held to the same rule deliberately:
     * letting an unconfirmed account decline would be a quiet way to keep a
     * rival off a club's team.
     */
    private ClubAdminAssignment claimableBy(Long invitationId, User user) {
        ClubAdminAssignment invitation = assignmentRepository.findById(invitationId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Invitation [%d] not found".formatted(invitationId)));

        boolean byAccount = invitation.getUser() != null
                && invitation.getUser().getId().equals(user.getId());
        boolean byAddress = invitation.getInvitedEmail() != null
                && invitation.getInvitedEmail().equalsIgnoreCase(user.getEmail());

        if (!byAccount && !byAddress) {
            // The same answer as a missing invitation. Confirming that some
            // other id is a real, open invitation would let anyone walk the id
            // space to learn which clubs are recruiting and when.
            throw new ResourceNotFoundException(
                    "Invitation [%d] not found".formatted(invitationId));
        }

        if (invitation.getStatus() != AssignmentStatus.PENDING) {
            throw new RequestValidationException("This invitation is no longer open.");
        }

        if (!user.isEmailVerified()) {
            // Not AccessDeniedException: that handler answers with a fixed
            // "Access denied", and this is the one refusal in the flow that the
            // person on the other end can actually do something about.
            throw new EmailNotVerifiedException(
                    "Confirm your email address before answering club invitations. "
                            + "Check your inbox for the confirmation link.");
        }

        return invitation;
    }

    // --- mail ---------------------------------------------------------------

    /**
     * The invitation itself. Two bodies rather than one because the next step
     * genuinely differs: someone with an account signs in, a stranger has to
     * sign up <em>with this address</em>, and an invitation that does not say so
     * produces an account under a personal address that can never claim it.
     */
    private void sendInvitationEmail(Club club, String email, User invitedBy, boolean hasAccount) {
        String link = mailProperties.appBaseUrl() + "/invitations";
        String next = hasAccount
                ? """
                  Sign in to CampusVibe and open the link below to accept or decline.

                  %s
                  """.formatted(link)
                : """
                  You do not have a CampusVibe account yet. Sign up using this
                  address, %s, and the invitation will be waiting for you here:

                  %s
                  """.formatted(email, link);

        mailSender.send(email,
                "%s invited you to help run %s".formatted(invitedBy.getName(), club.getName()),
                """
                Hi,

                %s invited you to be an administrator of %s on CampusVibe.
                Administrators manage the club page and the club's events.

                %s
                You keep your own CampusVibe account either way. Saved events and
                the clubs you follow stay personal to you; administering a club
                is a role you hold in that one club, and you can leave it at any
                time.

                If you were not expecting this, ignore this email. Nothing
                happens until you accept.
                """.formatted(invitedBy.getName(), club.getName(), next));
    }

    /**
     * Sends a security notice to the club's official address, when it has one.
     *
     * <p>§17 makes these notices mandatory and not opt-out, so that a club's
     * organisational inbox keeps an independent record of who joined and left
     * its management team: an administrator cannot quietly add an accomplice if
     * the club's own mailbox is told about it. Today every club's
     * {@code official_email} is NULL, because nothing can set one yet, so in
     * practice this is a no-op waiting on the platform-admin screen that fills
     * the column in. It is written now rather than then because the calls belong
     * beside the actions they describe, and retrofitting them means finding
     * every action a second time.
     */
    private void notifyClubInbox(Club club, String subject, String body) {
        String officialEmail = club.getOfficialEmail();
        if (officialEmail == null || officialEmail.isBlank()) {
            return;
        }
        mailSender.send(officialEmail, subject, body);
    }

    // --- plumbing -----------------------------------------------------------

    private ClubAdminAssignment saveGuardingIndexes(ClubAdminAssignment assignment) {
        return saveGuardingIndexes(assignment,
                "There is already an invitation waiting for that address.");
    }

    /**
     * Saves, translating the partial unique indexes into something a person can
     * act on. The checks in {@link #invite} and {@link #acceptInvitation} catch
     * these in every ordinary case; this catches the race those checks cannot —
     * two owners inviting the same person at the same moment, or one person
     * accepting two invitations to one club at once.
     */
    private ClubAdminAssignment saveGuardingIndexes(ClubAdminAssignment assignment, String message) {
        try {
            return assignmentRepository.saveAndFlush(assignment);
        } catch (DataIntegrityViolationException e) {
            throw new RequestValidationException(message);
        }
    }

    /** Whichever address this row can be reached at: the account's, or the invited one. */
    private static String addressOf(ClubAdminAssignment assignment) {
        User user = assignment.getUser();
        return user != null ? user.getEmail() : assignment.getInvitedEmail();
    }

    /**
     * Addresses are compared case-insensitively everywhere else in the
     * application, so they are stored in one form here too. Without this, an
     * invitation to Ada@x and an account at ada@x are two different people as
     * far as the unique index is concerned.
     */
    private static String normalise(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    private static ManagedClubDTO toManagedClubDto(Club club, ClubRole role) {
        return new ManagedClubDTO(
                club.getId(),
                club.getName(),
                club.getLogo(),
                club.getFollowers(),
                role,
                club.getOfficialEmail(),
                club.getOfficialEmailVerifiedAt() != null
        );
    }

    private ClubInvitationDTO toInvitationDto(ClubAdminAssignment invitation) {
        Club club = invitation.getClub();
        String invitedByName = Optional.ofNullable(invitation.getInvitedByUserId())
                .flatMap(userRepository::findById)
                .map(User::getName)
                .orElse(null);

        return new ClubInvitationDTO(
                invitation.getId(),
                club.getId(),
                club.getName(),
                club.getLogo(),
                invitation.getRole(),
                invitedByName,
                invitation.getCreatedAt()
        );
    }

    private static ClubAdminDTO toDto(ClubAdminAssignment assignment) {
        User user = assignment.getUser();
        return new ClubAdminDTO(
                assignment.getId(),
                user == null ? null : user.getId(),
                user == null ? null : user.getName(),
                user == null ? null : user.getEmail(),
                assignment.getInvitedEmail(),
                assignment.getRole(),
                assignment.getStatus(),
                assignment.getCreatedAt(),
                assignment.getActivatedAt()
        );
    }
}
