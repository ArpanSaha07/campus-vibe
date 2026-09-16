package com.campusvibe.ai.client;

import java.util.List;
import java.util.Map;

/**
 * One structured completion request, in provider-neutral terms.
 *
 * @param feature    short label for usage logging only, for example {@code planner}
 * @param messages   the conversation, system message first
 * @param schemaName a name for the schema, as providers require one
 * @param jsonSchema a strict JSON schema the output must satisfy
 */
public record LlmRequest(String feature,
                         List<Message> messages,
                         String schemaName,
                         Map<String, Object> jsonSchema) {

    public enum Role { SYSTEM, USER, ASSISTANT }

    public record Message(Role role, String content) {}

    public LlmRequest {
        messages = List.copyOf(messages);
    }
}
