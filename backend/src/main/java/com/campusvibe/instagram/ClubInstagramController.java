package com.campusvibe.instagram;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * The club dashboard's Instagram section. Owners and admins alike, like every
 * other dashboard section; {@code canManageClub} re-derives that from the
 * database on every call.
 */
@RestController
@RequestMapping("/api/v1/clubs/{clubId}/instagram")
public class ClubInstagramController {

    private final ClubInstagramService service;

    public ClubInstagramController(ClubInstagramService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("@clubPermissionService.canManageClub(authentication, #clubId)")
    public ClubInstagramDTO get(@PathVariable String clubId) {
        return service.get(clubId);
    }

    @PutMapping
    @PreAuthorize("@clubPermissionService.canManageClub(authentication, #clubId)")
    public ClubInstagramDTO update(@PathVariable String clubId, @RequestBody ClubInstagramUpdateRequest request) {
        return service.update(clubId, request);
    }

    /** 202: the run is started in the background and the page polls for its end. */
    @PostMapping("/import")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @PreAuthorize("@clubPermissionService.canManageClub(authentication, #clubId)")
    public ClubInstagramDTO importNow(@PathVariable String clubId) {
        return service.importNow(clubId);
    }
}
