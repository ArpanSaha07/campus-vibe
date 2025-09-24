package com.campusvibe.auth;

public record RegisterRequest(
        String name,
        String email,
        String password
) {}
