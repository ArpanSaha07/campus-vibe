package com.campusvibe.instagram;

import com.campusvibe.common.Logs;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Checks, once, the host of every candidate imported before V44, and moves
 * each published repost from the club that shared it to its host's club
 * (Arpan, 2026-11-26: move existing events too).
 *
 * <p>Runs at every startup and does nothing once every candidate is checked:
 * a new candidate is checked when it is created. A candidate that cannot be
 * checked yet, because its host needs a new club and no platform admin exists
 * to own it, stays unchecked and is tried at the next startup.
 */
@Component
public class InstagramHostBackfill implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(InstagramHostBackfill.class);

    private final InstagramEventCandidateRepository candidates;
    private final InstagramPublishService publishService;

    public InstagramHostBackfill(InstagramEventCandidateRepository candidates,
                                 InstagramPublishService publishService) {
        this.candidates = candidates;
        this.publishService = publishService;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<Long> ids = candidates.findHostUncheckedIds();
        if (ids.isEmpty()) return;
        int moved = 0;
        int failed = 0;
        for (Long id : ids) {
            try {
                if (publishService.checkHost(id)) moved++;
            } catch (RuntimeException e) {
                failed++;
                log.warn("Could not check the host of import candidate {}: {}", id, Logs.safe(e.getMessage()));
            }
        }
        log.info("Instagram import: checked the host of {} earlier candidates, moved {} events to their host's club, {} left for next start",
                ids.size() - failed, moved, failed);
    }
}
