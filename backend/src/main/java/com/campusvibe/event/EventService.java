package com.campusvibe.event;

import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.exception.ResourceNotFoundException;
<<<<<<< HEAD
import com.campusvibe.search.SearchIndexService;
=======
>>>>>>> 6b7d78bf92e7a4fa2d029d0a46eff35a0313265d
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class EventService {
    private final EventRepository eventRepository;
    private final ClubRepository clubRepository;
    private final EventMapper eventMapper;
<<<<<<< HEAD
    private final SearchIndexService searchIndexService;

    public EventService(EventRepository eventRepository,
                        ClubRepository clubRepository,
                        EventMapper eventMapper,
                        SearchIndexService searchIndexService) {
        this.eventRepository = eventRepository;
        this.clubRepository = clubRepository;
        this.eventMapper = eventMapper;
        this.searchIndexService = searchIndexService;
=======

    public EventService(EventRepository eventRepository,
                        ClubRepository clubRepository,
                        EventMapper eventMapper) {
        this.eventRepository = eventRepository;
        this.clubRepository = clubRepository;
        this.eventMapper = eventMapper;
>>>>>>> 6b7d78bf92e7a4fa2d029d0a46eff35a0313265d
    }

    @Transactional(readOnly = true)
    public List<EventDTO> list() {
        return eventRepository.findAll().stream().map(eventMapper).toList();
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
<<<<<<< HEAD
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
=======
        return eventMapper.apply(eventRepository.save(event));
>>>>>>> 6b7d78bf92e7a4fa2d029d0a46eff35a0313265d
    }

    private Event findEvent(Long id) {
        return eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event with id [%s] not found".formatted(id)));
    }
}
