package com.campusvibe.admin;

import com.campusvibe.club.ClubRepository;
import com.campusvibe.user.ApprovedClubAdmin;
import com.campusvibe.user.ApprovedClubAdminRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1/admin/approvals")
public class AdminApprovalController {

    private final ApprovedClubAdminRepository repository;
    private final ClubRepository clubRepository;

    public AdminApprovalController(ApprovedClubAdminRepository repository, ClubRepository clubRepository) {
        this.repository = repository;
        this.clubRepository = clubRepository;
    }

    @PostMapping("/request")
    public void request(@RequestParam String email) {
        if (repository.existsById(email)) return;
        ApprovedClubAdmin req = new ApprovedClubAdmin();
        req.setEmail(email);
        repository.save(req);
    }

    @PostMapping("/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public void approve(@RequestParam String email, @RequestParam String clubId) {
        ApprovedClubAdmin aca = repository.findById(email).orElseGet(() -> {
            ApprovedClubAdmin a = new ApprovedClubAdmin();
            a.setEmail(email);
            return a;
        });
        aca.setClub(clubRepository.findById(clubId).orElseThrow());
        aca.setApproved(true);
        aca.setApprovedAt(Instant.now());
        repository.save(aca);
    }
}
