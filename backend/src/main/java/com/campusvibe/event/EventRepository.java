package com.campusvibe.event;

import com.campusvibe.club.Club;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EventRepository extends JpaRepository<Event, Long> {
    List<Event> findByOrganizer(Club club);
    List<Event> findByPromotedTrue();
}
