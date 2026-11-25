package com.campusvibe.instagram;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * The pure decisions of the import: turning Claude's local dates into instants,
 * judging whether two titles name the same event, and whether a candidate is
 * good enough to publish without a human. No Spring, no database, so every rule
 * here has a unit test.
 */
final class CandidateRules {

    private CandidateRules() {}

    /** Events further out than this are held for review: usually a misread year. */
    static final Duration MAX_LEAD_TIME = Duration.ofDays(180);

    static final Duration MAX_EVENT_LENGTH = Duration.ofDays(14);

    private static final Set<String> STOPWORDS = Set.of(
            "the", "a", "an", "and", "of", "at", "for", "with", "x", "to", "in", "on", "our", "your",
            "le", "la", "les", "de", "du", "des", "et");

    record Times(Instant start, boolean startTimeKnown, Instant end, boolean endEstimated) {}

    /**
     * Local Montreal date and time strings to instants. A missing start time
     * makes an all-day event (midnight to 23:59) with {@code startTimeKnown=false};
     * the published description then says the time was not announced. A missing
     * end after a known start becomes start plus the default length, flagged as
     * estimated.
     */
    static Times resolveTimes(String startDate, String startTime, String endDate, String endTime,
                              ZoneId zone, Duration defaultDuration) {
        LocalDate sd = parseDate(startDate);
        if (sd == null) {
            return new Times(null, false, null, false);
        }
        LocalTime st = parseTime(startTime);
        Instant start = sd.atTime(st == null ? LocalTime.MIDNIGHT : st).atZone(zone).toInstant();

        LocalDate ed = parseDate(endDate);
        LocalTime et = parseTime(endTime);
        Instant end = null;
        boolean estimated = false;
        if (et != null) {
            end = (ed == null ? sd : ed).atTime(et).atZone(zone).toInstant();
            // "10 PM - 2 AM" with no end date ends the next day.
            if (ed == null && !end.isAfter(start)) {
                end = sd.plusDays(1).atTime(et).atZone(zone).toInstant();
            }
        } else if (ed != null && ed.isAfter(sd)) {
            end = ed.atTime(23, 59).atZone(zone).toInstant();
            estimated = st != null;
        } else if (st == null) {
            end = sd.atTime(23, 59).atZone(zone).toInstant();
        }
        if (end == null || !end.isAfter(start)) {
            end = start.plus(defaultDuration);
            estimated = true;
        }
        return new Times(start, st != null, end, estimated);
    }

