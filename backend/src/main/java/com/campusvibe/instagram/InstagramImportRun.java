package com.campusvibe.instagram;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** One scheduled or manual import, with what it found. */
@Entity
@Table(name = "instagram_import_runs")
@Getter
@Setter
@NoArgsConstructor
public class InstagramImportRun {

    public enum Trigger { SCHEDULED, MANUAL }

    public enum Status { RUNNING, SUCCEEDED, PARTIAL, FAILED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Trigger trigger;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.RUNNING;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt = Instant.now();

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(name = "accounts_requested", nullable = false)
    private Integer accountsRequested = 0;

    @Column(name = "stories_fetched", nullable = false)
    private Integer storiesFetched = 0;

    @Column(name = "stories_new", nullable = false)
    private Integer storiesNew = 0;

    @Column(name = "candidates_created", nullable = false)
    private Integer candidatesCreated = 0;

    @Column(name = "auto_published", nullable = false)
    private Integer autoPublished = 0;

    @Column(nullable = false)
    private Integer failures = 0;

    @Column(name = "included_posts", nullable = false)
    private Boolean includedPosts = false;

    @Column(name = "posts_fetched", nullable = false)
    private Integer postsFetched = 0;

    /** The one account a club's Import now run covered (V41); null for a scheduled run. */
    @Column(name = "source_id")
    private Long sourceId;

    @Column(name = "fetch_cost_usd")
    private Double fetchCostUsd;

    private String error;
}
