package com.campusvibe.instagram;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/** One fetched story frame, our stored copy of it and what Claude read from it. */
@Entity
@Table(name = "instagram_stories")
@Getter
@Setter
@NoArgsConstructor
public class InstagramStory {

    public enum MediaType { IMAGE, VIDEO }

    /** A 24-hour story, or a permanent feed post (V39). */
    public enum Kind { STORY, POST }

    public enum Status { PENDING, PROCESSING, PROCESSED, FAILED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "source_id", nullable = false)
    private InstagramSource source;

    @Column(name = "external_id", nullable = false)
    private String externalId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Kind kind = Kind.STORY;

    @Enumerated(EnumType.STRING)
    @Column(name = "media_type", nullable = false)
    private MediaType mediaType;

    @Column(columnDefinition = "text")
    private String caption;

    @Column(name = "posted_at")
    private Instant postedAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt = Instant.now();

    private String permalink;

    @Column(name = "link_url")
    private String linkUrl;

    @Column(name = "feed_post_url")
    private String feedPostUrl;

    @Column(name = "image_key")
    private String imageKey;

    @Column(name = "ocr_text", columnDefinition = "text")
    private String ocrText;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String extraction;

    private String classification;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.PENDING;

    @Column(name = "attempt_count", nullable = false)
    private Integer attemptCount = 0;

    @Column(name = "last_error")
    private String lastError;
}
