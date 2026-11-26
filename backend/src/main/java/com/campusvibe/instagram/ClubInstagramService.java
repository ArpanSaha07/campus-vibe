package com.campusvibe.instagram;

import com.campusvibe.ai.AiServiceUnavailableException;
import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.club.ClubService;
import com.campusvibe.club.ClubUpdateRequest;
import com.campusvibe.common.WebLinks;
import com.campusvibe.exception.DuplicateResourceException;
import com.campusvibe.exception.RequestValidationException;
import com.campusvibe.exception.ResourceNotFoundException;
import com.campusvibe.exception.TooManyAttemptsException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;

/**
 * A club's own Instagram connection, run from the club dashboard.
 *
 * <p><strong>One handle, stored once.</strong> The handle lives in the club's
 * contact links ({@code social_links.instagram}), the same value the Edit Club
 * page edits and the public club page links to (Arpan, 2026-11-26). Saving it
 * here writes those links through {@link ClubService#update}, so it is
 * normalised exactly as that form's value is, and links the importer's
 * {@code instagram_sources} row for the same handle to this club.
 *
 * <p><strong>Clubs override the admin's N</strong> (Arpan, 2026-11-26). Runs
 * check the first N accounts of the ranked list. Turning auto-import on sets
 * {@code club_opted_in}, which N never drops; turning it off sets
 * {@code enabled = false}, which removes the account even inside N. Connecting
 * without touching the toggle does neither, so the account stays wherever it
 * already sat in the list. The toggle shows the outcome: whether scheduled runs
 * will check the account.
 *
 * <p><strong>Saving never imports.</strong> Neither the handle nor the toggle
 * starts a run; only Import now does, and scheduled runs pick up an opted-in
 * account on their own timetable (Arpan, 2026-11-26).
 *
 * <p><strong>Import now reads this club's handle and nothing else</strong>, and
 * does not wait for a scheduled run over other accounts (Arpan, 2026-11-26).
 * It costs money (gateway credit and Claude calls), so it is refused for
 * {@link #COOLDOWN} after this account was last fetched by any run; owners and
 * admins alike may press it.
 */
@Service
public class ClubInstagramService {

    static final Duration COOLDOWN = Duration.ofHours(1);
    private static final String INSTAGRAM_PREFIX = "https://instagram.com/";

    private final ClubRepository clubRepository;
    private final ClubService clubService;
    private final InstagramSourceRepository sources;
    private final InstagramImportService importService;
    private final ObjectMapper mapper;
    private final InstagramImportSettingsService settings;

    public ClubInstagramService(ClubRepository clubRepository, ClubService clubService,
                                InstagramSourceRepository sources, InstagramImportService importService,
                                ObjectMapper mapper, InstagramImportSettingsService settings) {
        this.clubRepository = clubRepository;
        this.clubService = clubService;
        this.sources = sources;
        this.importService = importService;
        this.mapper = mapper;
        this.settings = settings;
    }

    @Transactional(readOnly = true)
    public ClubInstagramDTO get(String clubId) {
        Club club = findClub(clubId);
        String handle = InstagramPublishService.instagramHandleOf(club.getSocialLinks());
        return toDto(handle, connectedSource(clubId, handle).orElse(null));
    }

    @Transactional
    public ClubInstagramDTO update(String clubId, ClubInstagramUpdateRequest request) {
        Club club = findClub(clubId);
        String handle = handleFrom(request.handle());
        Optional<InstagramSource> previous = sources.findFirstByClubId(clubId);

        if (handle == null) {
            previous.ifPresent(this::disconnect);
            writeHandle(club, "");
            return toDto(null, null);
        }

        InstagramSource source = sources.findByHandle(handle).orElse(null);
        if (source != null && source.getClub() != null && !clubId.equals(source.getClub().getId())) {
            throw new DuplicateResourceException(
                    "@%s is already connected to another club on CampusVibe. Contact us if it is yours."
                            .formatted(handle));
        }
        previous.filter(p -> !p.getHandle().equals(handle)).ifPresent(this::disconnect);

        if (source == null) {
            source = new InstagramSource();
            source.setHandle(handle);
            // Last in the seeded order: the cap never reaches it, so only the
            // opt-in below decides whether scheduled runs import it.
            source.setPriority(sources.maxPriority() + 1);
            source.setFoundOn("club-dashboard");
            source.setEnabled(false);
        }
        boolean alreadyOurs = source.getClub() != null && clubId.equals(source.getClub().getId());
        source.setClub(club);
        if (request.autoImport() != null) {
            source.setEnabled(request.autoImport());
            source.setClubOptedIn(request.autoImport());
        } else if (!alreadyOurs) {
            // Connected, no choice made yet: neither opted in nor out, so the
            // account is checked exactly when it falls inside the admin's N.
            source.setEnabled(true);
            source.setClubOptedIn(false);
        }
        source = sources.save(source);

        writeHandle(club, handle);
        return toDto(handle, source);
    }

