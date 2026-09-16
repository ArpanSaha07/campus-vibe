package com.campusvibe.ai.feature.planner;

import com.campusvibe.ai.client.LlmException;
import com.campusvibe.ai.client.LlmRequest;
import com.campusvibe.club.Club;
import com.campusvibe.event.Event;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sending a message: the stream, what is stored, what is counted, and every
 * refusal. The model is {@link ScriptedLlmClient}.
 */
class PlannerMessageIT extends PlannerIntegrationTest {

    @Autowired private PlannerReplyService replyService;

    private final Instant now = Instant.now();

    private Club club;
    private Event running;
    private Event nextWeek;
    private Event ended;

    private void calendar() {
        club = createClub("chess-club", "Chess Club");
        running = event(club, "Blitz tournament", now.minus(Duration.ofHours(1)), now.plus(Duration.ofHours(2)));
        nextWeek = event(club, "Opening theory workshop", now.plus(Duration.ofDays(7)),
                now.plus(Duration.ofDays(7)).plus(Duration.ofHours(2)));
        ended = event(club, "Yesterday's simul", now.minus(Duration.ofDays(1)),
                now.minus(Duration.ofDays(1)).plus(Duration.ofHours(2)));
    }

    private static String pickJson(long id, String reason) {
        return "{\"id\":\"" + id + "\",\"reason\":\"" + reason + "\"}";
    }

    private void setUsedToday(User user, int count) {
        jdbcTemplate.update("INSERT INTO planner_daily_usage (user_id, usage_date, message_count) VALUES (?, ?, ?)",
                user.getId(), PlannerDay.of(Instant.now()), count);
    }

    private int messagesIn(String chatId) {
        return messageRepository.count(UUID.fromString(chatId));
    }

    @Test
    void aReplyStreamsItsIntroThenDoneAndOnlyOfferedEventsSurvive() throws Exception {
        calendar();
        User user = student("student@campus.com");
        String chat = newChat(user);
        llm.answerWith(request -> List.of(
                "{\"intro\":\"Two things on ",
                "for you, one right n",
                "ow \\u00e9 later.\",\"kind\":\"event\",\"picks\":[",
                pickJson(running.getId(), "is on right now.") + ",",
                pickJson(ended.getId(), "already ended.") + ",",
                pickJson(99999, "was made up.") + ",",
                pickJson(nextWeek.getId(), "is next week.") + "]}"));

        MvcResult result = send(user, chat, "What's on right now?");
        List<Frame> frames = frames(result);

        assertThat(result.getResponse().getContentType()).startsWith(MediaType.TEXT_EVENT_STREAM_VALUE);
        assertThat(result.getResponse().getHeader("X-Accel-Buffering")).isEqualTo("no");
        assertThat(streamedText(frames)).isEqualTo("Two things on for you, one right now é later.");
        assertThat(frames.get(frames.size() - 1).event()).isEqualTo("done");
        assertThat(frames.stream().filter(frame -> frame.event().equals("delta")).count()).isGreaterThan(1);

        var done = frames.get(frames.size() - 1).data();
        assertThat(done.path("picks")).hasSize(2);
        assertThat(done.path("picks").get(0).path("id").asText()).isEqualTo(String.valueOf(running.getId()));
        assertThat(done.path("picks").get(1).path("id").asText()).isEqualTo(String.valueOf(nextWeek.getId()));
        assertThat(done.path("events")).hasSize(2);
        assertThat(done.path("clubs")).isEmpty();
        assertThat(done.path("usage").path("used").asInt()).isEqualTo(1);
        assertThat(done.path("conversation").path("title").asText()).isEqualTo("What's on right now?");
        assertThat(done.path("messageId").asText()).isNotBlank();

        // The model was never offered the ended event.
        String system = llm.lastRequest().messages().get(0).content();
        assertThat(system).contains("Blitz tournament").contains("running now").contains("Opening theory workshop")
                .doesNotContain("Yesterday's simul");

        mockMvc.perform(get("/api/v1/planner/conversations/{id}", chat).header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("What's on right now?"))
                .andExpect(jsonPath("$.messages.length()").value(2))
                .andExpect(jsonPath("$.messages[0].role").value("user"))
                .andExpect(jsonPath("$.messages[0].content").value("What's on right now?"))
                .andExpect(jsonPath("$.messages[1].role").value("assistant"))
                .andExpect(jsonPath("$.messages[1].status").value("complete"))
                .andExpect(jsonPath("$.messages[1].content").value("Two things on for you, one right now é later."))
                .andExpect(jsonPath("$.messages[1].id").value(done.path("messageId").asText()))
                .andExpect(jsonPath("$.messages[1].picks.length()").value(2))
                .andExpect(jsonPath("$.messages[1].events.length()").value(2));
    }

