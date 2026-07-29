package com.campusvibe.club;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ClubRepository extends JpaRepository<Club, String> {
    Optional<Club> findByClubAdminId(Long clubAdminId);
}
