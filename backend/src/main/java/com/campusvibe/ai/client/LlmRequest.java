package com.campusvibe.ai.client;

import java.util.List;
import java.util.Map;

/**
 * One structured completion request, in provider-neutral terms.
 *
 * @param feature      short label for usage logging only, for example {@code planner}
 * @param messages     the conversation, system message first
 * @param schemaName   a name for the schema, as providers require one
 * @param jsonSchema   a strict JSON schema the answer must satisfy
 * @param tools        functions the model may call instead of answering; empty for none
 * @param toolsAllowed false forces an answer this round even when tools are listed,
 *                     which is how a caller ends a tool loop (ADR-023)
 */
public record LlmRequest(String feature,
                         List<Message> messages,
                         String schemaName,
                         Map<String, Object> jsonSchema,
                         List<Tool> tools,
                         boolean toolsAllowed) {

    public enum Role { SYSTEM, USER, ASSISTANT, TOOL }

    /**
     * One message. An assistant message that called tools carries them in
     * {@code toolCalls} and may have null content; a {@code TOOL} message
     * answers the call named by {@code toolCallId}.
     */
    public record Message(Role role, String content, List<ToolCall> toolCalls, String toolCallId) {

        public Message(Role role, String content) {
            this(role, content, List.of(), null);
        }

        public Message {
            toolCalls = toolCalls == null ? List.of() : List.copyOf(toolCalls);
        }

        public static Message toolCalls(List<ToolCall> calls) {
            return new Message(Role.ASSISTANT, null, calls, null);
        }

        public static Message toolResult(String toolCallId, String content) {
            return new Message(Role.TOOL, content, List.of(), toolCallId);
        }
    }

    /**
     * A function the model may call.
     *
     * @param parameters a strict JSON schema for the arguments
     */
    public record Tool(String name, String description, Map<String, Object> parameters) {}

    /**
     * A call the model made. {@code arguments} is the raw JSON text, which the
     * caller must validate: the model wrote it.
     */
    public record ToolCall(String id, String name, String arguments) {}

    public LlmRequest(String feature, List<Message> messages, String schemaName, Map<String, Object> jsonSchema) {
        this(feature, messages, schemaName, jsonSchema, List.of(), false);
    }

    public LlmRequest {
        messages = List.copyOf(messages);
        tools = tools == null ? List.of() : List.copyOf(tools);
    }

    /** The same request with these messages, for the next round of a tool loop. */
    public LlmRequest withMessages(List<Message> next) {
        return new LlmRequest(feature, next, schemaName, jsonSchema, tools, toolsAllowed);
    }

    /** The same request offering these tools, or forcing an answer when {@code allowed} is false. */
    public LlmRequest withTools(List<Tool> next, boolean allowed) {
        return new LlmRequest(feature, messages, schemaName, jsonSchema, next, allowed);
    }
}
