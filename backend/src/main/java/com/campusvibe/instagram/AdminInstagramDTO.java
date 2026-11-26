package com.campusvibe.instagram;

import java.util.List;

/**
 * The admin dashboard's Instagram import section.
 *
 * @param accountCount    N: runs check the first N accounts of the ranked list
 * @param totalAccounts   how many accounts the list holds
 * @param clubOptIns      accounts clubs turned auto-import on for, checked on top of N
 * @param importAvailable false when the server has no fetcher or no Claude key
 * @param running         a run over the list holds the lease; Import now waits for it
 * @param recentRuns      the latest runs of every kind, newest first
 */
public record AdminInstagramDTO(
        int accountCount,
        long totalAccounts,
        long clubOptIns,
        boolean importAvailable,
        boolean running,
        List<InstagramImportRunDTO> recentRuns) {
}
