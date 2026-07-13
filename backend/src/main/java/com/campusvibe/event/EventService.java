package com.campusvibe.event;

import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class EventService {
    private final EventRepository eventRepository;
    private final ClubRepository clubRepository;
    private final EventMapper eventMapper;

    public EventService(EventRepository eventRepository,
                        ClubRepository clubRepository,
                        EventMapper eventMapper) {
        this.eventRepository = eventRepository;
        this.clubRepository = clubRepository;
        this.eventMapper = eventMapper;
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
        return eventMapper.apply(eventRepository.save(event));
    }

    private Event findEvent(Long id) {
        return eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event with id [%s] not found".formatted(id)));
    }
}
