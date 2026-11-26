package com.campusvibe.instagram;

import com.campusvibe.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** The admin dashboard's Instagram import section. Platform admins only. */
@RestController
@RequestMapping("/api/v1/admin/instagram")
@PreAuthorize("hasRole('ADMIN')")
public class AdminInstagramController {

    public record AccountCountRequest(Integer accountCount) {}

    private final AdminInstagramService service;

    public AdminInstagramController(AdminInstagramService service) {
        this.service = service;
    }

    @GetMapping
    public AdminInstagramDTO get() {
        return service.get();
    }

    @PutMapping("/account-count")
    public AdminInstagramDTO setAccountCount(@RequestBody AccountCountRequest request,
                                             Authentication authentication) {
        User admin = (User) authentication.getPrincipal();
        return service.setAccountCount(request.accountCount(), admin.getId());
    }

    /** 202: the run is started in the background and the page polls for its end. */
    @PostMapping("/import")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public AdminInstagramDTO importNow() {
        return service.importNow();
    }
}
