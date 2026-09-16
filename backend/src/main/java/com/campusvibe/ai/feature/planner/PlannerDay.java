package com.campusvibe.ai.feature.planner;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * The planner's day is America/Toronto's, whatever zone the server runs in
 * (UTC in every environment). The daily quota is counted per such day and
 * resets at its midnight, and the model is told the date in this zone so
 * that tonight and this weekend mean what a student in Montreal means.
 */
public final class PlannerDay {

    public static final ZoneId ZONE = ZoneId.of("America/Toronto");

    private PlannerDay() {}

    public static LocalDate of(Instant instant) {
        return instant.atZone(ZONE).toLocalDate();
    }

    /** The midnight that ends the day holding {@code instant}. 23 or 25 hours away on a changeover day. */
    public static Instant resetsAt(Instant instant) {
        return of(instant).plusDays(1).atStartOfDay(ZONE).toInstant();
    }
}
