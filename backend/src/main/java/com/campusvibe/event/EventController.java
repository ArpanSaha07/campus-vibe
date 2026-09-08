package com.campusvibe.event;

import com.campusvibe.s3.S3Buckets;
import com.campusvibe.s3.S3Service;
import com.campusvibe.taxonomy.TaxonomyService;
import com.campusvibe.search.SearchLimits;
import com.campusvibe.search.SearchService;
import jakarta.validation.constraints.Size;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@RestController
@Validated // needed for constraints on @RequestParam, unlike @Valid on a body
@RequestMapping("/api/v1/events")
public class EventController {

    /**
     * Per axis, not combined. An event may carry eight topics and eight
     * formats; in practice it carries two or three of each, and the cap is here
     * to stop anything that is not the form from tagging an event with the
     * whole vocabulary and matching every student.
     */
    private static final int MAX_EVENT_TAGS = 8;

    private final EventService eventService;
    private final SearchService searchService;
    private final S3Service s3Service;
    private final S3Buckets buckets;
    private final TaxonomyService taxonomyService;

    public EventController(EventService eventService, SearchService searchService,
                           S3Service s3Service, S3Buckets buckets,
                           TaxonomyService taxonomyService) {
        this.eventService = eventService;
        this.searchService = searchService;
        this.s3Service = s3Service;
        this.buckets = buckets;
        this.taxonomyService = taxonomyService;
    }

    /**
     * All events, or just one club's when organizerId is given.
     *
     * A filter on the existing collection rather than a nested
     * /clubs/{id}/events route: the club dashboard used to fetch every event in
     * the system and filter client-side, which is the only thing this replaces.
     */
    @GetMapping
    public List<EventDTO> list(@RequestParam(required = false) String organizerId) {
        return organizerId == null || organizerId.isBlank()
                ? eventService.list()
                : eventService.listByOrganizer(organizerId);
    }

    @GetMapping("/search")
    public List<EventDTO> search(
            @RequestParam @Size(max = SearchLimits.MAX_QUERY_LENGTH) String q,
                                 @RequestParam(defaultValue = "20") int limit) {
        if (q == null || q.isBlank()) {
            return List.of();
        }
        return searchService.searchEvents(q.trim(), Math.clamp(limit, 1, 50));
    }

    @GetMapping("/{id}")
    public EventDTO get(@PathVariable Long id) {
        return eventService.get(id);
    }

    @PostMapping
    @PreAuthorize("@clubPermissionService.canManageClub(authentication, #request.organizerId())")
    public EventDTO create(@RequestBody EventCreateRequest request) {
        Event e = new Event();
        e.setTitle(request.title());
        e.setDescription(request.description());
        e.setDateTime(request.dateTime());
        e.setLocation(request.location());
        e.setPrice(request.price());
        e.setCapacity(request.capacity());
        // Validated against the two vocabularies before anything is written, so
        // a bad slug is a 400 naming it rather than a foreign-key violation
        // surfacing as a 500.
        e.getTopicSlugs().addAll(
                taxonomyService.requireKnownInterests(request.topics(), MAX_EVENT_TAGS, "topic"));
        e.getFormatSlugs().addAll(
                taxonomyService.requireKnownEventFormats(request.formats(), MAX_EVENT_TAGS, "format"));
        return eventService.create(e, request.organizerId());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@clubPermissionService.canManageEvent(authentication, #id)")
    public void delete(@PathVariable Long id) {
        eventService.delete(id);
    }

    @PostMapping(path = "/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("@clubPermissionService.canManageEvent(authentication, #id)")
    public void uploadImages(@PathVariable Long id, @RequestPart("files") List<MultipartFile> files) throws IOException {
        List<String> keys = new ArrayList<>();
        for (MultipartFile file : files) {
            String key = "events/" + id + "/images/" + file.getOriginalFilename();
            s3Service.putObject(buckets.getEvents(), key, file.getBytes());
            keys.add(key);
        }
        eventService.addImages(id, keys);
    }
}
