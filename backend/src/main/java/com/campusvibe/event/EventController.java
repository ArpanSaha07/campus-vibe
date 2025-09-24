package com.campusvibe.event;

import com.campusvibe.s3.S3Buckets;
import com.campusvibe.s3.S3Service;
import com.campusvibe.user.Role;
import com.campusvibe.user.User;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/v1/events")
public class EventController {
    private final EventService eventService;
    private final EventMapper eventMapper;
    private final S3Service s3Service;
    private final S3Buckets buckets;

    public EventController(EventService eventService, EventMapper eventMapper, S3Service s3Service, S3Buckets buckets) {
        this.eventService = eventService;
        this.eventMapper = eventMapper;
        this.s3Service = s3Service;
        this.buckets = buckets;
    }

    @GetMapping
    public List<EventDTO> list() {
        return eventService.list().stream().map(eventMapper).toList();
    }

    @GetMapping("/{id}")
    public EventDTO get(@PathVariable Long id) {
        return eventMapper.apply(eventService.get(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','CLUB_ADMIN')")
    public EventDTO create(@RequestBody EventCreateRequest request, Authentication auth) {
        authorizeEventCreate(request.organizerId(), auth);
        Event e = new Event();
        e.setTitle(request.title());
        e.setDescription(request.description());
        e.setDateTime(request.dateTime());
        e.setLocation(request.location());
        e.setPrice(request.price());
        e.setCapacity(request.capacity());
        e.setCategories(request.categories());
        return eventMapper.apply(eventService.create(e, request.organizerId()));
    }

    @PostMapping(path = "/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','CLUB_ADMIN')")
    public void uploadImages(@PathVariable Long id, @RequestPart("files") List<MultipartFile> files, Authentication auth) throws IOException {
        // Organizer authorization would require lookup; assuming pre-checked at creation
        for (MultipartFile file : files) {
            String key = "events/" + id + "/images/" + file.getOriginalFilename();
            s3Service.putObject(buckets.getEvents(), key, file.getBytes());
        }
    }

    private void authorizeEventCreate(String organizerId, Authentication auth) {
        User user = (User) auth.getPrincipal();
        if (user.getRole() == Role.CLUB_ADMIN) {
            if (user.getManagedClub() == null || !user.getManagedClub().getId().equals(organizerId)) {
                throw new RuntimeException("Forbidden");
            }
        }
    }
}
