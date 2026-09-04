package com.campusvibe.club;

import java.time.Instant;
import java.util.List;

public record ClubDTO(
        String id,
        String name,
        String description,
        Integer followers,
        String logo,
        String socialLinks,
        Boolean featured,
        List<String> images,
        Instant createdAt,
        // The category slug, or null while nobody has classified this club.
        // The label comes from GET /api/v1/club-categories.
        String category,
        // interest_catalogue slugs. Labels come from GET /api/v1/interests.
        List<String> interests
) {}
