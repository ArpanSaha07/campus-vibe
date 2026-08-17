package com.campusvibe.club;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ClubRepository extends JpaRepository<Club, String> {
    // findByClubAdminId is gone with the clubs.club_admin_id column (V12).
    // "Which clubs does this user manage?" is now
    // ClubAdminAssignmentRepository.findByUserIdAndStatus, which can answer it
    // for more than one club and distinguishes owners from admins.
}
