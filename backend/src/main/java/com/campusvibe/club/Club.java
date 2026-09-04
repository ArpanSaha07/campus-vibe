package com.campusvibe.club;

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
@Table(name = "clubs")
@Getter
@Setter
@NoArgsConstructor
public class Club {
    @Id
    private String id; // slug

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(nullable = false)
    private Integer followers = 0;

    private String logo; // s3 key or url

    private String socialLinks; // JSON string of { email, website, facebook, instagram }

    // The organisation's own address, and the trust anchor for administrator
    // changes. Distinct from the contact email inside socialLinks above, which
    // is public and owner-editable; this one only a platform ADMIN may write,
    // which is enforced by ClubUpdateRequest having no field for it at all.
    // Null for every club created before V13.
    @Column(name = "official_email")
    private String officialEmail;

    @Column(name = "official_email_verified_at")
    private Instant officialEmailVerifiedAt;

    // Club administration used to live here as a single club_admin_id. It is
    // now a club_admin_assignments row per administrator, so that a club can
    // have an owner plus several admins and a user can manage more than one
    // club. See com.campusvibe.clubadmin.ClubAdminAssignment.

    @Column(nullable = false)
    private Boolean featured = false;

    @ElementCollection
    @CollectionTable(name = "club_images", joinColumns = @JoinColumn(name = "club_id"))
    @Column(name = "url")
    private List<String> images = new ArrayList<>();

    // What kind of organisation this is -- one of the thirteen in
    // club_categories (V23). Nullable because every club predates the column
    // and there is no value that would be true for them; uncategorised means
    // nobody has said yet.
    @Column(name = "category_slug")
    private String categorySlug;

    // What this club is *about*, which is the axis that actually finds it.
    // Thirteen category labels cannot answer `show me AI clubs`; these can,
    // because they are interest_catalogue slugs -- the same vocabulary students
    // pick their own interests from, which makes matching a direct join.
    // See V25 and decision D7.
    @ElementCollection
    @CollectionTable(name = "club_interests", joinColumns = @JoinColumn(name = "club_id"))
    @Column(name = "interest_slug")
    private Set<String> interestSlugs = new HashSet<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
