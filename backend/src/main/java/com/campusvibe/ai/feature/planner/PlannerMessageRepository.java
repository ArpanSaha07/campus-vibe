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

/** {@code planner_messages} (V36). Picks are a JSONB array of {@link PlannerPickDTO}. */
@Repository
public class PlannerMessageRepository {

    public static final String USER = "user";
    public static final String ASSISTANT = "assistant";

    public record Row(long id, String role, String content, List<PlannerPickDTO> picks, Instant createdAt) {}

    private static final TypeReference<List<PlannerPickDTO>> PICKS = new TypeReference<>() {};

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
                readPicks(rs.getString("picks")),
                rs.getObject("created_at", OffsetDateTime.class).toInstant());
    }

    /** Every message, oldest first. A chat holds at most 40. */
    public List<Row> findByConversation(UUID conversationId) {
        return jdbcTemplate.query(
                "SELECT id, role, content, picks::text AS picks, created_at FROM planner_messages"
                        + " WHERE conversation_id = ? ORDER BY id",
                rowMapper, conversationId);
    }

    /** The latest {@code limit} messages, oldest first. */
    public List<Row> findRecent(UUID conversationId, int limit) {
        List<Row> newestFirst = new ArrayList<>(jdbcTemplate.query(
                "SELECT id, role, content, picks::text AS picks, created_at FROM planner_messages"
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

    public long insert(UUID conversationId, String role, String content, List<PlannerPickDTO> picks, Instant now) {
        Long id = jdbcTemplate.queryForObject(
                "INSERT INTO planner_messages (conversation_id, role, content, picks, created_at)"
                        + " VALUES (?, ?, ?, CAST(? AS jsonb), ?) RETURNING id",
                Long.class, conversationId, role, content, writePicks(picks),
                OffsetDateTime.ofInstant(now, ZoneOffset.UTC));
        if (id == null) {
            throw new IllegalStateException("INSERT ... RETURNING id returned no id");
        }
        return id;
    }

    private List<PlannerPickDTO> readPicks(String json) {
        try {
            return json == null ? List.of() : List.copyOf(objectMapper.readValue(json, PICKS));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("planner_messages.picks is not a pick array", e);
        }
    }

    private String writePicks(List<PlannerPickDTO> picks) {
        try {
            return objectMapper.writeValueAsString(picks);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Picks could not be written as JSON", e);
        }
    }
}
