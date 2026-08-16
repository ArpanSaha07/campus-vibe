package com.campusvibe.auth;

import jakarta.validation.constraints.NotBlank;

public record GoogleSignInRequest(
        // @NotBlank so a missing token is a 400 like every other malformed
        // request. Without it the null reached Google's parser and surfaced as a
        // 500 echoing a JVM helpful-NPE message to the caller (BUG-029).
        @NotBlank String idToken
) {}
