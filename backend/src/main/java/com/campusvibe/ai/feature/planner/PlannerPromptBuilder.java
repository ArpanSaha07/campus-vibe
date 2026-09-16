package com.campusvibe.ai.feature.planner;

import com.campusvibe.ai.client.LlmRequest;
import com.campusvibe.ai.prompt.PromptTemplateService;
import com.campusvibe.club.ClubDTO;
import com.campusvibe.event.EventDTO;
import com.campusvibe.taxonomy.ClubCategory;
import com.campusvibe.taxonomy.ClubCategoryRepository;
import com.campusvibe.taxonomy.EventFormat;
import com.campusvibe.taxonomy.EventFormatRepository;
import com.campusvibe.taxonomy.InterestCatalogueEntry;
import com.campusvibe.taxonomy.InterestCatalogueRepository;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Turns one message, its history and its candidates into the request the
 * model sees.
 *
 * <p>Candidates are one line each, with labels rather than slugs: the model
 * writes reasons for a student, and {@code ai-machine-learning} is not a word.
 * Dates are formatted with {@link Locale#US} in America/Toronto, never the
 * JVM's locale or zone (BUG-001, BUG-058).
 *
 * <p>The student's text is wrapped in {@code <message>} tags and the system
 * prompt says it is data. Anything that would close the tag early is defused.
 */
@Component
public class PlannerPromptBuilder {

    static final String TEMPLATE = "planner-system";

    private static final DateTimeFormatter NOW =
            DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy, h:mm a", Locale.US).withZone(PlannerDay.ZONE);
    private static final DateTimeFormatter DAY_AND_TIME =
            DateTimeFormatter.ofPattern("EEE MMM d, h:mm a", Locale.US).withZone(PlannerDay.ZONE);
    private static final DateTimeFormatter TIME =
            DateTimeFormatter.ofPattern("h:mm a", Locale.US).withZone(PlannerDay.ZONE);

    /** Longest description quoted per candidate, in characters. */
    static final int DESCRIPTION_LENGTH = 200;

    private final PromptTemplateService templates;
    private final InterestCatalogueRepository interestRepository;
    private final EventFormatRepository formatRepository;
    private final ClubCategoryRepository categoryRepository;

    public PlannerPromptBuilder(PromptTemplateService templates,
                                InterestCatalogueRepository interestRepository,
                                EventFormatRepository formatRepository,
                                ClubCategoryRepository categoryRepository) {
        this.templates = templates;
        this.interestRepository = interestRepository;
        this.formatRepository = formatRepository;
        this.categoryRepository = categoryRepository;
    }

    /**
     * @param history earlier messages of this chat, oldest first
     * @param names   names for the items of earlier answers, keyed {@code kind:id}
     */
    public LlmRequest build(String prompt,
                            List<PlannerMessageRepository.Row> history,
                            Map<String, String> names,
                            PlannerRetrievalService.Candidates candidates,
                            Instant now) {
        Map<String, String> interests = labels(interestRepository.findAll(),
                InterestCatalogueEntry::getSlug, InterestCatalogueEntry::getLabel);
        Map<String, String> formats = labels(formatRepository.findAll(), EventFormat::getSlug, EventFormat::getLabel);
        Map<String, String> categories = labels(categoryRepository.findAll(),
                ClubCategory::getSlug, ClubCategory::getLabel);

        String system = templates.render(TEMPLATE, Map.of(
                "now", NOW.format(now),
                "maxPicks", String.valueOf(PlannerLimits.MAX_PICKS),
                "interests", candidates.interests().isEmpty()
                        ? "none given"
                        : String.join(", ", labelsOf(candidates.interests(), interests)),
                "events", candidates.events().isEmpty()
                        ? "(none)"
                        : candidates.events().stream()
                                .map(event -> eventLine(event, now, interests, formats))
                                .collect(Collectors.joining("\n")),
                "clubs", candidates.clubs().isEmpty()
                        ? "(none)"
                        : candidates.clubs().stream()
                                .map(club -> clubLine(club, interests, categories))
                                .collect(Collectors.joining("\n"))));

        List<LlmRequest.Message> messages = new ArrayList<>();
        messages.add(new LlmRequest.Message(LlmRequest.Role.SYSTEM, system));
        for (PlannerMessageRepository.Row row : history) {
            messages.add(PlannerMessageRepository.USER.equals(row.role())
                    ? new LlmRequest.Message(LlmRequest.Role.USER, wrap(row.content()))
                    : new LlmRequest.Message(LlmRequest.Role.ASSISTANT, earlierAnswer(row, names)));
        }
        messages.add(new LlmRequest.Message(LlmRequest.Role.USER, wrap(prompt)));

        return new LlmRequest("planner", messages, PlannerAnswers.SCHEMA_NAME, PlannerAnswers.schema());
    }

    static String eventLine(EventDTO event, Instant now,
                            Map<String, String> interests, Map<String, String> formats) {
        StringBuilder line = new StringBuilder()
                .append("id: ").append(event.id())
                .append(" | ").append(oneLine(event.title()))
                .append(" | ").append(when(event.dateTime(), event.endTime()));
        if (!event.dateTime().isAfter(now) && event.endTime().isAfter(now)) {
            line.append(" | running now");
        }
        if (present(event.location())) line.append(" | at ").append(oneLine(event.location()));
        if (present(event.price())) line.append(" | price ").append(oneLine(event.price()));
        line.append(" | by ").append(oneLine(event.organizerName()));
        if (!event.topics().isEmpty()) {
            line.append(" | about ").append(String.join(", ", labelsOf(event.topics(), interests)));
        }
        if (!event.formats().isEmpty()) {
            line.append(" | format ").append(String.join(", ", labelsOf(event.formats(), formats)));
        }
        if (present(event.description())) {
            line.append(" | description: ").append(truncate(oneLine(event.description())));
        }
        return line.toString();
    }

    static String clubLine(ClubDTO club, Map<String, String> interests, Map<String, String> categories) {
        StringBuilder line = new StringBuilder()
                .append("id: ").append(club.id())
                .append(" | ").append(oneLine(club.name()));
        if (club.category() != null && categories.containsKey(club.category())) {
            line.append(" | ").append(categories.get(club.category()));
        }
        if (!club.interests().isEmpty()) {
            line.append(" | about ").append(String.join(", ", labelsOf(club.interests(), interests)));
        }
        if (present(club.description())) {
            line.append(" | description: ").append(truncate(oneLine(club.description())));
        }
        return line.toString();
    }

    /** {@code Thu Sep 17, 6:00 PM to 9:00 PM}, or both days when it ends on another. */
    static String when(Instant start, Instant end) {
        LocalDate startDay = PlannerDay.of(start);
        LocalDate endDay = PlannerDay.of(end);
        return DAY_AND_TIME.format(start) + " to " + (startDay.equals(endDay) ? TIME.format(end) : DAY_AND_TIME.format(end));
    }

    /** An earlier answer as the model sees it again: its intro, then what it picked. */
    static String earlierAnswer(PlannerMessageRepository.Row row, Map<String, String> names) {
        if (row.picks().isEmpty()) {
            return row.content();
        }
        StringBuilder text = new StringBuilder(row.content()).append("\nRecommended:");
        for (PlannerPickDTO pick : row.picks()) {
            String name = names.getOrDefault(pick.kind() + ":" + pick.id(), "(no longer listed)");
            text.append("\n- ").append(pick.kind()).append(' ').append(pick.id())
                    .append(": ").append(oneLine(name)).append(' ').append(pick.reason());
        }
        return text.toString();
    }

    /** The student's text as data, with no way to close the tag from inside it. */
    static String wrap(String text) {
        return "<message>\n" + text.replace("</message>", "</ message>") + "\n</message>";
    }

    private static <T> Map<String, String> labels(Collection<T> rows, Function<T, String> slug, Function<T, String> label) {
        return rows.stream().collect(Collectors.toMap(slug, label, (a, b) -> a));
    }

    private static List<String> labelsOf(Collection<String> slugs, Map<String, String> labels) {
        return slugs.stream().map(labels::get).filter(Objects::nonNull).sorted().toList();
    }

    private static boolean present(String value) {
        return value != null && !value.isBlank();
    }

    /** Line breaks would let candidate text pass for a new line of the prompt. */
    private static String oneLine(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").strip();
    }

    private static String truncate(String value) {
        return value.length() <= DESCRIPTION_LENGTH ? value : value.substring(0, DESCRIPTION_LENGTH).strip() + "…";
    }
}
