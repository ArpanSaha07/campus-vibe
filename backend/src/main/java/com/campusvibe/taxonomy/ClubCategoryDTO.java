package com.campusvibe.taxonomy;

/**
 * One club category on the wire. Mirrors {@code ClubCategory} in
 * {@code frontend/app/types/index.ts}.
 *
 * <p>No sort order: the endpoint returns the list already ordered, and sending
 * the number would invite a client to re-sort by it and then disagree with the
 * server about the answer.
 */
public record ClubCategoryDTO(
		String slug,
		String label
) {}