    @Test
    void anEventThatEndsAfterTheAnswerDropsOutOfTheStoredChat() throws Exception {
        calendar();
        User user = student("student@campus.com");
        String chat = newChat(user);
        llm.answerWith(request -> List.of("{\"intro\":\"One.\",\"kind\":\"event\",\"picks\":["
                + pickJson(running.getId(), "is on.") + "]}"));
        send(user, chat, "now?");

        jdbcTemplate.update("UPDATE events SET date_time = ?, end_time = ? WHERE id = ?",
                Timestamp.from(now.minus(Duration.ofHours(3))), Timestamp.from(now.minus(Duration.ofMinutes(1))),
                running.getId());

        mockMvc.perform(get("/api/v1/planner/conversations/{id}", chat).header("Authorization", bearer(user)))
                .andExpect(jsonPath("$.messages[1].picks.length()").value(1))
                .andExpect(jsonPath("$.messages[1].events.length()").value(0));
    }

    @Test
    void aFollowUpShowsTheModelWhatItRecommendedAndOffersThoseClubsEvents() throws Exception {
        calendar();
        User user = student("student@campus.com");
        String chat = newChat(user);
        llm.answerWith(request -> List.of(
                "{\"intro\":\"A club.\",\"kind\":\"club\",\"picks\":[{\"id\":\"chess-club\",\"reason\":\"plays chess.\"}]}"));
        send(user, chat, "chess clubs");

        llm.answerWith(request -> List.of("{\"intro\":\"Nothing.\",\"kind\":\"none\",\"picks\":[]}"));
        send(user, chat, "Upcoming events from these clubs");

        List<LlmRequest.Message> messages = llm.lastRequest().messages();
        assertThat(messages).hasSize(4);
        assertThat(messages.get(2).role()).isEqualTo(LlmRequest.Role.ASSISTANT);
        assertThat(messages.get(2).content()).contains("Recommended:").contains("club chess-club: Chess Club plays chess.");
        assertThat(messages.get(0).content()).contains("Opening theory workshop");
    }

