package com.campusvibe.auth;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.jackson2.JacksonFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.GeneralSecurityException;
import java.io.IOException;
import java.util.Collections;

@Component
public class GoogleTokenVerifier {

    private final String clientId;
    private final GoogleIdTokenVerifier verifier;

    public GoogleTokenVerifier(@Value("${google.clientId:}") String clientId) throws Exception {
        this.clientId = clientId;
    this.verifier = new GoogleIdTokenVerifier.Builder(
        GoogleNetHttpTransport.newTrustedTransport(),
        JacksonFactory.getDefaultInstance()
    )
                .setAudience(clientId == null || clientId.isBlank() ? null : Collections.singletonList(clientId))
                .build();
    }

    public Object verify(String idToken) {
        try {
            GoogleIdToken token = verifier.verify(idToken);
            return token != null ? token.getPayload() : null;
        } catch (GeneralSecurityException | IOException e) {
            return null;
        }
    }
}
