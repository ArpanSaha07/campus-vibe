package com.campusvibe.ai.feature.planner;

import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Saved chats: create, list, read, delete, the 15-chat cap and who may see what. */
class PlannerConversationIT extends PlannerIntegrationTest {

    private int chatCount(User user) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM planner_conversations WHERE user_id = ?", Integer.class, user.getId());
        return count == null ? 0 : count;
    }

    private void setLastActive(String chatId, Instant at) {
        jdbcTemplate.update("UPDATE planner_conversations SET last_active_at = ? WHERE id = ?",
                Timestamp.from(at), UUID.fromString(chatId));
    }

    @Test
    void aNewChatIsUntitledListedFirstAndReadableAndDeletable() throws Exception {
        User user = student("student@campus.com");

        String older = newChat(user);
        setLastActive(older, Instant.now().minus(1, ChronoUnit.HOURS));

        String created = objectMapper.readTree(mockMvc.perform(post("/api/v1/planner/conversations")
                        .header("Authorization", bearer(user)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.conversation.title").value("New chat"))
                .andExpect(jsonPath("$.evictedId").doesNotExist())
                .andReturn().getResponse().getContentAsString()).path("conversation").path("id").asText();

        mockMvc.perform(get("/api/v1/planner/conversations").header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conversations.length()").value(2))
                .andExpect(jsonPath("$.conversations[0].id").value(created))
                .andExpect(jsonPath("$.conversations[1].id").value(older))
                .andExpect(jsonPath("$.usage.used").value(0))
                .andExpect(jsonPath("$.usage.limit").value(15))
                .andExpect(jsonPath("$.usage.resetsAt").exists());

        mockMvc.perform(get("/api/v1/planner/conversations/{id}", created).header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(created))
                .andExpect(jsonPath("$.title").value("New chat"))
                .andExpect(jsonPath("$.messages.length()").value(0));

        mockMvc.perform(delete("/api/v1/planner/conversations/{id}", created).header("Authorization", bearer(user)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/planner/conversations/{id}", created).header("Authorization", bearer(user)))
                .andExpect(status().isNotFound());
        assertThat(chatCount(user)).isEqualTo(1);
    }

    @Test
    void theSixteenthChatDeletesTheLeastRecentlyActiveOne() throws Exception {
        User user = student("student@campus.com");
        List<String> chats = new ArrayList<>();
        Instant base = Instant.now().minus(2, ChronoUnit.DAYS);
        for (int i = 0; i < PlannerLimits.MAX_CONVERSATIONS; i++) {
            String chat = newChat(user);
            setLastActive(chat, base.plus(i, ChronoUnit.MINUTES));
            chats.add(chat);
        }
        // The oldest chat was used recently, so the second-oldest is the one to go.
        setLastActive(chats.get(0), Instant.now());

        mockMvc.perform(post("/api/v1/planner/conversations").header("Authorization", bearer(user)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.evictedId").value(chats.get(1)));

        assertThat(chatCount(user)).isEqualTo(PlannerLimits.MAX_CONVERSATIONS);
        mockMvc.perform(get("/api/v1/planner/conversations/{id}", chats.get(1)).header("Authorization", bearer(user)))
                .andExpect(status().isNotFound());
    }

    @Test
    void creatingChatsAtOnceNeverLeavesMoreThanFifteen() throws Exception {
        User user = student("student@campus.com");
        for (int i = 0; i < PlannerLimits.MAX_CONVERSATIONS - 1; i++) {
            newChat(user);
        }

        int racers = 8;
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(racers);
        try {
            List<Future<PlannerCreatedConversationDTO>> results = new ArrayList<>();
            for (int i = 0; i < racers; i++) {
                Callable<PlannerCreatedConversationDTO> create = () -> {
                    go.await();
                    return conversationService.create(user.getId());
                };
                results.add(pool.submit(create));
            }
            go.countDown();
            int evictions = 0;
            for (Future<PlannerCreatedConversationDTO> result : results) {
                if (result.get().evictedId() != null) evictions++;
            }
            // 14 + 8 creates, capped at 15: exactly 7 of them had to evict.
            assertThat(evictions).isEqualTo(racers - 1);
        } finally {
            pool.shutdownNow();
        }
        assertThat(chatCount(user)).isEqualTo(PlannerLimits.MAX_CONVERSATIONS);
    }

    @Test
    void anotherUsersChatIsNotFoundForEveryRoute() throws Exception {
        User owner = student("owner@campus.com");
        User other = student("other@campus.com");
        String chat = newChat(owner);

        mockMvc.perform(get("/api/v1/planner/conversations/{id}", chat).header("Authorization", bearer(other)))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/planner/conversations/{id}", chat).header("Authorization", bearer(other)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/planner/conversations").header("Authorization", bearer(other)))
                .andExpect(jsonPath("$.conversations.length()").value(0));
        mockMvc.perform(get("/api/v1/planner/conversations/{id}", "not-a-chat-id").header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());

        assertThat(chatCount(owner)).isEqualTo(1);
    }

    @Test
    void signedOutCallersAreRefused() throws Exception {
        // 403, as every other signed-in-only route in this API answers a caller with no token.
        mockMvc.perform(get("/api/v1/planner/conversations")).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/planner/conversations")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/planner/usage")).andExpect(status().isForbidden());
    }
}
