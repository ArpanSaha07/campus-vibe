package com.campusvibe.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.Key;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;

import static java.time.temporal.ChronoUnit.DAYS;

@Service
public class JWTUtil {

    private final String secretKey;
    private final String issuer;

    public JWTUtil(@Value("${jwt.secret}") String secretKey,
                   @Value("${jwt.issuer}") String issuer) {
        this.secretKey = secretKey;
        this.issuer = issuer;
    }

    /**
     * Issues a token carrying identity + roles only (see .claude/user-roles.md):
     * subject = user id, claims = email and role names. No club ids, permissions
     * or profile data — ownership is always checked against the database.
     */
    public String issueToken(Long userId, String email, List<String> roles) {
        return Jwts
                .builder()
                .setClaims(Map.of("email", email, "roles", roles))
                .setSubject(String.valueOf(userId))
                .setIssuer(issuer)
                .setIssuedAt(Date.from(Instant.now()))
                .setExpiration(Date.from(Instant.now().plus(15, DAYS)))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    /** @return the user id the token was issued for */
    public String getSubject(String token) {
        return getClaims(token).getSubject();
    }

    public String getEmail(String token) {
        return getClaims(token).get("email", String.class);
    }

    @SuppressWarnings("unchecked")
    public List<String> getRoles(String token) {
        return getClaims(token).get("roles", List.class);
    }

    public boolean isTokenValid(String jwt, String expectedSubject) {
        try {
            return getSubject(jwt).equals(expectedSubject) && !isTokenExpired(jwt);
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Claims getClaims(String token) {
        return Jwts
                .parserBuilder()
                .setSigningKey(getSigningKey())
                .requireIssuer(issuer)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(secretKey.getBytes());
    }

    private boolean isTokenExpired(String jwt) {
        return getClaims(jwt).getExpiration().before(Date.from(Instant.now()));
    }
}
