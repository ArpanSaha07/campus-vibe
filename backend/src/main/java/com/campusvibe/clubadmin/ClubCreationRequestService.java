package com.campusvibe.clubadmin;

import com.campusvibe.club.Club;
import com.campusvibe.club.ClubDTO;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.club.ClubSocialLinks;
import com.campusvibe.club.ClubService;
import com.campusvibe.exception.DuplicateResourceException;
import com.campusvibe.exception.RequestValidationException;
import com.campusvibe.exception.ResourceNotFoundException;
import com.campusvibe.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * The proposal half of ADR-004: an ordinary user asks for a club, and an admin
 * approving the request creates it with the requester as its owner.
 *
 * <p>The other half is {@code POST /api/v1/clubs}, which is admin-only and
 * creates directly. Both end in {@code ClubService.createOwnedBy}, so a club is
 * never born without somebody responsible for it.
 */
@Service
public class ClubCreationRequestService {

    private final ClubCreationRequestRepository requestRepository;
    private final ClubRepository clubRepository;
    private final ClubService clubService;
    private final ClubAuditService auditService;

    public ClubCreationRequestService(ClubCreationRequestRepository requestRepository,
                                      ClubRepository clubRepository,
                                      ClubService clubService,
                                      ClubAuditService auditService) {
        this.requestRepository = requestRepository;
        this.clubRepository = clubRepository;
        this.clubService = clubService;
        this.auditService = auditService;
    }

    @Transactional
    public ClubCreationRequestDTO create(User user, ClubCreationRequestCreateRequest request) {
        String slug = normaliseSlug(request.id());

        // Checked against both stores, because a slug can be taken two ways and
        // the messages differ. An existing club is permanent; a pending proposal
        // may yet be rejected.
        if (clubRepository.existsById(slug)) {
            throw new DuplicateResourceException(
                    "A club with the id [%s] already exists".formatted(slug));
        }
        if (requestRepository.existsPendingForSlug(slug, RequestStatus.PENDING)) {
            throw new DuplicateResourceException(
                    "Somebody has already proposed a club called [%s] and it is awaiting review"
                            .formatted(slug));
        }
        // One at a time. Without this a single account can reserve every name it
        // likes, and proposals have no expiry to release them.
        if (requestRepository.existsByUserIdAndStatus(user.getId(), RequestStatus.PENDING)) {
            throw new DuplicateResourceException(
                    "You already have a club proposal awaiting review");
        }

        ClubCreationRequest req = new ClubCreationRequest();
        req.setUser(user);
        req.setProposedSlug(slug);
        req.setName(request.name());
        req.setDescription(request.description());
        req.setCategorySlug(request.category());
        if (request.interests() != null) {
            req.getInterestSlugs().addAll(request.interests());
        }
        req.setMessage(request.message());
        // Normalised here rather than at approval, so a bad link is refused
        // while the person who typed it is still looking at the form -- and so
        // an approval, which is one click on a queue, cannot be the thing that
        // fails. What is stored is our JSON, not the string the client sent.
        req.setSocialLinks(ClubSocialLinks.normalise(request.socialLinks()));
        return toDto(requestRepository.save(req));
    }

    @Transactional(readOnly = true)
    public List<ClubCreationRequestDTO> list(RequestStatus status) {
        List<ClubCreationRequest> requests = status == null
                ? requestRepository.findAllByOrderByRequestedAtAsc()
                : requestRepository.findByStatusOrderByRequestedAtAsc(status);
        return requests.stream().map(this::toDto).toList();
    }

