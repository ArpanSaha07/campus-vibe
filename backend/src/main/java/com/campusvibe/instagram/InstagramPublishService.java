package com.campusvibe.instagram;

import com.campusvibe.club.Club;
import com.campusvibe.club.ClubDTO;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.club.ClubService;
import com.campusvibe.club.ClubSocialLinks;
import com.campusvibe.common.Logs;
import com.campusvibe.event.Event;
import com.campusvibe.event.EventDTO;
import com.campusvibe.event.EventRepository;
import com.campusvibe.event.EventService;
import com.campusvibe.search.SearchIndexService;
import com.campusvibe.exception.RequestValidationException;
import com.campusvibe.exception.ResourceNotFoundException;
import com.campusvibe.s3.MediaBucket;
import com.campusvibe.s3.MediaKeys;
import com.campusvibe.s3.S3Service;
import com.campusvibe.taxonomy.TaxonomyService;
import com.campusvibe.user.User;
import com.campusvibe.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns a candidate into a public event, with no human step: through
 * {@link EventService#create}, so it gets the same validation and search
 * indexing as an event typed into the form, then the poster becomes its banner
 * and the event remembers its Instagram link.
 *
 * <p>The account's club is found or made on the way: a club whose Instagram
 * link names the account, else a new club named after the account and owned by
 * the platform admin, who can hand it to the real club later.
 *
 * <p>Idempotent and safe under concurrent calls: the candidate row is locked for
 * the whole transaction, and an already-published candidate returns as is.
 */
@Service
public class InstagramPublishService {

    private static final Logger log = LoggerFactory.getLogger(InstagramPublishService.class);
    private static final int MAX_EVENT_TAGS = 8;
    private static final Pattern INSTAGRAM_HANDLE = Pattern.compile("instagram\\.com/([A-Za-z0-9._]{1,30})");

    private final InstagramEventCandidateRepository candidates;
    private final EventService eventService;
    private final TaxonomyService taxonomyService;
    private final ClubService clubService;
    private final ClubRepository clubRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbc;
    private final S3Service s3Service;
    private final MediaBucket mediaBucket;
    private final EventRepository eventRepository;
    private final SearchIndexService searchIndexService;
    private final InstagramSourceRepository sources;

    public InstagramPublishService(InstagramEventCandidateRepository candidates,
                                   EventService eventService,
                                   TaxonomyService taxonomyService,
                                   ClubService clubService,
                                   ClubRepository clubRepository,
                                   UserRepository userRepository,
                                   JdbcTemplate jdbc,
                                   S3Service s3Service,
                                   MediaBucket mediaBucket,
                                   EventRepository eventRepository,
                                   SearchIndexService searchIndexService,
                                   InstagramSourceRepository sources) {
        this.candidates = candidates;
        this.eventService = eventService;
        this.taxonomyService = taxonomyService;
        this.clubService = clubService;
        this.clubRepository = clubRepository;
        this.userRepository = userRepository;
        this.jdbc = jdbc;
        this.s3Service = s3Service;
        this.mediaBucket = mediaBucket;
        this.eventRepository = eventRepository;
        this.searchIndexService = searchIndexService;
        this.sources = sources;
    }

    @Transactional
    public InstagramEventCandidate publish(Long candidateId) {
        InstagramEventCandidate c = candidates.findByIdForUpdate(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException("No import candidate " + candidateId));
        if (c.getStatus() != InstagramEventCandidate.Status.PENDING_REVIEW) {
            return c;
        }
        if (c.getTitle() == null || c.getDateTime() == null) {
            throw new RequestValidationException("An event needs a title and a date");
        }
        InstagramSource source = c.getSource();
        InstagramStory media = c.getStory();
        Club club = c.getHostHandle() != null ? hostClub(c.getHostHandle(), c.getHostedBy(), source) : clubFor(source);

        Event event = new Event();
        event.setTitle(c.getTitle());
        event.setDescription(composeDescription(c, source, media));
        event.setDateTime(c.getDateTime());
        event.setEndTime(c.getEndTime());
        event.setLocation(c.getLocation());
        event.setPrice(c.getPrice());
        event.setCapacity(c.getCapacity());
        event.getTopicSlugs().addAll(taxonomyService.requireKnownInterests(c.getTopics(), MAX_EVENT_TAGS, "topic"));
        event.getFormatSlugs().addAll(taxonomyService.requireKnownEventFormats(c.getFormats(), MAX_EVENT_TAGS, "format"));
        applySourceLinks(event, source, media);
        EventDTO created = eventService.create(event, club.getId());

        attachBanner(created.id(), media);

        c.setStatus(InstagramEventCandidate.Status.PUBLISHED);
        c.setEventId(created.id());
        c.setAutoPublished(true);
        c.setReviewedAt(Instant.now());
        c.setReviewReasons(new ArrayList<>());
        source.setEventsFound(source.getEventsFound() + 1);
        return c;
    }

    /**
     * Another story or post about an event already published: fills what the
     * first one did not say (place, price, spots, banner) and adds facts it did
     * not have. Never overwrites, and only touches events this import created.
     */
    @Transactional
    public void enrich(Long eventId, Long duplicateCandidateId) {
        Event e = eventRepository.findById(eventId).orElse(null);
        InstagramEventCandidate dup = candidates.findById(duplicateCandidateId).orElse(null);
        if (e == null || dup == null || e.getSourceUrl() == null) return;
        boolean changed = false;
        if (e.getLocation() == null && dup.getLocation() != null) {
            e.setLocation(dup.getLocation());
            changed = true;
        }
        if (e.getPrice() == null && dup.getPrice() != null) {
            e.setPrice(dup.getPrice());
            changed = true;
        }
        if (e.getCapacity() == null && dup.getCapacity() != null) {
            e.setCapacity(dup.getCapacity());
            changed = true;
        }
        String description = e.getDescription() == null ? "" : e.getDescription();
        List<String> extra = new ArrayList<>();
        for (String h : dup.getHighlights()) {
            if (!description.toLowerCase(Locale.ROOT).contains(h.toLowerCase(Locale.ROOT))) extra.add(h);
        }
        if (dup.getRegistrationUrl() != null && !description.contains(dup.getRegistrationUrl())) {
            extra.add("Register: " + dup.getRegistrationUrl());
        }
        if (!extra.isEmpty()) {
            int from = description.lastIndexOf("\nFrom @");
            String head = from >= 0 ? description.substring(0, from).stripTrailing() : description.stripTrailing();
            String tail = from >= 0 ? description.substring(from) : "";
            StringBuilder sb = new StringBuilder(head).append("\n");
            for (String x : extra) sb.append("• ").append(x).append("\n");
            e.setDescription(sb.append(tail).toString());
            changed = true;
        }
        if (e.getImages().isEmpty()) {
            attachBanner(e.getId(), dup.getStory());
        }
        if (changed) {
            eventRepository.saveAndFlush(e);
            searchIndexService.indexEvent(e);
        }
    }

    /**
     * A post links to itself forever. A story links to itself while it is up,
     * then to the post it reshared, or to the account's profile.
     */
    static void applySourceLinks(Event event, InstagramSource source, InstagramStory media) {
        if (media.getKind() == InstagramStory.Kind.POST) {
            event.setSourceUrl(httpsOrNull(media.getPermalink()));
            return;
        }
        String permanent = httpsOrNull(media.getFeedPostUrl());
        event.setSourceUrl(permanent != null ? permanent : source.profileUrl());
        event.setSourceStoryUrl(httpsOrNull(media.getPermalink()));
        event.setSourceStoryExpiresAt(media.getExpiresAt());
    }

    private static String httpsOrNull(String url) {
        return url != null && url.startsWith("https://") ? url : null;
    }

    // ------------------------------------------------------------------ clubs

    /**
     * The club of the account hosting a reposted event (Arpan, 2026-11-26).
     * Found the same way as a watched account's club; a host the import has
     * never seen gets an account row, at the end of the ranked list, and a
     * club of its own like any other imported account.
     */
    Club hostClub(String handle, String hostedBy, InstagramSource postedBy) {
        InstagramSource host = sources.findByHandle(handle).orElseGet(() -> {
            InstagramSource s = new InstagramSource();
            s.setHandle(handle);
            s.setDisplayName(hostNameFrom(hostedBy));
            s.setPriority(sources.maxPriority() + 1);
            s.setFoundOn("repost by @" + postedBy.getHandle());
            s.setEnabled(true);
            return sources.save(s);
        });
        return clubFor(host);
    }

    /** "The Factory (@thefactory_mcgill)" gives "The Factory"; a bare handle gives null. */
    static String hostNameFrom(String hostedBy) {
        if (hostedBy == null) return null;
        String name = hostedBy.replaceAll("\\(?@[A-Za-z0-9._]+\\)?", "").replaceAll("\\s+", " ").strip();
        if (name.isEmpty()) return null;
        return name.length() > 120 ? name.substring(0, 120) : name;
    }

    /**
     * Moves an event published before V44 from the club that reposted it to
     * its host's club, once. Checks the host against the story the same way a
     * new candidate is checked. Leaves alone an event someone already moved.
     *
     * @return true when the event moved
     */
    @Transactional
    public boolean checkHost(Long candidateId) {
        InstagramEventCandidate c = candidates.findByIdForUpdate(candidateId).orElse(null);
        if (c == null || Boolean.TRUE.equals(c.getHostChecked())) return false;
        InstagramSource source = c.getSource();
        InstagramStory story = c.getStory();
        String handle = CandidateRules.verifiedHostHandle(null, c.getHostedBy(), source.getHandle(),
                story.getMentions(), story.getOcrText(), story.getCaption());
        c.setHostHandle(handle);
        boolean moved = false;
        if (handle != null && c.getStatus() == InstagramEventCandidate.Status.PUBLISHED && c.getEventId() != null) {
            Event event = eventRepository.findById(c.getEventId()).orElse(null);
            Club posting = source.getClub();
            if (event != null && posting != null && posting.getId().equals(event.getOrganizer().getId())) {
                Club host = hostClub(handle, c.getHostedBy(), source);
                if (!host.getId().equals(posting.getId())) {
                    event.setOrganizer(host);
                    // Flushed before indexing: the index write is JDBC (BUG-034), and
                    // the event's embedded text names its organizer (BUG-006).
                    Event saved = eventRepository.saveAndFlush(event);
                    searchIndexService.indexEvent(saved);
                    moved = true;
                    log.info("Moved event {} from [{}] to its host [{}]", saved.getId(), posting.getId(), host.getId());
                }
            }
        }
        c.setHostChecked(true);
        return moved;
    }

    private Club clubFor(InstagramSource source) {
        if (source.getClub() != null) {
            return source.getClub();
        }
        Club club = findClubByInstagram(source.getHandle()).orElseGet(() -> createClub(source));
        source.setClub(club);
        return club;
    }

    /** A club whose contact links already name this Instagram account. */
    private Optional<Club> findClubByInstagram(String handle) {
        return clubRepository.findAll().stream()
                .filter(club -> handle.equals(instagramHandleOf(club.getSocialLinks())))
                .findFirst();
    }

    static String instagramHandleOf(String socialLinksJson) {
        if (socialLinksJson == null) return null;
        Matcher m = INSTAGRAM_HANDLE.matcher(socialLinksJson);
        return m.find() ? m.group(1).toLowerCase(Locale.ROOT) : null;
    }

    private Club createClub(InstagramSource source) {
        User owner = platformAdmin().orElseThrow(() -> new IllegalStateException(
                "No platform admin exists to own a club for @" + source.getHandle()));
        String slug = slugFor(source.getHandle());
        if (clubRepository.existsById(slug)) {
            slug = slug + "-ig";
        }
        Club club = new Club();
        club.setId(slug);
        String name = source.getDisplayName() != null ? source.getDisplayName() : "@" + source.getHandle();
        club.setName(name.length() > 120 ? name.substring(0, 120) : name);
        club.setDescription("Events from @%s on Instagram.".formatted(source.getHandle()));
        // Handle checked against [a-z0-9._] on the way in, so this JSON is safe to build by hand.
        club.setSocialLinks(ClubSocialLinks.normalise("{\"instagram\":\"" + source.getHandle() + "\"}"));
        ClubDTO dto = clubService.createOwnedBy(club, null, List.of(), owner, owner);
        log.info("Instagram import created club [{}] for @{}", dto.id(), source.getHandle());
        return clubRepository.findById(dto.id())
                .orElseThrow(() -> new IllegalStateException("Club vanished after creation"));
    }

    /** The longest-standing platform admin. */
    private Optional<User> platformAdmin() {
        List<Long> ids = jdbc.queryForList("""
                SELECT u.id FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                JOIN roles r ON r.id = ur.role_id
                WHERE r.name = 'ROLE_ADMIN'
                ORDER BY u.id LIMIT 1
                """, Long.class);
        return ids.isEmpty() ? Optional.empty() : userRepository.findById(ids.get(0));
    }

    static String slugFor(String handle) {
        String slug = handle.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "");
        return slug.isEmpty() ? "ig-club" : slug;
    }

    // ------------------------------------------------------------------ media and text

    /** The poster, copied at full quality under the event's own key so the event owns it. */
    private void attachBanner(Long eventId, InstagramStory media) {
        if (media.getImageKey() == null) return;
        try {
            byte[] bytes = s3Service.getObject(mediaBucket.name(), media.getImageKey());
            String key = MediaKeys.eventImage(eventId, bytes);
            s3Service.putObject(mediaBucket.name(), key, bytes);
            eventService.addImages(eventId, List.of(key));
        } catch (RuntimeException e) {
            // The event is still worth publishing without its picture.
            log.warn("Could not attach Instagram banner to event {}: {}", eventId, Logs.safe(e.getMessage()));
        }
    }

    /**
     * The event page's description: the card sentence, the details, the facts
     * as bullets, then where it came from. Plain text with line breaks, which
     * the event page keeps.
     */
    static String composeDescription(InstagramEventCandidate c, InstagramSource source, InstagramStory media) {
        StringBuilder sb = new StringBuilder();
        if (c.getSummary() != null) sb.append(c.getSummary().strip()).append("\n\n");
        if (c.getDescription() != null && !c.getDescription().equals(c.getSummary())) {
            sb.append(c.getDescription().strip()).append("\n\n");
        }
        List<String> bullets = new ArrayList<>();
        if (c.getAudience() != null) bullets.add("For: " + c.getAudience());
        bullets.addAll(c.getHighlights());
        if (c.getHostedBy() != null) bullets.add("Hosted by " + c.getHostedBy());
        if (!c.getCollaborators().isEmpty()) bullets.add("With " + String.join(", ", c.getCollaborators()));
        if (c.getRegistrationUrl() != null) bullets.add("Register: " + c.getRegistrationUrl());
        if (!Boolean.TRUE.equals(c.getStartTimeKnown())) {
            bullets.add("Time not announced yet: check Instagram for updates");
        } else if (Boolean.TRUE.equals(c.getEndTimeEstimated())) {
            bullets.add("End time not announced; the one shown is an estimate");
        }
        for (String b : bullets) sb.append("• ").append(b).append("\n");
        if (!bullets.isEmpty()) sb.append("\n");
        sb.append("From @").append(source.getHandle()).append("'s Instagram ")
                .append(media.getKind() == InstagramStory.Kind.POST ? "post" : "story").append(".");
        return sb.toString();
    }
}
