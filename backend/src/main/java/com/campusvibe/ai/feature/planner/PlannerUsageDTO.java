package com.campusvibe.ai.feature.planner;

import java.time.Instant;

/**
 * Today's planner messages for one user.
 *
 * @param resetsAt the next midnight in America/Toronto
 */
public record PlannerUsageDTO(int used, int limit, Instant resetsAt) {}
