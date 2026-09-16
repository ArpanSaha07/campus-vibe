package com.campusvibe.ai.feature.planner;

import com.campusvibe.club.ClubDTO;
import com.campusvibe.event.EventDTO;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The model is not trusted with ids: only this message's candidates survive. */
class PlannerAnswersTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static EventDTO event(long id) {
        Instant start = Instant.parse("2026-10-01T22:00:00Z");
        return new EventDTO(id, "Event " + id, null, start, start.plusSeconds(7200), start, null, null,
                "chess-club", "Chess Club", 0, List.of(), false, null, 0, List.of(), List.of());
    }

    private static ClubDTO club(String id) {
        return new ClubDTO(id, id, null, 0, null, null, false, List.of(), Instant.now(), null, List.of());
    }

    private static final PlannerRetrievalService.Candidates CANDIDATES = new PlannerRetrievalService.Candidates(
            List.of(event(1), event(2), event(3)), List.of(club("chess-club")), Set.of());

    private static PlannerAnswers.ModelAnswer answer(String kind, PlannerAnswers.ModelPick... picks) {
        return new PlannerAnswers.ModelAnswer("Intro.", kind, List.of(picks));
    }

    private static PlannerAnswers.ModelPick pick(String id, String reason) {
        return new PlannerAnswers.ModelPick(id, reason);
    }

    @Test
    void keepsOnlyPicksThatWereOfferedDroppingInventedAndRepeatedOnes() {
        List<PlannerPickDTO> kept = PlannerAnswers.keep(answer("event",
                pick("2", "is on tonight."),
                pick("999", "was invented."),
                pick("2", "is repeated."),
                pick(" 1 ", " starts soon. ")), CANDIDATES);

        assertThat(kept).containsExactly(
                new PlannerPickDTO("event", "2", "is on tonight."),
                new PlannerPickDTO("event", "1", "starts soon."));
    }

    @Test
    void aPickOfTheOtherKindIsNotAnOfferedItem() {
        // chess-club is a candidate club, but this is an events answer.
        assertThat(PlannerAnswers.keep(answer("event", pick("chess-club", "runs it.")), CANDIDATES)).isEmpty();
        assertThat(PlannerAnswers.keep(answer("club", pick("chess-club", "runs chess nights.")), CANDIDATES))
                .containsExactly(new PlannerPickDTO("club", "chess-club", "runs chess nights."));
    }

    @Test
    void noneOrAnUnknownKindKeepsNothing() {
        assertThat(PlannerAnswers.keep(answer("none", pick("1", "x")), CANDIDATES)).isEmpty();
        assertThat(PlannerAnswers.keep(answer("both", pick("1", "x")), CANDIDATES)).isEmpty();
    }

    @Test
    void aBlankReasonDropsThePickAndALongOneIsCut() {
        String longReason = "is ".repeat(200);
        List<PlannerPickDTO> kept = PlannerAnswers.keep(answer("event",
                pick("1", "  "), pick("2", longReason)), CANDIDATES);

        assertThat(kept).hasSize(1);
        assertThat(kept.get(0).id()).isEqualTo("2");
        assertThat(kept.get(0).reason()).hasSizeLessThanOrEqualTo(PlannerAnswers.MAX_REASON_LENGTH + 1).endsWith("…");
    }

    @Test
    void keepsAtMostOneRowOfPicks() {
        List<EventDTO> many = java.util.stream.LongStream.rangeClosed(1, 10).mapToObj(PlannerAnswersTest::event).toList();
        PlannerRetrievalService.Candidates candidates = new PlannerRetrievalService.Candidates(many, List.of(), Set.of());
        PlannerAnswers.ModelPick[] picks = java.util.stream.LongStream.rangeClosed(1, 10)
                .mapToObj(id -> pick(String.valueOf(id), "fits.")).toArray(PlannerAnswers.ModelPick[]::new);

        assertThat(PlannerAnswers.keep(answer("event", picks), candidates)).hasSize(PlannerLimits.MAX_PICKS);
    }

    @Test
    void anEmptyIntroIsReplacedWithAFixedLine() {
        PlannerAnswers.ModelAnswer blank = new PlannerAnswers.ModelAnswer("  ", "none", List.of());

        assertThat(PlannerAnswers.intro(blank, List.of())).isEqualTo(PlannerAnswers.EMPTY_INTRO_WITHOUT_PICKS);
        assertThat(PlannerAnswers.intro(blank, List.of(new PlannerPickDTO("event", "1", "fits."))))
                .isEqualTo(PlannerAnswers.EMPTY_INTRO_WITH_PICKS);
    }

    @Test
    void parsesAnAnswerAndRefusesSomethingElse() {
        PlannerAnswers.ModelAnswer parsed = PlannerAnswers.parse(
                "{\"intro\":\"Hi.\",\"kind\":\"club\",\"picks\":[{\"id\":\"chess-club\",\"reason\":\"fits.\"}]}",
                objectMapper);

        assertThat(parsed.kind()).isEqualTo("club");
        assertThat(parsed.picks()).containsExactly(pick("chess-club", "fits."));
        assertThatThrownBy(() -> PlannerAnswers.parse("{\"intro\":\"cut off", objectMapper))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageNotContaining("cut off");
        assertThatThrownBy(() -> PlannerAnswers.parse("{\"kind\":\"none\"}", objectMapper))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void theSchemaIsStrictAndPutsTheIntroFirst() {
        Map<String, Object> schema = PlannerAnswers.schema();
        @SuppressWarnings("unchecked")
        Map<String, Object> properties = (Map<String, Object>) schema.get("properties");

        assertThat(properties.keySet()).containsExactly("intro", "kind", "picks");
        assertThat(schema.get("additionalProperties")).isEqualTo(false);
        assertThat(schema.get("required")).isEqualTo(List.of("intro", "kind", "picks"));
    }
}
