package com.campusvibe.ai.feature.planner;

/**
 * One recommended item in an answer (ADR-019).
 *
 * @param kind   {@code event} or {@code club}; every pick in one answer has the same kind
 * @param id     an event id as a string, or a club slug
 * @param reason continues a sentence that starts with the item's name
 */
public record PlannerPickDTO(String kind, String id, String reason) {

    public static final String EVENT = "event";
    public static final String CLUB = "club";
}
