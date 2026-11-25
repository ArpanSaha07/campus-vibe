package com.campusvibe.instagram;

import com.campusvibe.common.Logs;
import com.campusvibe.event.Event;
import com.campusvibe.event.EventRepository;
import com.campusvibe.s3.MediaBucket;
import com.campusvibe.s3.MediaKeys;
import com.campusvibe.s3.S3Service;
import com.campusvibe.taxonomy.EventFormatDTO;
import com.campusvibe.taxonomy.InterestDTO;
import com.campusvibe.taxonomy.TaxonomyService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Limit;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

/**
 * The import pipeline: fetch stories for the top enabled accounts, store each
 * new frame, read it with Claude, turn the events in it into candidates,
 * de-duplicate them, and publish the ones that pass {@link CandidateRules#publishBlockers}.
 *
 * <p>One run at a time across every instance, through a lease row in
 * {@code instagram_import_lock}. A failure is contained to its batch of
 * accounts or its single story; the run carries on and reports PARTIAL.
 */
@Service
public class InstagramImportService {

    private static final Logger log = LoggerFactory.getLogger(InstagramImportService.class);
    private static final int MAX_ATTEMPTS = 3;
    /** A schedule post (a week of games, a day of workshops) lists many events. */
    private static final int MAX_EVENTS_PER_STORY = 12;

