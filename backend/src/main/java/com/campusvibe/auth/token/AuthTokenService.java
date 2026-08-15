package com.campusvibe.auth.token;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

/**
 * Issues and redeems the single-use tokens behind password reset and email
 * verification.
 *
 * <p>Both flows are the same object with a different purpose, so the rules that
 * must not drift — how the secret is generated, that only its hash is stored,
 * single use, expiry, and that issuing invalidates the previous one — live here
 * once.
 */
@Service
public class AuthTokenService {

    /** 32 bytes of CSPRNG output. Long enough that guessing is not a strategy. */
    private static final int TOKEN_BYTES = 32;

    private final AuthTokenRepository repository;
    private final SecureRandom random = new SecureRandom();

    public AuthTokenService(AuthTokenRepository repository) {
        this.repository = repository;
    }

    /**
     * Issues a token and returns the **raw** value, which is the only time it
     * exists outside the email. Any previous token of the same purpose for this
     * user is deleted first.
     */
    @Transactional
    public String issue(Long userId, AuthTokenPurpose purpose, Duration ttl) {
        repository.deleteAllForUserAndPurpose(userId, purpose);

        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        AuthToken token = new AuthToken();
        token.setUserId(userId);
        token.setTokenHash(hash(raw));
        token.setPurpose(purpose);
        token.setExpiresAt(Instant.now().plus(ttl));
        repository.save(token);

        return raw;
    }

    /**
     * Redeems a token, marking it used.
     *
     * @return the user id it was issued for, or empty if the token is unknown,
     *         expired, already used, or issued for a different purpose
     */
    @Transactional
    public Optional<Long> redeem(String rawToken, AuthTokenPurpose purpose) {
        if (rawToken == null || rawToken.isBlank()) return Optional.empty();

        return repository.findByTokenHash(hash(rawToken))
                .filter(t -> t.getPurpose() == purpose)
                .filter(t -> t.isUsable(Instant.now()))
                .map(t -> {
                    t.setUsedAt(Instant.now());
                    repository.save(t);
                    return t.getUserId();
                });
    }

    /**
     * SHA-256, not bcrypt. A reset token is 256 bits of random already, so
     * there is no low-entropy secret for a slow hash to protect — and lookup
     * happens *by hash*, which a per-row salt would make impossible without
     * scanning every token in the table.
     */
    private static String hash(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] out = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(out);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is mandated by the JLS; if it is missing the JVM is broken.
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
