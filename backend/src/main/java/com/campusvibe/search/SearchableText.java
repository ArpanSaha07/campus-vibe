package com.campusvibe.search;

import com.campusvibe.club.Club;
import com.campusvibe.event.Event;

import java.util.Collection;
import java.util.stream.Collectors;

/**
 * Builds the combined text that gets embedded for an event or club.
 *
 * <p>Tags arrive as <strong>labels, not slugs</strong>, and the caller resolves
 * them. {@code ai-machine-learning} embeds badly and {@code AI & machine
 * learning} embeds well, so passing slugs here would quietly make the semantic
 * leg worse than passing nothing at all.
 *
 * <p>Including them is what lets a search for <em>tech</em> reach a departmental
 * society whose description never happens to use the word. Treat the tag join as
 * the load-bearing path and this as the bonus.
 */
public final class SearchableText {

    private SearchableText() {}

    public static String forEvent(Event event, Collection<String> tagLabels) {
        String organizer = event.getOrganizer() != null ? event.getOrganizer().getName() : "";
        return join(event.getTitle(), event.getDescription(), organizer,
                joinLabels(tagLabels), event.getLocation());
    }

    public static String forClub(Club club, Collection<String> tagLabels) {
        return join(club.getName(), club.getDescription(), joinLabels(tagLabels));
    }

    private static String joinLabels(Collection<String> labels) {
        return labels == null || labels.isEmpty() ? "" : String.join(", ", labels);
    }

    private static String join(String... parts) {
        return java.util.Arrays.stream(parts)
                .filter(p -> p != null && !p.isBlank())
                .collect(Collectors.joining("\n"));
    }
}