    /**
     * Creates the proposed club and installs the requester as its owner.
     *
     * <p>One transaction, and it has to be: a club with no owner is the P0 this
     * whole unit exists to close, and an APPROVED request with no club is a
     * proposal that can never be approved again.
     *
     * <p>The slug is re-checked here even though a partial unique index reserved
     * it at submission. The reservation only covers other <em>proposals</em> --
     * a platform admin creating the same slug directly writes to {@code clubs},
     * which that index cannot see. {@code createOwnedBy} would raise
     * {@code DuplicateResourceException} for it anyway, but the message would
     * talk about a club id rather than telling the reviewer what to do with the
     * proposal in front of them.
     */
    @Transactional
    public ClubCreationRequestDTO approve(Long requestId, User approver) {
        ClubCreationRequest req = findPending(requestId);

        if (clubRepository.existsById(req.getProposedSlug())) {
            throw new RequestValidationException(
                    ("A club with the id [%s] was created while this proposal was waiting, so it "
                            + "cannot be approved. Reject it and ask for a different name.")
                            .formatted(req.getProposedSlug()));
        }

        Club club = new Club();
        club.setId(req.getProposedSlug());
        club.setName(req.getName());
        club.setDescription(req.getDescription());
        // Set before createOwnedBy, like every other field here, because
        // Club.id is assigned rather than generated: saveAndFlush goes through
        // em.merge and returns a different managed instance, so anything set on
        // this object afterwards would be written to a detached copy and
        // persisted nowhere (BUG-037, ADR-002). Already normalised at
        // submission, so this is a copy and not a second validation.
        club.setSocialLinks(req.getSocialLinks());
        // Seeded from the same contact address, so a club created by approval
        // has its recovery channel from birth rather than waiting for an admin
        // to add one by hand (Arpan, 2026-09-10). Read out of the links rather
        // than held in a second column on the proposal: there is one address on
        // that form, and two copies of it would eventually disagree. Unverified,
        // like every administratively written address -- only the mail round
        // trip may say otherwise (ADR-006).
        club.setOfficialEmail(ClubSocialLinks.officialEmailFrom(req.getSocialLinks()));

        ClubDTO created = clubService.createOwnedBy(
                club,
                req.getCategorySlug(),
                new ArrayList<>(req.getInterestSlugs()),
                req.getUser(),
                approver);

        req.setStatus(RequestStatus.APPROVED);
        req.setReviewedAt(Instant.now());
        req.setReviewedByUserId(approver.getId());
        req.setCreatedClubId(created.id());

        // CLUB_CREATED and CLUB_OWNER_INSTALLED are both written by
        // createOwnedBy, which is the one place both creation paths pass
        // through. This entry says the club arrived by proposal rather than by
        // an admin filling in the form, which neither of those can know.
        auditService.record(created.id(), approver, ClubAuditAction.CLUB_PROPOSAL_APPROVED,
                AuditEntityType.CLUB, created.id(),
                Map.of("requestedBy", req.getUser().getEmail()));

        return toDto(req);
    }

    @Transactional
    public ClubCreationRequestDTO reject(Long requestId, User reviewer) {
        ClubCreationRequest req = findPending(requestId);
        // No reason field, matching ClubAdminRequest. Rejecting creates nothing,
        // and releases the slug reservation by leaving PENDING.
        req.setStatus(RequestStatus.REJECTED);
        req.setReviewedAt(Instant.now());
        req.setReviewedByUserId(reviewer.getId());
        return toDto(req);
    }

    private ClubCreationRequest findPending(Long requestId) {
        ClubCreationRequest req = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Club creation request [%s] not found".formatted(requestId)));
        if (req.getStatus() != RequestStatus.PENDING) {
            throw new RequestValidationException(
                    "Request [%s] has already been reviewed".formatted(requestId));
        }
        return req;
    }

    /**
     * The slug as it will become {@code clubs.id}.
     *
     * <p>The frontend derives it from the name, but it arrives over HTTP so it
     * is normalised again here rather than trusted -- and the reservation index
     * compares {@code lower(proposed_slug)}, so storing a mixed-case value would
     * make the stored row and the index disagree about what was reserved.
     */
    private static String normaliseSlug(String slug) {
        return slug == null ? null : slug.trim().toLowerCase(Locale.ROOT);
    }

    private ClubCreationRequestDTO toDto(ClubCreationRequest req) {
        return new ClubCreationRequestDTO(
                req.getId(),
                req.getUser().getId(),
                req.getUser().getName(),
                req.getUser().getEmail(),
                req.getProposedSlug(),
                req.getName(),
                req.getDescription(),
                req.getCategorySlug(),
                List.copyOf(req.getInterestSlugs()),
                req.getMessage(),
                req.getSocialLinks(),
                req.getStatus(),
                req.getRequestedAt(),
                req.getReviewedAt(),
                req.getCreatedClubId()
        );
    }
}
