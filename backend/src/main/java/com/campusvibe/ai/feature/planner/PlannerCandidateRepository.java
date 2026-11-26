package com.campusvibe.ai.feature.planner;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.List;

/**
 * The planner's retrieval sources other than search: what this user saved,
 * is going to and follows, and what is simply on soonest.
 *
 * <p>Every event query here applies the same {@link PlannerIntent.Window} as
 * the search leg: still running at its start, which is never before now
 * (ADR-020's {@code end_time > now()}), and starting before its end. So no
 * source can offer an event that has ended, and when the prompt names a day,
 * none can offer another day's (spec 2026-11-26-planner-topic-and-date-retrieval).
 */
@Repository
public class PlannerCandidateRepository {

    private static final String IN_WINDOW =
            "e.end_time > :windowFrom AND e.date_time < :windowTo";

    private final NamedParameterJdbcTemplate jdbc;

    public PlannerCandidateRepository(JdbcTemplate jdbcTemplate) {
        this.jdbc = new NamedParameterJdbcTemplate(jdbcTemplate);
    }

    /** Events this user saved or said they are going to. */
    public List<Long> savedOrGoing(long userId, PlannerIntent.Window window) {
        return jdbc.queryForList("""
                SELECT e.id FROM events e
                WHERE e.id IN (SELECT event_id FROM user_saved_events WHERE user_id = :userId
                               UNION
                               SELECT event_id FROM user_event_rsvps WHERE user_id = :userId)
                  AND %s
                ORDER BY e.date_time
                """.formatted(IN_WINDOW),
                params(window).addValue("userId", userId), Long.class);
    }

    /** Events run by the clubs this user follows, soonest first. */
    public List<Long> fromFollowedClubs(long userId, PlannerIntent.Window window, int limit) {
        return jdbc.queryForList("""
                SELECT e.id FROM events e
                JOIN user_followed_clubs f ON f.club_id = e.organizer_id
                WHERE f.user_id = :userId AND %s
                ORDER BY e.date_time
                LIMIT :limit
                """.formatted(IN_WINDOW),
                params(window).addValue("userId", userId).addValue("limit", limit), Long.class);
    }

    /** Events run by these clubs, soonest first: the follow-up to a clubs answer. */
    public List<Long> fromClubs(Collection<String> clubIds, PlannerIntent.Window window, int limit) {
        if (clubIds.isEmpty()) {
            return List.of();
        }
        return jdbc.queryForList("""
                SELECT e.id FROM events e
                WHERE e.organizer_id IN (:clubIds) AND %s
                ORDER BY e.date_time
                LIMIT :limit
                """.formatted(IN_WINDOW),
                params(window).addValue("clubIds", clubIds).addValue("limit", limit), Long.class);
    }

    /**
     * Running now or starting soonest, whatever they are about. The only
     * source that can answer a prompt like <em>what's on right now?</em>, which
     * names nothing search could match.
     */
    public List<Long> soonest(PlannerIntent.Window window, int limit) {
        return jdbc.queryForList("""
                SELECT e.id FROM events e
                WHERE %s
                ORDER BY e.date_time
                LIMIT :limit
                """.formatted(IN_WINDOW),
                params(window).addValue("limit", limit), Long.class);
    }

    /** Every event this user is going to, ended or not: what the agent may cancel (ADR-023). */
    public List<Long> goingEventIds(long userId) {
        return jdbc.queryForList("SELECT event_id FROM user_event_rsvps WHERE user_id = :userId",
                new MapSqlParameterSource("userId", userId), Long.class);
    }

    /** Every event this user saved, ended or not: what the agent may unsave (ADR-023). */
    public List<Long> savedEventIds(long userId) {
        return jdbc.queryForList("SELECT event_id FROM user_saved_events WHERE user_id = :userId",
                new MapSqlParameterSource("userId", userId), Long.class);
    }

    public List<String> followedClubIds(long userId) {
        return jdbc.queryForList("SELECT club_id FROM user_followed_clubs WHERE user_id = :userId",
                new MapSqlParameterSource("userId", userId), String.class);
    }

    /** The user's own interests (V20), the vocabulary event topics share (ADR-001). */
    public List<String> interestSlugs(long userId) {
        return jdbc.queryForList("SELECT interest_slug FROM user_interests WHERE user_id = :userId",
                new MapSqlParameterSource("userId", userId), String.class);
    }

    /** Events tagged with any of these topics, soonest first: the source a named topic filters to. */
    public List<Long> withTopics(Collection<String> topics, PlannerIntent.Window window, int limit) {
        if (topics.isEmpty()) {
            return List.of();
        }
        return jdbc.queryForList("""
                SELECT e.id FROM events e
                WHERE e.id IN (SELECT event_id FROM event_topic_assignments WHERE interest_slug IN (:topics))
                  AND %s
                ORDER BY e.date_time
                LIMIT :limit
                """.formatted(IN_WINDOW),
                params(window).addValue("topics", topics).addValue("limit", limit), Long.class);
    }

    private static MapSqlParameterSource params(PlannerIntent.Window window) {
        return new MapSqlParameterSource("windowFrom", utc(window.from())).addValue("windowTo", utc(window.to()));
    }

    static OffsetDateTime utc(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
