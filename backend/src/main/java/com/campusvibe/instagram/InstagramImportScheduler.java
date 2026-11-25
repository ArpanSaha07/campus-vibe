package com.campusvibe.instagram;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.event.EventListener;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.Instant;

/**
 * Runs the import twice a day (9:00 and 21:00 Montreal by default). Stories
 * expire after 24 hours, so two runs 12 hours apart see every story at least
 * once. Off unless {@code INSTAGRAM_IMPORT_ENABLED=true}; a stale import
 * also runs once at startup.
 */
@Configuration
@EnableScheduling
@EnableConfigurationProperties(InstagramProperties.class)
public class InstagramImportScheduler {

    private final InstagramProperties props;
    private final InstagramImportService importService;
    private final InstagramImportRunRepository runs;

    public InstagramImportScheduler(InstagramProperties props, InstagramImportService importService,
                                    InstagramImportRunRepository runs) {
        this.props = props;
        this.importService = importService;
        this.runs = runs;
    }

    /**
     * After a restart or deploy, catch up at once when the last run is older
     * than half a day, rather than showing nothing new until 9:00 or 21:00.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void catchUpOnStartup() {
        if (!props.enabled() || !props.runOnStartup()) return;
        boolean stale = runs.findFirstByOrderByStartedAtDesc()
                .map(r -> r.getStartedAt().isBefore(Instant.now().minus(props.startupStaleAfter())))
                .orElse(true);
        if (stale) importService.startBackgroundRun();
    }

    @Scheduled(cron = "${campusvibe.instagram.cron:0 0 9,21 * * *}",
               zone = "${campusvibe.instagram.zone:America/Toronto}")
    public void scheduledRun() {
        if (props.enabled()) {
            importService.runScheduled();
        }
    }
}
