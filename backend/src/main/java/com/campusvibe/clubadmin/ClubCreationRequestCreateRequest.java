package com.campusvibe.clubadmin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * An ordinary user proposing a club.
 *
 * <p>Text only, and that is a decision rather than an oversight: a logo or a
 * banner needs a club id and an S3 key, and neither exists before approval. The
 * requester adds images from {@code /manage/[clubId]} once they are the owner,
 * so the proposal form renders no image controls at all.
 *
 * <p>Mirrors {@code ClubCreateRequest} plus {@code message}. Adding a field to
 * one and not the other is the duplication ADR-005 accepts and names as the
 * first thing to check when the club model grows.
 */
public record ClubCreationRequestCreateRequest(
        @NotBlank @Size(max = 255) String id,
        @NotBlank @Size(max = 100) String name,
        @Size(max = 1000) String description,
        String category,
        List<String> interests,
        @Size(max = 2000) String message
) {}
