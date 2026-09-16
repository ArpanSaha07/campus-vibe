package com.campusvibe.ai.feature.planner;

import com.campusvibe.club.ClubDTO;
import com.campusvibe.club.ClubMapper;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.event.EventDTO;
import com.campusvibe.event.EventMapper;
import com.campusvibe.event.EventRepository;
import com.campusvibe.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Saved chats: the 15-chat cap and its eviction, ownership, and reading a chat
 * back with fresh cards.
 */
@Service
public class PlannerConversationService {

    /** What an untitled chat is called until its first reply completes. */
    public static final String UNTITLED = "New chat";

    private final PlannerConversationRepository conversationRepository;
    private final PlannerMessageRepository messageRepository;
    private final PlannerUsageService usageService;
    private final EventRepository eventRepository;
    private final ClubRepository clubRepository;
    private final EventMapper eventMapper;
    private final ClubMapper clubMapper;

    public PlannerConversationService(PlannerConversationRepository conversationRepository,
                                      PlannerMessageRepository messageRepository,
                                      PlannerUsageService usageService,
                                      EventRepository eventRepository,
                                      ClubRepository clubRepository,
                                      EventMapper eventMapper,
                                      ClubMapper clubMapper) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.usageService = usageService;
        this.eventRepository = eventRepository;
        this.clubRepository = clubRepository;
        this.eventMapper = eventMapper;
        this.clubMapper = clubMapper;
    }

    @Transactional(readOnly = true)
    public PlannerConversationListDTO list(long userId) {
        return new PlannerConversationListDTO(
                conversationRepository.findByUser(userId).stream().map(PlannerConversationService::summary).toList(),
                usageService.usage(userId));
    }

    /**
     * Creates an empty chat, first deleting the least recently active one if
     * the user already has 15.
     *
     * <p>The user's row is locked for the whole transaction, so two tabs
     * creating at once run in turn and the second sees the first's chat. A
     * count read without the lock would let both see 14 and leave 16.
     */
    @Transactional
    public PlannerCreatedConversationDTO create(long userId) {
        conversationRepository.lockUser(userId);

        String evictedId = null;
        while (conversationRepository.countByUser(userId) >= PlannerLimits.MAX_CONVERSATIONS) {
            UUID oldest = conversationRepository.findLeastRecentlyActive(userId).orElseThrow();
            conversationRepository.delete(oldest, userId);
            evictedId = oldest.toString();
        }

        PlannerConversationRepository.Row created = conversationRepository.insert(userId, Instant.now());
        return new PlannerCreatedConversationDTO(summary(created), evictedId);
    }

    @Transactional(readOnly = true)
    public PlannerConversationDTO get(String conversationId, long userId) {
        PlannerConversationRepository.Row conversation = requireOwned(conversationId, userId);
        List<PlannerMessageRepository.Row> rows = messageRepository.findByConversation(conversation.id());

        Cards cards = cardsFor(rows.stream().flatMap(row -> row.picks().stream()).toList());
        List<PlannerMessageDTO> messages = rows.stream()
                .map(row -> {
                    Cards own = cards.only(row.picks());
                    return new PlannerMessageDTO(String.valueOf(row.id()), row.role(), row.content(), "complete",
                            row.picks(), own.events(), own.clubs(), row.createdAt());
                })
                .toList();

        return new PlannerConversationDTO(conversation.id().toString(), titleOf(conversation),
                conversation.lastActiveAt(), messages);
    }

    @Transactional
    public void delete(String conversationId, long userId) {
        UUID id = parseId(conversationId);
        if (!conversationRepository.delete(id, userId)) {
            throw notFound();
        }
    }

    /** A completed exchange as stored, with the cards its picks name. */
    public record StoredReply(long messageId, PlannerConversationSummaryDTO conversation, Cards cards) {}

    /**
     * Stores a completed exchange, the person's message then the reply, and
     * records the reply on the chat: its title if it had none, and its last
     * activity. Nothing is stored for a reply that did not complete, so this
     * is the only write a reply makes to a chat.
     *
     * @return empty when the chat was deleted while the reply was being written
     */
    @Transactional
    public Optional<StoredReply> recordExchange(long userId, UUID conversationId, String prompt,
                                                String intro, List<PlannerPickDTO> picks) {
        Instant now = Instant.now();
        Optional<PlannerConversationRepository.Row> conversation =
                conversationRepository.recordReply(conversationId, userId, titleFrom(prompt), now);
        if (conversation.isEmpty()) {
            return Optional.empty();
        }
        messageRepository.insert(conversationId, PlannerMessageRepository.USER, prompt, List.of(), now);
        long replyId = messageRepository.insert(conversationId, PlannerMessageRepository.ASSISTANT, intro, picks, now);
        return Optional.of(new StoredReply(replyId, summary(conversation.get()), cardsFor(picks).only(picks)));
    }

    /** The first message, on one line and cut to 60 characters without splitting a character. */
    static String titleFrom(String prompt) {
        String line = prompt.replaceAll("\\s+", " ").strip();
        if (line.codePointCount(0, line.length()) <= PlannerLimits.TITLE_LENGTH) {
            return line;
        }
        return line.substring(0, line.offsetByCodePoints(0, PlannerLimits.TITLE_LENGTH)).strip();
    }

    /**
     * The chat, if it is this user's. Another user's chat is a 404, never a
     * 403, so a chat id reveals nothing about whether it exists.
     */
    public PlannerConversationRepository.Row requireOwned(String conversationId, long userId) {
        return conversationRepository.findOwned(parseId(conversationId), userId).orElseThrow(this::notFound);
    }

    /**
     * The cards behind these picks, read now: an event that has ended or been
     * deleted since the answer was written is left out, and so is a deleted
     * club. The page drops a pick with no card.
     *
     * <p>Call inside a transaction: the mappers read lazy collections.
     */
    public Cards cardsFor(Collection<PlannerPickDTO> picks) {
        Set<Long> eventIds = new LinkedHashSet<>();
        Set<String> clubIds = new LinkedHashSet<>();
        for (PlannerPickDTO pick : picks) {
            if (PlannerPickDTO.EVENT.equals(pick.kind())) {
                parseEventId(pick.id()).ifPresent(eventIds::add);
            } else if (PlannerPickDTO.CLUB.equals(pick.kind())) {
                clubIds.add(pick.id());
            }
        }

        Instant now = Instant.now();
        List<EventDTO> events = eventIds.isEmpty() ? List.of() : eventRepository.findAllById(eventIds).stream()
                .filter(event -> event.getEndTime().isAfter(now))
                .map(eventMapper)
                .toList();
        List<ClubDTO> clubs = clubIds.isEmpty() ? List.of() : clubRepository.findAllById(clubIds).stream()
                .map(clubMapper)
                .toList();
        return new Cards(events, clubs);
    }

    public static PlannerConversationSummaryDTO summary(PlannerConversationRepository.Row row) {
        return new PlannerConversationSummaryDTO(row.id().toString(), titleOf(row), row.lastActiveAt());
    }

    private static String titleOf(PlannerConversationRepository.Row row) {
        return row.title() == null ? UNTITLED : row.title();
    }

    private UUID parseId(String conversationId) {
        try {
            return UUID.fromString(conversationId);
        } catch (IllegalArgumentException e) {
            // Not a chat id at all, which the page treats exactly as a missing chat.
            throw notFound();
        }
    }

    private ResourceNotFoundException notFound() {
        return new ResourceNotFoundException("This chat no longer exists.");
    }

    private static Optional<Long> parseEventId(String id) {
        try {
            return Optional.of(Long.parseLong(id));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    /** Hydrated cards, in the order the repository returned them. */
    public record Cards(List<EventDTO> events, List<ClubDTO> clubs) {

        /** The subset these picks name, in pick order. */
        public Cards only(List<PlannerPickDTO> picks) {
            Map<String, EventDTO> eventsById = events.stream()
                    .collect(Collectors.toMap(event -> String.valueOf(event.id()), Function.identity()));
            Map<String, ClubDTO> clubsById = clubs.stream()
                    .collect(Collectors.toMap(ClubDTO::id, Function.identity()));
            List<EventDTO> ownEvents = picks.stream()
                    .filter(pick -> PlannerPickDTO.EVENT.equals(pick.kind()))
                    .map(pick -> eventsById.get(pick.id()))
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList();
            List<ClubDTO> ownClubs = picks.stream()
                    .filter(pick -> PlannerPickDTO.CLUB.equals(pick.kind()))
                    .map(pick -> clubsById.get(pick.id()))
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList();
            return new Cards(ownEvents, ownClubs);
        }
    }
}
