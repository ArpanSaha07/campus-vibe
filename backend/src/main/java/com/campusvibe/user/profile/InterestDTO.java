package com.campusvibe.user.profile;

/**
 * One entry of the interest vocabulary, for the picker.
 *
 * <p>{@code sortOrder} deliberately does not cross the wire: the endpoint
 * returns the list already in order, so sending the number would invite a
 * client to re-sort by it and then disagree with the server about the answer.
 */
public record InterestDTO(
		String slug,
		String label,
		String category
) {}
