package com.campusvibe.auth;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.GeneralSecurityException;
import java.io.IOException;
import java.util.Collections;

/**
 * Verifies a Google ID token: signature against Google's published keys, issuer,
 * audience and expiry.
 */
@Component
public class GoogleTokenVerifier {

    private static final Logger log = LoggerFactory.getLogger(GoogleTokenVerifier.class);

    /** Null when no client id is configured, which disables Google sign-in. */
    private final GoogleIdTokenVerifier verifier;

    public GoogleTokenVerifier(@Value("${google.clientId:}") String clientId) throws Exception {
        if (clientId == null || clientId.isBlank()) {
            // Fail closed, not open (BUG-030). The previous version passed a null
            // audience to the builder, and a null audience makes the underlying
            // IdTokenVerifier *skip* the audience check rather than reject
            // everything — so any Google ID token issued to any OAuth client in
            // the world verified, and POST /api/v1/auth/google is permitAll and
            // auto-creates users from whatever email the token carries.
            this.verifier = null;
            log.warn("Google sign-in is DISABLED: GOOGLE_CLIENT_ID is not set. "
                    + "POST /api/v1/auth/google will reject every token.");
        } else {
            this.verifier = new GoogleIdTokenVerifier.Builder(
                    GoogleNetHttpTransport.newTrustedTransport(),
                    // GsonFactory, not the deprecated JacksonFactory.
                    GsonFactory.getDefaultInstance())
                    .setAudience(Collections.singletonList(clientId))
                    .build();
        }
    }

    /** @return the verified payload, or null if the token is unusable for any reason. */
    public GoogleIdToken.Payload verify(String idToken) {
        if (verifier == null || idToken == null || idToken.isBlank()) {
            return null;
        }
        try {
            GoogleIdToken token = verifier.verify(idToken);
            return token != null ? token.getPayload() : null;
        } catch (GeneralSecurityException | IOException e) {
            return null;
        } catch (IllegalArgumentException e) {
            // A structurally malformed token (no dots, undecodable segments) is
            // rejected by the *parser*, before verification, with an unchecked
            // exception — and one thrown by a bare Preconditions.checkArgument,
            // so its message is null. Letting it escape turned a bad token into
            // a 500 with an empty body instead of a 401 (BUG-028).
            return null;
        }
    }
}
