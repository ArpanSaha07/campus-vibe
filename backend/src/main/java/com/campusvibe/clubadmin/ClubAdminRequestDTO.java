package com.campusvibe.clubadmin;

import java.time.Instant;

public record ClubAdminRequestDTO(
        Long id,
        Long userId,
        String userName,
        String userEmail,
        String clubId,
        String clubName,
        String message,
        RequestStatus status,
        Instant requestedAt,
        Instant reviewedAt
) {}
