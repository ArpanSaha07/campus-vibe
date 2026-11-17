package com.campusvibe.ai.feature.planner;

import com.campusvibe.ai.client.LlmRequest;
import com.campusvibe.club.Club;
import com.campusvibe.club.ClubRepository;
import com.campusvibe.event.Event;
import com.campusvibe.event.EventRepository;
import com.campusvibe.exception.ResourceNotFoundException;
import com.campusvibe.user.MyClubService;
import com.campusvibe.user.MyEventService;
import com.campusvibe.user.User;
import com.campusvibe.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Runs the tools the model calls, on rules the model cannot change (ADR-023):
 *
 * <ul>
 *   <li>the student is the JWT principal's id, never an argument;</li>
 *   <li>following, RSVPing, saving and a calendar link reach only this turn's
 *       candidates or the student's own follows, saves and RSVPs (Arpan,
 *       2026-11-16), so a club's description cannot aim an action at an
 *       arbitrary club or event;</li>
 *   <li>an ended event is refused here, before the unchanged
 *       {@code MyEventService.rsvp} or {@code saveEvent}, which check only
 *       that it exists (Arpan, 2026-11-16; the endpoint fix is a P1 in
 *       {@code todo.md});</li>
 *   <li>undoing touches only what the student already has, so it needs no
 *       fence of its own.</li>
 * </ul>
 *
 * <p>Writes go through the same services as the follow button and the API, so
 * a follow moves {@code Club.followers} exactly as a click does.
 */
@Service
public class PlannerToolExecutor {

    /** What one tool call did, and the JSON the model reads back as its result. */
    public record Execution(List<PlannerAction> actions, String resultForModel) {}

    private final MyClubService myClubService;
    private final MyEventService myEventService;
    private final PlannerCandidateRepository candidateRepository;
    private final UserRepository userRepository;
    private final ClubRepository clubRepository;
    private final EventRepository eventRepository;
    private final ObjectMapper objectMapper;

    public PlannerToolExecutor(MyClubService myClubService,
                               MyEventService myEventService,
                               PlannerCandidateRepository candidateRepository,
                               UserRepository userRepository,
                               ClubRepository clubRepository,
                               EventRepository eventRepository,
                               ObjectMapper objectMapper) {
        this.myClubService = myClubService;
        this.myEventService = myEventService;
        this.candidateRepository = candidateRepository;
        this.userRepository = userRepository;
        this.clubRepository = clubRepository;
        this.eventRepository = eventRepository;
        this.objectMapper = objectMapper;
    }

    public Execution execute(long userId, LlmRequest.ToolCall call,
                             PlannerRetrievalService.Candidates candidates, Instant now) {
        List<String> ids = ids(call.arguments());
        if (ids == null) {
            return new Execution(List.of(), "{\"error\":\"The arguments were not {ids: [...]}.\"}");
        }
        String email = userRepository.findById(userId).map(User::getEmail)
                .orElseThrow(() -> new ResourceNotFoundException("The user no longer exists."));

        List<PlannerAction> actions = new ArrayList<>();
        switch (call.name()) {
            case PlannerTools.FOLLOW_CLUB, PlannerTools.UNFOLLOW_CLUB -> {
                Set<String> followed = new HashSet<>(candidateRepository.followedClubIds(userId));
                boolean follow = PlannerTools.FOLLOW_CLUB.equals(call.name());
                for (String id : ids) {
                    actions.add(follow ? follow(email, id, followed, candidates) : unfollow(email, id, followed));
                }
            }
            case PlannerTools.RSVP_EVENT, PlannerTools.CANCEL_RSVP, PlannerTools.SAVE_EVENT,
                 PlannerTools.UNSAVE_EVENT, PlannerTools.OFFER_CALENDAR_LINK -> {
                Set<String> going = strings(candidateRepository.goingEventIds(userId));
                Set<String> saved = strings(candidateRepository.savedEventIds(userId));
                for (String id : ids) {
                    actions.add(eventAction(call.name(), email, id, going, saved, candidates, now));
                }
            }
            default -> {
                return new Execution(List.of(), "{\"error\":\"There is no tool by that name.\"}");
            }
        }
        return new Execution(List.copyOf(actions), resultFor(actions));
    }

    private PlannerAction follow(String email, String id, Set<String> followed,
                                 PlannerRetrievalService.Candidates candidates) {
        Optional<Club> club = clubRepository.findById(id);
        String name = club.map(Club::getName).orElse(id);
        if (followed.contains(id)) {
            return club(PlannerAction.FOLLOW, id, name, PlannerAction.UNCHANGED);
        }
        if (!candidates.hasClub(id)) {
            return club(PlannerAction.FOLLOW, id, name,
                    club.isEmpty() ? PlannerAction.NOT_FOUND : PlannerAction.NOT_ALLOWED);
        }
        myClubService.follow(email, id);
        followed.add(id);
        return club(PlannerAction.FOLLOW, id, name, PlannerAction.DONE);
    }

