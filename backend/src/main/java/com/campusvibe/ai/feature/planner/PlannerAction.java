package com.campusvibe.ai.feature.planner;

import java.util.List;
import java.util.stream.Collectors;

/**
 * One thing the agent did, or tried to do, to the student's account in a turn
 * (ADR-023). Stored on the assistant message as JSONB, so a reload and the
 * next turn's history both show it.
 *
 * @param type       {@code follow}, {@code unfollow}, {@code rsvp}, {@code cancel_rsvp},
 *                   {@code save}, {@code unsave} or {@code calendar}
 * @param targetKind {@code club} or {@code event}
 * @param id         a club slug, or an event id as a string
 * @param name       the club's name or the event's title when it was read, or the id
 *                   when the item does not exist
 * @param outcome    see the constants: what actually happened
 */
public record PlannerAction(String type, String targetKind, String id, String name, String outcome) {

    public static final String FOLLOW = "follow";
    public static final String UNFOLLOW = "unfollow";
    public static final String RSVP = "rsvp";
    public static final String CANCEL_RSVP = "cancel_rsvp";
    public static final String SAVE = "save";
    public static final String UNSAVE = "unsave";
    public static final String CALENDAR = "calendar";

    /** The account changed. */
    public static final String DONE = "done";
    /** Nothing to change: already following, already going, not saved. */
    public static final String UNCHANGED = "unchanged";
    /** A calendar link is in the answer; the student's click is the confirmation. */
    public static final String OFFERED = "offered";
    /** The event has ended (ADR-020), so it cannot be RSVPed, saved or added. */
    public static final String ENDED = "ended";
    /** No such club or event. */
    public static final String NOT_FOUND = "not_found";
    /** Outside the fence: neither shown this turn nor already the student's own. */
    public static final String NOT_ALLOWED = "not_allowed";

    /** True when the account was written, which makes the turn count even if it then fails. */
    public boolean changedAccount() {
        return DONE.equals(outcome);
    }

    /**
     * What a turn says when its actions ran but its answer failed (Arpan,
     * 2026-11-16: stored and counted). Lists only what took effect.
     */
    static String fallbackIntro(List<PlannerAction> actions) {
        String done = actions.stream()
                .filter(action -> DONE.equals(action.outcome()) || OFFERED.equals(action.outcome()))
                .map(PlannerAction::pastTense)
                .collect(Collectors.joining("; "));
        return done.isEmpty()
                ? PlannerReplyService.PROVIDER_ERROR_MESSAGE
                : "Done: " + done + ". I couldn't finish the rest of my answer, so ask again if you need more.";
    }

    private String pastTense() {
        return switch (type) {
            case FOLLOW -> "followed " + name;
            case UNFOLLOW -> "unfollowed " + name;
            case RSVP -> "you're going to " + name;
            case CANCEL_RSVP -> "cancelled your RSVP to " + name;
            case SAVE -> "saved " + name;
            case UNSAVE -> "removed " + name + " from your saved events";
            case CALENDAR -> "a Google Calendar link for " + name + " is below";
            default -> name;
        };
    }
}
