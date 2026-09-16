package com.campusvibe.ai.feature.planner;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class PlannerRankerTest {

    private static final Instant NOW = Instant.parse("2026-10-02T23:00:00Z");

    private static PlannerRanker.EventFacts event(long id, Duration startsIn, String organizer, String... topics) {
        Instant start = NOW.plus(startsIn);
        return new PlannerRanker.EventFacts(id, start, start.plus(Duration.ofHours(2)), organizer, Set.of(topics));
    }

    private static PlannerRanker.EventSignals signals(Map<Long, Double> search, Set<Long> savedOrGoing,
                                                      Set<Long> context, List<Long> soonest,
                                                      Set<String> followed, Set<String> interests) {
        return new PlannerRanker.EventSignals(search, savedOrGoing, context, soonest, followed, interests);
    }

    private static List<Long> ids(List<PlannerRanker.EventFacts> ranked) {
        return ranked.stream().map(PlannerRanker.EventFacts::id).toList();
    }

    @Test
    void eachSourceAddsToAnEventsScore() {
        List<PlannerRanker.EventFacts> events = List.of(
                event(1, Duration.ofDays(1), "a"),
                event(2, Duration.ofDays(2), "followed-club"),
                event(3, Duration.ofDays(3), "a", "music"),
                event(4, Duration.ofDays(4), "a"),
                event(5, Duration.ofDays(5), "a"));

        List<PlannerRanker.EventFacts> ranked = PlannerRanker.rankEvents(events,
                signals(Map.of(1L, 0.05), Set.of(4L), Set.of(5L), List.of(), Set.of("followed-club"), Set.of("music")),
                false, NOW, 10);

        // context 0.35 > saved 0.25 > followed 0.15 > interest 0.10 > search 0.05
        assertThat(ids(ranked)).containsExactly(5L, 4L, 2L, 3L, 1L);
    }

    @Test
    void aRunningEventLeadsOnlyWhenThePromptAsksAboutNow() {
        List<PlannerRanker.EventFacts> events = List.of(
                event(1, Duration.ofHours(-1), "a"),
                event(2, Duration.ofHours(3), "a"));
        PlannerRanker.EventSignals searchLikesTheLaterOne =
                signals(Map.of(2L, 0.2), Set.of(), Set.of(), List.of(), Set.of(), Set.of());

        assertThat(ids(PlannerRanker.rankEvents(events, searchLikesTheLaterOne, true, NOW, 10))).containsExactly(1L, 2L);
        assertThat(ids(PlannerRanker.rankEvents(events, searchLikesTheLaterOne, false, NOW, 10))).containsExactly(2L, 1L);
    }

    @Test
    void soonerStartsBreakTiesAndTheLimitHolds() {
        List<PlannerRanker.EventFacts> events = List.of(
                event(1, Duration.ofDays(3), "a"),
                event(2, Duration.ofDays(1), "a"),
                event(3, Duration.ofDays(2), "a"));

        List<PlannerRanker.EventFacts> ranked = PlannerRanker.rankEvents(events,
                signals(Map.of(), Set.of(), Set.of(), List.of(), Set.of(), Set.of()), false, NOW, 2);

        assertThat(ids(ranked)).containsExactly(2L, 3L);
    }

    @Test
    void theSoonestListFavoursItsHead() {
        List<PlannerRanker.EventFacts> events = List.of(
                event(1, Duration.ofDays(3), "a"),
                event(2, Duration.ofDays(1), "a"));

        // A later start at the head of the list outranks an earlier one below it.
        List<PlannerRanker.EventFacts> ranked = PlannerRanker.rankEvents(events,
                signals(Map.of(), Set.of(), Set.of(), List.of(1L, 2L), Set.of(), Set.of()), false, NOW, 2);

        assertThat(ids(ranked)).containsExactly(1L, 2L);
    }

    @Test
    void clubsRankByContextThenOrganizerFollowedAndInterests() {
        List<PlannerRanker.ClubFacts> clubs = List.of(
                new PlannerRanker.ClubFacts("searched", Set.of()),
                new PlannerRanker.ClubFacts("organizer", Set.of()),
                new PlannerRanker.ClubFacts("context", Set.of()),
                new PlannerRanker.ClubFacts("followed", Set.of("music")));

        List<PlannerRanker.ClubFacts> ranked = PlannerRanker.rankClubs(clubs, Map.of("searched", 0.05),
                Set.of("context"), List.of("organizer"), Set.of("followed"), Set.of("music"), 3);

        assertThat(ranked.stream().map(PlannerRanker.ClubFacts::id))
                .containsExactly("context", "followed", "organizer");
    }

    @Test
    void recognisesPromptsAboutNow() {
        assertThat(PlannerRanker.asksAboutNow("What's happening right now?")).isTrue();
        assertThat(PlannerRanker.asksAboutNow("anything TONIGHT")).isTrue();
        assertThat(PlannerRanker.asksAboutNow("plan my weekend")).isFalse();
        assertThat(PlannerRanker.asksAboutNow("known for board games")).isFalse();
    }
}
