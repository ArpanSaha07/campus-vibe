package com.campusvibe.ai.feature.planner;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/** The quota day is Montreal's, whatever zone the server runs in (UTC everywhere). */
class PlannerDayTest {

    @Test
    void aUtcInstantAfterMidnightIsStillTheEveningBeforeInMontreal() {
        // 03:30 UTC on the 17th is 23:30 EDT on the 16th.
        Instant lateEvening = Instant.parse("2026-09-17T03:30:00Z");

        assertThat(PlannerDay.of(lateEvening)).isEqualTo(LocalDate.of(2026, 9, 16));
        assertThat(PlannerDay.resetsAt(lateEvening)).isEqualTo(Instant.parse("2026-09-17T04:00:00Z"));
    }

    @Test
    void theDayTurnsAtMontrealMidnightExactly() {
        Instant midnight = Instant.parse("2026-09-17T04:00:00Z");

        assertThat(PlannerDay.of(midnight.minusMillis(1))).isEqualTo(LocalDate.of(2026, 9, 16));
        assertThat(PlannerDay.of(midnight)).isEqualTo(LocalDate.of(2026, 9, 17));
        assertThat(PlannerDay.resetsAt(midnight)).isEqualTo(Instant.parse("2026-09-18T04:00:00Z"));
    }

    @Test
    void winterMidnightIsFiveHoursBehindUtc() {
        assertThat(PlannerDay.resetsAt(Instant.parse("2026-12-10T15:00:00Z")))
                .isEqualTo(Instant.parse("2026-12-11T05:00:00Z"));
    }

    @Test
    void theDayClocksGoBackIsTwentyFiveHoursLong() {
        // 2026-11-01: 02:00 EDT becomes 01:00 EST.
        Instant morning = Instant.parse("2026-11-01T12:00:00Z");
        Instant start = LocalDate.of(2026, 11, 1).atStartOfDay(PlannerDay.ZONE).toInstant();

        assertThat(Duration.between(start, PlannerDay.resetsAt(morning))).isEqualTo(Duration.ofHours(25));
    }
}
