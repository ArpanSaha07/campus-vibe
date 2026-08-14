package com.campusvibe.clubadmin;

import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.exception.DuplicateResourceException;
import com.campusvibe.exception.RequestValidationException;
import com.campusvibe.exception.ResourceNotFoundException;
import com.campusvibe.user.Role;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.RoleRepository;
import com.campusvibe.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class ClubAdminRequestService {

    private final ClubAdminRequestRepository requestRepository;
    private final ClubRepository clubRepository;
    private final RoleRepository roleRepository;

    public ClubAdminRequestService(ClubAdminRequestRepository requestRepository,
                                   ClubRepository clubRepository,
                                   RoleRepository roleRepository) {
        this.requestRepository = requestRepository;
        this.clubRepository = clubRepository;
        this.roleRepository = roleRepository;
    }

    @Transactional
    public ClubAdminRequestDTO create(User user, ClubAdminRequestCreateRequest request) {
        Club club = clubRepository.findById(request.clubId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Club with id [%s] not found".formatted(request.clubId())));
        if (club.getClubAdminId() != null) {
            throw new RequestValidationException("Club [%s] already has a club admin".formatted(club.getId()));
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

    @Transactional
    public ClubAdminRequestDTO approve(Long requestId) {
        ClubAdminRequest req = findPending(requestId);
        Club club = req.getClub();
        if (club.getClubAdminId() != null) {
            throw new RequestValidationException("Club [%s] already has a club admin".formatted(club.getId()));
        }
        Role clubAdminRole = roleRepository.findByName(RoleName.ROLE_CLUB_ADMIN.name())
                .orElseThrow(() -> new IllegalStateException(
                        "ROLE_CLUB_ADMIN is missing from the roles table; check Flyway migration V7"));
        User user = req.getUser();
        user.addRole(clubAdminRole);
        club.setClubAdminId(user.getId());
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
