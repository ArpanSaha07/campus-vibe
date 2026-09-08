package com.campusvibe.club;

import java.util.List;

public record ClubUpdateRequest(
        String name,
        String description,
        String socialLinks,
        // Null means untouched, matching every other field on this record.
        // Clearing a category is not offered: the form always sends one, and
        // `general` exists precisely so there is something true to send.
        String category,
        List<String> interests
) {}
