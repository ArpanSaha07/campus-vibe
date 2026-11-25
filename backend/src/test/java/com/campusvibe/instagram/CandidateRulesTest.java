package com.campusvibe.instagram;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CandidateRulesTest {

    private static final ZoneId MTL = ZoneId.of("America/Toronto");
    private static final Duration TWO_HOURS = Duration.ofHours(2);

    @Test
    void localMontrealTimesBecomeUtcInstants() {
        var t = CandidateRules.resolveTimes("2026-11-27", "17:30", "", "19:00", MTL, TWO_HOURS);

        assertThat(t.start()).isEqualTo(Instant.parse("2026-11-27T22:30:00Z"));
        assertThat(t.end()).isEqualTo(Instant.parse("2026-11-28T00:00:00Z"));
        assertThat(t.startTimeKnown()).isTrue();
        assertThat(t.endEstimated()).isFalse();
    }

    @Test
    void daylightSavingIsTheZonesProblemNotOurs() {
        var summer = CandidateRules.resolveTimes("2026-07-01", "18:00", "", "", MTL, TWO_HOURS);

        assertThat(summer.start()).isEqualTo(Instant.parse("2026-07-01T22:00:00Z"));
    }

    @Test
    void aMissingEndIsEstimatedAndSaysSo() {
        var t = CandidateRules.resolveTimes("2026-11-25", "19:30", "", "", MTL, TWO_HOURS);

        assertThat(t.end()).isEqualTo(t.start().plus(TWO_HOURS));
        assertThat(t.endEstimated()).isTrue();
    }

    @Test
    void anEndBeforeTheStartRollsToTheNextDay() {
        var t = CandidateRules.resolveTimes("2026-11-28", "22:00", "", "02:00", MTL, TWO_HOURS);

        assertThat(Duration.between(t.start(), t.end())).isEqualTo(Duration.ofHours(4));
    }

    @Test
    void aDateWithoutATimeBecomesAnAllDayEvent() {
        var t = CandidateRules.resolveTimes("2026-11-28", "", "", "", MTL, TWO_HOURS);

        assertThat(t.start()).isEqualTo(Instant.parse("2026-11-28T05:00:00Z"));
        assertThat(t.end()).isEqualTo(Instant.parse("2026-11-29T04:59:00Z"));
        assertThat(t.startTimeKnown()).isFalse();
        assertThat(t.endEstimated()).isFalse();
    }

    @Test
    void garbageDatesGiveNoTimes() {
        var t = CandidateRules.resolveTimes("Nov 28", "7pm", "", "", MTL, TWO_HOURS);

        assertThat(t.start()).isNull();
    }

    @Test
    void titlesMatchDespiteDecorationAndOrder() {
        assertThat(CandidateRules.titleSimilarity("Fall Banquet", "BUSS FALL BANQUET!")).isEqualTo(1.0);
        assertThat(CandidateRules.titleSimilarity("Trivia Night", "trivia night @ Gerts")).isEqualTo(1.0);
        assertThat(CandidateRules.titleSimilarity("Café Crawl", "cafe crawl")).isEqualTo(1.0);
        assertThat(CandidateRules.titleSimilarity("Trivia Night", "Fall Banquet")).isZero();
    }

    @Test
    void sameEventNeedsCloseTimesAndSimilarTitles() {
        Instant t = Instant.parse("2026-11-27T22:30:00Z");

        assertThat(CandidateRules.sameEvent("Trivia Night", t, "Trivia night!", t.plus(Duration.ofHours(1)))).isTrue();
        assertThat(CandidateRules.sameEvent("Trivia Night", t, "Trivia Night", t.plus(Duration.ofDays(7)))).isFalse();
    }

    @Test
    void onlyHttpLinksAreKept() {
        assertThat(CandidateRules.cleanUrl("javascript:alert(1)")).isNull();
        assertThat(CandidateRules.cleanUrl("forms.gle/abc")).isEqualTo("https://forms.gle/abc");
        assertThat(CandidateRules.cleanUrl("https://lu.ma/x")).isEqualTo("https://lu.ma/x");
    }

    @Test
    void capacityOnlyWhenItIsANumber() {
        assertThat(CandidateRules.parseCapacity("40 spots")).isEqualTo(40);
        assertThat(CandidateRules.parseCapacity("")).isNull();
        assertThat(CandidateRules.parseCapacity("limited")).isNull();
    }

    // ------------------------------------------------------------- auto-publish

    private static final Instant NOW = Instant.parse("2026-11-25T12:00:00Z");

    private static InstagramEventCandidate confident() {
        InstagramEventCandidate c = new InstagramEventCandidate();
        c.setClassification("UPCOMING_EVENT");
        c.setConfidence(0.93);
        c.setTitle("Trivia Night");
        c.setDateTime(Instant.parse("2026-11-27T22:30:00Z"));
        c.setStartTimeKnown(true);
        c.setEndTime(Instant.parse("2026-11-28T00:00:00Z"));
        return c;
    }

    @Test
    void aConfidentCompleteEventPublishes() {
        assertThat(CandidateRules.publishBlockers(confident(), true, 0.6, NOW)).isEmpty();
    }

    @Test
    void remindersAndRepostsAndDateOnlyEventsPublishToo() {
        InstagramEventCandidate c = confident();
        c.setClassification("EVENT_REMINDER");
        c.setRepost(true);
        c.setStartTimeKnown(false);

        assertThat(CandidateRules.publishBlockers(c, true, 0.6, NOW)).isEmpty();
    }

    @Test
    void lowConfidenceRecapsAndUnsureDatesDoNot() {
        InstagramEventCandidate c = confident();
        c.setConfidence(0.4);
        c.setClassification("PAST_EVENT");
        c.setUncertainFields(new java.util.ArrayList<>(List.of("startDate")));

        List<String> reasons = CandidateRules.publishBlockers(c, true, 0.6, NOW);

        assertThat(reasons).hasSize(3);
        assertThat(String.join(" ", reasons)).contains("40%", "PAST_EVENT", "date");
    }

    @Test
    void finishedEventsNeverPublish() {
        InstagramEventCandidate over = confident();
        over.setEndTime(NOW.minusSeconds(60));

        assertThat(CandidateRules.publishBlockers(over, true, 0.6, NOW)).contains("Already over");
    }

    @Test
    void farFutureDatesLookLikeAMisreadYear() {
        InstagramEventCandidate c = confident();
        c.setDateTime(NOW.plus(Duration.ofDays(300)));
        c.setEndTime(c.getDateTime().plus(TWO_HOURS));

        assertThat(CandidateRules.publishBlockers(c, true, 0.6, NOW))
                .anyMatch(r -> r.contains("6 months"));
    }

    @Test
    void cancelledEventsAreHeldBack() {
        InstagramEventCandidate c = confident();
        c.setWarnings(new java.util.ArrayList<>(List.of("Event cancelled due to weather")));

        assertThat(CandidateRules.publishBlockers(c, true, 0.6, NOW)).contains("May be cancelled");
    }

    @Test
    void autoPublishOffMeansNothingPublishes() {
        assertThat(CandidateRules.publishBlockers(confident(), false, 0.6, NOW))
                .contains("Auto-publish is turned off");
    }

    @Test
    void oneRepostedPosterIsOneEventWhateverOcrCallsIt() {
        Instant t = Instant.parse("2026-11-26T23:00:00Z");

        assertThat(CandidateRules.sameSlot(t, "Lev Bukham (Room 203)", t, "Lev Bukham (Room 203) University Centre")).isTrue();
        assertThat(CandidateRules.sameSlot(t, "Lev Bukham (Room 203)", t.plusSeconds(7200), "Lev Bukham (Room 203)")).isFalse();
        assertThat(CandidateRules.sameSlot(t, "Gerts Bar", t, "Trottier 3120")).isFalse();
    }

    @Test
    void aReminderWithoutATimeMatchesTheShowThatEvening() {
        Instant midnight = Instant.parse("2026-11-25T05:00:00Z");
        Instant show = Instant.parse("2026-11-26T01:00:00Z");

        assertThat(CandidateRules.sameEvent("Last Stop comedy show", midnight, "Last Stop: A MSCC Comedy Show", show)).isFalse();
        assertThat(CandidateRules.sameEvent("Last Stop comedy show", midnight, "Last Stop: A MSCC Comedy Show", show, true)).isTrue();
    }

    @Test
    void twoGamesAgainstTheSameTeamHoursApartAreTwoEvents() {
        Instant six = Instant.parse("2026-11-26T23:00:00Z");
        Instant eight = Instant.parse("2026-11-27T01:00:00Z");

        assertThat(CandidateRules.sameEvent("Martlets Basketball vs Concordia Stingers", six,
                "Redbirds Basketball vs Concordia Stingers", eight)).isFalse();
        assertThat(CandidateRules.sameEvent("MCHAM Mystery Book Sale", six, "Mcham book sale", eight)).isTrue();
    }
}
