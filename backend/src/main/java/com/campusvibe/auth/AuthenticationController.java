package com.campusvibe.auth;

import com.campusvibe.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("api/v1/auth")
@Validated // needed for constraints on @RequestParam, unlike @Valid on a body
public class AuthenticationController {

    private final AuthenticationService authenticationService;

    public AuthenticationController(AuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
    }

    @PostMapping("login")
    public ResponseEntity<AuthenticationResponse> login(@Valid @RequestBody AuthenticationRequest request) {
        AuthenticationResponse response = authenticationService.login(request);
        return ResponseEntity.ok()
                .header(HttpHeaders.AUTHORIZATION, response.token())
                .body(response);
    }

    @PostMapping("register")
    public ResponseEntity<AuthenticationResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthenticationResponse response = authenticationService.register(request);
        return ResponseEntity.ok()
                .header(HttpHeaders.AUTHORIZATION, response.token())
                .body(response);
    }

    @PostMapping("google")
    public ResponseEntity<AuthenticationResponse> google(@Valid @RequestBody GoogleSignInRequest request) {
        AuthenticationResponse response = authenticationService.googleSignIn(request);
        return ResponseEntity.ok()
                .header(HttpHeaders.AUTHORIZATION, response.token())
                .body(response);
    }

    /**
     * Whether an address is already taken, and by which provider — asked by the
     * signup form as soon as the email field is complete, so someone who first
     * signed up with Google is told to use Google rather than being refused at
     * the end of a form they have already filled in.
     *
     * <p>This is the one endpoint that deliberately confirms an account exists.
     * See AuthenticationService.emailStatus for the reasoning and the trade.
     */
    @GetMapping("email-status")
    public ResponseEntity<EmailStatusResponse> emailStatus(
            @RequestParam @NotBlank @Email String email) {
        return ResponseEntity.ok(authenticationService.emailStatus(email));
    }

    /**
     * Starts a password reset.
     *
     * <p><b>Always 204</b>, whether or not the address exists, whether or not
     * it is a Google account, and whether or not mail actually went out. Any
     * variation here — a different status, a different body, a noticeably
     * different response time — is an account oracle. Unlike
     * {@code email-status}, nothing about the product needs this one to answer.
     */
    @PostMapping("forgot-password")
    public ResponseEntity<Void> forgotPassword(
            @Valid @RequestBody PasswordResetRequests.ForgotPasswordRequest request) {
        authenticationService.requestPasswordReset(request.email());
        return ResponseEntity.noContent().build();
    }

    /**
     * Completes a password reset. Returns 204 rather than a session: proving
     * inbox control is enough to change the password, and signing in afterwards
     * with the new one confirms it reached the right person.
     */
    @PostMapping("reset-password")
    public ResponseEntity<Void> resetPassword(
            @Valid @RequestBody PasswordResetRequests.ResetPasswordRequest request) {
        authenticationService.resetPassword(request.token(), request.password());
        return ResponseEntity.noContent().build();
    }

    /** Confirms an address from a mailed link. Unauthenticated: the token is the proof. */
    @PostMapping("verify-email")
    public ResponseEntity<Void> verifyEmail(
            @Valid @RequestBody PasswordResetRequests.VerifyEmailRequest request) {
        authenticationService.verifyEmail(request.token());
        return ResponseEntity.noContent().build();
    }

    /**
     * Re-sends the confirmation link. Requires a session, so it cannot be aimed
     * at a stranger's inbox.
     */
    @PostMapping("resend-verification")
    public ResponseEntity<Void> resendVerification(@AuthenticationPrincipal User user) {
        authenticationService.resendVerification(user);
        return ResponseEntity.noContent().build();
    }

}
