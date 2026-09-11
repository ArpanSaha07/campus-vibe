package com.campusvibe.clubadmin;

import com.campusvibe.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/**
 * A proposal for a club that does not exist yet.
 *
 * <p>Deliberately not a {@code clubs} row with a status column. A club row is
 * public the moment it exists — {@code GET /api/v1/clubs} is unauthenticated and
 * {@code SearchIndexService} indexes on write — so gating visibility would mean
 * filtering in four places, and missing one publishes a club nobody reviewed
 * (ADR-005). Nothing is written to {@code clubs} until an admin approves.
 *
 * <p>Deliberately not a {@link ClubAdminRequest} either, even though the two
 * queue together on the admin dashboard. That entity's {@code club} is
 * {@code optional = false} and names a club that already exists, which is
 * exactly what a proposal does not have; and the two approve differently — a
 * claim installs an owner on an existing club, a proposal creates the club
 * first.
 *
 * <p>The descriptive fields mirror {@code ClubCreateRequest}, because approval
 * feeds them straight into {@code ClubService.createOwnedBy}. That duplication
 * is the standing cost of ADR-005: a new field on a club has to be added here
 * too, or it silently cannot be proposed.
 */
@Entity
@Table(name = "club_creation_requests")
@Getter
@Setter
@NoArgsConstructor
public class ClubCreationRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /**
     * What {@code clubs.id} would become. Held as plain text, not a foreign key:
     * the whole point is that no club exists yet. A partial unique index over
     * PENDING rows reserves it, and the approval transaction re-checks it
     * against {@code clubs} for the race the reservation cannot see.
     */
    @Column(name = "proposed_slug", nullable = false)
    private String proposedSlug;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "category_slug")
    private String categorySlug;

    @ElementCollection
    @CollectionTable(name = "club_creation_request_interests",
            joinColumns = @JoinColumn(name = "request_id"))
    @Column(name = "interest_slug")
    private Set<String> interestSlugs = new HashSet<>();

    /** Why the requester should run this club. Free text, shown to the reviewer. */
    @Column(columnDefinition = "text")
    private String message;

    /**
     * The club's four public contact values, as a JSON string in one column
     * exactly as {@code Club.socialLinks} holds them — which is what lets
     * {@code approve} carry the value across without translating it.
     *
     * <p>Never written raw. {@code ClubSocialLinks.normalise} is the control,
     * and it runs before this is set, because these links land in an
     * {@code href} on the club's public page once the proposal is approved.
     */
    @Column(name = "social_links", columnDefinition = "text")
    private String socialLinks;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RequestStatus status = RequestStatus.PENDING;

    @Column(name = "requested_at", nullable = false)
    private Instant requestedAt = Instant.now();

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "reviewed_by_user_id")
    private Long reviewedByUserId;

    /**
     * What the approval produced, so <em>which club did this become</em> has an
     * answer afterwards. Null on every PENDING and REJECTED row.
     */
    @Column(name = "created_club_id")
    private String createdClubId;
}
