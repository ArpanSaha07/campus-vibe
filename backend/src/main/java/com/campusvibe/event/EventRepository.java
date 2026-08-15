package com.campusvibe.event;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Every read here loads the organizing club with the event.
 *
 * Event.organizer is LAZY, which is right — the write paths have no use for it.
 * But EventMapper reads the club's name for the DTO, and a lazy proxy answers
 * getId() straight from the identifier while getName() has to initialize it.
 * Without these graphs that is one extra select per event.
 *
 * Measured on GET /api/v1/events with 6 events: 13 statements with the graph,
 * 17 without.
 *
 * The remaining cost is 2 statements per event, for the `images` and
 * `categories` element collections the mapper copies. That predates this and is
 * not addressed here — see todo.md.
 *
 * The overrides exist only to attach the graph; the queries are unchanged.
 */
public interface EventRepository extends JpaRepository<Event, Long> {

    @Override
    @EntityGraph(attributePaths = "organizer")
    List<Event> findAll();

    @Override
    @EntityGraph(attributePaths = "organizer")
    List<Event> findAllById(Iterable<Long> ids);

    @Override
    @EntityGraph(attributePaths = "organizer")
    Optional<Event> findById(Long id);

    /**
     * By club id rather than by Club: the caller has a slug from a query string,
     * and loading the club first only to pass it back as a predicate would cost
     * a second query to prove something the foreign key already knows.
     */
    @EntityGraph(attributePaths = "organizer")
    List<Event> findByOrganizerId(String organizerId);

    @EntityGraph(attributePaths = "organizer")
    List<Event> findByPromotedTrue();
}
