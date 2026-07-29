package com.campusvibe.search;

import com.campusvibe.club.Club;
import com.campusvibe.event.Event;

import java.util.stream.Collectors;

/** Builds the combined text that gets embedded for an event or club. */
public final class SearchableText {

    private SearchableText() {}

    public static String forEvent(Event event) {
        String categories = event.getCategories() == null
                ? ""
                : String.join(" ", event.getCategories());
        String organizer = event.getOrganizer() != null ? event.getOrganizer().getName() : "";
        return join(event.getTitle(), event.getDescription(), organizer, categories, event.getLocation());
    }

    public static String forClub(Club club) {
        return join(club.getName(), club.getDescription());
    }

    private static String join(String... parts) {
        return java.util.Arrays.stream(parts)
                .filter(p -> p != null && !p.isBlank())
                .collect(Collectors.joining("\n"));
    }
}
