package com.campusvibe.ai.feature.planner;

import java.time.Duration;

/**
 * The planner's bounds, all decided by Arpan (AI planner plan, 2026-09-15, and
 * spec 2026-09-16-planner-backend). The page states several of them too, in
 * {@code frontend/app/lib/planner.ts}; change both or neither.
 */
public final class PlannerLimits {

    /** Saved chats per user. Creating one more deletes the least recently active. */
    public static final int MAX_CONVERSATIONS = 15;

    /** Messages per user per America/Toronto day, across every chat. */
    public static final int DAILY_MESSAGES = 15;

    /** Longest message, in characters. The page's MAX_PROMPT_LENGTH. */
    public static final int MAX_PROMPT_LENGTH = 1000;

    /** Messages a chat holds; a send that would pass it is refused with an error frame. */
    public static final int MAX_MESSAGES_PER_CONVERSATION = 40;

    /** Earlier messages sent to the model with each new one. */
    public static final int HISTORY_MESSAGES = 10;

    /** Candidates offered to the model per message. */
    public static final int MAX_CANDIDATE_EVENTS = 15;
    public static final int MAX_CANDIDATE_CLUBS = 6;

    /** Picks kept in one answer: one card row. */
    public static final int MAX_PICKS = 6;

    /** How far ahead retrieval looks. Running events are always in. */
    public static final Duration WINDOW = Duration.ofDays(30);

    /** A chat's title is its first message cut to this many characters. */
    public static final int TITLE_LENGTH = 60;

    private PlannerLimits() {}
}
