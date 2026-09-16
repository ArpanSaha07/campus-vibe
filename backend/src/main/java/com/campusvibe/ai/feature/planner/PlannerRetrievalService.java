package com.campusvibe.ai.feature.planner;

import com.campusvibe.club.Club;
import com.campusvibe.club.ClubDTO;
import com.campusvibe.club.ClubMapper;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.event.Event;
import com.campusvibe.event.EventDTO;
import com.campusvibe.event.EventMapper;
import com.campusvibe.event.EventRepository;
import com.campusvibe.search.QueryEmbeddingCache;
import com.campusvibe.search.SearchIndexService;
import com.campusvibe.search.SearchRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Chooses what the model may recommend for one message: at most 15 events that
 * have not ended and start within 30 days, and at most 6 clubs.
 *
 * <p>Sources, merged and then ranked by {@link PlannerRanker}:
 * <ul>
 *   <li>hybrid search on the prompt and the previous prompt, one embedding
 *       through {@link QueryEmbeddingCache}; when no embedding can be had,
 *       keywords alone (Arpan, 2026-09-16)</li>
 *   <li>the events the person saved or is going to</li>
 *   <li>events from the clubs they follow</li>
 *   <li>the items of the previous answer: after a clubs answer, those clubs'
 *       events; after an events answer, their organizers, so a follow-up chip
 *       has something to point at</li>
 *   <li>the soonest events, so a prompt about now has candidates</li>
 * </ul>
 *
 * <p>The model sees nothing else, and {@link PlannerAnswers} drops any pick
 * that is not one of these.
 */
@Service
public class PlannerRetrievalService {

    /** How many each source contributes before ranking. */
    private static final int POOL = 30;

    private final QueryEmbeddingCache queryEmbeddingCache;
    private final SearchRepository searchRepository;
    private final PlannerCandidateRepository candidateRepository;
    private final EventRepository eventRepository;
    private final ClubRepository clubRepository;
    private final EventMapper eventMapper;
    private final ClubMapper clubMapper;

    public PlannerRetrievalService(QueryEmbeddingCache queryEmbeddingCache,
                                   SearchRepository searchRepository,
                                   PlannerCandidateRepository candidateRepository,
                                   EventRepository eventRepository,
                                   ClubRepository clubRepository,
                                   EventMapper eventMapper,
                                   ClubMapper clubMapper) {
        this.queryEmbeddingCache = queryEmbeddingCache;
        this.searchRepository = searchRepository;
        this.candidateRepository = candidateRepository;
        this.eventRepository = eventRepository;
        this.clubRepository = clubRepository;
        this.eventMapper = eventMapper;
        this.clubMapper = clubMapper;
    }

    /** What the model is offered, best first, with what it needs to describe them. */
    public record Candidates(List<EventDTO> events, List<ClubDTO> clubs, Set<String> interests) {

        public boolean hasEvent(String id) {
            return events.stream().anyMatch(event -> String.valueOf(event.id()).equals(id));
        }

        public boolean hasClub(String id) {
            return clubs.stream().anyMatch(club -> club.id().equals(id));
        }
    }