    private final InstagramProperties props;
    private final InstagramSourceRepository sources;
    private final InstagramStoryRepository stories;
    private final InstagramEventCandidateRepository candidates;
    private final InstagramImportRunRepository runs;
    private final StoryFetcherClient fetcher;
    private final StoryMediaDownloader downloader;
    private final StoryEventExtractor extractor;
    private final InstagramPublishService publishService;
    private final EventRepository eventRepository;
    private final TaxonomyService taxonomyService;
    private final S3Service s3Service;
    private final MediaBucket mediaBucket;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    private final ExecutorService manualRunner = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "instagram-import");
        t.setDaemon(true);
        return t;
    });
    /** Candidate creation is serialized so two stories of one event cannot both slip past de-duplication. */
    private final Object candidateLock = new Object();

    public InstagramImportService(InstagramProperties props,
                                  InstagramSourceRepository sources,
                                  InstagramStoryRepository stories,
                                  InstagramEventCandidateRepository candidates,
                                  InstagramImportRunRepository runs,
                                  StoryFetcherClient fetcher,
                                  StoryMediaDownloader downloader,
                                  StoryEventExtractor extractor,
                                  InstagramPublishService publishService,
                                  EventRepository eventRepository,
                                  TaxonomyService taxonomyService,
                                  S3Service s3Service,
                                  MediaBucket mediaBucket,
                                  JdbcTemplate jdbc,
                                  ObjectMapper mapper) {
        this.props = props;
        this.sources = sources;
        this.stories = stories;
        this.candidates = candidates;
        this.runs = runs;
        this.fetcher = fetcher;
        this.downloader = downloader;
        this.extractor = extractor;
        this.publishService = publishService;
        this.eventRepository = eventRepository;
        this.taxonomyService = taxonomyService;
        this.s3Service = s3Service;
        this.mediaBucket = mediaBucket;
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    // ------------------------------------------------------------------ entry points

    /** Starts a run in the background (used at startup) and returns it at once. */
    public InstagramImportRun startBackgroundRun() {
        String token = UUID.randomUUID().toString();
        if (!tryAcquireLease(token)) {
            return null;
        }
        InstagramImportRun run = newRun(InstagramImportRun.Trigger.SCHEDULED);
        manualRunner.submit(() -> runWithLease(run, token));
        return run;
    }

    /** Runs synchronously on the scheduler thread; skips quietly if another run holds the lease. */
    public void runScheduled() {
        String token = UUID.randomUUID().toString();
        if (!tryAcquireLease(token)) {
            log.info("Instagram import skipped: another run holds the lease");
            return;
        }
        runWithLease(newRun(InstagramImportRun.Trigger.SCHEDULED), token);
    }

    public boolean isRunning() {
        Integer n = jdbc.queryForObject(
                "SELECT count(*) FROM instagram_import_lock WHERE id = 1 AND locked_until > now()", Integer.class);
        return n != null && n > 0;
    }

    // ------------------------------------------------------------------ the run

    private InstagramImportRun newRun(InstagramImportRun.Trigger trigger) {
        InstagramImportRun run = new InstagramImportRun();
        run.setTrigger(trigger);
        return runs.save(run);
    }

    private void runWithLease(InstagramImportRun run, String token) {
        try {
            execute(run);
        } catch (RuntimeException e) {
            log.error("Instagram import run {} failed", run.getId(), e);
            run.setStatus(InstagramImportRun.Status.FAILED);
            run.setError(truncate(e.getMessage(), 1000));
        } finally {
            run.setFinishedAt(Instant.now());
            runs.save(run);
            releaseLease(token);
        }
    }

    private void execute(InstagramImportRun run) {
        if (!fetcher.isConfigured()) {
            throw new IllegalStateException("No story fetcher is configured (INSTAGRAM_FETCHER_URL)");
        }
        // Nothing can be read without Claude, so fetching would only spend credit.
        if (!extractor.isConfigured()) {
            throw new IllegalStateException("ANTHROPIC_API_KEY is not set: nothing fetched, nothing published");
        }
        List<InstagramSource> watched = sources.findByEnabledTrueOrderByPriorityAsc(Limit.of(props.maxAccounts()));
        run.setAccountsRequested(watched.size());
        runs.save(run);
        Double usedBefore = fetcher.health().map(StoryFetcherClient.Health::usedUsd).orElse(null);

        Map<String, InstagramSource> byHandle = watched.stream()
                .collect(Collectors.toMap(InstagramSource::getHandle, s -> s, (a, b) -> a, LinkedHashMap::new));
        List<Work> work = new ArrayList<>();
        int failures = 0;

        List<String> handles = new ArrayList<>(byHandle.keySet());
        failures += fetchAll(handles, byHandle, run, work, false);
        if (postsDue()) {
            run.setIncludedPosts(true);
            failures += fetchAll(handles, byHandle, run, work, true);
        }
        run.setStoriesNew(work.size());

        // Earlier stories that were stored but not read (extraction was down, a timeout).
        for (InstagramStory s : stories.findRetryable(MAX_ATTEMPTS, Instant.now().minus(Duration.ofHours(24)), Limit.of(500))) {
            if (work.stream().noneMatch(w -> w.storyId().equals(s.getId()))) {
                work.add(new Work(s.getId(), s.getSource().getId(), null));
            }
        }
        runs.save(run);

        int candidatesCreated = 0;
        int published = 0;
        if (!work.isEmpty()) {
            ExecutorService pool = Executors.newFixedThreadPool(props.extraction().concurrency());
            try {
                List<Future<Outcome>> futures = new ArrayList<>();
                for (Work w : work) futures.add(pool.submit(() -> process(w)));
                for (Future<Outcome> f : futures) {
                    try {
                        Outcome o = f.get(10, TimeUnit.MINUTES);
                        candidatesCreated += o.candidates();
                        published += o.published();
                        if (o.failed()) failures++;
                    } catch (Exception e) {
                        failures++;
                        log.warn("A story failed to process: {}", Logs.safe(e.getMessage()));
                    }
                }
            } finally {
                pool.shutdownNow();
            }
        }

        run.setCandidatesCreated(candidatesCreated);
        run.setAutoPublished(published);
        run.setFailures(failures);
        Double usedAfter = fetcher.health().map(StoryFetcherClient.Health::usedUsd).orElse(null);
        if (usedBefore != null && usedAfter != null) {
            run.setFetchCostUsd(Math.max(0, usedAfter - usedBefore));
        }
        run.setStatus(failures > 0 ? InstagramImportRun.Status.PARTIAL : InstagramImportRun.Status.SUCCEEDED);
        log.info("Instagram import run {}: {} accounts, {} stories + {} posts ({} new), {} events found, {} published, {} failures",
                run.getId(), run.getAccountsRequested(), run.getStoriesFetched(), run.getPostsFetched(),
                run.getStoriesNew(), candidatesCreated, published, failures);
    }

    /**
     * Fetches stories (or posts) for every handle in batches, stores what is new
     * and queues it. Returns how many batches failed.
     */
    private int fetchAll(List<String> handles, Map<String, InstagramSource> byHandle, InstagramImportRun run,
                         List<Work> work, boolean posts) {
        int failures = 0;
        Instant oldestPost = Instant.now().minus(props.posts().maxAge());
        for (int i = 0; i < handles.size(); i += fetcher.batchSize()) {
            List<String> batch = handles.subList(i, Math.min(i + fetcher.batchSize(), handles.size()));
            Instant now = Instant.now();
            StoryFetcherClient.FetchResult result;
            try {
                result = posts ? fetcher.fetchPosts(batch, props.posts().limit()) : fetcher.fetch(batch);
            } catch (RuntimeException e) {
                failures++;
                log.warn("{} fetch failed for {} accounts: {}", posts ? "Post" : "Story", batch.size(),
                        Logs.safe(e.getMessage()));
                for (String h : batch) {
                    InstagramSource s = byHandle.get(h);
                    s.setLastFetchAt(now);
                    s.setLastError(truncate(e.getMessage(), 500));
                }
                sources.saveAll(batch.stream().map(byHandle::get).toList());
                continue;
            }
            if (!posts) {
                for (String h : batch) {
                    InstagramSource s = byHandle.get(h);
                    String status = result.statusByHandle().getOrDefault(h, "no_stories");
                    s.setLastFetchAt(now);
                    s.setLastStatus(status);
                    if (status.equals("ok") || status.equals("no_stories") || status.equals("no_active_stories")) {
                        s.setLastSuccessAt(now);
                        s.setLastError(null);
                    }
                }
                run.setStoriesFetched(run.getStoriesFetched() + result.stories().size());
            } else {
                run.setPostsFetched(run.getPostsFetched() + result.stories().size());
            }
            for (StoryFetcherClient.FetchedStory fs : result.stories()) {
                InstagramSource source = byHandle.get(fs.handle());
                if (source == null || stories.existsBySourceIdAndExternalId(source.getId(), fs.externalId())) {
                    continue;
                }
                // An old post is a finished event or no event at all: not worth reading.
                if (posts && fs.postedAt() != null && fs.postedAt().isBefore(oldestPost)) {
                    continue;
                }
                if (source.getDisplayName() == null && fs.creatorFullName() != null) {
                    source.setDisplayName(truncate(fs.creatorFullName(), 120));
                }
                InstagramStory saved = saveNewStory(source, fs);
                if (saved != null) {
                    source.setStoriesSeen(source.getStoriesSeen() + 1);
                    work.add(new Work(saved.getId(), source.getId(), fs));
                }
            }
            sources.saveAll(batch.stream().map(byHandle::get).toList());
        }
        return failures;
    }

    /** Posts do not expire, so they are fetched once per {@code posts.min-interval}. */
    private boolean postsDue() {
        if (!props.posts().enabled()) return false;
        return runs.findFirstByIncludedPostsTrueAndStatusNotOrderByStartedAtDesc(InstagramImportRun.Status.FAILED)
                .map(r -> r.getStartedAt().isBefore(Instant.now().minus(props.posts().minInterval())))
                .orElse(true);
    }

    private InstagramStory saveNewStory(InstagramSource source, StoryFetcherClient.FetchedStory fs) {
        InstagramStory story = new InstagramStory();
        story.setSource(source);
        story.setExternalId(fs.externalId());
        story.setKind(fs.kind());
        story.setMediaType(fs.mediaType());
        story.setCaption(truncate(fs.caption(), 8000));
        story.setPostedAt(fs.postedAt());
        story.setExpiresAt(fs.expiresAt());
        story.setPermalink(truncate(fs.permalink(), 500));
        story.setLinkUrl(CandidateRules.cleanUrl(fs.linkUrl()));
        story.setFeedPostUrl(fs.feedPostUrl());
        try {
            return stories.save(story);
        } catch (DataIntegrityViolationException e) {
            return null; // another instance stored it first
        }
    }

    // ------------------------------------------------------------------ one story

    record Work(Long storyId, Long sourceId, StoryFetcherClient.FetchedStory fetched) {}

    record Outcome(int candidates, int published, boolean failed) {}

    Outcome process(Work w) {
        InstagramStory story = stories.findById(w.storyId()).orElseThrow();
        InstagramSource source = sources.findWithClubById(w.sourceId()).orElseThrow();
        story.setStatus(InstagramStory.Status.PROCESSING);
        story.setAttemptCount(story.getAttemptCount() + 1);
        stories.save(story);
        try {
            byte[] image = loadImage(story, source, w.fetched());
            if (!extractor.isConfigured()) {
                story.setStatus(InstagramStory.Status.PENDING);
                story.setAttemptCount(story.getAttemptCount() - 1);
                story.setLastError("Not read yet: no ANTHROPIC_API_KEY configured");
                stories.save(story);
                return new Outcome(0, 0, false);
            }
            List<byte[]> frames = extraImages(w.fetched());

            StoryExtraction extraction = extractor.extract(context(story, source, w.fetched()), image, frames);
            story.setOcrText(truncate(extraction.ocrText(), 5000));
            story.setClassification(extraction.classification() == null ? null : extraction.classification().name());
            story.setExtraction(toJson(extraction));
            story.setStatus(InstagramStory.Status.PROCESSED);
            story.setLastError(null);
            stories.save(story);

            synchronized (candidateLock) {
                return createCandidates(story, source, extraction);
            }
        } catch (Exception e) {
            log.warn("Story {} of @{} failed: {}", story.getExternalId(), source.getHandle(), Logs.safe(e.getMessage()));
            story.setStatus(InstagramStory.Status.FAILED);
            story.setLastError(truncate(e.getClass().getSimpleName() + ": " + e.getMessage(), 500));
            stories.save(story);
            return new Outcome(0, 0, true);
        }
    }

    private byte[] loadImage(InstagramStory story, InstagramSource source,
                             StoryFetcherClient.FetchedStory fetched) throws java.io.IOException {
        if (story.getImageKey() != null) {
            return s3Service.getObject(mediaBucket.name(), story.getImageKey());
        }
        if (fetched == null || fetched.imageUrl() == null) {
            throw new java.io.IOException("Story has no image");
        }
        byte[] image = downloader.downloadImage(fetched.imageUrl());
        String key = MediaKeys.instagramStory(source.getHandle(), story.getExternalId(), image);
        s3Service.putObject(mediaBucket.name(), key, image);
        story.setImageKey(key);
        stories.save(story);
        return image;
    }

    /**
     * What Claude sees beside the main image: frames of a video, or the other
     * slides of a carousel post. A slide that fails to download is skipped.
     */
    private List<byte[]> extraImages(StoryFetcherClient.FetchedStory f) {
        if (f == null) return List.of();
        if (f.mediaType() == InstagramStory.MediaType.VIDEO) {
            return downloader.videoFrames(f.videoUrl());
        }
        List<byte[]> slides = new ArrayList<>();
        for (String url : f.extraImageUrls()) {
            try {
                slides.add(downloader.downloadImage(url));
            } catch (java.io.IOException e) {
                log.info("Skipped a carousel slide of @{}: {}", f.handle(), Logs.safe(e.getMessage()));
            }
        }
        return slides;
    }

    private StoryEventExtractor.StoryContext context(InstagramStory story, InstagramSource source,
                                                     StoryFetcherClient.FetchedStory f) {
        return new StoryEventExtractor.StoryContext(
                story.getKind(),
                source.getHandle(),
                source.getDisplayName(),
                story.getPostedAt(),
                story.getLinkUrl(),
                f == null ? null : f.locationName(),
                f != null && f.caption() != null ? f.caption() : story.getCaption(),
                f == null ? List.of() : f.countdowns(),
                f == null ? List.of() : f.mentions(),
                story.getMediaType() == InstagramStory.MediaType.VIDEO);
    }

    private Outcome createCandidates(InstagramStory story, InstagramSource source, StoryExtraction extraction) {
        StoryExtraction.Classification cls = extraction.classification();
        if (cls == null || cls == StoryExtraction.Classification.PAST_EVENT
                || cls == StoryExtraction.Classification.NOT_EVENT
                || extraction.events() == null || extraction.events().isEmpty()) {
            return new Outcome(0, 0, false);
        }
        Set<String> knownTopics = taxonomyService.listInterests().stream().map(InterestDTO::slug).collect(Collectors.toSet());
        Set<String> knownFormats = taxonomyService.listEventFormats().stream().map(EventFormatDTO::slug).collect(Collectors.toSet());
        Instant now = Instant.now();
        int created = 0;
        int published = 0;

        for (StoryExtraction.ExtractedEvent e : extraction.events().stream().limit(MAX_EVENTS_PER_STORY).toList()) {
            InstagramEventCandidate c = new InstagramEventCandidate();
            c.setStory(story);
            c.setSource(source);
            c.setTitle(CandidateRules.clean(e.title(), 200));
            c.setDescription(CandidateRules.clean(e.description(), 2000));
            c.setSummary(CandidateRules.clean(e.summary(), 300));
            c.setHighlights(capped(e.highlights()));
            c.setAudience(CandidateRules.clean(e.audience(), 200));
            c.setCollaborators(capped(e.collaborators()));
            CandidateRules.Times t = CandidateRules.resolveTimes(e.startDate(), e.startTime(), e.endDate(), e.endTime(),
                    props.zoneId(), props.defaultDuration());
            if (t.end() != null && !t.end().isAfter(now)) {
                continue; // already over: a reminder or recap read late
            }
            c.setDateTime(t.start());
            c.setStartTimeKnown(t.startTimeKnown());
            c.setEndTime(t.end());
            c.setEndTimeEstimated(t.endEstimated());
            c.setLocation(CandidateRules.clean(e.location(), 300));
            c.setPrice(CandidateRules.clean(e.price(), 100));
            c.setCapacity(CandidateRules.parseCapacity(e.capacity()));
            String url = CandidateRules.cleanUrl(e.registrationUrl());
            c.setRegistrationUrl(url != null ? url : story.getLinkUrl());
            c.setHostedBy(CandidateRules.clean(e.hostedBy(), 200));
            c.setRepost(e.repost());
            c.setTopics(filter(e.topics(), knownTopics));
            c.setFormats(filter(e.formats(), knownFormats));
            c.setClassification(cls.name());
            c.setConfidence(Math.max(0, Math.min(1, e.confidence())));
            c.setUncertainFields(capped(e.uncertainFields()));
            c.setWarnings(capped(e.warnings()));
            c.setMissingFields(CandidateRules.missingFields(c));
            markDuplicate(c);
            if (c.getStatus() == InstagramEventCandidate.Status.PENDING_REVIEW) {
                c.setReviewReasons(CandidateRules.publishBlockers(c,
                        props.autoPublish().enabled(), props.autoPublish().minConfidence(), now));
            }
            c = candidates.save(c);
            created++;

            if (c.getStatus() == InstagramEventCandidate.Status.DUPLICATE && c.getDuplicateOfEventId() != null) {
                try {
                    publishService.enrich(c.getDuplicateOfEventId(), c.getId());
                } catch (RuntimeException ex) {
                    log.info("Could not enrich event {} from candidate {}: {}", c.getDuplicateOfEventId(), c.getId(),
                            Logs.safe(ex.getMessage()));
                }
            }

            if (c.getStatus() == InstagramEventCandidate.Status.PENDING_REVIEW && c.getReviewReasons().isEmpty()) {
                try {
                    publishService.publish(c.getId());
                    published++;
                } catch (RuntimeException ex) {
                    InstagramEventCandidate fresh = candidates.findById(c.getId()).orElse(c);
                    List<String> reasons = new ArrayList<>(fresh.getReviewReasons());
                    reasons.add("Could not publish: " + truncate(ex.getMessage(), 200));
                    log.warn("Could not publish candidate {}: {}", c.getId(), Logs.safe(ex.getMessage()));
                    fresh.setReviewReasons(reasons);
                    candidates.save(fresh);
                }
            }
        }
        return new Outcome(created, published, false);
    }

    private void markDuplicate(InstagramEventCandidate c) {
        if (c.getDateTime() == null) return;
        boolean dayOnly = !Boolean.TRUE.equals(c.getStartTimeKnown());
        Instant from = c.getDateTime().minus(Duration.ofHours(24));
        Instant to = c.getDateTime().plus(Duration.ofHours(24));
        for (Event ev : eventRepository.findByDateTimeBetween(from, to)) {
            if (CandidateRules.sameEvent(c.getTitle(), c.getDateTime(), ev.getTitle(), ev.getDateTime(), dayOnly)
                    || CandidateRules.sameSlot(c.getDateTime(), c.getLocation(), ev.getDateTime(), ev.getLocation())) {
                c.setStatus(InstagramEventCandidate.Status.DUPLICATE);
                c.setDuplicateOfEventId(ev.getId());
                return;
            }
        }
        String reshared = c.getStory().getFeedPostUrl();
        for (InstagramEventCandidate other : candidates.findLiveBetween(from, to)) {
            String otherPost = other.getStory().getFeedPostUrl() != null
                    ? other.getStory().getFeedPostUrl() : other.getStory().getPermalink();
            // Two reshares of one post are one event only if they also agree on the time and
            // roughly the name: one post can list a whole week of events.
            boolean samePost = reshared != null && reshared.equals(otherPost)
                    && !other.getStory().getId().equals(c.getStory().getId())
                    && Math.abs(Duration.between(c.getDateTime(), other.getDateTime()).toMinutes()) <= 30
                    && CandidateRules.titleSimilarity(c.getTitle(), other.getTitle()) >= 0.34;
            if (samePost
                    || CandidateRules.sameEvent(c.getTitle(), c.getDateTime(), other.getTitle(), other.getDateTime(),
                            dayOnly || !Boolean.TRUE.equals(other.getStartTimeKnown()))
                    || CandidateRules.sameSlot(c.getDateTime(), c.getLocation(), other.getDateTime(), other.getLocation())) {
                c.setStatus(InstagramEventCandidate.Status.DUPLICATE);
                c.setDuplicateOfCandidateId(other.getId());
                if (other.getEventId() != null) c.setDuplicateOfEventId(other.getEventId());
                return;
            }
        }
    }

    private static List<String> filter(List<String> slugs, Set<String> known) {
        if (slugs == null) return new ArrayList<>();
        return slugs.stream().filter(known::contains).distinct().limit(8).collect(Collectors.toCollection(ArrayList::new));
    }

    private static List<String> capped(List<String> values) {
        if (values == null) return new ArrayList<>();
        return values.stream().filter(v -> v != null && !v.isBlank())
                .map(v -> truncate(v.strip(), 200)).limit(10)
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private String toJson(StoryExtraction extraction) {
        try {
            return mapper.writeValueAsString(extraction);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    // ------------------------------------------------------------------ lease

    boolean tryAcquireLease(String token) {
        int rows = jdbc.update("""
                INSERT INTO instagram_import_lock (id, holder, locked_until)
                VALUES (1, ?, now() + (? * interval '1 second'))
                ON CONFLICT (id) DO UPDATE
                    SET holder = EXCLUDED.holder, locked_until = EXCLUDED.locked_until
                    WHERE instagram_import_lock.locked_until < now()
                """, token, props.lockLease().toSeconds());
        return rows == 1;
    }

    void releaseLease(String token) {
        jdbc.update("UPDATE instagram_import_lock SET locked_until = now() WHERE id = 1 AND holder = ?", token);
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }

    @PreDestroy
    void shutdown() {
        manualRunner.shutdownNow();
    }
}
