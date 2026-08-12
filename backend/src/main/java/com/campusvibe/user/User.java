package com.campusvibe.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.Instant;
import java.util.Collection;
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

	@Column(nullable = false)
	private String password;

	// EAGER: the role set is tiny and is needed by getAuthorities() outside any session
	@ManyToMany(fetch = FetchType.EAGER)
	@JoinTable(
			name = "user_roles",
			joinColumns = @JoinColumn(name = "user_id"),
			inverseJoinColumns = @JoinColumn(name = "role_id"))
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
	private Set<Long> savedEventIds = new HashSet<>();

	@ElementCollection(fetch = FetchType.LAZY)
	@CollectionTable(name = "user_event_rsvps", joinColumns = @JoinColumn(name = "user_id"))
	@Column(name = "event_id")
	private Set<Long> goingEventIds = new HashSet<>();

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
