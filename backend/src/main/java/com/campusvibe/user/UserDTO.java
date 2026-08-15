package com.campusvibe.user;

import java.time.Instant;
import java.util.List;

public record UserDTO(
	Long id,
	String name,
	String email,
	List<String> roles,
	Instant createdAt,
	// Exposed so the UI can prompt an unverified user to check their inbox.
	// Not an authorisation signal — the backend decides what unverified may do.
	boolean emailVerified,
	String authProvider
) {}
