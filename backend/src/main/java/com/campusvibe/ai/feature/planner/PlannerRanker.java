package com.campusvibe.ai.feature.planner;

import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Orders retrieval candidates before the best are offered to the model.
 *
 * <p>Pure, so it is tested without a database. Each source a candidate came
 * from adds to its score; the model then chooses among the ones kept, so the
 * weights decide what it is shown, not what it picks. They are hand-set, and
 * their order is the point: what this conversation is already about first,
 * then the person's own events, then what they follow and care about. Search
 * relevance, at most 1, runs through all of them.
 */
public final class PlannerRanker {

    /** An item from the answer the person is following up on. */
    static final double CONTEXT = 0.35;
    /** An event the person saved or is going to. */
    static final double SAVED_OR_GOING = 0.25;
    /** An event run by, or a club that is, one the person follows. */
    static final double FOLLOWED = 0.15;
    /** Shares at least one interest with the person (ADR-001's shared vocabulary). */
    static final double INTEREST = 0.10;
    /** Running now, when the prompt asks about now. */
    static final double RUNNING_NOW = 0.30;
    /** The most a soonest-starting event gets for being soon, falling to zero down the list. */
    static final double SOONEST = 0.05;
    /** A club that runs one of the kept events. */
    static final double ORGANIZER = 0.10;

    private static final Pattern ASKS_ABOUT_NOW =
            Pattern.compile("\\b(now|right now|tonight|currently|at the moment)\\b", Pattern.CASE_INSENSITIVE);

    private PlannerRanker() {}

    /** What the ranker needs to know about one event. */
    public record EventFacts(long id, Instant start, Instant end, String organizerId, Set<String> topics) {}

    /** What the ranker needs to know about one club. */
    public record ClubFacts(String id, Set<String> interests) {}

    /** Where the event candidates came from. Any of these may be empty. */
    public record EventSignals(Map<Long, Double> searchScores,
                               Set<Long> savedOrGoing,
                               Set<Long> context,
                               List<Long> soonest,
                               Set<String> followedClubs,
                               Set<String> interests) {}

    public static boolean asksAboutNow(String prompt) {
        return prompt != null && ASKS_ABOUT_NOW.matcher(prompt).find();
    }

    /** The best {@code limit} events, best first; ties go to the earlier start. */
    public static List<EventFacts> rankEvents(Collection<EventFacts> events, EventSignals signals,
                                              boolean asksAboutNow, Instant now, int limit) {
        Map<Long, Double> soonestBonus = new HashMap<>();
        int size = signals.soonest().size();
        for (int i = 0; i < size; i++) {
            soonestBonus.put(signals.soonest().get(i), SOONEST * (size - i) / size);
        }

        Map<Long, Double> scores = new HashMap<>();
        for (EventFacts event : events) {
            double score = signals.searchScores().getOrDefault(event.id(), 0.0)
                    + soonestBonus.getOrDefault(event.id(), 0.0);
            if (signals.context().contains(event.id())) score += CONTEXT;
            if (signals.savedOrGoing().contains(event.id())) score += SAVED_OR_GOING;
            if (signals.followedClubs().contains(event.organizerId())) score += FOLLOWED;
            if (event.topics().stream().anyMatch(signals.interests()::contains)) score += INTEREST;
            if (asksAboutNow && !event.start().isAfter(now) && event.end().isAfter(now)) score += RUNNING_NOW;
            scores.put(event.id(), score);
        }

        return events.stream()
                .sorted(Comparator.comparingDouble((EventFacts event) -> scores.get(event.id())).reversed()
                        .thenComparing(EventFacts::start)
                        .thenComparingLong(EventFacts::id))
                .limit(limit)
                .toList();
    }

    /**
     * The best {@code limit} clubs, best first; ties go to the slug.
     *
     * @param organizers the organizers of the kept events, best event first
     */
    public static List<ClubFacts> rankClubs(Collection<ClubFacts> clubs, Map<String, Double> searchScores,
                                            Set<String> context, List<String> organizers,
                                            Set<String> followedClubs, Set<String> interests, int limit) {
        Map<String, Double> scores = new HashMap<>();
        for (ClubFacts club : clubs) {
            double score = searchScores.getOrDefault(club.id(), 0.0);
            if (context.contains(club.id())) score += CONTEXT;
            if (organizers.contains(club.id())) score += ORGANIZER;
            if (followedClubs.contains(club.id())) score += FOLLOWED;
            if (club.interests().stream().anyMatch(interests::contains)) score += INTEREST;
            scores.put(club.id(), score);
        }

        return clubs.stream()
                .sorted(Comparator.comparingDouble((ClubFacts club) -> scores.get(club.id())).reversed()
                        .thenComparing(ClubFacts::id))
                .limit(limit)
                .toList();
    }
}
