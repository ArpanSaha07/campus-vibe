package com.campusvibe.instagram;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * An event read from a story, before it is an event. Holds the same fields as
 * {@code EventCreateRequest} plus what is needed to judge it: confidence, what
 * was missing or uncertain, and why it was not published automatically.
 */
@Entity
@Table(name = "instagram_event_candidates")
@Getter
@Setter
@NoArgsConstructor
public class InstagramEventCandidate {

    public enum Status { PENDING_REVIEW, PUBLISHED, REJECTED, DUPLICATE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "story_id", nullable = false)
    private InstagramStory story;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "source_id", nullable = false)
    private InstagramSource source;

    private String title;

    @Column(columnDefinition = "text")
    private String description;

    /** One card-length sentence. */
    @Column(columnDefinition = "text")
    private String summary;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private List<String> highlights = new ArrayList<>();

    private String audience;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private List<String> collaborators = new ArrayList<>();

    @Column(name = "date_time")
    private Instant dateTime;

    @Column(name = "start_time_known", nullable = false)
    private Boolean startTimeKnown = false;

    @Column(name = "end_time")
    private Instant endTime;

    @Column(name = "end_time_estimated", nullable = false)
    private Boolean endTimeEstimated = false;

    private String location;
    private String price;
    private Integer capacity;

    @Column(name = "registration_url")
    private String registrationUrl;

    @Column(name = "hosted_by")
    private String hostedBy;

    @Column(name = "is_repost", nullable = false)
    private Boolean repost = false;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private List<String> topics = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private List<String> formats = new ArrayList<>();

    @Column(nullable = false)
    private String classification;

    @Column(nullable = false)
    private Double confidence = 0.0;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "missing_fields", columnDefinition = "jsonb", nullable = false)
    private List<String> missingFields = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "uncertain_fields", columnDefinition = "jsonb", nullable = false)
    private List<String> uncertainFields = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private List<String> warnings = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "review_reasons", columnDefinition = "jsonb", nullable = false)
    private List<String> reviewReasons = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.PENDING_REVIEW;

    @Column(name = "auto_published", nullable = false)
    private Boolean autoPublished = false;

    @Column(name = "event_id")
    private Long eventId;

    @Column(name = "duplicate_of_event_id")
    private Long duplicateOfEventId;

    @Column(name = "duplicate_of_candidate_id")
    private Long duplicateOfCandidateId;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "rejection_reason")
    private String rejectionReason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
