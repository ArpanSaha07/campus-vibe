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
        Instant createdAt
) {}
