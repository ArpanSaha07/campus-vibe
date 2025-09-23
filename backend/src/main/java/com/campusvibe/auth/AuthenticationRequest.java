package com.campusvibe.auth;

public record AuthenticationRequest(
        String username,
        String password
) {
}
