package com.campusvibe.ai.feature.planner;

import com.campusvibe.club.ClubDTO;
import com.campusvibe.event.EventDTO;

import java.time.Instant;
import java.util.List;

/**
 * One stored turn.
 *
 * @param content the user's text, or the assistant's intro
 * @param status  always {@code complete}: a failed or stopped reply is never stored
 * @param events  the picked events, hydrated on this read; one that has ended or
 *                been deleted is absent
 * @param clubs   the picked clubs, hydrated the same way
 */
public record PlannerMessageDTO(String id,
                                String role,
                                String content,
                                String status,
                                List<PlannerPickDTO> picks,
                                List<EventDTO> events,
                                List<ClubDTO> clubs,
                                Instant createdAt) {}
