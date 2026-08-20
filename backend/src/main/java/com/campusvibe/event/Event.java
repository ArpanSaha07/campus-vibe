package com.campusvibe.event;

import com.campusvibe.club.Club;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "events")
@Getter
@Setter
@NoArgsConstructor
public class Event {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "date_time", nullable = false)
    private Instant dateTime;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    private String location;
    private String price;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organizer_id", nullable = false)
    private Club organizer;

    @Column(nullable = false)
    private Integer followers = 0;

    @ElementCollection
    @CollectionTable(name = "event_images", joinColumns = @JoinColumn(name = "event_id"))
    @Column(name = "url")
    private List<String> images = new ArrayList<>();

    @Column(nullable = false)
    private Boolean promoted = false;

    private Integer capacity;

    @Column(nullable = false)
    private Integer registered = 0;

    /*
     * Two axes, two vocabularies, and no event category -- see V28 and
     * decisions D2 and D3 in interests_and_categories.md.
     *
     * formatSlugs says what kind of thing this is (Workshop, Panel) and comes
     * from event_formats, which is events-only because those words mean nothing
     * as a student interest. topicSlugs says what it is about and comes from
     * interest_catalogue, shared with students and clubs -- which is what makes
     * matching a student to an event a direct join rather than a mapping.
     *
     * Sets rather than Lists: both are composite-key join tables, so a
     * duplicate is impossible in the database and a List would only invite code
     * that pretends order means something here.
     */

    @ElementCollection
    @CollectionTable(name = "event_format_assignments", joinColumns = @JoinColumn(name = "event_id"))
    @Column(name = "format_slug")
    private Set<String> formatSlugs = new HashSet<>();

    @ElementCollection
    @CollectionTable(name = "event_topic_assignments", joinColumns = @JoinColumn(name = "event_id"))
    @Column(name = "interest_slug")
    private Set<String> topicSlugs = new HashSet<>();
}
