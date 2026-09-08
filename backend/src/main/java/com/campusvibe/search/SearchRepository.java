package com.campusvibe.search;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Hybrid search queries. Final score = semanticWeight * cosine similarity
 * + keywordWeight * normalized ts_rank (see .claude/docs/architecture/search.md).
 * When no query embedding is available, falls back to keyword-only matching.
 */
@Repository
public class SearchRepository {

    private final JdbcTemplate jdbcTemplate;
    private final double semanticWeight;
    private final double keywordWeight;
    private final double minScore;

    // ts_rank is unbounded; x / (x + k) maps it into [0, 1)
    private static final String EVENT_TEXT =
            "e.title || ' ' || COALESCE(e.description, '') || ' ' || COALESCE(c.name, '') || ' ' || COALESCE(tags.tag_text, '')";
    private static final String CLUB_TEXT =
            "c.name || ' ' || COALESCE(c.description, '') || ' ' || COALESCE(ctags.tag_text, '')";

    /**
     * An event's tags as readable words, for the keyword leg.
     *
     * <p>Replaces the {@code event_categories} join V30 dropped. Both axes are
     * folded into one blob because keyword matching does not care which is
     * which -- somebody typing <em>workshop</em> and somebody typing
     * <em>robotics</em> both want this event.
     *
     * <p>Labels rather than slugs, deliberately: nobody searches for
     * {@code ai-machine-learning}, and to_tsvector would treat the hyphens as
     * word boundaries anyway and produce something the query never matches.
     */
    private static final String EVENT_TAGS_JOIN = """
            LEFT JOIN (SELECT event_id, string_agg(label, ' ') AS tag_text FROM (
                           SELECT eta.event_id, ic.label
                           FROM event_topic_assignments eta
                           JOIN interest_catalogue ic ON ic.slug = eta.interest_slug
                           UNION ALL
                           SELECT efa.event_id, ef.label
                           FROM event_format_assignments efa
                           JOIN event_formats ef ON ef.slug = efa.format_slug
                       ) t GROUP BY event_id) tags ON tags.event_id = e.id""";

    /**
     * A club's interest tags as readable words.
     *
     * <p>New with V25, and the reason a search for <em>tech</em> now reaches a
     * departmental society whose description never uses the word -- which is
     * exactly what club tags were added to make possible.
     */
    private static final String CLUB_TAGS_JOIN = """
            LEFT JOIN (SELECT ci.club_id, string_agg(ic.label, ' ') AS tag_text
                       FROM club_interests ci
                       JOIN interest_catalogue ic ON ic.slug = ci.interest_slug
                       GROUP BY ci.club_id) ctags ON ctags.club_id = c.id""";

    public SearchRepository(JdbcTemplate jdbcTemplate,
                            @Value("${search.semantic-weight:0.7}") double semanticWeight,
                            @Value("${search.keyword-weight:0.3}") double keywordWeight,
                            @Value("${search.min-score:0.2}") double minScore) {
        this.jdbcTemplate = jdbcTemplate;
        this.semanticWeight = semanticWeight;
        this.keywordWeight = keywordWeight;
        this.minScore = minScore;
    }

    public List<Long> hybridSearchEventIds(String vectorLiteral, String query, int limit) {
        // A keyword hit always qualifies; minScore only gates semantic-only matches.
        String sql = """
                SELECT id FROM (
                    SELECT e.id,
                           kw.rank AS kw,
                           %f * COALESCE(1 - (e.embedding <=> CAST(? AS vector)), 0)
                         + %f * (kw.rank / (kw.rank + 0.05)) AS score
                    FROM events e
                    JOIN clubs c ON c.id = e.organizer_id
                    %s
                    CROSS JOIN LATERAL (
                        SELECT to_tsvector('english', %s) AS doc,
                               websearch_to_tsquery('english', ?) AS query
                    ) fts
                    CROSS JOIN LATERAL (
                        -- ts_rank returns 1e-20 (not 0) for non-matches; gate on a real match
                        SELECT CASE WHEN fts.doc @@ fts.query
                                    THEN ts_rank(fts.doc, fts.query) ELSE 0 END AS rank
                    ) kw
                ) ranked
                WHERE score >= ? OR kw > 0
                ORDER BY score DESC
                LIMIT ?
                """.formatted(semanticWeight, keywordWeight, EVENT_TAGS_JOIN, EVENT_TEXT);
        return jdbcTemplate.queryForList(sql, Long.class, vectorLiteral, query, minScore, limit);
    }

    public List<Long> keywordSearchEventIds(String query, int limit) {
        String sql = """
                SELECT e.id
                FROM events e
                JOIN clubs c ON c.id = e.organizer_id
                %s
                WHERE to_tsvector('english', %s) @@ websearch_to_tsquery('english', ?)
                   OR e.title ILIKE '%%' || ? || '%%'
                ORDER BY ts_rank(to_tsvector('english', %s), websearch_to_tsquery('english', ?)) DESC
                LIMIT ?
                """.formatted(EVENT_TAGS_JOIN, EVENT_TEXT, EVENT_TEXT);
        return jdbcTemplate.queryForList(sql, Long.class, query, query, query, limit);
    }

    public List<String> hybridSearchClubIds(String vectorLiteral, String query, int limit) {
        String sql = """
                SELECT id FROM (
                    SELECT c.id,
                           kw.rank AS kw,
                           %f * COALESCE(1 - (c.embedding <=> CAST(? AS vector)), 0)
                         + %f * (kw.rank / (kw.rank + 0.05)) AS score
                    FROM clubs c
                    %s
                    CROSS JOIN LATERAL (
                        SELECT to_tsvector('english', %s) AS doc,
                               websearch_to_tsquery('english', ?) AS query
                    ) fts
                    CROSS JOIN LATERAL (
                        -- ts_rank returns 1e-20 (not 0) for non-matches; gate on a real match
                        SELECT CASE WHEN fts.doc @@ fts.query
                                    THEN ts_rank(fts.doc, fts.query) ELSE 0 END AS rank
                    ) kw
                ) ranked
                WHERE score >= ? OR kw > 0
                ORDER BY score DESC
                LIMIT ?
                """.formatted(semanticWeight, keywordWeight, CLUB_TAGS_JOIN, CLUB_TEXT);
        return jdbcTemplate.queryForList(sql, String.class, vectorLiteral, query, minScore, limit);
    }

    public List<String> keywordSearchClubIds(String query, int limit) {
        String sql = """
                SELECT c.id
                FROM clubs c
                %s
                WHERE to_tsvector('english', %s) @@ websearch_to_tsquery('english', ?)
                   OR c.name ILIKE '%%' || ? || '%%'
                ORDER BY ts_rank(to_tsvector('english', %s), websearch_to_tsquery('english', ?)) DESC
                LIMIT ?
                """.formatted(CLUB_TAGS_JOIN, CLUB_TEXT, CLUB_TEXT);
        return jdbcTemplate.queryForList(sql, String.class, query, query, query, limit);
    }
}
