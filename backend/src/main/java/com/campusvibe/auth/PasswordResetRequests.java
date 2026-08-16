package com.campusvibe.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request bodies for the password-reset and email-verification flows. */
public final class PasswordResetRequests {

    private PasswordResetRequests() {}

    public record ForgotPasswordRequest(
            @NotBlank @Email String email
    ) {}

    public record ResetPasswordRequest(
            @NotBlank String token,
            // Same bounds as RegisterRequest: 8 minimum, and 72 because bcrypt
            // silently truncates beyond that.
            @NotBlank @Size(min = 8, max = 72) String password
    ) {}

    public record VerifyEmailRequest(
            @NotBlank String token
    ) {}
}
