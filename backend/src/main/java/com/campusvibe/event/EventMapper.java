package com.campusvibe.event;

import org.springframework.stereotype.Component;

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
                event.getFollowers(),
                event.getImages(),
                event.getPromoted(),
                event.getCapacity(),
                event.getRegistered(),
                event.getCategories()
        );
    }
}
