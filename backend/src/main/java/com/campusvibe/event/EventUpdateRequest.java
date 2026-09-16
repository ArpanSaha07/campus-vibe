package com.campusvibe.event;

import java.time.Instant;
import java.util.List;

/**
 * Editing an event (CEM-10).
 *
 * <p>Full replacement, unlike {@code ClubUpdateRequest}'s patch semantics: the
 * edit form always sends every field, so a null here means cleared, which is
 * the only way to remove a location, a price or a capacity. Title, start and
 * end are the three a null cannot clear -- all NOT NULL -- and are refused.
 *
 * <p>No {@code organizerId}. An event belongs to the club that created it;
 * moving or co-hosting it is D-10, and a field here would be that decision made
 * by accident.
 */
public record EventUpdateRequest(
        String title,
        String description,
        Instant dateTime,
        Instant endTime,
        String location,
        String price,
        Integer capacity,
        List<String> topics,
        List<String> formats
) {}
