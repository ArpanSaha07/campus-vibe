package com.campusvibe.event;

import java.time.Instant;
import java.util.List;

public record EventCreateRequest(
        String title,
        String description,
        Instant dateTime,
        String location,
        String price,
        String organizerId,
        Integer capacity,
        List<String> categories
) {}
