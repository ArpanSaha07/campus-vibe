package com.campusvibe.ai.feature.planner;

import java.util.List;

/** Every saved chat, most recently active first, with today's usage. */
public record PlannerConversationListDTO(List<PlannerConversationSummaryDTO> conversations, PlannerUsageDTO usage) {}
