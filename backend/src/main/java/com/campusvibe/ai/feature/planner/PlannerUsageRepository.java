package com.campusvibe.ai.feature.planner;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

/** {@code planner_daily_usage} (V36): one row per user per America/Toronto day. */
@Repository
public class PlannerUsageRepository {

    private final JdbcTemplate jdbcTemplate;

    public PlannerUsageRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Counts one message if the day has room, in one statement.
     *
     * <p>A read followed by a write would let two sends at 14 of 15 both see
     * room. Here the conflict update's WHERE is evaluated against the row as
     * locked, so the second send updates nothing and is refused.
     *
     * @return false when the day's limit is already reached
     */
    public boolean trySpend(long userId, LocalDate day, int limit) {
        return jdbcTemplate.update("""
                INSERT INTO planner_daily_usage (user_id, usage_date, message_count)
                VALUES (?, ?, 1)
                ON CONFLICT (user_id, usage_date) DO UPDATE
                    SET message_count = planner_daily_usage.message_count + 1
                    WHERE planner_daily_usage.message_count < ?
                """, userId, day, limit) > 0;
    }

    /** Hands back a message spent on {@code day}; never below zero. */
    public void refund(long userId, LocalDate day) {
        jdbcTemplate.update(
                "UPDATE planner_daily_usage SET message_count = message_count - 1"
                        + " WHERE user_id = ? AND usage_date = ? AND message_count > 0",
                userId, day);
    }

    public int used(long userId, LocalDate day) {
        List<Integer> counts = jdbcTemplate.queryForList(
                "SELECT message_count FROM planner_daily_usage WHERE user_id = ? AND usage_date = ?",
                Integer.class, userId, day);
        return counts.isEmpty() ? 0 : counts.get(0);
    }
}
