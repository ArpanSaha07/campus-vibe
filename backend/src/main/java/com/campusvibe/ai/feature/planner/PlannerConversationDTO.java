package com.campusvibe.ai.feature.planner;

import java.time.Instant;
import java.util.List;

/** A saved chat with its messages, oldest first. */
public record PlannerConversationDTO(String id, String title, Instant lastActiveAt, List<PlannerMessageDTO> messages) {}
