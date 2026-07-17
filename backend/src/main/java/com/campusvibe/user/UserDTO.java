package com.campusvibe.user;

import java.time.Instant;
import java.util.List;

public record UserDTO(
	Long id,
	String name,
	String email,
	List<String> roles,
	Instant createdAt
) {}
