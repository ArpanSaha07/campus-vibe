package com.campusvibe.event;

import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EventService {
    private final EventRepository eventRepository;
    private final ClubRepository clubRepository;

    public EventService(EventRepository eventRepository, ClubRepository clubRepository) {
        this.eventRepository = eventRepository;
        this.clubRepository = clubRepository;
    }

    public List<Event> list() { return eventRepository.findAll(); }

    public Event get(Long id) { return eventRepository.findById(id).orElseThrow(); }

    public Event create(Event event, String organizerId) {
        Club club = clubRepository.findById(organizerId).orElseThrow();
        event.setOrganizer(club);
        return eventRepository.save(event);
    }
}
