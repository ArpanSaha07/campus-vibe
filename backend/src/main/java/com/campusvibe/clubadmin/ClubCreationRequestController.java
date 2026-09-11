package com.campusvibe.clubadmin;

import com.campusvibe.user.User;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Proposing a club, and reviewing the proposals.
 *
 * <p>The ordinary user's route to a club since ADR-004 moved
 * {@code POST /api/v1/clubs} behind {@code hasRole('ADMIN')}. Nothing here
 * writes to {@code clubs} except {@code approve}, which creates the club and
 * installs the requester as its owner in one transaction.
 *
 * <p>Sits under its own path rather than {@code /api/v1/clubs/...} on purpose:
 * a proposal is not a club, and the public-GET matcher in
 * {@code SecurityFilterChainConfig} covers {@code /api/v1/clubs/**}.
 */
@RestController
@RequestMapping("/api/v1/club-creation-requests")
public class ClubCreationRequestController {

    private final ClubCreationRequestService requestService;

    public ClubCreationRequestController(ClubCreationRequestService requestService) {
        this.requestService = requestService;
    }

    @PostMapping
    @PreAuthorize("hasRole('USER')")
    public ClubCreationRequestDTO create(@Valid @RequestBody ClubCreationRequestCreateRequest request,
                                         Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        return requestService.create(user, request);
    }

    /**
     * The review queue. ADMIN only — a proposal names its requester and their
     * address, and an unreviewed one is nobody else's business.
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<ClubCreationRequestDTO> list(@RequestParam(required = false) RequestStatus status) {
        return requestService.list(status);
    }

    /**
     * Approving creates the club and makes the requester its {@code CLUB_OWNER}.
     * The approving admin is recorded on both the request and the assignment.
     */
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ClubCreationRequestDTO approve(@PathVariable Long id, Authentication authentication) {
        User actor = (User) authentication.getPrincipal();
        return requestService.approve(id, actor);
    }

    /** Rejecting creates nothing and carries no reason, matching a club-admin request. */
    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ClubCreationRequestDTO reject(@PathVariable Long id, Authentication authentication) {
        User actor = (User) authentication.getPrincipal();
        return requestService.reject(id, actor);
    }
}
