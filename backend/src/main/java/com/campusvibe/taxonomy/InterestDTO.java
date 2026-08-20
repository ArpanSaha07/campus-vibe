package com.campusvibe.taxonomy;

/**
 * One entry of the interest vocabulary, for the picker.
 *
 * <p>The response holds both levels: the twelve groups come through with a
 * null {@code parentSlug}, and each interest names the group it hangs under. A
 * client renders headings from the former and pills from the latter, which is
 * why the group label is not repeated on every row.
 *
 * <p>{@code sortOrder} deliberately does not cross the wire: the endpoint
 * returns the list already in order, so sending the number would invite a
 * client to re-sort by it and then disagree with the server about the answer.
 */
public record InterestDTO(
		String slug,
		String label,
		String parentSlug
) {}
