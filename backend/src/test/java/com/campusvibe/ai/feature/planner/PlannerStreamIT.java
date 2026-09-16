package com.campusvibe.ai.feature.planner;

import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The reply stream through a real servlet container, as the browser reaches it.
 *
 * <p>MockMvc does not run Tomcat's async dispatch the way a real request does,
 * so it cannot show that the second, async dispatch of an {@code SseEmitter}
 * passes Spring Security, nor that a refusal asked for as
 * {@code text/event-stream} still leaves with its status. Both were written
 * for this unit, and both fail silently in a browser.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class PlannerStreamIT extends PlannerIntegrationTest {

    @LocalServerPort
    private int port;

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    private HttpResponse<String> post(User user, String chatId, String content) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(
                        URI.create("http://localhost:" + port + "/api/v1/planner/conversations/" + chatId + "/messages"))
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", bearer(user))
                .header("Content-Type", "application/json")
                .header("Accept", "text/event-stream")
                .POST(HttpRequest.BodyPublishers.ofString("{\"content\":\"" + content + "\"}"))
                .build();
        return http.send(request, HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void aReplyStreamsToTheEndThroughTheContainer() throws Exception {
        User user = student("student@campus.com");
        String chat = newChat(user);
        llm.answerWith(request -> List.of("{\"intro\":\"Nothing on ", "yet.\",\"kind\":\"none\",\"picks\":[]}"));

        HttpResponse<String> response = post(user, chat, "anything tonight?");

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("Content-Type")).hasValueSatisfying(
                type -> assertThat(type).startsWith("text/event-stream"));
        assertThat(response.headers().firstValue("X-Accel-Buffering")).hasValue("no");
        assertThat(response.body())
                .contains("event:delta")
                .contains("{\"text\":\"Nothing on \"}")
                .contains("event:done")
                .doesNotContain("event:error");
        assertThat(messageRepository.count(java.util.UUID.fromString(chat))).isEqualTo(2);
    }

    @Test
    void refusalsAskedForAsAStreamKeepTheirStatusAndBody() throws Exception {
        User user = student("student@campus.com");
        String chat = newChat(user);

        llm.setConfigured(false);
        HttpResponse<String> unavailable = post(user, chat, "hello");
        assertThat(unavailable.statusCode()).isEqualTo(503);
        assertThat(unavailable.body()).contains("The planner is unavailable right now.");

        llm.setConfigured(true);
        jdbcTemplate.update("INSERT INTO planner_daily_usage (user_id, usage_date, message_count) VALUES (?, ?, ?)",
                user.getId(), PlannerDay.of(java.time.Instant.now()), PlannerLimits.DAILY_MESSAGES);
        HttpResponse<String> exhausted = post(user, chat, "hello");
        assertThat(exhausted.statusCode()).isEqualTo(429);
        assertThat(exhausted.headers().firstValue("Retry-After")).isPresent();

        HttpResponse<String> missing = post(user, "00000000-0000-0000-0000-000000000000", "hello");
        assertThat(missing.statusCode()).isEqualTo(404);
    }
}
