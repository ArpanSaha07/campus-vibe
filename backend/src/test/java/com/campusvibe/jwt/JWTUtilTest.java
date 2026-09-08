package com.campusvibe.jwt;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class JWTUtilTest {

    private static final String SECRET = "test-secret-0123456789-0123456789-0123456789-0123456789";

    private JWTUtil jwtUtil;

    @BeforeEach
    void setUp() {
        jwtUtil = new JWTUtil(SECRET, "campusvibe");
    }

    @Test
    void tokenCarriesIdentityAndRolesOnly() {
        String token = jwtUtil.issueToken(42L, "user@campus.com", List.of("ROLE_USER", "ROLE_ADMIN"));

        assertEquals("42", jwtUtil.getSubject(token));
        assertEquals("user@campus.com", jwtUtil.getEmail(token));
        assertEquals(List.of("ROLE_USER", "ROLE_ADMIN"), jwtUtil.getRoles(token));
    }

    @Test
    void tokenIsValidForItsSubject() {
        String token = jwtUtil.issueToken(7L, "a@b.com", List.of("ROLE_USER"));

        assertTrue(jwtUtil.isTokenValid(token, "7"));
        assertFalse(jwtUtil.isTokenValid(token, "8"));
    }

    @Test
    void tamperedTokenIsRejected() {
        String token = jwtUtil.issueToken(7L, "a@b.com", List.of("ROLE_USER"));
        String tampered = token.substring(0, token.length() - 4) + "AAAA";

        assertFalse(jwtUtil.isTokenValid(tampered, "7"));
    }

    @Test
    void tokenSignedWithDifferentSecretIsRejected() {
        JWTUtil other = new JWTUtil("other-secret-9876543210-9876543210-9876543210-987654", "campusvibe");
        String foreign = other.issueToken(7L, "a@b.com", List.of("ROLE_ADMIN"));

        assertFalse(jwtUtil.isTokenValid(foreign, "7"));
    }

    @Test
    void tokenFromDifferentIssuerIsRejected() {
        JWTUtil other = new JWTUtil(SECRET, "someone-else");
        String foreign = other.issueToken(7L, "a@b.com", List.of("ROLE_USER"));

        assertFalse(jwtUtil.isTokenValid(foreign, "7"));
    }

    @Test
    void garbageTokenIsRejectedNotThrown() {
        assertFalse(jwtUtil.isTokenValid("not-a-jwt", "7"));
    }
}
