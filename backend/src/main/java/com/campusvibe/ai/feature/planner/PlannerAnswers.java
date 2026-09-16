package com.campusvibe.ai.feature.planner;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The shape the model must answer in, and what the server keeps of an answer.
 *
 * <p>One kind per answer ({@code event}, {@code club}, or {@code none} when
 * nothing fits), because the page draws one card row (ADR-019). The schema is
 * strict, so the provider refuses to produce anything else.
 *
 * <p><b>The model is not trusted with ids.</b> {@link #keep} drops every pick
 * that is not one of this message's candidates, so an invented id, an ended
 * event or an item from another kind never reaches the page or the database.
 */
final class PlannerAnswers {

    static final String SCHEMA_NAME = "planner_answer";

    /** Longest reason kept, in characters; a sentence, not a paragraph. */
    static final int MAX_REASON_LENGTH = 300;

    /** Said when the model wrote no intro at all. */
    static final String EMPTY_INTRO_WITH_PICKS = "Here's what I found.";
    static final String EMPTY_INTRO_WITHOUT_PICKS =
            "I couldn't find anything on the calendar that fits. You can ask for a different search.";

    record ModelAnswer(String intro, String kind, List<ModelPick> picks) {}

    record ModelPick(String id, String reason) {}

    private PlannerAnswers() {}

    static Map<String, Object> schema() {
        Map<String, Object> pick = new LinkedHashMap<>();
        pick.put("type", "object");
        pick.put("properties", Map.of(
                "id", Map.of("type", "string"),
                "reason", Map.of("type", "string")));
        pick.put("required", List.of("id", "reason"));
        pick.put("additionalProperties", false);

        // LinkedHashMap: property order is the order the model writes them in,
        // and intro must come first for IntroStreamReader to stream it.
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("intro", Map.of("type", "string"));
        properties.put("kind", Map.of("type", "string", "enum", List.of("event", "club", "none")));
        properties.put("picks", Map.of("type", "array", "items", pick));

        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", properties);
        schema.put("required", List.of("intro", "kind", "picks"));
        schema.put("additionalProperties", false);
        return schema;
    }

    /** @throws IllegalArgumentException when the text is not an answer */
    static ModelAnswer parse(String text, ObjectMapper objectMapper) {
        try {
            ModelAnswer answer = objectMapper.readValue(text, ModelAnswer.class);
            if (answer == null || answer.intro() == null || answer.picks() == null) {
                throw new IllegalArgumentException("The answer is missing a required property");
            }
            return answer;
        } catch (JsonProcessingException e) {
            // Not rethrown with the cause's message: it quotes the model output.
            throw new IllegalArgumentException("The answer is not valid JSON");
        }
    }

    /** The picks that name this message's candidates, in the model's order, at most six. */
    static List<PlannerPickDTO> keep(ModelAnswer answer, PlannerRetrievalService.Candidates candidates) {
        String kind = answer.kind();
        if (!PlannerPickDTO.EVENT.equals(kind) && !PlannerPickDTO.CLUB.equals(kind)) {
            return List.of();
        }

        List<PlannerPickDTO> kept = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (ModelPick pick : answer.picks()) {
            if (pick == null || pick.id() == null || pick.reason() == null) continue;
            String id = pick.id().trim();
            String reason = pick.reason().trim();
            if (reason.isEmpty() || !seen.add(id)) continue;
            boolean offered = PlannerPickDTO.EVENT.equals(kind) ? candidates.hasEvent(id) : candidates.hasClub(id);
            if (!offered) continue;
            if (reason.length() > MAX_REASON_LENGTH) {
                reason = reason.substring(0, MAX_REASON_LENGTH).trim() + "…";
            }
            kept.add(new PlannerPickDTO(kind, id, reason));
            if (kept.size() == PlannerLimits.MAX_PICKS) break;
        }
        return List.copyOf(kept);
    }

    /** The intro as stored and shown: the model's, trimmed, or a fixed line when it wrote none. */
    static String intro(ModelAnswer answer, List<PlannerPickDTO> kept) {
        String intro = answer.intro().strip();
        if (!intro.isEmpty()) return intro;
        return kept.isEmpty() ? EMPTY_INTRO_WITHOUT_PICKS : EMPTY_INTRO_WITH_PICKS;
    }
}
