package com.campusvibe.event;

import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.exception.RequestValidationException;
import com.campusvibe.exception.ResourceNotFoundException;
import com.campusvibe.search.SearchIndexService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

@Service
public class EventService {
    /** The longest an event may run (Arpan, 2026-09-15); V35 checks the same. */
    public static final Duration MAX_EVENT_LENGTH = Duration.ofDays(14);

    private final EventRepository eventRepository;
    private final ClubRepository clubRepository;
    private final EventMapper eventMapper;
    private final SearchIndexService searchIndexService;

    public EventService(EventRepository eventRepository,
                        ClubRepository clubRepository,
                        EventMapper eventMapper,
                        SearchIndexService searchIndexService) {
        this.eventRepository = eventRepository;
        this.clubRepository = clubRepository;
        this.eventMapper = eventMapper;
        this.searchIndexService = searchIndexService;
    }

    @Transactional(readOnly = true)
    public List<EventDTO> list() {
        return eventRepository.findAll().stream().map(eventMapper).toList();
    }

    /** Events that have not ended, running or still to come, soonest start first. */
    @Transactional(readOnly = true)
    public List<EventDTO> listUpcoming() {
        return eventRepository.findByEndTimeAfterOrderByDateTimeAsc(Instant.now())
                .stream().map(eventMapper).toList();
    }

    /**
     * Events run by one club.
     *
     * An organizer id that matches nothing returns an empty list rather than
     * 404: this is a filter over a collection that does exist, and a club with
     * no events yet is an ordinary state that must answer the same way.
     */
    @Transactional(readOnly = true)
    public List<EventDTO> listByOrganizer(String organizerId) {
        return eventRepository.findByOrganizerId(organizerId).stream().map(eventMapper).toList();
    }

    @Transactional(readOnly = true)
    public EventDTO get(Long id) {
        return eventMapper.apply(findEvent(id));
    }

    @Transactional
    public EventDTO create(Event event, String organizerId) {
        requireValidTimes(event.getDateTime(), event.getEndTime());
        Club club = clubRepository.findById(organizerId)
                .orElseThrow(() -> new ResourceNotFoundException("Club with id [%s] not found".formatted(organizerId)));
        event.setOrganizer(club);
        Event saved = eventRepository.save(event);
        searchIndexService.indexEvent(saved);
        return eventMapper.apply(saved);
    }

    /**
     * Replaces an event's editable fields and tags, then re-indexes it.
     *
     * <p>Full replacement: a null description, location, price or capacity
     * clears it. Title, start and end cannot be cleared -- all are NOT NULL, and
     * letting the constraint refuse them would surface as a 500.
     *
     * <p>The tag sets are cleared and refilled, never reassigned: swapping the
     * PersistentSet out makes Hibernate delete and reinsert every row.
     */
    @Transactional
    public EventDTO update(Long id, EventUpdateRequest request,
                           Set<String> topics, Set<String> formats) {
        if (request.title() == null || request.title().isBlank()) {
            throw new RequestValidationException("An event needs a title");
        }
        requireValidTimes(request.dateTime(), request.endTime());
        Event event = findEvent(id);
        event.setTitle(request.title().trim());
        event.setDescription(request.description());
        event.setDateTime(request.dateTime());
        event.setEndTime(request.endTime());
        event.setLocation(request.location());
        event.setPrice(request.price());
        event.setCapacity(request.capacity());
        event.getTopicSlugs().clear();
        event.getTopicSlugs().addAll(topics);
        event.getFormatSlugs().clear();
        event.getFormatSlugs().addAll(formats);
        // Flushed before indexing: indexEvent writes the embedding through
        // JdbcTemplate, which cannot see unflushed work (BUG-034). The embedded
        // text carries the title and tags, so it must describe the event as saved.
        Event saved = eventRepository.saveAndFlush(event);
        searchIndexService.indexEvent(saved);
        return eventMapper.apply(saved);
    }

    @Transactional
    public void delete(Long id) {
        eventRepository.delete(findEvent(id));
    }

    /**
     * Ten photos per event (Arpan, 2026-09-15). The controller checks before
     * storing anything; this re-checks inside the write, so two uploads racing
     * each other cannot both land.
     */
    public static final int MAX_EVENT_IMAGES = 10;

    /** How many photos the event holds now, for the controller's pre-check. */
    @Transactional(readOnly = true)
    public int imageCount(Long id) {
        return findEvent(id).getImages().size();
    }

    @Transactional
    public void addImages(Long id, List<String> keys) {
        Event event = findEvent(id);
        if (event.getImages().size() + keys.size() > MAX_EVENT_IMAGES) {
            throw new RequestValidationException(
                    "An event can have up to %d photos".formatted(MAX_EVENT_IMAGES));
        }
        event.getImages().addAll(keys);
    }

    /**
     * Removes the photo at {@code index} from the row and returns its key, so
     * the caller deletes the object only after this commits (s3-media §19):
     * deleting inside the transaction would leave the row pointing at nothing
     * whenever the commit failed.
     */
    @Transactional
    public String removeImage(Long id, int index) {
        Event event = findEvent(id);
        List<String> images = event.getImages();
        requireImageAt(id, images, index);
        return images.remove(index);
    }

    /**
     * Makes the photo at {@code index} the banner by moving it to the front.
     *
     * <p>Every surface draws the first photo as the banner, so the order is the
     * choice (Arpan, 2026-09-15) and no column or DTO field is needed. Mutated in
     * place, never reassigned: a copied collection loses the write (BUG-044).
     */
    @Transactional
    public EventDTO makeBanner(Long id, int index) {
        Event event = findEvent(id);
        List<String> images = event.getImages();
        requireImageAt(id, images, index);
        if (index > 0) {
            images.add(0, images.remove(index));
        }
        return eventMapper.apply(eventRepository.saveAndFlush(event));
    }

    private static void requireImageAt(Long id, List<String> images, int index) {
        if (index < 0 || index >= images.size()) {
            throw new ResourceNotFoundException(
                    "Event [%d] has no image at position %d".formatted(id, index));
        }
    }

    /**
     * Start and end present, end after start, at most 14 days apart. Checked
     * here so each is a 400 with a sentence; V35's CHECK constraints would
     * otherwise refuse them as a 500.
     */
    private static void requireValidTimes(Instant start, Instant end) {
        if (start == null) {
            throw new RequestValidationException("An event needs a start date and time");
        }
        if (end == null) {
            throw new RequestValidationException("An event needs an end date and time");
        }
        if (!end.isAfter(start)) {
            throw new RequestValidationException("An event must end after it starts");
        }
        if (end.isAfter(start.plus(MAX_EVENT_LENGTH))) {
            throw new RequestValidationException("An event must end within 14 days of its start");
        }
    }

    private Event findEvent(Long id) {
        return eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event with id [%s] not found".formatted(id)));
    }
}
