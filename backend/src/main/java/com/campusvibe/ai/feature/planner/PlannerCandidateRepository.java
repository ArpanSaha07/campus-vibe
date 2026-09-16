package com.campusvibe.ai.feature.planner;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

/**
 * The planner's retrieval sources other than search: what this user saved,
 * is going to and follows, and what is simply on soonest.
 *
 * <p>Every event query here applies the same window as the search leg,
 * {@code end_time > now()} (ADR-020) and a start within {@code windowDays}, so
 * no source can offer the model an event that has ended.
 */
@Repository
public class PlannerCandidateRepository {

    private static final String IN_WINDOW =
            "e.end_time > now() AND e.date_time < now() + make_interval(days => :windowDays)";

    private final NamedParameterJdbcTemplate jdbc;

    public PlannerCandidateRepository(JdbcTemplate jdbcTemplate) {
        this.jdbc = new NamedParameterJdbcTemplate(jdbcTemplate);
    }

    /** Events this user saved or said they are going to. */
    public List<Long> savedOrGoing(long userId, int windowDays) {
        return jdbc.queryForList("""
                SELECT e.id FROM events e
                WHERE e.id IN (SELECT event_id FROM user_saved_events WHERE user_id = :userId
                               UNION
                               SELECT event_id FROM user_event_rsvps WHERE user_id = :userId)
                  AND %s
                ORDER BY e.date_time
                """.formatted(IN_WINDOW),
                params(windowDays).addValue("userId", userId), Long.class);
    }

    /** Events run by the clubs this user follows, soonest first. */
    public List<Long> fromFollowedClubs(long userId, int windowDays, int limit) {
        return jdbc.queryForList("""
                SELECT e.id FROM events e
                JOIN user_followed_clubs f ON f.club_id = e.organizer_id
                WHERE f.user_id = :userId AND %s
                ORDER BY e.date_time
                LIMIT :limit
                """.formatted(IN_WINDOW),
                params(windowDays).addValue("userId", userId).addValue("limit", limit), Long.class);
    }

    /** Events run by these clubs, soonest first: the follow-up to a clubs answer. */
    public List<Long> fromClubs(Collection<String> clubIds, int windowDays, int limit) {
        if (clubIds.isEmpty()) {
            return List.of();
        }
        return jdbc.queryForList("""
                SELECT e.id FROM events e
                WHERE e.organizer_id IN (:clubIds) AND %s
                ORDER BY e.date_time
                LIMIT :limit
                """.formatted(IN_WINDOW),
                params(windowDays).addValue("clubIds", clubIds).addValue("limit", limit), Long.class);
    }

    /**
     * Running now or starting soonest, whatever they are about. The only
     * source that can answer a prompt like <em>what's on right now?</em>, which
     * names nothing search could match.
     */
    public List<Long> soonest(int windowDays, int limit) {
        return jdbc.queryForList("""
                SELECT e.id FROM events e
                WHERE %s
                ORDER BY e.date_time
                LIMIT :limit
                """.formatted(IN_WINDOW),
                params(windowDays).addValue("limit", limit), Long.class);
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

    private static MapSqlParameterSource params(int windowDays) {
        return new MapSqlParameterSource("windowDays", windowDays);
    }
}
