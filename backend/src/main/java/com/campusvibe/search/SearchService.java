package com.campusvibe.search;

import com.campusvibe.club.ClubDTO;
import com.campusvibe.club.ClubMapper;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.event.EventDTO;
import com.campusvibe.event.EventMapper;
import com.campusvibe.event.EventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class SearchService {

    private final EmbeddingService embeddingService;
    private final SearchRepository searchRepository;
    private final EventRepository eventRepository;
    private final ClubRepository clubRepository;
    private final EventMapper eventMapper;
    private final ClubMapper clubMapper;

    public SearchService(EmbeddingService embeddingService,
                         SearchRepository searchRepository,
                         EventRepository eventRepository,
                         ClubRepository clubRepository,
                         EventMapper eventMapper,
                         ClubMapper clubMapper) {
        this.embeddingService = embeddingService;
        this.searchRepository = searchRepository;
        this.eventRepository = eventRepository;
        this.clubRepository = clubRepository;
        this.eventMapper = eventMapper;
        this.clubMapper = clubMapper;
    }

    @Transactional(readOnly = true)
    public List<EventDTO> searchEvents(String query, int limit) {
        List<Long> ids = queryEmbedding(query)
                .map(vector -> searchRepository.hybridSearchEventIds(vector, query, limit))
                .orElseGet(() -> searchRepository.keywordSearchEventIds(query, limit));
        // reload in ranked order
        Map<Long, EventDTO> byId = eventRepository.findAllById(ids).stream()
                .map(eventMapper)
                .collect(Collectors.toMap(EventDTO::id, Function.identity()));
        return ids.stream().map(byId::get).filter(java.util.Objects::nonNull).toList();
    }

    @Transactional(readOnly = true)
    public List<ClubDTO> searchClubs(String query, int limit) {
        List<String> ids = queryEmbedding(query)
                .map(vector -> searchRepository.hybridSearchClubIds(vector, query, limit))
                .orElseGet(() -> searchRepository.keywordSearchClubIds(query, limit));
        Map<String, ClubDTO> byId = clubRepository.findAllById(ids).stream()
                .map(clubMapper)
                .collect(Collectors.toMap(ClubDTO::id, Function.identity()));
        return ids.stream().map(byId::get).filter(java.util.Objects::nonNull).toList();
    }

    private Optional<String> queryEmbedding(String query) {
        return embeddingService.embed(query).map(SearchIndexService::toVectorLiteral);
    }
}
