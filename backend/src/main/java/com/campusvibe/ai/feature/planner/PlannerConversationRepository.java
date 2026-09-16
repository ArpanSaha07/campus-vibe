package com.campusvibe.ai.feature.planner;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * {@code planner_conversations} (V36).
 *
 * <p>Plain SQL rather than JPA, for all three planner tables: the writes that
 * matter are a row lock, a conditional upsert and an update-returning, each one
 * statement here, and no entity means no flush to forget between a JPA write
 * and a JdbcTemplate one (BUG-034).
 *
 * <p>Every read and write that takes a chat id also takes the user id, so a
 * chat is only ever found by its owner.
 */
@Repository
public class PlannerConversationRepository {

    public record Row(UUID id, long userId, String title, Instant createdAt, Instant lastActiveAt) {}

    private static final String COLUMNS = "id, user_id, title, created_at, last_active_at";

    private static final RowMapper<Row> ROW = (rs, n) -> new Row(
            rs.getObject("id", UUID.class),
            rs.getLong("user_id"),
            rs.getString("title"),
            rs.getObject("created_at", OffsetDateTime.class).toInstant(),
            rs.getObject("last_active_at", OffsetDateTime.class).toInstant());

    private final JdbcTemplate jdbcTemplate;

    public PlannerConversationRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Locks the user's row until the transaction ends, so two creates for one
     * user run one after the other and the second counts the first's chat.
     */
    public void lockUser(long userId) {
        jdbcTemplate.queryForList("SELECT id FROM users WHERE id = ? FOR UPDATE", Long.class, userId);
    }

    public List<Row> findByUser(long userId) {
        return jdbcTemplate.query(
                "SELECT " + COLUMNS + " FROM planner_conversations WHERE user_id = ?"
                        + " ORDER BY last_active_at DESC, created_at DESC",
                ROW, userId);
    }

    public Optional<Row> findOwned(UUID id, long userId) {
        return jdbcTemplate.query(
                "SELECT " + COLUMNS + " FROM planner_conversations WHERE id = ? AND user_id = ?",
                ROW, id, userId).stream().findFirst();
    }

    public int countByUser(long userId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM planner_conversations WHERE user_id = ?", Integer.class, userId);
        return count == null ? 0 : count;
    }

    /** The chat eviction removes: least recently active, then oldest. The page names the same one. */
    public Optional<UUID> findLeastRecentlyActive(long userId) {
        return jdbcTemplate.queryForList(
                "SELECT id FROM planner_conversations WHERE user_id = ?"
                        + " ORDER BY last_active_at ASC, created_at ASC LIMIT 1",
                UUID.class, userId).stream().findFirst();
    }

    public Row insert(long userId, Instant now) {
        OffsetDateTime at = OffsetDateTime.ofInstant(now, ZoneOffset.UTC);
        return jdbcTemplate.queryForObject(
                "INSERT INTO planner_conversations (id, user_id, title, created_at, last_active_at)"
                        + " VALUES (?, ?, NULL, ?, ?) RETURNING " + COLUMNS,
                ROW, UUID.randomUUID(), userId, at, at);
    }

    public boolean delete(UUID id, long userId) {
        return jdbcTemplate.update(
                "DELETE FROM planner_conversations WHERE id = ? AND user_id = ?", id, userId) > 0;
    }

    /**
     * Records a completed reply: sets the title if the chat has none yet, and
     * moves last_active_at. Empty when the chat was deleted mid-reply.
     */
    public Optional<Row> recordReply(UUID id, long userId, String titleIfUnset, Instant now) {
        return jdbcTemplate.query(
                "UPDATE planner_conversations SET title = COALESCE(title, ?), last_active_at = ?"
                        + " WHERE id = ? AND user_id = ? RETURNING " + COLUMNS,
                ROW, titleIfUnset, OffsetDateTime.ofInstant(now, ZoneOffset.UTC), id, userId)
                .stream().findFirst();
    }
}
