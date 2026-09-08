package com.campusvibe.club;

import java.util.List;

/**
 * A new club.
 *
 * <p>Carries the category and tags because creation is the only moment they can
 * currently be set: {@code PUT /clubs/{id}} demands {@code canManageClub}, and
 * creating a club does not make you its owner — see the note on
 * {@code ClubController.create}. Classifying a club is also simply part of
 * describing it, so asking at creation is right regardless.
 */
public record ClubCreateRequest(
        String id,
        String name,
        String description,
        String category,
        List<String> interests
) {}
