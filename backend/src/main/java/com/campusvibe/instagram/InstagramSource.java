package com.campusvibe.instagram;

import com.campusvibe.club.Club;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** An Instagram account we watch for event stories. */
@Entity
@Table(name = "instagram_sources")
@Getter
@Setter
@NoArgsConstructor
public class InstagramSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String handle;

    @Column(name = "display_name")
    private String displayName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "club_id")
    private Club club;

    @Column(nullable = false)
    private Integer priority;

    @Column(nullable = false)
    private Integer score = 0;

    @Column(name = "found_on")
    private String foundOn;

    @Column(nullable = false)
    private Boolean enabled = true;

    @Column(name = "last_fetch_at")
    private Instant lastFetchAt;

    @Column(name = "last_success_at")
    private Instant lastSuccessAt;

    @Column(name = "last_status")
    private String lastStatus;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "stories_seen", nullable = false)
    private Integer storiesSeen = 0;

    @Column(name = "events_found", nullable = false)
    private Integer eventsFound = 0;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public String profileUrl() {
        return "https://www.instagram.com/" + handle + "/";
    }
}
