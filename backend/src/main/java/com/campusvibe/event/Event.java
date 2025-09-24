package com.campusvibe.event;

import com.campusvibe.club.Club;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

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

    @ElementCollection
    @CollectionTable(name = "event_categories", joinColumns = @JoinColumn(name = "event_id"))
    @Column(name = "category")
    private List<String> categories = new ArrayList<>();
}
