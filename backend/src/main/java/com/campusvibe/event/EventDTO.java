package com.campusvibe.event;

import java.time.Instant;
import java.util.List;

public record EventDTO(
        Long id,
        String title,
        String description,
        Instant dateTime,
        Instant createdAt,
        String location,
        String price,
        String organizerId,
        Integer followers,
        List<String> images,
        Boolean promoted,
        Integer capacity,
        Integer registered,
        List<String> categories
) {}
