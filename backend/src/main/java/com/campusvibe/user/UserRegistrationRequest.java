package com.campusvibe.user;

public record UserRegistrationRequest(
        String name,
        String email,
        String password
) {
}

