package com.campusvibe.clubadmin;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

/**
 * A platform admin setting a club's official email address.
 *
 * <p>Nullable on purpose: sending {@code null} clears the address, which is the
 * only way to undo a mistake. {@code @Email} therefore has to tolerate null,
 * which it does — an absent value is not an invalid one.
 *
 * <p>Deliberately its own payload rather than a field on
 * {@code ClubUpdateRequest}. That record is reachable by any club owner through
 * {@code PUT /clubs/{id}}, and the whole point of this column is that the people
 * who currently run a club cannot change the address it can be recovered
 * through. Keeping the field out of that record is the enforcement.
 */
public record ClubOfficialEmailRequest(
        @Email @Size(max = 255) String officialEmail
) {}
