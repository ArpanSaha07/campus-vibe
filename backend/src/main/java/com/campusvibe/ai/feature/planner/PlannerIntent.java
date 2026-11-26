package com.campusvibe.ai.feature.planner;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * What a planner prompt names, read without the model: the topics it asks
 * about and the stretch of time it means (spec 2026-11-26-planner-topic-and-date-retrieval).
 *
 * <p>Pure, so it is tested without a database. Topics come from the
 * {@code interest_catalogue} labels and slugs plus {@link #SYNONYMS}, and a
 * group expands to its children, so <em>tech</em> reaches an event tagged only
 * {@code software-development}. Ranges are Montreal days through
 * {@link PlannerDay#ZONE}. Each is taken from the current prompt, else from the
 * previous one, so <em>what about tomorrow?</em> keeps the topic it follows.
 *
 * @param topics the slugs asked about, groups expanded; empty when none is named
 * @param range  the time asked about, or null when none is named
 */
public record PlannerIntent(Set<String> topics, Window range) {

    /** A half-open stretch of time: events overlapping it count. */
    public record Window(Instant from, Instant to) {

        public boolean isEmpty() {
            return !from.isBefore(to);
        }
    }

    /** One row of the catalogue, as much of it as matching needs. */
    public record Topic(String slug, String label, String parentSlug) {}

    /**
     * Words a student uses for a topic that its label does not contain.
     * Matching ignores a trailing s, so these are singular.
     */
    static final Map<String, String> SYNONYMS = Map.ofEntries(
            Map.entry("tech", "tech"),
            Map.entry("technology", "tech"),
            Map.entry("coding", "software-development"),
            Map.entry("programming", "software-development"),
            Map.entry("software", "software-development"),
            Map.entry("dev", "software-development"),
            Map.entry("developer", "software-development"),
            Map.entry("ai", "ai-machine-learning"),
            Map.entry("ml", "ai-machine-learning"),
            Map.entry("machine learning", "ai-machine-learning"),
            Map.entry("data", "data-science"),
            Map.entry("web", "web-development"),
            Map.entry("hackathon", "hackathons"));

    /**
     * Label words too common in other senses to name a topic on their own:
     * <em>what's running now</em> is not about running.
     */
    private static final Set<String> AMBIGUOUS = Set.of("running");

    /**
     * Words that say a prompt is a request for events, or when, and say nothing
     * about what. Left in, an any-word keyword query matches nearly every event
     * on them: on 2026-11-26, 18 of 30.
     */
    private static final Set<String> FILLER = Set.of(
            "event", "events", "happening", "happen", "happens", "today", "tonight", "tomorrow",
            "weekend", "week", "next", "suggest", "suggestion", "suggestions", "recommend",
            "recommendation", "recommendations", "any", "anything", "something", "thing", "things",
            "stuff", "show", "find", "upcoming", "soon", "now", "campus", "mcgill", "montreal",
            "plan", "planner", "go", "going", "attend", "on", "near");

    private static final LocalTime EVENING = LocalTime.of(17, 0);
    private static final LocalTime LATE_NIGHT_END = LocalTime.of(4, 0);

    private static final Pattern TOMORROW = Pattern.compile("\\b(tomorrow|tmrw|tmr)\\b");
    private static final Pattern TONIGHT = Pattern.compile("\\b(tonight|this evening)\\b");
    private static final Pattern TODAY = Pattern.compile("\\btoday\\b");
    private static final Pattern WEEKEND = Pattern.compile("\\bweekend\\b");
    private static final Pattern NEXT_WEEK = Pattern.compile("\\bnext week\\b");

    public static PlannerIntent parse(String prompt, String previousPrompt,
                                      Collection<Topic> catalogue, Instant now) {
        String current = normalise(prompt);
        String previous = normalise(previousPrompt);

        Set<String> topics = topicsIn(current, catalogue);
        if (topics.isEmpty()) {
            topics = topicsIn(previous, catalogue);
        }
        Window range = rangeIn(current, now).or(() -> rangeIn(previous, now)).orElse(null);
        return new PlannerIntent(Set.copyOf(topics), range);
    }

    /**
     * The window every event source applies: still attendable (ADR-020),
     * starting within {@link PlannerLimits#WINDOW}, and inside the range when
     * one was named.
     */
    public Window window(Instant now) {
        Instant to = now.plus(PlannerLimits.WINDOW);
        if (range == null) {
            return new Window(now, to);
        }
        Instant from = range.from().isAfter(now) ? range.from() : now;
        return new Window(from, range.to().isBefore(to) ? range.to() : to);
    }

    /** The prompt without the words that say nothing about what, for the keyword leg. */
    public static String keywordText(String text) {
        if (text == null) {
            return "";
        }
        return Pattern.compile("\\s+").splitAsStream(text.strip())
                .filter(word -> !FILLER.contains(normalise(word).strip()))
                .collect(Collectors.joining(" "));
    }

    static Set<String> topicsIn(String text, Collection<Topic> catalogue) {
        if (text.isBlank()) {
            return Set.of();
        }
        Map<String, Topic> bySlug = new HashMap<>();
        Map<String, List<String>> children = new HashMap<>();
        for (Topic topic : catalogue) {
            bySlug.put(topic.slug(), topic);
            if (topic.parentSlug() != null) {
                children.computeIfAbsent(topic.parentSlug(), parent -> new ArrayList<>()).add(topic.slug());
            }
        }

        Set<String> named = new LinkedHashSet<>();
        for (Topic topic : catalogue) {
            for (String phrase : phrasesOf(topic)) {
                if (!AMBIGUOUS.contains(phrase) && mentions(text, phrase)) {
                    named.add(topic.slug());
                }
            }
        }
        SYNONYMS.forEach((phrase, slug) -> {
            if (bySlug.containsKey(slug) && mentions(text, phrase)) {
                named.add(slug);
            }
        });

        Set<String> expanded = new LinkedHashSet<>(named);
        for (String slug : named) {
            expanded.addAll(children.getOrDefault(slug, List.of()));
        }
        return expanded;
    }

    /** The label, each side of an ampersand in it, and the slug as words. */
    private static Set<String> phrasesOf(Topic topic) {
        Set<String> phrases = new LinkedHashSet<>();
        String label = topic.label().toLowerCase(Locale.ROOT);
        phrases.add(normalise(label).strip());
        for (String part : label.split("&")) {
            phrases.add(normalise(part).strip());
        }
        phrases.add(normalise(topic.slug()).strip());
        phrases.removeIf(String::isBlank);
        return phrases;
    }

    /**
     * Whole words only, with or without a final s, either way round:
     * hackathons names the synonym hackathon, and career names the label Careers.
     */
    private static boolean mentions(String text, String phrase) {
        String stem = phrase.endsWith("s") && !phrase.endsWith("ss") ? phrase.substring(0, phrase.length() - 1) : phrase;
        return Pattern.compile("(?<![a-z0-9])" + Pattern.quote(stem) + "s?(?![a-z0-9])").matcher(text).find();
    }

    static Optional<Window> rangeIn(String text, Instant now) {
        if (text.isBlank()) {
            return Optional.empty();
        }
        ZonedDateTime local = now.atZone(PlannerDay.ZONE);
        LocalDate day = local.toLocalDate();
        if (TOMORROW.matcher(text).find()) {
            return Optional.of(days(day.plusDays(1), day.plusDays(2)));
        }
        if (TONIGHT.matcher(text).find()) {
            Instant evening = at(day, EVENING);
            return Optional.of(new Window(evening.isAfter(now) ? evening : now, at(day.plusDays(1), LATE_NIGHT_END)));
        }
        if (TODAY.matcher(text).find()) {
            return Optional.of(new Window(now, at(day.plusDays(1), LocalTime.MIDNIGHT)));
        }
        if (WEEKEND.matcher(text).find()) {
            DayOfWeek weekday = day.getDayOfWeek();
            boolean inIt = weekday == DayOfWeek.FRIDAY || weekday == DayOfWeek.SATURDAY || weekday == DayOfWeek.SUNDAY;
            LocalDate friday = day.with(inIt
                    ? TemporalAdjusters.previousOrSame(DayOfWeek.FRIDAY)
                    : TemporalAdjusters.nextOrSame(DayOfWeek.FRIDAY));
            Instant start = at(friday, EVENING);
            return Optional.of(new Window(start.isAfter(now) ? start : now, at(friday.plusDays(3), LocalTime.MIDNIGHT)));
        }
        if (NEXT_WEEK.matcher(text).find()) {
            LocalDate monday = day.with(TemporalAdjusters.next(DayOfWeek.MONDAY));
            return Optional.of(days(monday, monday.plusDays(7)));
        }
        return Optional.empty();
    }

    private static Window days(LocalDate first, LocalDate end) {
        return new Window(at(first, LocalTime.MIDNIGHT), at(end, LocalTime.MIDNIGHT));
    }

    private static Instant at(LocalDate day, LocalTime time) {
        return day.atTime(time).atZone(PlannerDay.ZONE).toInstant();
    }

    /** Lower case, every run of anything but a letter or digit one space, padded. */
    static String normalise(String text) {
        if (text == null) {
            return "";
        }
        return " " + text.toLowerCase(Locale.ROOT).replace("'", "").replaceAll("[^a-z0-9]+", " ").strip() + " ";
    }
}
