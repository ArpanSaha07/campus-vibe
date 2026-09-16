package com.campusvibe.ai.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OpenAiChatStreamTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static InputStream stream(String... lines) {
        return new ByteArrayInputStream(String.join("\n", lines).getBytes(StandardCharsets.UTF_8));
    }

    private static String chunk(String content, String finishReason) {
        String delta = content == null ? "{}" : "{\"content\":" + quote(content) + "}";
        String finish = finishReason == null ? "null" : "\"" + finishReason + "\"";
        return "data: {\"choices\":[{\"index\":0,\"delta\":" + delta + ",\"finish_reason\":" + finish + "}]}";
    }

    private static String quote(String text) {
        return "\"" + text.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    @Test
    void handsOnEachContentFragmentAndReturnsTheWholeText() throws Exception {
        List<String> fragments = new ArrayList<>();

        OpenAiChatStream.Result result = OpenAiChatStream.read(stream(
                chunk("{\"intro\":", null), "",
                chunk("\"Hi\"}", null), "",
                ": keep-alive", "",
                chunk(null, "stop"), "",
                "data: {\"choices\":[],\"usage\":{\"total_tokens\":42}}", "",
                "data: [DONE]", ""), objectMapper, fragments::add);

        assertThat(fragments).containsExactly("{\"intro\":", "\"Hi\"}");
        assertThat(result.text()).isEqualTo("{\"intro\":\"Hi\"}");
        assertThat(result.totalTokens()).isEqualTo(42);
    }

    @Test
    void anOutputCutOffAtTheTokenCapIsTruncated() {
        assertThatThrownBy(() -> OpenAiChatStream.read(stream(
                chunk("{\"intro\":\"Hi", null), chunk(null, "length"), "data: [DONE]"), objectMapper, text -> {}))
                .isInstanceOfSatisfying(LlmException.class,
                        e -> assertThat(e.reason()).isEqualTo(LlmException.Reason.TRUNCATED));
    }

    @Test
    void aRefusalIsRefused() {
        assertThatThrownBy(() -> OpenAiChatStream.read(stream(
                "data: {\"choices\":[{\"delta\":{\"refusal\":\"I can't help with that.\"},\"finish_reason\":null}]}"),
                objectMapper, text -> {}))
                .isInstanceOfSatisfying(LlmException.class,
                        e -> assertThat(e.reason()).isEqualTo(LlmException.Reason.REFUSED));
    }

    @Test
    void aStreamThatStopsWithoutFinishingFails() {
        assertThatThrownBy(() -> OpenAiChatStream.read(stream(chunk("{\"intro\":\"Hi", null)), objectMapper, text -> {}))
                .isInstanceOfSatisfying(LlmException.class,
                        e -> assertThat(e.reason()).isEqualTo(LlmException.Reason.FAILED));
    }

    @Test
    void anErrorObjectKeepsOnlyItsType() {
        assertThatThrownBy(() -> OpenAiChatStream.read(stream(
                "data: {\"error\":{\"type\":\"server_error\",\"message\":\"your prompt was: secret\"}}"),
                objectMapper, text -> {}))
                .isInstanceOf(LlmException.class)
                .hasMessageContaining("server_error")
                .hasMessageNotContaining("secret");
    }

    @Test
    void anExceptionFromTheCallerStopsTheStreamUnchanged() {
        IllegalStateException stop = new IllegalStateException("client gone");

        assertThatThrownBy(() -> OpenAiChatStream.read(stream(chunk("a", null), chunk("b", "stop"), "data: [DONE]"),
                objectMapper, text -> { throw stop; }))
                .isSameAs(stop);
    }
}
