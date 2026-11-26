package com.campusvibe.instagram;

import java.time.Instant;

/**
 * One import run, as the admin dashboard lists it.
 *
 * @param trigger SCHEDULED or MANUAL (an admin's or a club's Import now)
 * @param status  RUNNING, SUCCEEDED, PARTIAL or FAILED
 * @param handle  the one account a club's Import now covered; null for a run over the list
 */
public record InstagramImportRunDTO(
        Long id,
        String trigger,
        String status,
        Instant startedAt,
        Instant finishedAt,
        int accountsRequested,
        int storiesFetched,
        int postsFetched,
        int eventsFound,
        int eventsPublished,
        int failures,
        String handle,
        String error) {
}
