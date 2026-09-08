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
        // The club's display name, alongside its id. Every surface that shows an
        // event shows who runs it, and without this the frontend had to either
        // fetch the club per card or guess the name from the slug.
        String organizerName,
        Integer followers,
        List<String> images,
        Boolean promoted,
        Integer capacity,
        Integer registered,
        // Two fields, not one merged array. A single list would put `workshop`
        // beside `robotics` with nothing saying which is which, and every
        // consumer would have to look each value up to find out. Both carry
        // slugs; labels come from GET /api/v1/event-formats and
        // GET /api/v1/interests.
        List<String> topics,
        List<String> formats
) {}
