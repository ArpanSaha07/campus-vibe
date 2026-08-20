package com.campusvibe.user.profile;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Profiles by user id — the id of a profile is the id of the person it
 * describes, so {@code findById} is already "find this user's profile" and
 * there is no derived query to add.
 */
public interface UserProfileRepository extends JpaRepository<UserProfile, Long> {
}
