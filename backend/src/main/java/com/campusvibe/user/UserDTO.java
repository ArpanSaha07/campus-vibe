package com.campusvibe.user;

import java.time.Instant;

public record UserDTO(
	Long id,
	String name,
	String email,
	Role role,
	Instant dateJoined,
	String managedClubId
) {}
