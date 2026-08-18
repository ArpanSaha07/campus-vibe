package com.campusvibe.clubadmin;

import java.time.Instant;

/**
 * One row of a club's Administrators list.
 *
 * <p>Readable by the club's own management team and by platform admins, which
 * is why it carries the member's email: the owner needs to tell two people with
 * the same first name apart before removing one of them. It is not reachable
 * from any public club endpoint.
 */
public record ClubAdminDTO(
        Long assignmentId,
        /** Null while an invitation is outstanding to an address with no account. */
        Long userId,
        /** Null in the same case — there is no name to show until someone claims it. */
        String userName,
        String userEmail,
        /**
         * The address the owner invited, present on every invitation and null on
         * rows that were never one (the V12 backfill, and the first owner
         * installed by approving a club-admin request).
         *
         * <p>The Administrators list renders this when {@code userName} is
         * absent, which is what lets a pending invitation to a stranger appear
         * as a row the owner can see and cancel.
         */
        String invitedEmail,
        ClubRole role,
        AssignmentStatus status,
        Instant createdAt,
        Instant activatedAt
) {}
