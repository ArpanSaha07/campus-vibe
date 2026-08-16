package com.campusvibe.auth.token;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * A single-use secret proving the holder controls an inbox.
 *
 * <p>Only the SHA-256 of the token is stored. The token itself exists once, in
 * the email that carried it — a database dump must not hand over working reset
 * links.
 */
@Entity
@Table(name = "auth_tokens")
@Getter
@Setter
@NoArgsConstructor
public class AuthToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "token_hash", nullable = false, unique = true)
    private String tokenHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AuthTokenPurpose purpose;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    /** Non-null once redeemed. The row is kept so a replay is distinguishable. */
    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public boolean isUsable(Instant now) {
        return usedAt == null && expiresAt.isAfter(now);
    }
}