    static LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDate.parse(s.trim());
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    static LocalTime parseTime(String s) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();
        if (t.matches("\\d:\\d\\d")) t = "0" + t;
        try {
            return LocalTime.parse(t);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    static Integer parseCapacity(String s) {
        if (s == null) return null;
        String digits = s.replaceAll("[^0-9]", "");
        if (digits.isEmpty() || digits.length() > 6) return null;
        int n = Integer.parseInt(digits);
        return n > 0 ? n : null;
    }

    /** "" and whitespace to null, everything else trimmed and length-capped. */
    static String clean(String s, int max) {
        if (s == null) return null;
        String t = s.strip();
        if (t.isEmpty()) return null;
        return t.length() > max ? t.substring(0, max) : t;
    }

    /** Only http(s) URLs, so a stored link can never be javascript: or data:. */
    static String cleanUrl(String s) {
        String t = clean(s, 500);
        if (t == null) return null;
        String lower = t.toLowerCase(Locale.ROOT);
        if (!lower.startsWith("https://") && !lower.startsWith("http://")) {
            if (lower.matches("^[a-z0-9.-]+\\.[a-z]{2,}(/.*)?$")) return "https://" + t;
            return null;
        }
        return t;
    }

    // ------------------------------------------------------------- duplicates

    /** 0..1 likeness of two event titles; 1 when one contains the other. */
    static double titleSimilarity(String a, String b) {
        Set<String> ta = tokens(a);
        Set<String> tb = tokens(b);
        if (ta.isEmpty() || tb.isEmpty()) return 0;
        String na = String.join(" ", new TreeSet<>(ta));
        String nb = String.join(" ", new TreeSet<>(tb));
        if (na.equals(nb) || ta.containsAll(tb) || tb.containsAll(ta)) return 1;
        Set<String> inter = new HashSet<>(ta);
        inter.retainAll(tb);
        Set<String> union = new HashSet<>(ta);
        union.addAll(tb);
        return (double) inter.size() / union.size();
    }

    static boolean sameEvent(String titleA, Instant startA, String titleB, Instant startB) {
        if (startA == null || startB == null) return false;
        long hours = Math.abs(Duration.between(startA, startB).toHours());
        if (hours > 12) return false;
        return titleSimilarity(titleA, titleB) >= 0.5;
    }

    /**
     * The same time slot at the same place: one poster reshared by several
     * accounts, whose titles OCR reads differently every time.
     */
    static boolean sameSlot(Instant startA, String locationA, Instant startB, String locationB) {
        if (startA == null || startB == null || locationA == null || locationB == null) return false;
        if (Math.abs(Duration.between(startA, startB).toMinutes()) > 30) return false;
        return titleSimilarity(locationA, locationB) >= 0.5;
    }

    private static Set<String> tokens(String s) {
        Set<String> out = new LinkedHashSet<>();
        if (s == null) return out;
        String norm = java.text.Normalizer.normalize(s.toLowerCase(Locale.ROOT), java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("[^a-z0-9 ]", " ");
        for (String t : norm.split("\\s+")) {
            if (t.length() > 1 && !STOPWORDS.contains(t)) out.add(t);
        }
        return out;
    }

    // ----------------------------------------------------------- auto-publish

    /**
     * Why this candidate is not shown on CampusVibe. Empty means it publishes.
     * Only things that would put a wrong or useless event in front of students
     * block it: no club link is needed (the account gets one automatically), and
     * a date without a time publishes as an all-day event.
     */
    static List<String> publishBlockers(InstagramEventCandidate c, boolean autoPublishEnabled,
                                        double minConfidence, Instant now) {
        List<String> reasons = new ArrayList<>();
        if (!autoPublishEnabled) reasons.add("Auto-publish is turned off");
        String cls = c.getClassification();
        if (!"UPCOMING_EVENT".equals(cls) && !"EVENT_REMINDER".equals(cls)) {
            reasons.add("Classified as " + cls + ", not an upcoming event");
        }
        if (c.getConfidence() == null || c.getConfidence() < minConfidence) {
            reasons.add("Confidence %d%% is below %d%%".formatted(
                    Math.round((c.getConfidence() == null ? 0 : c.getConfidence()) * 100),
                    Math.round(minConfidence * 100)));
        }
        if (c.getTitle() == null) reasons.add("No title");
        if (c.getDateTime() == null) {
            reasons.add("No date");
        } else {
            if (c.getEndTime() != null && !c.getEndTime().isAfter(now)) reasons.add("Already over");
            if (c.getDateTime().isAfter(now.plus(MAX_LEAD_TIME))) reasons.add("More than 6 months away (year misread?)");
            if (c.getEndTime() == null || !c.getEndTime().isAfter(c.getDateTime())
                    || c.getEndTime().isAfter(c.getDateTime().plus(MAX_EVENT_LENGTH))) {
                reasons.add("End time is invalid");
            }
        }
        if (c.getUncertainFields().contains("startDate")) reasons.add("Unsure about the date");
        if (c.getWarnings().stream().anyMatch(w -> w.toLowerCase(Locale.ROOT).contains("cancel"))) {
            reasons.add("May be cancelled");
        }
        return reasons;
    }

    static List<String> missingFields(InstagramEventCandidate c) {
        List<String> missing = new ArrayList<>();
        if (c.getTitle() == null) missing.add("title");
        if (c.getDescription() == null) missing.add("description");
        if (c.getDateTime() == null) missing.add("dateTime");
        else if (!Boolean.TRUE.equals(c.getStartTimeKnown())) missing.add("startTime");
        if (Boolean.TRUE.equals(c.getEndTimeEstimated())) missing.add("endTime");
        if (c.getLocation() == null) missing.add("location");
        if (c.getPrice() == null) missing.add("price");
        if (c.getCapacity() == null) missing.add("capacity");
        return missing;
    }
}
