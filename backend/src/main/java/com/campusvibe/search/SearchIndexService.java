package com.campusvibe.search;

import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.taxonomy.TaxonomyService;
import com.campusvibe.event.Event;
import com.campusvibe.event.EventRepository;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes embeddings for events and clubs. Best-effort by design: indexing must
 * never fail the surrounding business operation (event/club create or update),
 * and it is a no-op when no embedding provider is configured.
 */
@Service
public class SearchIndexService {

    private static final Logger log = LoggerFactory.getLogger(SearchIndexService.class);

    private final EmbeddingService embeddingService;
    private final JdbcTemplate jdbcTemplate;
    private final EventRepository eventRepository;
    private final ClubRepository clubRepository;
    private final TaxonomyService taxonomyService;

    public SearchIndexService(EmbeddingService embeddingService,
                              JdbcTemplate jdbcTemplate,
                              EventRepository eventRepository,
                              ClubRepository clubRepository,
                              TaxonomyService taxonomyService) {
        this.embeddingService = embeddingService;
        this.jdbcTemplate = jdbcTemplate;
        this.eventRepository = eventRepository;
        this.clubRepository = clubRepository;
        this.taxonomyService = taxonomyService;
    }

    /**
     * Slugs to the words a human would read.
     *
     * <p>Looked up once per index call rather than held as a field: the
     * vocabularies only change when a migration runs, but caching them here
     * would mean a stale map survives that migration until the next restart,
     * for a lookup that costs a single indexed read.
     */
    private List<String> labelsFor(Collection<String> interestSlugs,
                                   Collection<String> formatSlugs) {
        Map<String, String> interests = taxonomyService.interestLabels();
        Map<String, String> formats = taxonomyService.eventFormatLabels();
        return Stream.concat(
                        interestSlugs.stream().map(interests::get),
                        formatSlugs.stream().map(formats::get))
                .filter(Objects::nonNull)
                .sorted()
                .toList();
    }

    public void indexEvent(Event event) {
        if (!embeddingService.isEnabled()) {
            return;
        }
        try {
            List<String> labels = labelsFor(event.getTopicSlugs(), event.getFormatSlugs());
            embeddingService.embed(SearchableText.forEvent(event, labels)).ifPresent(embedding ->
                    jdbcTemplate.update("UPDATE events SET embedding = CAST(? AS vector) WHERE id = ?",
                            toVectorLiteral(embedding), event.getId()));
        } catch (Exception e) {
            log.warn("Failed to index event {} for search: {}", event.getId(), e.getMessage());
        }
    }

    public void indexClub(Club club) {
        if (!embeddingService.isEnabled()) {
            return;
        }
        try {
            List<String> labels = labelsFor(club.getInterestSlugs(), List.of());
            embeddingService.embed(SearchableText.forClub(club, labels)).ifPresent(embedding ->
                    jdbcTemplate.update("UPDATE clubs SET embedding = CAST(? AS vector) WHERE id = ?",
                            toVectorLiteral(embedding), club.getId()));
        } catch (Exception e) {
            log.warn("Failed to index club {} for search: {}", club.getId(), e.getMessage());
        }
    }

    /** Backfills embeddings for every event and club. Returns counts indexed. */
    @Transactional
    public ReindexResult reindexAll() {
        int events = 0;
        int clubs = 0;
        if (embeddingService.isEnabled()) {
            for (Event event : eventRepository.findAll()) {
                indexEvent(event);
                events++;
            }
            for (Club club : clubRepository.findAll()) {
                indexClub(club);
                clubs++;
            }
        }
        return new ReindexResult(embeddingService.isEnabled(), events, clubs);
    }

    public record ReindexResult(boolean embeddingsEnabled, int eventsIndexed, int clubsIndexed) {}

    static String toVectorLiteral(float[] embedding) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < embedding.length; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(embedding[i]);
        }
        return sb.append(']').toString();
    }
}
