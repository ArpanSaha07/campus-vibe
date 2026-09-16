package com.campusvibe.ai.feature.planner;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.club.Club;
import com.campusvibe.event.Event;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;

/**
 * Shared set-up for the planner ITs: a scripted model in place of OpenAI, and
 * helpers to create events, send a message and read the frames back.
 */
@Import(ScriptedLlmClient.Config.class)
abstract class PlannerIntegrationTest extends AbstractIntegrationTest {

    @Autowired protected ScriptedLlmClient llm;
    @Autowired protected PlannerConversationService conversationService;
    @Autowired protected PlannerUsageService usageService;
    @Autowired protected PlannerMessageRepository messageRepository;

    /** One SSE frame as the page's parser sees it. */
    protected record Frame(String event, JsonNode data) {}

    @BeforeEach
    void resetModel() {
        llm.reset();
    }

    protected User student(String email) {
        return createUser("Student", email, "password123", RoleName.ROLE_USER);
    }

    protected Event event(Club club, String title, Instant start, Instant end) {
        Event event = new Event();
        event.setTitle(title);
        event.setOrganizer(club);
        event.setDateTime(start);
        event.setEndTime(end);
        return eventRepository.save(event);
    }

    protected String newChat(User user) {
        return conversationService.create(user.getId()).conversation().id();
    }

    /** Posts a message as the page does, Accept included, and waits for the stream to end. */
    protected MvcResult send(User user, String chatId, String content) throws Exception {
        MvcResult started = mockMvc.perform(post("/api/v1/planner/conversations/{id}/messages", chatId)
                        .header("Authorization", bearer(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.TEXT_EVENT_STREAM)
                        .content(objectMapper.writeValueAsString(Map.of("content", content))))
                .andExpect(request().asyncStarted())
                .andReturn();
        started.getAsyncResult(20_000);
        return started;
    }

    protected List<Frame> frames(MvcResult result) throws Exception {
        List<Frame> frames = new ArrayList<>();
        String body = result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        for (String block : body.replace("\r\n", "\n").split("\n\n")) {
            String event = "message";
            StringBuilder data = new StringBuilder();
            for (String line : block.split("\n")) {
                if (line.startsWith("event:")) event = line.substring(6).strip();
                else if (line.startsWith("data:")) data.append(line.substring(5));
            }
            if (!data.isEmpty()) frames.add(new Frame(event, objectMapper.readTree(data.toString())));
        }
        return frames;
    }

    protected static String streamedText(List<Frame> frames) {
        StringBuilder text = new StringBuilder();
        frames.stream().filter(frame -> frame.event().equals("delta"))
                .forEach(frame -> text.append(frame.data().get("text").asText()));
        return text.toString();
    }

    protected static Set<String> eventsOf(List<Frame> frames) {
        return Set.copyOf(frames.stream().map(Frame::event).toList());
    }

    protected int usedToday(User user) {
        return usageService.usage(user.getId()).used();
    }
}
