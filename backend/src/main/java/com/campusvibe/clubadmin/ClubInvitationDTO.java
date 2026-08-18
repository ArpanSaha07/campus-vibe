package com.campusvibe.clubadmin;

import java.time.Instant;

/**
 * An invitation as the person invited sees it.
 *
 * <p>Deliberately not {@link ClubAdminDTO} turned around. That record answers
 * "who is on this team" for someone already inside the club; this one answers
 * "should I join this club" for someone outside it, and the fields differ
 * accordingly — the club's identity matters here and does not there, and the
 * other administrators' names and addresses must not travel to someone who has
 * not accepted yet.
 *
 * <p>{@code invitedByName} is included because §27 asks a confirmation screen to
 * say what is being agreed to and with whom. An invitation that says only "a
 * club invited you" is one a careful person is right to ignore.
 */
public record ClubInvitationDTO(
        Long invitationId,
        String clubId,
        String clubName,
        String clubLogo,
        ClubRole role,
        /** Null if the inviting account has since been deleted. */
        String invitedByName,
        Instant invitedAt
) {}