    @Test
    void theSixteenthMessageOfTheDayIsRefusedAndDeletingAChatDoesNotGiveItBack() throws Exception {
        User user = student("student@campus.com");
        String chat = newChat(user);
        setUsedToday(user, PlannerLimits.DAILY_MESSAGES - 1);

        send(user, chat, "one more");
        assertThat(usedToday(user)).isEqualTo(PlannerLimits.DAILY_MESSAGES);

        mockMvc.perform(post("/api/v1/planner/conversations/{id}/messages", chat)
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.TEXT_EVENT_STREAM)
                        .content(objectMapper.writeValueAsString(Map.of("content", "and another"))))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));

        mockMvc.perform(delete("/api/v1/planner/conversations/{id}", chat).header("Authorization", bearer(user)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/planner/usage").header("Authorization", bearer(user)))
                .andExpect(jsonPath("$.used").value(PlannerLimits.DAILY_MESSAGES))
                .andExpect(jsonPath("$.limit").value(PlannerLimits.DAILY_MESSAGES));
    }

    @Test
    void aProviderFailureIsAnErrorFrameRefundedWithNothingStored() throws Exception {
        User user = student("student@campus.com");
        String chat = newChat(user);
        llm.failWith(new LlmException(LlmException.Reason.UNAVAILABLE, "timed out"));

        List<Frame> frames = frames(send(user, chat, "plan my weekend"));

        assertThat(frames).hasSize(1);
        assertThat(frames.get(0).event()).isEqualTo("error");
        assertThat(frames.get(0).data().path("code").asText()).isEqualTo(PlannerReplyService.PROVIDER_ERROR);
        assertThat(frames.get(0).data().path("message").asText()).isEqualTo(PlannerReplyService.PROVIDER_ERROR_MESSAGE);
        assertThat(usedToday(user)).isZero();
        assertThat(messagesIn(chat)).isZero();
        mockMvc.perform(get("/api/v1/planner/conversations/{id}", chat).header("Authorization", bearer(user)))
                .andExpect(jsonPath("$.title").value("New chat"));
    }

    @Test
    void anAnswerThatIsNotJsonFailsTheSameWay() throws Exception {
        User user = student("student@campus.com");
        String chat = newChat(user);
        llm.answerWith(request -> List.of("{\"intro\":\"Half an ans"));

        List<Frame> frames = frames(send(user, chat, "plan my weekend"));

        assertThat(streamedText(frames)).isEqualTo("Half an ans");
        assertThat(frames.get(frames.size() - 1).event()).isEqualTo("error");
        assertThat(usedToday(user)).isZero();
        assertThat(messagesIn(chat)).isZero();
    }

    @Test
    void aClientThatStopsReadingStoresNothingAndTheMessageStaysCounted() {
        User user = student("student@campus.com");
        String chat = newChat(user);
        llm.answerWith(request -> List.of("{\"intro\":\"Here ", "are some ", "ideas.\",\"kind\":\"none\",\"picks\":[]}"));
        LocalDate spentOn = usageService.spend(user.getId());

        StoppingSink sink = new StoppingSink();
        replyService.reply(user.getId(), UUID.fromString(chat), "plan my weekend", spentOn, sink);

        assertThat(sink.deltas).isEqualTo(1);
        assertThat(sink.completed).isTrue();
        assertThat(sink.errors).isZero();
        assertThat(usedToday(user)).isEqualTo(1);
        assertThat(messagesIn(chat)).isZero();
    }

    @Test
    void aFullChatIsAnErrorFrameAndIsNotCounted() throws Exception {
        User user = student("student@campus.com");
        String chat = newChat(user);
        for (int i = 0; i < PlannerLimits.MAX_MESSAGES_PER_CONVERSATION / 2; i++) {
            messageRepository.insert(UUID.fromString(chat), "user", "q" + i, List.of(), Instant.now());
            messageRepository.insert(UUID.fromString(chat), "assistant", "a" + i, List.of(), Instant.now());
        }

        List<Frame> frames = frames(send(user, chat, "one more"));

        assertThat(frames).hasSize(1);
        assertThat(frames.get(0).event()).isEqualTo("error");
        assertThat(frames.get(0).data().path("code").asText()).isEqualTo(PlannerReplyService.CONVERSATION_FULL);
        assertThat(frames.get(0).data().path("message").asText()).isEqualTo(PlannerReplyService.CONVERSATION_FULL_MESSAGE);
        assertThat(usedToday(user)).isZero();
        assertThat(llm.lastRequest()).isNull();
    }

    @Test
    void refusalsBeforeTheStreamAreStatusesAndCostNothing() throws Exception {
        User user = student("student@campus.com");
        User other = student("other@campus.com");
        String chat = newChat(user);

        record Case(User caller, String chatId, String content, int status) {}
        List<Case> cases = List.of(
                new Case(user, chat, "   ", 400),
                new Case(user, chat, "x".repeat(PlannerLimits.MAX_PROMPT_LENGTH + 1), 400),
                new Case(other, chat, "hello", 404),
                new Case(user, "not-a-chat-id", "hello", 404));
        for (Case c : cases) {
            mockMvc.perform(post("/api/v1/planner/conversations/{id}/messages", c.chatId())
                            .header("Authorization", bearer(c.caller()))
                            .contentType(MediaType.APPLICATION_JSON)
                            .accept(MediaType.TEXT_EVENT_STREAM)
                            .content(objectMapper.writeValueAsString(Map.of("content", c.content()))))
                    .andExpect(status().is(c.status()));
        }

        llm.setConfigured(false);
        mockMvc.perform(post("/api/v1/planner/conversations/{id}/messages", chat)
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.TEXT_EVENT_STREAM)
                        .content(objectMapper.writeValueAsString(Map.of("content", "hello"))))
                .andExpect(status().isServiceUnavailable());

        assertThat(usedToday(user)).isZero();
        assertThat(usedToday(other)).isZero();
        assertThat(llm.lastRequest()).isNull();
    }

    /** A client that reads the first delta and then goes away. */
    private static final class StoppingSink implements PlannerReplySink {
        int deltas;
        int errors;
        boolean gone;
        boolean completed;

        @Override
        public void delta(String text) {
            if (gone) throw new ClientGoneException();
            deltas++;
            gone = true;
        }

        @Override
        public void done(PlannerReplyDoneDTO done) {
            throw new ClientGoneException();
        }

        @Override
        public void error(String code, String message) {
            errors++;
        }

        @Override
        public void keepAlive() {}

        @Override
        public boolean isGone() {
            return gone;
        }

        @Override
        public boolean timedOut() {
            return false;
        }

        @Override
        public void complete() {
            completed = true;
        }
    }
}
