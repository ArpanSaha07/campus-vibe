package com.campusvibe.event;

import java.time.Instant;
import java.util.List;

public record EventDTO(
        Long id,
        String title,
        String description,
        Instant dateTime,
        Instant endTime,
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
        List<String> formats,
        // Where the event came from when it was imported from Instagram: the
        // post, the story while it is still up, or the account's profile.
        // Null for events typed into CampusVibe. A card with one links there.
        String sourceUrl
) {
    /** Every field but sourceUrl, for events that were not imported. */
    public EventDTO(Long id, String title, String description, Instant dateTime, Instant endTime,
                    Instant createdAt, String location, String price, String organizerId,
                    String organizerName, Integer followers, List<String> images, Boolean promoted,
                    Integer capacity, Integer registered, List<String> topics, List<String> formats) {
        this(id, title, description, dateTime, endTime, createdAt, location, price, organizerId,
                organizerName, followers, images, promoted, capacity, registered, topics, formats, null);
    }
}
