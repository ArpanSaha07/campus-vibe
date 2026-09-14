package com.campusvibe.clubadmin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * An ordinary user proposing a club.
 *
 * <p><strong>No images, and that is a decision rather than an oversight:</strong>
 * a logo or a banner needs a club id and an S3 key, and neither exists before
 * approval. The requester adds images from {@code /manage/[clubId]} once they
 * are the owner, so the proposal form renders no image controls at all.
 *
 * <p>This once said <em>text only</em> and meant it: the contact links were
 * dropped too, so a club born by proposal reached its public page with an empty
 * contact block. They are carried here now, and onto the club at approval —
 * only the images wait. See the amendment to ADR-004.
 *
 * <p>Mirrors {@code ClubCreateRequest} plus {@code message} and
 * {@code socialLinks}. Adding a field to one and not the other is the
 * duplication ADR-005 accepts and names as the first thing to check when the
 * club model grows — and dropping the links was exactly that, caught by a human
 * reading the form rather than by anything in the build.
 */
public record ClubCreationRequestCreateRequest(
        @NotBlank @Size(max = 255) String id,
        @NotBlank @Size(max = 100) String name,
        @Size(max = 1000) String description,
        String category,
        List<String> interests,
        @Size(max = 2000) String message,
        /**
         * The four contact values as a JSON string, the shape
         * {@code clubs.social_links} already uses. Optional on this path, unlike
         * the admin form where the contact email is required: a student
         * proposing a club may not have an address for it yet.
         * {@code ClubSocialLinks.normalise} both validates and re-serialises it.
         */
        @Size(max = 2000) String socialLinks
) {}
