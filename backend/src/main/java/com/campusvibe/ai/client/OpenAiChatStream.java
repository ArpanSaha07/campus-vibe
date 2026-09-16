package com.campusvibe.ai.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.function.Consumer;

/**
 * Reads an OpenAI Chat Completions stream: {@code data:} lines of JSON chunks,
 * ended by {@code data: [DONE]}.
 *
 * <p>Separate from {@link OpenAiLlmClient} so it can be tested on a byte
 * stream with no HTTP. It knows nothing about retries or timeouts, and it lets
 * an exception from {@code onText} through untouched.
 */
final class OpenAiChatStream {

    /** What the stream produced. {@code totalTokens} is -1 when the provider sent no usage. */
    record Result(String text, int totalTokens) {}

    private OpenAiChatStream() {}

    static Result read(InputStream body, ObjectMapper objectMapper, Consumer<String> onText) throws IOException {
        StringBuilder text = new StringBuilder();
        String finishReason = null;
        int totalTokens = -1;
        boolean done = false;

        BufferedReader reader = new BufferedReader(new InputStreamReader(body, StandardCharsets.UTF_8));
        String line;
        while ((line = reader.readLine()) != null) {
            if (!line.startsWith("data:")) {
                // Blank separators, and any comment or event line the provider adds.
                continue;
            }
            String payload = line.substring("data:".length()).trim();
            if (payload.equals("[DONE]")) {
                done = true;
                break;
            }
            JsonNode chunk = objectMapper.readTree(payload);
            if (chunk.hasNonNull("error")) {
                // The error object can quote the request; only its type is kept.
                throw new LlmException(LlmException.Reason.FAILED,
                        "Provider stream error of type " + chunk.path("error").path("type").asText("unknown"));
            }
            if (chunk.path("usage").hasNonNull("total_tokens")) {
                totalTokens = chunk.path("usage").path("total_tokens").asInt();
            }
            JsonNode choice = chunk.path("choices").path(0);
            if (choice.isMissingNode()) {
                // The usage-only chunk stream_options.include_usage adds at the end.
                continue;
            }
            JsonNode delta = choice.path("delta");
            if (delta.hasNonNull("refusal") && !delta.path("refusal").asText().isEmpty()) {
                throw new LlmException(LlmException.Reason.REFUSED, "The model refused the request");
            }
            if (delta.hasNonNull("content")) {
                String fragment = delta.path("content").asText();
                if (!fragment.isEmpty()) {
                    text.append(fragment);
                    onText.accept(fragment);
                }
            }
            if (choice.hasNonNull("finish_reason")) {
                finishReason = choice.path("finish_reason").asText();
            }
        }

        if ("length".equals(finishReason)) {
            throw new LlmException(LlmException.Reason.TRUNCATED, "The output reached the token cap");
        }
        if ("content_filter".equals(finishReason)) {
            throw new LlmException(LlmException.Reason.REFUSED, "The output was filtered");
        }
        if (finishReason == null || !done) {
            throw new LlmException(LlmException.Reason.FAILED, "The stream ended before the completion finished");
        }
        return new Result(text.toString(), totalTokens);
    }
}
