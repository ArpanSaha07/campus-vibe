package com.campusvibe.event;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.function.Function;

@Component
public class EventMapper implements Function<Event, EventDTO> {
    @Override
    public EventDTO apply(Event event) {
        return new EventDTO(
                event.getId(),
                event.getTitle(),
                event.getDescription(),
                event.getDateTime(),
                event.getCreatedAt(),
                event.getLocation(),
                event.getPrice(),
                event.getOrganizer().getId(),
                // getId() is served straight off the lazy proxy, but getName()
                // initializes it. EventRepository's read methods carry an
                // @EntityGraph for `organizer` so that costs no extra query —
                // without it this line alone would make every list N+1.
                event.getOrganizer().getName(),
                event.getFollowers(),
                // copy so lazy collections are initialized while the session is open
                List.copyOf(event.getImages()),
                event.getPromoted(),
                event.getCapacity(),
                event.getRegistered(),
                // Sorted so two reads of one row cannot disagree about the
                // order -- Hibernate hands these back as a HashSet.
                event.getTopicSlugs().stream().sorted().toList(),
                event.getFormatSlugs().stream().sorted().toList()
        );
    }
}
