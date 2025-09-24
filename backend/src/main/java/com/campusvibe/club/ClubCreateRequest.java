package com.campusvibe.club;

public record ClubCreateRequest(
        String id,
        String name,
        String description
) {}
