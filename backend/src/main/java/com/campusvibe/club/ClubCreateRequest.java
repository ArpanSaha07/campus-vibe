package com.campusvibe.club;

import java.util.List;

/**
 * A new club.
 *
 * <p>Carries the category and tags because classifying a club is part of
 * describing it, so asking at creation is right. It is no longer the only
 * moment they can be set — the reason it once was, that creating a club did not
 * make you its owner, stopped being true with ADR-004: the creating admin is
 * installed as CLUB_OWNER in the same transaction and so passes
 * {@code canManageClub} on {@code PUT /clubs/{id}} immediately.
 *
 * <p>{@code id} is the slug, chosen by the client rather than generated here —
 * see the note on {@code Club.id} and {@code clubSlug} on the frontend. There
 * is deliberately no field for {@code officialEmail}: writing it must always
 * clear its verified stamp, which is what {@code ClubAdminService.setOfficialEmail}
 * is for (ADR-006).
 */
public record ClubCreateRequest(
        String id,
        String name,
        String description,
        String category,
        List<String> interests
) {}
