package com.campusvibe.clubadmin;

import java.time.Instant;

/**
 * One row of a club's Administrators list.
 *
 * <p>Readable by the club's own management team and by platform admins, which
 * is why it carries the member's email: the owner needs to tell two people with
 * the same first name apart before removing one of them. It is not reachable
 * from any public club endpoint.
 */
public record ClubAdminDTO(
        Long assignmentId,
        Long userId,
        String userName,
        String userEmail,
        ClubRole role,
        AssignmentStatus status,
        Instant createdAt,
        Instant activatedAt
) {}
