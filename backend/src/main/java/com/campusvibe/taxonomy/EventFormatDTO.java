package com.campusvibe.taxonomy;

/**
 * One event format on the wire. Mirrors {@code EventFormat} in
 * {@code frontend/app/types/index.ts}.
 *
 * <p>{@code groupLabel} crosses the wire where the interest catalogue sends a
 * {@code parentSlug} instead, and the asymmetry is deliberate: an interest
 * group is a row something can be tagged with, so it needs an identity, while a
 * format group is only ever a heading on a picker.
 */
public record EventFormatDTO(
		String slug,
		String label,
		String groupLabel
) {}
