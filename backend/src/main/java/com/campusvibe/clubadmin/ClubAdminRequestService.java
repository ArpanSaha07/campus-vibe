package com.campusvibe.clubadmin;

import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.exception.DuplicateResourceException;
import com.campusvibe.exception.RequestValidationException;
import com.campusvibe.exception.ResourceNotFoundException;
import com.campusvibe.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class ClubAdminRequestService {

    private final ClubAdminRequestRepository requestRepository;
    private final ClubRepository clubRepository;
    private final ClubAdminAssignmentRepository assignmentRepository;
    private final ClubAdminService clubAdminService;

    public ClubAdminRequestService(ClubAdminRequestRepository requestRepository,
                                   ClubRepository clubRepository,
                                   ClubAdminAssignmentRepository assignmentRepository,
                                   ClubAdminService clubAdminService) {
        this.requestRepository = requestRepository;
        this.clubRepository = clubRepository;
        this.assignmentRepository = assignmentRepository;
        this.clubAdminService = clubAdminService;
    }

    @Transactional
    public ClubAdminRequestDTO create(User user, ClubAdminRequestCreateRequest request) {
        Club club = clubRepository.findById(request.clubId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Club with id [%s] not found".formatted(request.clubId())));
        // Only ownerless clubs can be requested. Once a club has an owner, new
        // administrators come from that owner inviting them, not from a
        // platform admin appointing them over the owner's head.
        if (assignmentRepository.existsByClubIdAndRoleAndStatus(
                club.getId(), ClubRole.CLUB_OWNER, AssignmentStatus.ACTIVE)) {
            throw new RequestValidationException(
                    "Club [%s] already has an owner — ask them for an invitation".formatted(club.getId()));
        }
        if (requestRepository.existsByUserIdAndClubIdAndStatus(user.getId(), club.getId(), RequestStatus.PENDING)) {
            throw new DuplicateResourceException("You already have a pending request for this club");
        }
        ClubAdminRequest req = new ClubAdminRequest();
        req.setUser(user);
        req.setClub(club);
        req.setMessage(request.message());
        return toDto(requestRepository.save(req));
    }

    @Transactional(readOnly = true)
    public List<ClubAdminRequestDTO> list(RequestStatus status) {
        List<ClubAdminRequest> requests = status == null
                ? requestRepository.findAll()
                : requestRepository.findByStatus(status);
        return requests.stream().map(this::toDto).toList();
    }

    /**
     * Installs the requester as the club's first owner.
     *
     * <p>This is the platform-admin bootstrap of §9: clubs launch with nobody in
     * charge, and this is how the first person gets there. It no longer grants
     * any account-wide role — authority is the {@code club_admin_assignments}
     * row alone, scoped to this one club.
     *
     * <p>Transactional because the assignment and the request's status must
     * move together. A club with an owner but a still-PENDING request would
     * invite a second approval; an APPROVED request with no assignment would
     * leave the requester locked out of the club they were just given.
     */
    @Transactional
    public ClubAdminRequestDTO approve(Long requestId, Long approvedByUserId) {
        ClubAdminRequest req = findPending(requestId);
        // assignFirstOwner re-checks for a sitting owner and throws if there is
        // one — the request may have sat in the queue while the club was
        // claimed through another route.
        clubAdminService.assignFirstOwner(req.getClub(), req.getUser(), approvedByUserId);
        req.setStatus(RequestStatus.APPROVED);
        req.setReviewedAt(Instant.now());
        return toDto(req);
    }

    @Transactional
    public ClubAdminRequestDTO reject(Long requestId) {
        ClubAdminRequest req = findPending(requestId);
        req.setStatus(RequestStatus.REJECTED);
        req.setReviewedAt(Instant.now());
        return toDto(req);
    }

    private ClubAdminRequest findPending(Long requestId) {
        ClubAdminRequest req = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Club admin request [%s] not found".formatted(requestId)));
        if (req.getStatus() != RequestStatus.PENDING) {
            throw new RequestValidationException("Request [%s] has already been reviewed".formatted(requestId));
        }
        return req;
    }

    private ClubAdminRequestDTO toDto(ClubAdminRequest req) {
        return new ClubAdminRequestDTO(
                req.getId(),
                req.getUser().getId(),
                req.getUser().getName(),
                req.getUser().getEmail(),
                req.getClub().getId(),
                req.getClub().getName(),
                req.getMessage(),
                req.getStatus(),
                req.getRequestedAt(),
                req.getReviewedAt()
        );
    }
}
