package com.campusvibe.ai.feature.planner;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PlannerIntentTest {

    /** Thursday 2026-11-26, 14:30 in Montreal: the day the GDG workshop went missing. */
    private static final Instant NOW = montreal("2026-11-26T14:30");

    private static final List<PlannerIntent.Topic> CATALOGUE = List.of(
            new PlannerIntent.Topic("tech", "Technology", null),
            new PlannerIntent.Topic("software-development", "Software development", "tech"),
            new PlannerIntent.Topic("ai-machine-learning", "AI & machine learning", "tech"),
            new PlannerIntent.Topic("web-development", "Web development", "tech"),
            new PlannerIntent.Topic("data-science", "Data science", "tech"),
            new PlannerIntent.Topic("games", "Games", null),
            new PlannerIntent.Topic("board-games", "Board games", "games"),
            new PlannerIntent.Topic("food-drink", "Food & drink", null),
            new PlannerIntent.Topic("sports-fitness", "Sports & fitness", null),
            new PlannerIntent.Topic("running", "Running", "sports-fitness"),
            new PlannerIntent.Topic("careers", "Careers", "academic-career"),
            new PlannerIntent.Topic("hackathons", "Hackathons", "academic-career"));

    private static Instant montreal(String localDateTime) {
        return LocalDateTime.parse(localDateTime).atZone(PlannerDay.ZONE).toInstant();
    }

    private static PlannerIntent parse(String prompt) {
        return PlannerIntent.parse(prompt, null, CATALOGUE, NOW);
    }

    @Test
    void techNamesTheGroupAndEveryChild() {
        assertThat(parse("suggest tech events happening today").topics()).containsExactlyInAnyOrder(
                "tech", "software-development", "ai-machine-learning", "web-development", "data-science");
    }

    @Test
    void synonymsAndLabelsNameTheirTopic() {
        assertThat(parse("any coding workshops?").topics()).containsExactly("software-development");
        assertThat(parse("AI talks").topics()).containsExactly("ai-machine-learning");
        assertThat(parse("something about machine learning").topics()).containsExactly("ai-machine-learning");
        assertThat(parse("hackathons this month").topics()).containsExactly("hackathons");
        assertThat(parse("career stuff").topics()).containsExactly("careers");
        assertThat(parse("free food").topics()).containsExactly("food-drink");
        assertThat(parse("board game night").topics()).contains("board-games");
    }

    @Test
    void wordsInsideOtherWordsAndAmbiguousLabelsNameNothing() {
        assertThat(parse("what's running right now?").topics()).isEmpty();
        assertThat(parse("anything fun to do?").topics()).isEmpty();
        assertThat(parse("said").topics()).isEmpty();
        assertThat(parse("webinars").topics()).isEmpty();
    }

    @Test
    void todayRunsFromNowToMidnight() {
        assertThat(parse("tech events today").range())
                .isEqualTo(new PlannerIntent.Window(NOW, montreal("2026-11-27T00:00")));
    }

    @Test
    void tonightRunsFromFiveOrNowToFourInTheMorning() {
        assertThat(parse("what's on tonight?").range())
                .isEqualTo(new PlannerIntent.Window(montreal("2026-11-26T17:00"), montreal("2026-11-27T04:00")));
        Instant late = montreal("2026-11-26T21:00");
        assertThat(PlannerIntent.parse("tonight", null, CATALOGUE, late).range())
                .isEqualTo(new PlannerIntent.Window(late, montreal("2026-11-27T04:00")));
    }

    @Test
    void tomorrowIsTheNextMontrealDayAndWinsOverTonight() {
        PlannerIntent.Window tomorrow = new PlannerIntent.Window(montreal("2026-11-27T00:00"), montreal("2026-11-28T00:00"));
        assertThat(parse("anything tomorrow?").range()).isEqualTo(tomorrow);
        assertThat(parse("tomorrow night, not tonight").range()).isEqualTo(tomorrow);
    }

    @Test
    void thisWeekendIsFridayEveningToMondayAndStartsNowWhenInIt() {
        assertThat(parse("this weekend").range())
                .isEqualTo(new PlannerIntent.Window(montreal("2026-11-27T17:00"), montreal("2026-11-30T00:00")));
        Instant saturday = montreal("2026-11-28T11:00");
        assertThat(PlannerIntent.parse("weekend plans", null, CATALOGUE, saturday).range())
                .isEqualTo(new PlannerIntent.Window(saturday, montreal("2026-11-30T00:00")));
    }

    @Test
    void nextWeekIsNextMondayToTheMondayAfter() {
        assertThat(parse("hackathons next week").range())
                .isEqualTo(new PlannerIntent.Window(montreal("2026-11-30T00:00"), montreal("2026-12-07T00:00")));
    }

    @Test
    void aDayAcrossTheClockChangeIsMontrealsDay() {
        // 2026-11-01 is 25 hours long in Montreal.
        Instant morning = montreal("2026-11-01T00:30");
        PlannerIntent.Window today = PlannerIntent.parse("today", null, CATALOGUE, morning).range();
        assertThat(today.to()).isEqualTo(montreal("2026-11-02T00:00"));
        assertThat(java.time.Duration.between(today.from(), today.to()).toMinutes()).isEqualTo(24 * 60 + 30);
    }

    @Test
    void noPhraseMeansNoRangeAndTheUsualWindow() {
        PlannerIntent intent = parse("tech events");
        assertThat(intent.range()).isNull();
        assertThat(intent.window(NOW)).isEqualTo(new PlannerIntent.Window(NOW, NOW.plus(PlannerLimits.WINDOW)));
    }

    @Test
    void theWindowNeverStartsBeforeNowNorEndsPastThirtyDays() {
        PlannerIntent tonight = parse("tonight");
        assertThat(tonight.window(montreal("2026-11-26T19:00")).from()).isEqualTo(montreal("2026-11-26T19:00"));
        PlannerIntent nextWeek = parse("next week");
        assertThat(nextWeek.window(NOW).to()).isEqualTo(montreal("2026-12-07T00:00"));
    }

    @Test
    void aFollowUpKeepsWhatItDoesNotReplace() {
        PlannerIntent tomorrow = PlannerIntent.parse("what about tomorrow?", "tech events today", CATALOGUE, NOW);
        assertThat(tomorrow.topics()).contains("tech", "ai-machine-learning");
        assertThat(tomorrow.range().from()).isEqualTo(montreal("2026-11-27T00:00"));

        PlannerIntent games = PlannerIntent.parse("any board games instead?", "tech events today", CATALOGUE, NOW);
        assertThat(games.topics()).contains("board-games").doesNotContain("tech");
        assertThat(games.range().to()).isEqualTo(montreal("2026-11-27T00:00"));
    }

    @Test
    void keywordTextDropsFillerAndKeepsWhatTheStudentIsAfter() {
        assertThat(PlannerIntent.keywordText("Suggest tech events happening today!")).isEqualTo("tech");
        assertThat(PlannerIntent.keywordText("any AI workshops tomorrow?")).isEqualTo("AI workshops");
        assertThat(PlannerIntent.keywordText("events today")).isEmpty();
        assertThat(PlannerIntent.keywordText(null)).isEmpty();
    }
}
