package com.campusvibe.instagram;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.time.ZoneId;

/** {@code campusvibe.instagram.*} in application.yml. */
@ConfigurationProperties(prefix = "campusvibe.instagram")
public record InstagramProperties(
        boolean enabled,
        String cron,
        String zone,
        int maxAccounts,
        Duration lockLease,
        Fetcher fetcher,
        Extraction extraction,
        AutoPublish autoPublish,
        Duration defaultDuration,
        Posts posts,
        boolean runOnStartup,
        boolean seedSources,
        Duration startupStaleAfter
) {
    public InstagramProperties {
        if (zone == null || zone.isBlank()) zone = "America/Toronto";
        if (maxAccounts <= 0) maxAccounts = 200;
        if (lockLease == null) lockLease = Duration.ofHours(2);
        if (fetcher == null) fetcher = new Fetcher(null, null, 20, Duration.ofMinutes(5));
        if (extraction == null) extraction = new Extraction(null, null, "claude-haiku-5-5", 4, 4, "ffmpeg");
        if (autoPublish == null) autoPublish = new AutoPublish(true, 0.7);
        if (defaultDuration == null) defaultDuration = Duration.ofHours(2);
        if (posts == null) posts = new Posts(true, 3, Duration.ofHours(20), Duration.ofDays(21));
        if (startupStaleAfter == null) startupStaleAfter = Duration.ofHours(11);
    }

    public ZoneId zoneId() {
        return ZoneId.of(zone);
    }

    public record Fetcher(String baseUrl, String apiKey, int batchSize, Duration timeout) {
        public Fetcher {
            if (batchSize <= 0 || batchSize > 20) batchSize = 20;
            if (timeout == null) timeout = Duration.ofMinutes(5);
        }

        public boolean isConfigured() {
            return baseUrl != null && !baseUrl.isBlank();
        }
    }

    /** {@code baseUrl} is blank for Anthropic's API; set it only for a proxy or a test server. */
    public record Extraction(String apiKey, String baseUrl, String model, int concurrency, int videoFrames,
                             String ffmpegPath) {
        public Extraction {
            if (model == null || model.isBlank()) model = "claude-haiku-5-5";
            if (concurrency <= 0) concurrency = 4;
            if (videoFrames < 0) videoFrames = 0;
            if (ffmpegPath == null || ffmpegPath.isBlank()) ffmpegPath = "ffmpeg";
        }

        public boolean isConfigured() {
            return apiKey != null && !apiKey.isBlank();
        }
    }

    public record AutoPublish(boolean enabled, double minConfidence) {}

    /**
     * Feed posts. They do not expire, so they are fetched at most once per
     * {@code minInterval} (a run in between fetches stories only), only the
     * newest {@code limit} per account, and posts older than {@code maxAge}
     * are not read at all.
     */
    public record Posts(boolean enabled, int limit, Duration minInterval, Duration maxAge) {
        public Posts {
            if (limit <= 0 || limit > 50) limit = 3;
            if (minInterval == null) minInterval = Duration.ofHours(20);
            if (maxAge == null) maxAge = Duration.ofDays(21);
        }
    }

}