    /**
     * Starts an import of this club's account alone; returns the state with
     * {@code running} set. Not transactional on purpose: starting the run
     * inserts its row and takes the lease, which a read-only transaction refuses.
     */
    public ClubInstagramDTO importNow(String clubId) {
        Club club = findClub(clubId);
        String handle = InstagramPublishService.instagramHandleOf(club.getSocialLinks());
        InstagramSource source = connectedSource(clubId, handle).orElseThrow(() ->
                new RequestValidationException("Save your club's Instagram account before importing."));
        if (!importService.isConfigured()) {
            throw new AiServiceUnavailableException("Instagram import isn't set up on this server yet.");
        }
        if (importService.isSourceRunning(source.getId())) {
            throw new DuplicateResourceException("Your import is already running.");
        }
        Instant allowedAt = nextAllowed(source);
        if (allowedAt != null || importService.startSourceRun(source.getId(), COOLDOWN) == null) {
            // The second test is the atomic claim; it loses only to a click
            // that landed a moment earlier, which is the same answer.
            long seconds = allowedAt == null ? COOLDOWN.getSeconds()
                    : Math.max(1, Duration.between(Instant.now(), allowedAt).getSeconds());
            throw new TooManyAttemptsException(
                    "This account was imported less than an hour ago. Try again later.", seconds);
        }
        // Re-read: the claim stamped last_fetch_at and wrote a RUNNING run.
        return toDto(handle, sources.findById(source.getId()).orElse(source));
    }

    // ------------------------------------------------------------------ helpers

    /** The source for the club's handle, only when it is linked to this club. */
    private Optional<InstagramSource> connectedSource(String clubId, String handle) {
        if (handle == null) return Optional.empty();
        return sources.findByHandle(handle)
                .filter(s -> s.getClub() != null && clubId.equals(s.getClub().getId()));
    }

    /**
     * Unlinks a source the club no longer uses. Its choice goes with it: the
     * account returns to its place in the ranked list, checked only inside N.
     */
    private void disconnect(InstagramSource source) {
        source.setEnabled(true);
        source.setClubOptedIn(false);
        source.setClub(null);
        sources.save(source);
    }

    /**
     * Writes the handle into the club's contact links through the same path
     * the Edit Club page uses, so {@code ClubSocialLinks.normalise} checks it
     * and the other five links are kept as they are.
     */
    private void writeHandle(Club club, String handle) {
        ObjectNode links;
        try {
            links = club.getSocialLinks() == null || club.getSocialLinks().isBlank()
                    ? mapper.createObjectNode()
                    : (ObjectNode) mapper.readTree(club.getSocialLinks());
        } catch (JsonProcessingException | ClassCastException e) {
            // Only normalise() writes this column, so it is always an object.
            throw new IllegalStateException("Club [%s] has unreadable contact links".formatted(club.getId()), e);
        }
        links.put("instagram", handle);
        clubService.update(club.getId(), new ClubUpdateRequest(null, null, links.toString(), null, null));
    }

    /** A handle, lowercased and without @, or null for blank. Refuses anything else with a 400. */
    static String handleFrom(String raw) {
        String url = WebLinks.normaliseInstagram(raw, "Instagram");
        if (url == null) return null;
        return url.substring(INSTAGRAM_PREFIX.length()).toLowerCase(Locale.ROOT);
    }

    private ClubInstagramDTO toDto(String handle, InstagramSource source) {
        if (source == null) {
            return new ClubInstagramDTO(handle, false, importService.isConfigured(), false,
                    null, null, 0, null, null);
        }
        InstagramImportRun last = importService.lastSourceRun(source.getId()).orElse(null);
        boolean running = importService.isSourceRunning(source.getId());
        return new ClubInstagramDTO(
                handle,
                scheduled(source),
                importService.isConfigured(),
                running,
                source.getLastFetchAt(),
                nextAllowed(source),
                source.getEventsFound(),
                last == null ? null : last.getStatus().name(),
                last == null || running ? null : last.getAutoPublished());
    }

    /** Whether scheduled runs check this account: opted in, or inside the admin's N and not opted out. */
    private boolean scheduled(InstagramSource source) {
        if (!Boolean.TRUE.equals(source.getEnabled())) return false;
        if (Boolean.TRUE.equals(source.getClubOptedIn())) return true;
        return sources.countRankedAhead(source.getPriority()) < settings.accountCount();
    }

    private static Instant nextAllowed(InstagramSource source) {
        if (source.getLastFetchAt() == null) return null;
        Instant at = source.getLastFetchAt().plus(COOLDOWN);
        return at.isAfter(Instant.now()) ? at : null;
    }

    private Club findClub(String clubId) {
        return clubRepository.findById(clubId)
                .orElseThrow(() -> new ResourceNotFoundException("Club [%s] not found".formatted(clubId)));
    }
}
