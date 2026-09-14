package com.campusvibe.club;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

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
 * see the note on {@code Club.id} and {@code clubSlug} on the frontend.
 *
 * <p><strong>{@code officialEmail} was deliberately absent until 2026-09-10</strong>,
 * on the reasoning that writing that address must always clear its verified
 * stamp, which is what {@code ClubAdminService.setOfficialEmail} is for
 * (ADR-006). That reasoning is about a club which already exists and already
 * has a stamp; at creation there is neither, so it never reached this case —
 * and its absence meant every club started with no recovery address at all
 * until somebody went back and added one by hand. It is seeded here from the
 * contact email the form already collects (Arpan, 2026-09-10). The rule itself
 * is unchanged and still binds everywhere else: a seeded address is
 * <em>unverified</em>, and only the mail round trip may ever say otherwise.
 */
public record ClubCreateRequest(
        String id,
        String name,
        String description,
        String category,
        List<String> interests,
        /**
         * The club's own address, seeded from the form's contact email and then
         * independent of it: this one is the recovery channel and only a
         * platform admin may change it, that one is public and owner-editable
         * ({@code Club.java:36-42}). Optional — a club with no address is the
         * state every club was in before this field existed.
         */
        @Email(message = "The club email must be a valid email address")
        @Size(max = 255) String officialEmail
) {}
