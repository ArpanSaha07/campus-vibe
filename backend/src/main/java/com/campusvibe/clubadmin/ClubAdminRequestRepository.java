package com.campusvibe.clubadmin;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClubAdminRequestRepository extends JpaRepository<ClubAdminRequest, Long> {
    List<ClubAdminRequest> findByStatus(RequestStatus status);
    boolean existsByUserIdAndClubIdAndStatus(Long userId, String clubId, RequestStatus status);
}
