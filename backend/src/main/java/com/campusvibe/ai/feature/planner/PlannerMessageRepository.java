package com.campusvibe.ai.feature.planner;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * {@code planner_messages} (V36, V37). Picks are a JSONB array of
 * {@link PlannerPickDTO}; actions, of {@link PlannerAction} (ADR-023).
 */
@Repository
public class PlannerMessageRepository {

    public static final String USER = "user";
    public static final String ASSISTANT = "assistant";

    public record Row(long id, String role, String content, List<PlannerPickDTO> picks,
                      List<PlannerAction> actions, Instant createdAt) {

        /** A row without actions, as every user message and every answer before V37 has. */
        public Row(long id, String role, String content, List<PlannerPickDTO> picks, Instant createdAt) {
            this(id, role, content, picks, List.of(), createdAt);
        }
    }

    private static final TypeReference<List<PlannerPickDTO>> PICKS = new TypeReference<>() {};
    private static final TypeReference<List<PlannerAction>> ACTIONS = new TypeReference<>() {};
    private static final String COLUMNS = "id, role, content, picks::text AS picks, actions::text AS actions, created_at";

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final RowMapper<Row> rowMapper;

    public PlannerMessageRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.rowMapper = (rs, n) -> new Row(
                rs.getLong("id"),
                rs.getString("role"),
                rs.getString("content"),
                read(rs.getString("picks"), PICKS),
                read(rs.getString("actions"), ACTIONS),
                rs.getObject("created_at", OffsetDateTime.class).toInstant());
    }

    /** Every message, oldest first. A chat holds at most 40. */
    public List<Row> findByConversation(UUID conversationId) {
        return jdbcTemplate.query(
                "SELECT " + COLUMNS + " FROM planner_messages"
                        + " WHERE conversation_id = ? ORDER BY id",
                rowMapper, conversationId);
    }

    /** The latest {@code limit} messages, oldest first. */
    public List<Row> findRecent(UUID conversationId, int limit) {
        List<Row> newestFirst = new ArrayList<>(jdbcTemplate.query(
                "SELECT " + COLUMNS + " FROM planner_messages"
                        + " WHERE conversation_id = ? ORDER BY id DESC LIMIT ?",
                rowMapper, conversationId, limit));
        Collections.reverse(newestFirst);
        return newestFirst;
    }

    public int count(UUID conversationId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM planner_messages WHERE conversation_id = ?", Integer.class, conversationId);
        return count == null ? 0 : count;
    }

    public long insert(UUID conversationId, String role, String content, List<PlannerPickDTO> picks,
                       List<PlannerAction> actions, Instant now) {
        Long id = jdbcTemplate.queryForObject(
                "INSERT INTO planner_messages (conversation_id, role, content, picks, actions, created_at)"
                        + " VALUES (?, ?, ?, CAST(? AS jsonb), CAST(? AS jsonb), ?) RETURNING id",
                Long.class, conversationId, role, content, write(picks), write(actions),
                OffsetDateTime.ofInstant(now, ZoneOffset.UTC));
        if (id == null) {
            throw new IllegalStateException("INSERT ... RETURNING id returned no id");
        }
        return id;
    }

    private <T> List<T> read(String json, TypeReference<List<T>> type) {
        try {
            return json == null ? List.of() : List.copyOf(objectMapper.readValue(json, type));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("A planner_messages JSONB column is not the expected array", e);
        }
    }

    private String write(List<?> values) {
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Planner message JSON could not be written", e);
        }
    }
}
