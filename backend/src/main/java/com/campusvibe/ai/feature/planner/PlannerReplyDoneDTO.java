package com.campusvibe.ai.feature.planner;

import com.campusvibe.club.ClubDTO;
import com.campusvibe.event.EventDTO;

import java.util.List;

/**
 * The {@code done} frame that closes a streamed reply (ADR-019): the stored
 * reply's id, its picks and their cards, the usage after this message, and the
 * chat's summary, whose title the first reply sets.
 */
public record PlannerReplyDoneDTO(String messageId,
                                  List<PlannerPickDTO> picks,
                                  List<EventDTO> events,
                                  List<ClubDTO> clubs,
                                  PlannerUsageDTO usage,
                                  PlannerConversationSummaryDTO conversation) {}
