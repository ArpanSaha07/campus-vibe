package com.campusvibe.club;

public record ClubUpdateRequest(
        String name,
        String description,
        String socialLinks
) {}
