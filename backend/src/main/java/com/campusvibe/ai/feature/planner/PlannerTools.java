package com.campusvibe.ai.feature.planner;

import com.campusvibe.ai.client.LlmRequest;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The seven tools the planner offers the model (ADR-023). Each takes a list
 * of ids, so one call can follow several clubs: the request turns parallel tool
 * calls off, because strict argument schemas are not guaranteed for them.
 *
 * <p>The descriptions tell the model what each tool is for; what it is
 * <em>allowed</em> to do is decided by {@link PlannerToolExecutor}, never here.
 */
final class PlannerTools {

    static final String FOLLOW_CLUB = "follow_club";
    static final String UNFOLLOW_CLUB = "unfollow_club";
    static final String RSVP_EVENT = "rsvp_event";
    static final String CANCEL_RSVP = "cancel_rsvp";
    static final String SAVE_EVENT = "save_event";
    static final String UNSAVE_EVENT = "unsave_event";
    static final String OFFER_CALENDAR_LINK = "offer_calendar_link";

    private PlannerTools() {}

    static List<LlmRequest.Tool> all() {
        return List.of(
                tool(FOLLOW_CLUB, "Follow clubs for the student. Use when they ask to follow or join a club's updates."),
                tool(UNFOLLOW_CLUB, "Stop following clubs the student follows."),
                tool(RSVP_EVENT, "Mark the student as going to events. Use when they say they will participate, "
                        + "go, attend, book or RSVP."),
                tool(CANCEL_RSVP, "Cancel the student's RSVP to events they said they were going to."),
                tool(SAVE_EVENT, "Save (bookmark) events for the student. Use when they ask to save, "
                        + "bookmark or keep an event for later."),
                tool(UNSAVE_EVENT, "Remove events from the student's saved events."),
                tool(OFFER_CALENDAR_LINK, "Show an Add to Google Calendar link for events. Use when the student "
                        + "asks to add an event to their calendar. This does not write to their calendar: they "
                        + "click the link to confirm."));
    }

    /** What the page shows while a tool runs, in the {@code status} frame. */
    static String statusLine(String toolName) {
        return switch (toolName) {
            case FOLLOW_CLUB -> "Following clubs…";
            case UNFOLLOW_CLUB -> "Unfollowing clubs…";
            case RSVP_EVENT -> "RSVPing to events…";
            case CANCEL_RSVP -> "Cancelling RSVPs…";
            case SAVE_EVENT -> "Saving events…";
            case UNSAVE_EVENT -> "Removing saved events…";
            case OFFER_CALENDAR_LINK -> "Getting a calendar link…";
            default -> "Working on it…";
        };
    }

    private static LlmRequest.Tool tool(String name, String description) {
        Map<String, Object> ids = new LinkedHashMap<>();
        ids.put("type", "array");
        ids.put("description", "Ids copied exactly from the candidates, or from the student's earlier actions.");
        ids.put("items", Map.of("type", "string"));

        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("type", "object");
        parameters.put("properties", Map.of("ids", ids));
        parameters.put("required", List.of("ids"));
        parameters.put("additionalProperties", false);
        return new LlmRequest.Tool(name, description, parameters);
    }
}
