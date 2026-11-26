package com.campusvibe.instagram;

import java.time.Instant;

/**
 * A club's Instagram connection, as its dashboard shows it.
 *
 * @param handle              the handle on the club's contact links, without @, or null
 * @param autoImport          whether scheduled runs import this account
 * @param importAvailable     false when the server has no fetcher or no Claude key,
 *                            so Import now would do nothing
 * @param running             this club's own Import now run is under way; a
 *                            scheduled run over other accounts never sets it
 * @param lastImportedAt      when this account was last fetched, by any run
 * @param nextImportAllowedAt when Import now opens again after the cooldown, or null
 * @param eventsFound         events found on this account so far, by any run
 * @param lastRunStatus       the club's latest Import now run: RUNNING, SUCCEEDED,
 *                            PARTIAL or FAILED; null if it never pressed it
 * @param lastRunPublished    events that run published; null while running or never run
 */
public record ClubInstagramDTO(
        String handle,
        boolean autoImport,
        boolean importAvailable,
        boolean running,
        Instant lastImportedAt,
        Instant nextImportAllowedAt,
        int eventsFound,
        String lastRunStatus,
        Integer lastRunPublished) {
}
