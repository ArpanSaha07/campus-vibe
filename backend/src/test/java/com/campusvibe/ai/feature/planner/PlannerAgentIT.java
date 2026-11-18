package com.campusvibe.ai.feature.planner;

import com.campusvibe.ai.client.LlmException;
import com.campusvibe.ai.client.LlmRequest;
import com.campusvibe.club.Club;
import com.campusvibe.event.Event;
import com.campusvibe.user.User;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The planner as an agent (ADR-023): tool rounds before the answer, what the
 * executor allows, what is stored and counted. The model is
 * {@link ScriptedLlmClient}.
 */
class PlannerAgentIT extends PlannerIntegrationTest {

    private static final String ANSWER = "{\"intro\":\"Done.\",\"kind\":\"none\",\"picks\":[]}";

    private final Instant now = Instant.now();

    private Club chess;
    private Event workshop;
    private Event ended;

    private void calendar() {
        chess = createClub("chess-club", "Chess Club");
        workshop = event(chess, "Chess opening workshop", now.plus(Duration.ofDays(2)),
                now.plus(Duration.ofDays(2)).plus(Duration.ofHours(2)));
        ended = event(chess, "Chess simul last week", now.minus(Duration.ofDays(7)),
                now.minus(Duration.ofDays(7)).plus(Duration.ofHours(2)));
    }

    private static LlmRequest.ToolCall call(String id, String tool, String... ids) {
        return new LlmRequest.ToolCall(id, tool,
                "{\"ids\":[" + String.join(",", java.util.Arrays.stream(ids).map(x -> "\"" + x + "\"").toList()) + "]}");
    }

    private JsonNode done(List<Frame> frames) {
        Frame last = frames.get(frames.size() - 1);
        assertThat(last.event()).isEqualTo("done");
        return last.data();
    }

