package com.campusvibe.clubadmin;

import com.campusvibe.auth.EmailNotVerifiedException;
import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.exception.RequestValidationException;
import com.campusvibe.exception.ResourceNotFoundException;
import com.campusvibe.mail.AppMailProperties;
import com.campusvibe.mail.MailSender;
import com.campusvibe.user.User;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Handing a club to its next owner.
 *
 * <p>Its own service rather than more of {@link ClubAdminService}, as §34
 * suggests, because it is the only thing in the system that moves authority
 * between two people at once. Everything here exists to make that one act
 * atomic: §9 says a club must never be left with zero or two owners, and a club
 * in either state cannot fix itself — there is nobody with the authority to.
 *
 * <p>Authorisation is at the controller, as everywhere else, with the same one
 * exception: whether a transfer is <em>yours</em> to accept needs the row in
 * hand, so {@link #answerableBy} does it here.
 */
@Service
public class ClubOwnershipService {

    private final ClubOwnershipTransferRepository transferRepository;
    private final ClubAdminAssignmentRepository assignmentRepository;
    private final ClubRepository clubRepository;
    private final MailSender mailSender;
    private final AppMailProperties mailProperties;

    public ClubOwnershipService(ClubOwnershipTransferRepository transferRepository,
                                ClubAdminAssignmentRepository assignmentRepository,
                                ClubRepository clubRepository,
                                MailSender mailSender,
                                AppMailProperties mailProperties) {
        this.transferRepository = transferRepository;
        this.assignmentRepository = assignmentRepository;
        this.clubRepository = clubRepository;
        this.mailSender = mailSender;
        this.mailProperties = mailProperties;
    }

    // --- reads --------------------------------------------------------------

    /** The club's handover in flight, if there is one. */
    @Transactional(readOnly = true)
    public Optional<OwnershipTransferDTO> pendingFor(String clubId) {
        return transferRepository.findByClubIdAndStatus(clubId, TransferStatus.PENDING)
                .map(ClubOwnershipService::toDto);
    }

    /** Handovers waiting on this person to answer, across every club. */
    @Transactional(readOnly = true)
    public List<OwnershipTransferDTO> awaiting(Long userId) {
        return transferRepository
                .findByToUserIdAndStatusOrderByCreatedAtAsc(userId, TransferStatus.PENDING)
                .stream()
                .map(ClubOwnershipService::toDto)
                .toList();
    }

    // --- starting and withdrawing -------------------------------------------

    /**
     * Offers the club to one of its admins.
     *
     * <p>Nothing changes here. The row is PENDING, the sitting owner is still
     * the owner, and the successor is still an admin — §8 requires the incoming
     * owner to accept, and being handed a club without agreeing to it is worse
     * than being handed an admin role without agreeing to it, which §6 already
     * forbids.
     *
     * <p>The successor must be an <em>active admin of this club</em>. That is
     * the eligibility rule, and it is doing real work: becoming an admin means
     * having accepted an invitation, which means having proven the address and
     * agreed to be involved. Offering the club to an arbitrary address would
     * collapse two decisions — should this person help run the club, and should
     * they own it — into one click.
     */
    @Transactional
    public OwnershipTransferDTO offer(String clubId, Long toUserId,
                                      ClubOwnershipTransfer.OutgoingOwner outgoingBecomes,
                                      User actor) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Club [%s] not found".formatted(clubId)));

        // The sitting owner, read from the table rather than taken from the
        // caller: a platform ADMIN passes isClubOwner too, and an admin acting
        // on a club must not be recorded as the person who handed it over.
        ClubAdminAssignment ownerRow = activeOwnerOf(clubId);

        if (ownerRow.getUser().getId().equals(toUserId)) {
            throw new RequestValidationException(
                    "That is already the club's owner.");
        }

        ClubAdminAssignment successorRow = assignmentRepository
                .findByClubIdAndUserIdAndStatus(clubId, toUserId, AssignmentStatus.ACTIVE)
                .filter(a -> a.getRole() == ClubRole.CLUB_ADMIN)
                .orElseThrow(() -> new RequestValidationException(
                        "Ownership can only be handed to one of this club's admins. "
                                + "Invite them as an admin first."));

        if (transferRepository.findByClubIdAndStatus(clubId, TransferStatus.PENDING).isPresent()) {
            throw new RequestValidationException(
                    "This club already has a handover waiting. Cancel it before starting another.");
        }

        ClubOwnershipTransfer transfer = new ClubOwnershipTransfer();
        transfer.setClub(club);
        transfer.setFromUser(ownerRow.getUser());
        transfer.setToUser(successorRow.getUser());
        transfer.setOutgoingBecomes(outgoingBecomes);
        transfer.setStatus(TransferStatus.PENDING);

        ClubOwnershipTransfer saved;
        try {
            saved = transferRepository.saveAndFlush(transfer);
        } catch (DataIntegrityViolationException e) {
            // one_pending_transfer_per_club, under a race the check above
            // cannot see.
            throw new RequestValidationException(
                    "This club already has a handover waiting. Cancel it before starting another.");
        }

        User successor = successorRow.getUser();
        mailSender.send(successor.getEmail(),
                "%s wants to hand you %s".formatted(actor.getName(), club.getName()),
                """
                Hi %s,

                %s has offered to make you the owner of %s on CampusVibe.

                The club owner manages the club page and its events like any
                admin, and is additionally the only person who can invite
                admins, remove them, and hand the club on again. Every club has
                exactly one.

                Nothing has changed yet. Sign in and open Invitations to accept
                or decline:

                %s

                If you were not expecting this, speak to %s before accepting.
                """.formatted(successor.getName(), actor.getName(), club.getName(),
                        mailProperties.appBaseUrl() + "/invitations", actor.getName()));

        notifyClubInbox(club,
                "A handover of %s is waiting".formatted(club.getName()),
                """
                %s has offered ownership of %s on CampusVibe to %s.

                Ownership does not move until %s accepts. If this was not
                expected, the current owner can cancel it from Manage club,
                under Administrators.
                """.formatted(actor.getName(), club.getName(), successor.getName(),
                        successor.getName()));

        return toDto(saved);
    }

    /** The outgoing owner changing their mind, before the successor answers. */
    @Transactional
    public void cancel(String clubId, User actor) {
        ClubOwnershipTransfer transfer = transferRepository
                .findByClubIdAndStatus(clubId, TransferStatus.PENDING)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Club [%s] has no handover waiting".formatted(clubId)));

        transfer.resolveAs(TransferStatus.CANCELLED);
        transferRepository.save(transfer);

        Club club = transfer.getClub();
        mailSender.send(transfer.getToUser().getEmail(),
                "The handover of %s was cancelled".formatted(club.getName()),
                """
                Hi %s,

                %s has withdrawn the offer to make you the owner of %s.

                Your admin role is unchanged -- you can still manage the club
                page and its events exactly as before.
                """.formatted(transfer.getToUser().getName(), actor.getName(), club.getName()));
    }

    /**
     * Cancels a pending handover that names this person as the successor.
     *
     * <p>Called when someone is removed from a club. A handover offered to
     * somebody who is no longer on the team can never complete, and leaving it
     * PENDING would hold the club's one transfer slot against it.
     */
    @Transactional
    public void cancelTransfersTo(String clubId, Long userId) {
        transferRepository
                .findByClubIdAndStatusAndToUserId(clubId, TransferStatus.PENDING, userId)
                .forEach(transfer -> {
                    transfer.resolveAs(TransferStatus.CANCELLED);
                    transferRepository.save(transfer);
                });
    }

    // --- answering ----------------------------------------------------------

    /**
     * Accepts the club. This is the one method in the application that moves
     * authority between two people.
     *
     * <p><strong>Everything is re-checked here, not trusted from the offer.</strong>
     * An offer can sit for days: the successor may have been removed from the
     * club since, and the club's owner may have changed by some other route. A
     * transfer that promoted someone who is no longer on the team, or demoted
     * someone who is no longer the owner, would be worse than one that refuses.
     */
    @Transactional
    public ManagedClubDTO accept(Long transferId, User user) {
        ClubOwnershipTransfer transfer = answerableBy(transferId, user);
        Club club = transfer.getClub();
        String clubId = club.getId();

        ClubAdminAssignment ownerRow = activeOwnerOf(clubId);
        if (!ownerRow.getUser().getId().equals(transfer.getFromUser().getId())) {
            throw new RequestValidationException(
                    "This club's owner has changed since the handover was offered. "
                            + "Ask the current owner to start it again.");
        }

        ClubAdminAssignment successorRow = assignmentRepository
                .findByClubIdAndUserIdAndStatus(clubId, user.getId(), AssignmentStatus.ACTIVE)
                .filter(a -> a.getRole() == ClubRole.CLUB_ADMIN)
                .orElseThrow(() -> new RequestValidationException(
                        "You are no longer an admin of this club, so ownership cannot pass to you."));

        // ORDER IS LOAD-BEARING, and the two flushes are what pin it.
        //
        // one_active_owner_per_club is a partial unique INDEX, and PostgreSQL
        // checks those per statement -- a partial index cannot be declared
        // DEFERRABLE, so there is no way to let both rows be owners for an
        // instant and sort it out at commit. The old owner has to stop being
        // one before the new owner starts.
        //
        // Measured, not assumed: replacing both saveAndFlush calls with save()
        // still passes the whole suite today, because Hibernate happens to
        // flush these two updates in the order they were dirtied. That is not
        // a documented guarantee for two updates to the same entity type, and
        // if it ever changed the failure would be a constraint violation on an
        // index nobody would think to suspect, in the one operation that must
        // not half-happen. The flushes cost one extra round trip on an action
        // a club performs once a year. Both still sit inside one transaction,
        // so a failure on the second rolls the first back and the club keeps
        // the owner it had.
        if (transfer.getOutgoingBecomes() == ClubOwnershipTransfer.OutgoingOwner.REVOKED) {
            // Revoked by the outgoing owner themselves: they chose to leave
            // when they started the handover, and recording the successor here
            // would read as the new owner's first act being to remove the old.
            ownerRow.revoke(transfer.getFromUser().getId());
        } else {
            ownerRow.setRole(ClubRole.CLUB_ADMIN);
        }
        assignmentRepository.saveAndFlush(ownerRow);

        successorRow.setRole(ClubRole.CLUB_OWNER);
        assignmentRepository.saveAndFlush(successorRow);

        transfer.resolveAs(TransferStatus.ACCEPTED);
        transferRepository.save(transfer);

        User outgoing = transfer.getFromUser();
        boolean stayed = transfer.getOutgoingBecomes() == ClubOwnershipTransfer.OutgoingOwner.CLUB_ADMIN;
        mailSender.send(outgoing.getEmail(),
                "%s is now the owner of %s".formatted(user.getName(), club.getName()),
                """
                Hi %s,

                %s has accepted ownership of %s on CampusVibe.

                %s
                """.formatted(outgoing.getName(), user.getName(), club.getName(),
                        stayed
                                ? "You are still an admin of the club and can manage its page and events."
                                : "Your administrator access to the club has ended, as you chose when you started the handover."));

        notifyClubInbox(club,
                "%s is now the owner of %s".formatted(user.getName(), club.getName()),
                """
                Ownership of %s on CampusVibe has passed from %s to %s.

                %s

                If this was not expected, contact CampusVibe -- an ownership
                change cannot be undone by the club itself.
                """.formatted(club.getName(), outgoing.getName(), user.getName(),
                        stayed
                                ? "%s remains an admin of the club.".formatted(outgoing.getName())
                                : "%s is no longer an administrator.".formatted(outgoing.getName())));

        return new ManagedClubDTO(
                clubId,
                club.getName(),
                club.getLogo(),
                club.getFollowers(),
                ClubRole.CLUB_OWNER,
                club.getOfficialEmail(),
                club.getOfficialEmailVerifiedAt() != null
        );
    }

    /** Declining. The successor keeps the admin role they already had. */
    @Transactional
    public void decline(Long transferId, User user) {
        ClubOwnershipTransfer transfer = answerableBy(transferId, user);
        Club club = transfer.getClub();

        transfer.resolveAs(TransferStatus.DECLINED);
        transferRepository.save(transfer);

        mailSender.send(transfer.getFromUser().getEmail(),
                "%s declined ownership of %s".formatted(user.getName(), club.getName()),
                """
                Hi %s,

                %s has declined the offer to own %s. You are still the club's
                owner, and %s is still an admin.
                """.formatted(transfer.getFromUser().getName(), user.getName(),
                        club.getName(), user.getName()));
    }

    /**
     * Loads a transfer and proves it is this person's to answer.
     *
     * <p>Held to the same confirmed-address rule as invitations, and for one
     * reason: every path that grants authority in this application requires the
     * account to have proven its address, and a rule with an exception in it is
     * a rule nobody can state. In practice the successor is already an active
     * admin, which they could only have become by accepting an invitation,
     * which already required it — so this refuses nobody who arrived through
     * the product, and catches an admin row created by any other means.
     */
    private ClubOwnershipTransfer answerableBy(Long transferId, User user) {
        ClubOwnershipTransfer transfer = transferRepository.findById(transferId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Handover [%d] not found".formatted(transferId)));

        if (!transfer.getToUser().getId().equals(user.getId())) {
            // Same answer as a missing row: whether some other club is being
            // handed over is not this caller's business.
            throw new ResourceNotFoundException(
                    "Handover [%d] not found".formatted(transferId));
        }

        if (!transfer.isPending()) {
            throw new RequestValidationException("This handover is no longer open.");
        }

        if (!user.isEmailVerified()) {
            throw new EmailNotVerifiedException(
                    "Confirm your email address before accepting a club. "
                            + "Check your inbox for the confirmation link.");
        }

        return transfer;
    }

    // --- plumbing -----------------------------------------------------------

    /**
     * The club's sitting owner.
     *
     * <p>A club with no active owner is a real state — every club starts that
     * way until a platform admin approves the first request — so this is a
     * refusal with a sentence rather than an assertion.
     */
    private ClubAdminAssignment activeOwnerOf(String clubId) {
        return assignmentRepository
                .findByClubIdAndRoleAndStatus(clubId, ClubRole.CLUB_OWNER, AssignmentStatus.ACTIVE)
                .orElseThrow(() -> new RequestValidationException(
                        "This club has no owner to hand over from."));
    }

    /** §17, same as {@code ClubAdminService}: a no-op until a club has an address. */
    private void notifyClubInbox(Club club, String subject, String body) {
        String officialEmail = club.getOfficialEmail();
        if (officialEmail == null || officialEmail.isBlank()) {
            return;
        }
        mailSender.send(officialEmail, subject, body);
    }

    private static OwnershipTransferDTO toDto(ClubOwnershipTransfer transfer) {
        Club club = transfer.getClub();
        User from = transfer.getFromUser();
        User to = transfer.getToUser();
        return new OwnershipTransferDTO(
                transfer.getId(),
                club.getId(),
                club.getName(),
                club.getLogo(),
                from.getId(),
                from.getName(),
                to.getId(),
                to.getName(),
                transfer.getOutgoingBecomes(),
                transfer.getStatus(),
                transfer.getCreatedAt()
        );
    }
}
