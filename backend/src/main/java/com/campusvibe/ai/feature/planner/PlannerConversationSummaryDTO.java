package com.campusvibe.ai.feature.planner;

import java.time.Instant;

/** A saved chat as the sidebar lists it. */
public record PlannerConversationSummaryDTO(String id, String title, Instant lastActiveAt) {}
