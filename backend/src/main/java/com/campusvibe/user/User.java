package com.campusvibe.user;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.Instant;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User implements UserDetails {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private String name;

	@Column(nullable = false, unique = true)
	private String email;

	// Nullable since V10: a Google account has no password. Every read of this
	// field must cope with null — EmailPasswordAuthenticationProvider is the one
	// that matters, and it rejects rather than calling matches() on null.
	@Column
	private String password;

	@Enumerated(EnumType.STRING)
	@Column(name = "auth_provider", nullable = false)
	private AuthProvider authProvider = AuthProvider.LOCAL;

	// Whether the address has been proven. GOOGLE accounts are true on creation
	// (googleSignIn refuses a token whose email_verified claim is not set);
	// LOCAL accounts start false and are flipped by redeeming a mailed token.
	// Only enforced at login when campusvibe.auth.require-verified-email is on.
	@Column(name = "email_verified", nullable = false)
	private boolean emailVerified = false;

	// EAGER: the role set is tiny and is needed by getAuthorities() outside any session
	@ManyToMany(fetch = FetchType.EAGER)
	@JoinTable(
			name = "user_roles",
			joinColumns = @JoinColumn(name = "user_id"),
			inverseJoinColumns = @JoinColumn(name = "role_id"))
	@Getter(AccessLevel.NONE)
	@Setter(AccessLevel.NONE)
	private Set<Role> roles = new HashSet<>();

	@Column(name = "created_at", nullable = false)
	private Instant createdAt = Instant.now();

	// Event ids rather than @ManyToMany Event: this entity is the security
	// principal, loaded on every authenticated request, and mapping the events
	// themselves would invite a lazy-initialization failure the moment anything
	// outside a transaction touched them. Ids are enough to answer "is this
	// saved?" and to fetch the events deliberately when a caller wants them.
	// LAZY for the same reason — no request should pay for these unless it asks.
	@ElementCollection(fetch = FetchType.LAZY)
	@CollectionTable(name = "user_saved_events", joinColumns = @JoinColumn(name = "user_id"))
	@Column(name = "event_id")
	@Getter(AccessLevel.NONE)
	@Setter(AccessLevel.NONE)
	private Set<Long> savedEventIds = new HashSet<>();

	@ElementCollection(fetch = FetchType.LAZY)
	@CollectionTable(name = "user_event_rsvps", joinColumns = @JoinColumn(name = "user_id"))
	@Column(name = "event_id")
	@Getter(AccessLevel.NONE)
	@Setter(AccessLevel.NONE)
	private Set<Long> goingEventIds = new HashSet<>();

	/*
	 * The three collections above are handed out as unmodifiable views, and every
	 * change goes through a named mutator. Lombok generates no accessor for them.
	 *
	 * Two reasons, and the second is why the first one's obvious fix is wrong:
	 *
	 * 1. A getter that returns the field itself lets a caller change this entity
	 *    behind its back (CodeQL java/internal-representation-exposure).
	 *
	 * 2. Returning `new HashSet<>(field)` instead — which Copilot Autofix proposed
	 *    in 1562eae — silently breaks persistence. Hibernate replaces these fields
	 *    with a PersistentSet that records each add and remove so it can emit SQL
	 *    at flush. Mutating a copy of it writes nothing, commits nothing and
	 *    throws nothing; the change is simply lost. It took MyEventsIT down with
	 *    it, which is the only reason we noticed.
	 *
	 * An unmodifiable view wraps the live PersistentSet rather than replacing it,
	 * so Hibernate still sees mutations made through the mutators, while
	 * `getRoles().add(...)` now fails loudly instead of quietly doing nothing.
	 * Do not reassign these fields either: swapping the PersistentSet out makes
	 * Hibernate delete and reinsert every row.
	 */

	public Set<Role> getRoles() {
		return Collections.unmodifiableSet(roles);
	}

	public void addRole(Role role) {
		roles.add(role);
	}

	public Set<Long> getSavedEventIds() {
		return Collections.unmodifiableSet(savedEventIds);
	}

	public void addSavedEvent(Long eventId) {
		savedEventIds.add(eventId);
	}

	public void removeSavedEvent(Long eventId) {
		savedEventIds.remove(eventId);
	}

	public Set<Long> getGoingEventIds() {
		return Collections.unmodifiableSet(goingEventIds);
	}

	public void addGoingEvent(Long eventId) {
		goingEventIds.add(eventId);
	}

	public void removeGoingEvent(Long eventId) {
		goingEventIds.remove(eventId);
	}
	// Club ids are slugs (Club.id is a String), so this collection is typed
	// String where the event ones are Long. Same reasoning as above otherwise:
	// ids rather than mapped Club entities, LAZY so an ordinary authenticated
	// request never loads them. The table is already in place from V4.
	@ElementCollection(fetch = FetchType.LAZY)
	@CollectionTable(name = "user_followed_clubs", joinColumns = @JoinColumn(name = "user_id"))
	@Column(name = "club_id")
	private Set<String> followedClubIds = new HashSet<>();

	public boolean hasRole(RoleName roleName) {
		return roles.stream().anyMatch(r -> r.getName().equals(roleName.name()));
	}

	public List<String> getRoleNames() {
		return roles.stream().map(Role::getName).sorted().toList();
	}

	@Override
	public Collection<? extends GrantedAuthority> getAuthorities() {
		return roles.stream()
				.map(role -> new SimpleGrantedAuthority(role.getName()))
				.toList();
	}

	@Override
	public String getUsername() {
		return email;
	}

	@Override
	public boolean isAccountNonExpired() { return true; }

	@Override
	public boolean isAccountNonLocked() { return true; }

	@Override
	public boolean isCredentialsNonExpired() { return true; }

	@Override
	public boolean isEnabled() { return true; }
}
