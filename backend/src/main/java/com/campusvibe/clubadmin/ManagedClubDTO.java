package com.campusvibe.clubadmin;

/**
 * A club the signed-in user may manage, and the authority they hold over it.
 *
 * <p>Separate from {@code ClubDTO} rather than an extension of it for one
 * reason: {@code officialEmail}. That address is the club's verification and
 * recovery channel and must never appear on a public club page, so it lives on
 * a DTO that only the management endpoints can return.
 *
 * <p>Lean on purpose — the dashboard's picker and overview need identity, a
 * follower count and the caller's role. Anything richer is a
 * {@code GET /api/v1/clubs/{id}} away.
 */
public record ManagedClubDTO(
        String clubId,
        String clubName,
        String logo,
        Integer followers,
        /**
         * The caller's role in this club, or null when they are a platform
         * ADMIN with no assignment here — they may manage the club without
         * holding a role in it. Always present in the managed-clubs list,
         * which only contains clubs the caller actually has an assignment in.
         */
        ClubRole role,
        /** Null until a platform admin sets one. Administrator workflows fall
         *  back to invitee acceptance alone while it is absent. */
        String officialEmail,
        boolean officialEmailVerified
) {}
