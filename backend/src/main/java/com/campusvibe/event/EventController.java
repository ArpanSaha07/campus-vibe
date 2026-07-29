package com.campusvibe.event;

import com.campusvibe.s3.S3Buckets;
import com.campusvibe.s3.S3Service;
import com.campusvibe.search.SearchService;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/v1/events")
public class EventController {
    private final EventService eventService;
    private final SearchService searchService;
    private final S3Service s3Service;
    private final S3Buckets buckets;

    public EventController(EventService eventService, SearchService searchService,
                           S3Service s3Service, S3Buckets buckets) {
        this.eventService = eventService;
        this.searchService = searchService;
        this.s3Service = s3Service;
        this.buckets = buckets;
    }

    @GetMapping
    public List<EventDTO> list() {
        return eventService.list();
    }

    @GetMapping("/search")
    public List<EventDTO> search(@RequestParam String q,
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
        if (request.categories() != null) {
            e.setCategories(request.categories());
        }
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
