package com.campusvibe.clubadmin;

import com.campusvibe.user.User;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/club-admin-requests")
public class ClubAdminRequestController {

    private final ClubAdminRequestService requestService;

    public ClubAdminRequestController(ClubAdminRequestService requestService) {
        this.requestService = requestService;
    }

    @PostMapping
    @PreAuthorize("hasRole('USER')")
    public ClubAdminRequestDTO create(@Valid @RequestBody ClubAdminRequestCreateRequest request,
                                      Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        return requestService.create(user, request);
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<ClubAdminRequestDTO> list(@RequestParam(required = false) RequestStatus status) {
        return requestService.list(status);
    }

    /**
     * Approving installs the requester as the club's first {@code CLUB_OWNER}.
     * The approving admin is recorded on the assignment, so "who put this
     * person in charge" is answerable later.
     */
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ClubAdminRequestDTO approve(@PathVariable Long id, Authentication authentication) {
        User actor = (User) authentication.getPrincipal();
        return requestService.approve(id, actor.getId());
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ClubAdminRequestDTO reject(@PathVariable Long id) {
        return requestService.reject(id);
    }
}
