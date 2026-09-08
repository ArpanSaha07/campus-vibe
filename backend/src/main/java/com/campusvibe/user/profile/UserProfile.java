package com.campusvibe.user.profile;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * What a student chooses to say about themselves.
 *
 * <p>Deliberately not fields on {@link com.campusvibe.user.User}. That entity is
 * the Spring Security principal and {@code JWTAuthenticationFilter} re-loads it
 * from the database on every authenticated request; nothing here is needed to
 * decide whether a request is allowed, so nothing here should be loaded to
 * decide it.
 *
 * <p>The id <em>is</em> the user id (V18 keys the table on {@code user_id}), so
 * there is no second surrogate key to keep in step and no way to end up with two
 * profiles for one person. Assigned rather than generated, which is why there is
 * no {@code @GeneratedValue}.
 *
 * <p>A row is created on first write, never at sign-up — see
 * {@link UserProfileService} for why absence has to be a supported state
 * regardless.
 */
@Entity
@Table(name = "user_profiles")
@Getter
@Setter
@NoArgsConstructor
public class UserProfile {

	@Id
	@Column(name = "user_id")
	private Long userId;

	@Column(name = "bio")
	private String bio;

	@Column(name = "faculty")
	private String faculty;

	@Column(name = "degree")
	private String degree;

	// Three columns rather than the opaque JSON string clubs.social_links uses.
	// See V18 for the reasoning; the short version is that a typed shape can be
	// validated on write and pinned by the API contract, and a blob cannot.
	@Column(name = "instagram_url")
	private String instagramUrl;

	@Column(name = "facebook_url")
	private String facebookUrl;

	@Column(name = "linkedin_url")
	private String linkedinUrl;

	@Column(name = "show_interests", nullable = false)
	private boolean showInterests = true;

	@Column(name = "show_social_links", nullable = false)
	private boolean showSocialLinks = true;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt = Instant.now();

	/*
	 * The two collections below follow the rule User already establishes for
	 * savedEventIds: Lombok generates no accessor, the getter hands out an
	 * unmodifiable view, and every change goes through replaceX().
	 *
	 * The second half of that rule is the one worth restating, because its
	 * obvious fix is wrong. Returning `new HashSet<>(field)` would also stop
	 * callers mutating the entity behind its back -- and would silently break
	 * persistence, because Hibernate replaces these fields with a PersistentSet
	 * that records each add and remove so it can emit SQL at flush. Mutating a
	 * copy writes nothing, commits nothing and throws nothing.
	 *
	 * The same reasoning forbids reassigning the field. replaceX() therefore
	 * clears and refills the live set rather than swapping in a new one: a
	 * swap makes Hibernate delete and reinsert every row, and here it would
	 * also lose the collection Hibernate is tracking.
	 */

	@ElementCollection(fetch = FetchType.LAZY)
	@CollectionTable(name = "user_profile_subjects", joinColumns = @JoinColumn(name = "user_id"))
	@Column(name = "subject")
	@Getter(AccessLevel.NONE)
	@Setter(AccessLevel.NONE)
	private Set<String> subjects = new HashSet<>();

	@ElementCollection(fetch = FetchType.LAZY)
	@CollectionTable(name = "user_interests", joinColumns = @JoinColumn(name = "user_id"))
	@Column(name = "interest_slug")
	@Getter(AccessLevel.NONE)
	@Setter(AccessLevel.NONE)
	private Set<String> interestSlugs = new HashSet<>();

	public UserProfile(Long userId) {
		this.userId = userId;
	}

	public Set<String> getSubjects() {
		return Collections.unmodifiableSet(subjects);
	}

	public void replaceSubjects(Collection<String> next) {
		subjects.clear();
		subjects.addAll(next);
	}

	public Set<String> getInterestSlugs() {
		return Collections.unmodifiableSet(interestSlugs);
	}

	public void replaceInterestSlugs(Collection<String> next) {
		interestSlugs.clear();
		interestSlugs.addAll(next);
	}
}