    private PlannerAction unfollow(String email, String id, Set<String> followed) {
        String name = clubRepository.findById(id).map(Club::getName).orElse(id);
        if (!followed.remove(id)) {
            return club(PlannerAction.UNFOLLOW, id, name, PlannerAction.UNCHANGED);
        }
        myClubService.unfollow(email, id);
        return club(PlannerAction.UNFOLLOW, id, name, PlannerAction.DONE);
    }

    private PlannerAction eventAction(String tool, String email, String id, Set<String> going, Set<String> saved,
                                      PlannerRetrievalService.Candidates candidates, Instant now) {
        String type = switch (tool) {
            case PlannerTools.RSVP_EVENT -> PlannerAction.RSVP;
            case PlannerTools.CANCEL_RSVP -> PlannerAction.CANCEL_RSVP;
            case PlannerTools.SAVE_EVENT -> PlannerAction.SAVE;
            case PlannerTools.UNSAVE_EVENT -> PlannerAction.UNSAVE;
            default -> PlannerAction.CALENDAR;
        };
        Optional<Event> event = parseEventId(id).flatMap(eventRepository::findById);
        String name = event.map(Event::getTitle).orElse(id);

        // Undoing: only what the student already has; ended or not, it may go.
        if (PlannerAction.CANCEL_RSVP.equals(type) || PlannerAction.UNSAVE.equals(type)) {
            boolean rsvp = PlannerAction.CANCEL_RSVP.equals(type);
            if (!(rsvp ? going : saved).remove(id)) {
                return event(type, id, name, PlannerAction.UNCHANGED);
            }
            long eventId = Long.parseLong(id);
            if (rsvp) myEventService.cancelRsvp(email, eventId); else myEventService.unsaveEvent(email, eventId);
            return event(type, id, name, PlannerAction.DONE);
        }

        if (event.isEmpty()) {
            return event(type, id, name, PlannerAction.NOT_FOUND);
        }
        if (PlannerAction.RSVP.equals(type) && going.contains(id)
                || PlannerAction.SAVE.equals(type) && saved.contains(id)) {
            return event(type, id, name, PlannerAction.UNCHANGED);
        }
        if (!candidates.hasEvent(id) && !going.contains(id) && !saved.contains(id)) {
            return event(type, id, name, PlannerAction.NOT_ALLOWED);
        }
        if (!event.get().getEndTime().isAfter(now)) {
            return event(type, id, name, PlannerAction.ENDED);
        }
        long eventId = event.get().getId();
        switch (type) {
            case PlannerAction.RSVP -> {
                myEventService.rsvp(email, eventId);
                going.add(id);
            }
            case PlannerAction.SAVE -> {
                myEventService.saveEvent(email, eventId);
                saved.add(id);
            }
            default -> {
                // The calendar link writes nothing: the student's click on it confirms.
                return event(type, id, name, PlannerAction.OFFERED);
            }
        }
        return event(type, id, name, PlannerAction.DONE);
    }

    /** The {@code ids} array, at most six distinct, or null when the arguments are not that shape. */
    private List<String> ids(String arguments) {
        try {
            JsonNode root = objectMapper.readTree(arguments);
            if (root == null || !root.path("ids").isArray()) {
                return null;
            }
            Set<String> ids = new LinkedHashSet<>();
            for (JsonNode id : root.path("ids")) {
                String value = id.asText("").trim();
                if (!value.isEmpty()) ids.add(value);
                if (ids.size() == PlannerLimits.MAX_IDS_PER_TOOL_CALL) break;
            }
            return List.copyOf(ids);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private String resultFor(List<PlannerAction> actions) {
        try {
            return objectMapper.writeValueAsString(Map.of("results", actions.stream()
                    .map(action -> Map.of("id", action.id(), "name", action.name(), "outcome", action.outcome()))
                    .toList()));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("A tool result could not be written as JSON", e);
        }
    }

    private static PlannerAction club(String type, String id, String name, String outcome) {
        return new PlannerAction(type, PlannerPickDTO.CLUB, id, name, outcome);
    }

    private static PlannerAction event(String type, String id, String name, String outcome) {
        return new PlannerAction(type, PlannerPickDTO.EVENT, id, name, outcome);
    }

    private static Set<String> strings(List<Long> ids) {
        Set<String> out = new HashSet<>();
        ids.forEach(id -> out.add(String.valueOf(id)));
        return out;
    }

    private static Optional<Long> parseEventId(String id) {
        try {
            return Optional.of(Long.parseLong(id));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }
}
