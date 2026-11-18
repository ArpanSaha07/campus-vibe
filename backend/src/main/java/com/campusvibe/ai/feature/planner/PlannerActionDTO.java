package com.campusvibe.ai.feature.planner;

import com.campusvibe.event.EventDTO;

/**
 * A {@link PlannerAction} as the page receives it.
 *
 * @param event the event, read now, for a {@code calendar} action whose outcome is
 *              {@code offered}, so the page can build the Google Calendar template
 *              link; null otherwise, and null once that event has ended or gone
 */
public record PlannerActionDTO(String type,
                               String targetKind,
                               String id,
                               String name,
                               String outcome,
                               EventDTO event) {}
