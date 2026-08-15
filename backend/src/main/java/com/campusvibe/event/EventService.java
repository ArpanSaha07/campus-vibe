package com.campusvibe.event;

import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.exception.ResourceNotFoundException;
import com.campusvibe.search.SearchIndexService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class EventService {
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
        Club club = clubRepository.findById(organizerId)
                .orElseThrow(() -> new ResourceNotFoundException("Club with id [%s] not found".formatted(organizerId)));
        event.setOrganizer(club);
        Event saved = eventRepository.save(event);
        searchIndexService.indexEvent(saved);
        return eventMapper.apply(saved);
    }

    @Transactional
    public void delete(Long id) {
        eventRepository.delete(findEvent(id));
    }

    @Transactional
    public void addImages(Long id, List<String> keys) {
        Event event = findEvent(id);
        event.getImages().addAll(keys);
    }

    private Event findEvent(Long id) {
        return eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event with id [%s] not found".formatted(id)));
    }
}
