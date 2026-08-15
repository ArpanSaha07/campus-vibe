package com.campusvibe.auth.token;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface AuthTokenRepository extends JpaRepository<AuthToken, Long> {

    Optional<AuthToken> findByTokenHash(String tokenHash);

    /**
     * Invalidates every outstanding token of one purpose for a user.
     *
     * <p>Called when a new one is issued, so requesting a second reset link
     * silently kills the first. Without this, every link ever sent stays live
     * until it expires, and the number of working credentials for an account
     * grows with each request — including requests an attacker triggers.
     */
    @Modifying
    @Query("delete from AuthToken t where t.userId = :userId and t.purpose = :purpose")
    void deleteAllForUserAndPurpose(@Param("userId") Long userId,
                                    @Param("purpose") AuthTokenPurpose purpose);
}
