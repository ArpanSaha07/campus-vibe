package com.campusvibe.ai.feature.planner;

/**
 * A new, empty chat.
 *
 * @param evictedId the least recently active chat, deleted to stay within 15, or null
 */
public record PlannerCreatedConversationDTO(PlannerConversationSummaryDTO conversation, String evictedId) {}