    private int rows(String sql, Object... args) {
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, args);
        return count == null ? 0 : count;
    }

    @Test
    void aFollowRunsThroughTheToolLoopIsReportedStoredAndCountsOneMessage() throws Exception {
        calendar();
        User user = student("student@campus.com");
        String chat = newChat(user);
        llm.callTools(call("call_1", PlannerTools.FOLLOW_CLUB, "chess-club"));
        llm.answerWith(request -> List.of("{\"intro\":\"You now follow Chess Club.\",\"kind\":\"none\",\"picks\":[]}"));

        List<Frame> frames = frames(send(user, chat, "Follow the chess club please"));

        assertThat(eventsOf(frames)).contains("status", "delta", "done");
        assertThat(frames.stream().filter(frame -> frame.event().equals("status")).findFirst().orElseThrow()
                .data().path("text").asText()).isEqualTo("Following clubs…");
        JsonNode done = done(frames);
        assertThat(done.path("actions")).hasSize(1);
        assertThat(done.path("actions").get(0).path("type").asText()).isEqualTo(PlannerAction.FOLLOW);
        assertThat(done.path("actions").get(0).path("id").asText()).isEqualTo("chess-club");
        assertThat(done.path("actions").get(0).path("name").asText()).isEqualTo("Chess Club");
        assertThat(done.path("actions").get(0).path("outcome").asText()).isEqualTo(PlannerAction.DONE);
        assertThat(done.path("usage").path("used").asInt()).isEqualTo(1);

        assertThat(rows("SELECT count(*) FROM user_followed_clubs WHERE user_id = ? AND club_id = 'chess-club'",
                user.getId())).isEqualTo(1);
        assertThat(clubRepository.findById("chess-club").orElseThrow().getFollowers())
                .isEqualTo(chess.getFollowers() + 1);

        // Round one offered tools; round two carried the result back.
        List<LlmRequest> requests = llm.requests();
        assertThat(requests).hasSize(2);
        assertThat(requests.get(0).toolsAllowed()).isTrue();
        assertThat(requests.get(0).tools()).extracting(LlmRequest.Tool::name).contains(PlannerTools.FOLLOW_CLUB);
        List<LlmRequest.Message> second = requests.get(1).messages();
        assertThat(second.get(second.size() - 2).toolCalls()).hasSize(1);
        assertThat(second.get(second.size() - 1).role()).isEqualTo(LlmRequest.Role.TOOL);
        assertThat(second.get(second.size() - 1).toolCallId()).isEqualTo("call_1");
        assertThat(second.get(second.size() - 1).content()).contains("\"outcome\":\"done\"");

        mockMvc.perform(get("/api/v1/planner/conversations/{id}", chat).header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages[1].actions.length()").value(1))
                .andExpect(jsonPath("$.messages[1].actions[0].outcome").value("done"))
                .andExpect(jsonPath("$.messages[0].actions.length()").value(0));

        // The next turn shows the model what it did, so it can undo it.
        llm.answerWith(request -> List.of(ANSWER));
        send(user, chat, "Actually, unfollow it");
        String history = llm.lastRequest().messages().stream()
                .filter(message -> message.role() == LlmRequest.Role.ASSISTANT)
                .map(LlmRequest.Message::content).reduce("", String::concat);
        assertThat(history).contains("Actions:").contains("follow club chess-club: Chess Club (done)");
    }

    @Test
    void rsvpSaveAndTheirUndosWriteTheSameTablesAsTheButtons() throws Exception {
        calendar();
        User user = student("student@campus.com");
        String chat = newChat(user);
        String id = String.valueOf(workshop.getId());
        llm.callTools(call("c1", PlannerTools.RSVP_EVENT, id));
        llm.callTools(call("c2", PlannerTools.SAVE_EVENT, id));
        llm.answerWith(request -> List.of(ANSWER));

        JsonNode done = done(frames(send(user, chat, "Book the chess workshop and bookmark it")));

        assertThat(done.path("actions")).hasSize(2);
        assertThat(rows("SELECT count(*) FROM user_event_rsvps WHERE user_id = ? AND event_id = ?",
                user.getId(), workshop.getId())).isEqualTo(1);
        assertThat(rows("SELECT count(*) FROM user_saved_events WHERE user_id = ? AND event_id = ?",
                user.getId(), workshop.getId())).isEqualTo(1);

        llm.callTools(call("c3", PlannerTools.CANCEL_RSVP, id));
        llm.callTools(call("c4", PlannerTools.UNSAVE_EVENT, id));
        llm.callTools(call("c5", PlannerTools.UNSAVE_EVENT, id));
        llm.answerWith(request -> List.of(ANSWER));

        done = done(frames(send(user, chat, "Cancel both")));

        assertThat(done.path("actions")).hasSize(3);
        assertThat(done.path("actions").get(2).path("outcome").asText()).isEqualTo(PlannerAction.UNCHANGED);
        assertThat(rows("SELECT count(*) FROM user_event_rsvps WHERE user_id = ?", user.getId())).isZero();
        assertThat(rows("SELECT count(*) FROM user_saved_events WHERE user_id = ?", user.getId())).isZero();
        assertThat(usedToday(user)).isEqualTo(2);
    }

    @Test
    void anEndedEventIsRefusedEvenWhenItIsTheStudentsOwn() throws Exception {
        calendar();
        User user = student("student@campus.com");
        jdbcTemplate.update("INSERT INTO user_saved_events (user_id, event_id) VALUES (?, ?)",
                user.getId(), ended.getId());
        String chat = newChat(user);
        llm.callTools(call("c1", PlannerTools.RSVP_EVENT, String.valueOf(ended.getId())));
        llm.answerWith(request -> List.of(ANSWER));

        JsonNode done = done(frames(send(user, chat, "I'm going to the simul")));

        assertThat(done.path("actions").get(0).path("outcome").asText()).isEqualTo(PlannerAction.ENDED);
        assertThat(rows("SELECT count(*) FROM user_event_rsvps WHERE user_id = ?", user.getId())).isZero();
    }

    @Test
    void anIdOutsideTheCandidatesAndTheStudentsOwnIsNotAllowed() throws Exception {
        calendar();
        createClub("rowing-club", "Rowing Club");
        User user = student("student@campus.com");
        String chat = newChat(user);
        llm.callTools(call("c1", PlannerTools.FOLLOW_CLUB, "rowing-club", "no-such-club"));
        llm.answerWith(request -> List.of(ANSWER));

        JsonNode done = done(frames(send(user, chat, "chess workshop this week")));

        assertThat(llm.requests().get(0).messages().get(0).content()).doesNotContain("Rowing Club");
        assertThat(done.path("actions").get(0).path("outcome").asText()).isEqualTo(PlannerAction.NOT_ALLOWED);
        assertThat(done.path("actions").get(1).path("outcome").asText()).isEqualTo(PlannerAction.NOT_FOUND);
        assertThat(rows("SELECT count(*) FROM user_followed_clubs WHERE user_id = ?", user.getId())).isZero();
    }

    @Test
    void aCalendarLinkWritesNothingAndCarriesItsEvent() throws Exception {
        calendar();
        User user = student("student@campus.com");
        String chat = newChat(user);
        llm.callTools(call("c1", PlannerTools.OFFER_CALENDAR_LINK, String.valueOf(workshop.getId())));
        llm.answerWith(request -> List.of(ANSWER));

        JsonNode done = done(frames(send(user, chat, "Add the chess workshop to my calendar")));

        JsonNode action = done.path("actions").get(0);
        assertThat(action.path("outcome").asText()).isEqualTo(PlannerAction.OFFERED);
        assertThat(action.path("event").path("id").asLong()).isEqualTo(workshop.getId());
        assertThat(action.path("event").path("title").asText()).isEqualTo("Chess opening workshop");
        assertThat(rows("SELECT count(*) FROM user_event_rsvps WHERE user_id = ?", user.getId())).isZero();
        assertThat(rows("SELECT count(*) FROM user_saved_events WHERE user_id = ?", user.getId())).isZero();
    }

    @Test
    void anAnswerThatFailsAfterAnActionIsStoredWithWhatWasDoneAndCounted() throws Exception {
        calendar();
        User user = student("student@campus.com");
        String chat = newChat(user);
        llm.callTools(call("c1", PlannerTools.FOLLOW_CLUB, "chess-club"));
        llm.failWith(new LlmException(LlmException.Reason.UNAVAILABLE, "down"));

        MvcResult result = send(user, chat, "Follow the chess club");
        JsonNode done = done(frames(result));

        assertThat(done.path("actions").get(0).path("outcome").asText()).isEqualTo(PlannerAction.DONE);
        assertThat(usedToday(user)).isEqualTo(1);
        mockMvc.perform(get("/api/v1/planner/conversations/{id}", chat).header("Authorization", bearer(user)))
                .andExpect(jsonPath("$.messages.length()").value(2))
                .andExpect(jsonPath("$.messages[1].content").value(
                        "Done: followed Chess Club. I couldn't finish the rest of my answer, so ask again if you need more."));
    }

    @Test
    void aFailureWithNoActionThatChangedAnythingIsStillRefundedAndStoresNothing() throws Exception {
        calendar();
        User user = student("student@campus.com");
        String chat = newChat(user);
        llm.callTools(call("c1", PlannerTools.FOLLOW_CLUB, "no-such-club"));
        llm.failWith(new LlmException(LlmException.Reason.UNAVAILABLE, "down"));

        List<Frame> frames = frames(send(user, chat, "Follow a club that does not exist"));

        assertThat(frames.get(frames.size() - 1).event()).isEqualTo("error");
        assertThat(usedToday(user)).isZero();
        assertThat(messageRepository.count(java.util.UUID.fromString(chat))).isZero();
    }

    @Test
    void afterFourToolRoundsTheModelMustAnswer() throws Exception {
        calendar();
        User user = student("student@campus.com");
        String chat = newChat(user);
        for (int i = 0; i < 6; i++) {
            llm.callTools(call("c" + i, PlannerTools.FOLLOW_CLUB, "chess-club"));
        }
        llm.answerWith(request -> List.of(ANSWER));

        done(frames(send(user, chat, "Follow chess club over and over")));

        List<LlmRequest> requests = llm.requests();
        assertThat(requests).hasSize(PlannerLimits.MAX_TOOL_ROUNDS + 1);
        assertThat(requests.get(PlannerLimits.MAX_TOOL_ROUNDS).toolsAllowed()).isFalse();
    }
}
