package com.campusvibe.instagram;

/**
 * Saves a club's Instagram handle and its auto-import choice together.
 *
 * @param handle     a handle, @handle or instagram.com link; blank disconnects
 * @param autoImport whether scheduled runs import the account; null leaves it as it is
 */
public record ClubInstagramUpdateRequest(String handle, Boolean autoImport) {
}
