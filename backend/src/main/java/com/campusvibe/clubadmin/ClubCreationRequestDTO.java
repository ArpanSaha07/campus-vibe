package com.campusvibe.clubadmin;

import java.time.Instant;
import java.util.List;

/**
 * A proposal as the admin queue and the requester see it.
 *
 * <p>Carries the requester's name and email for the same reason
 * {@link ClubAdminRequestDTO} does: the reviewer is deciding about a person as
 * much as about a club, and a queue that shows only a slug cannot be reviewed.
 */
public record ClubCreationRequestDTO(
        Long id,
        Long userId,
        String userName,
        String userEmail,
        String proposedSlug,
        String name,
        String description,
        String category,
        List<String> interests,
        String message,
        /**
         * The four contact values as the JSON string the club will hold, or null
         * when the requester left every one blank. The review queue renders them
         * so a reviewer deciding whether a club is real can look at its site.
         */
        String socialLinks,
        RequestStatus status,
        Instant requestedAt,
        Instant reviewedAt,
        String createdClubId
) {}