    /**
     * @param previousPrompt the person's previous message in this chat, or null
     * @param previousPicks  the picks of the answer before this message, or empty
     */
    @Transactional(readOnly = true)
    public Candidates retrieve(long userId, String prompt, String previousPrompt,
                               List<PlannerPickDTO> previousPicks, Instant now) {
        int windowDays = (int) PlannerLimits.WINDOW.toDays();
        String searchText = previousPrompt == null ? prompt : prompt + "\n" + previousPrompt;
        // Empty when the key is unset or the provider failed: search ranks by
        // keywords alone and the reply still runs.
        String vector = queryEmbeddingCache.embed(searchText).map(SearchIndexService::toVectorLiteral).orElse(null);

        Set<String> followed = new HashSet<>(candidateRepository.followedClubIds(userId));
        Set<String> interests = new HashSet<>(candidateRepository.interestSlugs(userId));

        Set<Long> contextEvents = new LinkedHashSet<>();
        Set<String> contextClubs = new LinkedHashSet<>();
        for (PlannerPickDTO pick : previousPicks) {
            if (PlannerPickDTO.EVENT.equals(pick.kind())) {
                parseEventId(pick.id()).ifPresent(contextEvents::add);
            } else if (PlannerPickDTO.CLUB.equals(pick.kind())) {
                contextClubs.add(pick.id());
            }
        }
        contextEvents.addAll(candidateRepository.fromClubs(contextClubs, windowDays, POOL));

        Map<Long, Double> eventScores = searchRepository
                .plannerEventCandidates(vector, searchText, windowDays, POOL).stream()
                .collect(Collectors.toMap(SearchRepository.Scored::id, SearchRepository.Scored::score, Math::max));
        Set<Long> savedOrGoing = new LinkedHashSet<>(candidateRepository.savedOrGoing(userId, windowDays));
        List<Long> soonest = candidateRepository.soonest(windowDays, POOL);

        Set<Long> eventIds = new LinkedHashSet<>(eventScores.keySet());
        eventIds.addAll(savedOrGoing);
        eventIds.addAll(candidateRepository.fromFollowedClubs(userId, windowDays, POOL));
        eventIds.addAll(contextEvents);
        eventIds.addAll(soonest);

        Instant windowEnd = now.plus(PlannerLimits.WINDOW);
        // The previous answer's own events come in by id, so the window is
        // applied again here; every other source already applied it in SQL.
        Map<Long, Event> events = eventRepository.findAllById(eventIds).stream()
                .filter(event -> event.getEndTime().isAfter(now) && event.getDateTime().isBefore(windowEnd))
                .collect(Collectors.toMap(Event::getId, Function.identity()));

        // After an events answer, the clubs that run those events.
        for (Long id : contextEvents) {
            Event event = events.get(id);
            if (event != null && previousPicksInclude(previousPicks, PlannerPickDTO.EVENT, String.valueOf(id))) {
                contextClubs.add(event.getOrganizer().getId());
            }
        }

        List<PlannerRanker.EventFacts> rankedEvents = PlannerRanker.rankEvents(
                events.values().stream()
                        .map(event -> new PlannerRanker.EventFacts(event.getId(), event.getDateTime(),
                                event.getEndTime(), event.getOrganizer().getId(), Set.copyOf(event.getTopicSlugs())))
                        .toList(),
                new PlannerRanker.EventSignals(eventScores, savedOrGoing, contextEvents, soonest, followed, interests),
                PlannerRanker.asksAboutNow(prompt), now, PlannerLimits.MAX_CANDIDATE_EVENTS);

        List<String> organizers = rankedEvents.stream().map(PlannerRanker.EventFacts::organizerId).distinct().toList();
        Map<String, Double> clubScores = searchRepository
                .plannerClubCandidates(vector, searchText, POOL).stream()
                .collect(Collectors.toMap(SearchRepository.Scored::id, SearchRepository.Scored::score, Math::max));

        Set<String> clubIds = new LinkedHashSet<>(clubScores.keySet());
        clubIds.addAll(organizers);
        clubIds.addAll(contextClubs);
        Map<String, Club> clubs = clubRepository.findAllById(clubIds).stream()
                .collect(Collectors.toMap(Club::getId, Function.identity()));

        List<PlannerRanker.ClubFacts> rankedClubs = PlannerRanker.rankClubs(
                clubs.values().stream()
                        .map(club -> new PlannerRanker.ClubFacts(club.getId(), Set.copyOf(club.getInterestSlugs())))
                        .toList(),
                clubScores, contextClubs, organizers, followed, interests, PlannerLimits.MAX_CANDIDATE_CLUBS);

        return new Candidates(
                rankedEvents.stream().map(facts -> eventMapper.apply(events.get(facts.id()))).toList(),
                rankedClubs.stream().map(facts -> clubMapper.apply(clubs.get(facts.id()))).toList(),
                Set.copyOf(interests));
    }

    /**
     * Names for the items of earlier answers, keyed {@code kind:id}, so the
     * history sent to the model says what it recommended. Ended events keep
     * their names here: the history is about what was said, not what is on.
     */
    @Transactional(readOnly = true)
    public Map<String, String> namesFor(Collection<PlannerPickDTO> picks) {
        Set<Long> eventIds = new HashSet<>();
        Set<String> clubIds = new HashSet<>();
        for (PlannerPickDTO pick : picks) {
            if (PlannerPickDTO.EVENT.equals(pick.kind())) {
                parseEventId(pick.id()).ifPresent(eventIds::add);
            } else if (PlannerPickDTO.CLUB.equals(pick.kind())) {
                clubIds.add(pick.id());
            }
        }
        Map<String, String> names = new HashMap<>();
        if (!eventIds.isEmpty()) {
            eventRepository.findAllById(eventIds)
                    .forEach(event -> names.put(PlannerPickDTO.EVENT + ":" + event.getId(), event.getTitle()));
        }
        if (!clubIds.isEmpty()) {
            clubRepository.findAllById(clubIds)
                    .forEach(club -> names.put(PlannerPickDTO.CLUB + ":" + club.getId(), club.getName()));
        }
        return names;
    }

    private static boolean previousPicksInclude(List<PlannerPickDTO> picks, String kind, String id) {
        return picks.stream().anyMatch(pick -> kind.equals(pick.kind()) && id.equals(pick.id()));
    }

    private static Optional<Long> parseEventId(String id) {
        try {
            return Optional.of(Long.parseLong(id));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }
}
