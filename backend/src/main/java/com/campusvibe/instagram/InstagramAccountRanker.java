package com.campusvibe.instagram;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.Reader;
import java.net.URI;
import java.util.*;

/**
 * Ranks Instagram accounts from the discovery CSV ({@code username,profile_url,found_on})
 * from most to least worth watching for McGill student events.
 *
 * <p>The CSV has no follower counts, so the score is built from what it has:
 * where the account was found and what its handle says. Student-run McGill
 * accounts (SSMU's club directory, faculty associations, athletics) rank first;
 * McGill departments next; Montreal venues low; other universities and
 * personal accounts (McGill Daily author pages) last and disabled. The scoring
 * is deliberately simple and visible on the admin page, so a wrong rank is
 * fixed by editing the priority, not the formula.
 */
final class InstagramAccountRanker {

    private InstagramAccountRanker() {}

    record RankedAccount(String handle, String foundOn, int score, boolean eligible) {}

    /** Central accounts that matter more than their source page suggests. */
    private static final Set<String> FLAGSHIP = Set.of(
            "mcgillu", "ssmu_aeum", "ssmuaeum", "mcgillathletics", "mcgillredbirds", "mcgillmartlets",
            "mcgillaus", "aus_mcgill", "mcgilleus", "eusmcgill", "sus_mcgill", "susmcgill", "pgssmcgill",
            "mcgillstudentlife", "mcgillsustainability", "mcgillfrosh", "mcgillcaps", "morsl_mcgill",
            "mcgillmorsl", "mcgillinternational", "mcgilllibrary", "gertsbar", "mcgillgerts");

    /** Matched anywhere in the handle. */
    private static final List<String> GROUP_WORDS = List.of(
            "club", "society", "assoc", "council", "union", "team", "committee", "collective",
            "network", "events", "frosh", "gala", "debat", "hack", "conference", "student",
            "undergrad", "radio", "theatre", "theater", "choir", "orchestra", "dance", "film");

    /** Too short to match inside words: only as a whole token, prefix or suffix. */
    private static final Set<String> GROUP_ABBREVIATIONS = Set.of(
            "sa", "gsa", "usa", "ssa", "soc", "eus", "aus", "sus", "mus", "pgss", "ssmu", "mss", "lsa");

    static boolean looksLikeAGroup(String handle) {
        for (String w : GROUP_WORDS) {
            if (handle.contains(w)) return true;
        }
        String bare = handle.replace("mcgill", " ");
        for (String token : bare.split("[._\\s]+")) {
            if (token.isEmpty()) continue;
            if (GROUP_ABBREVIATIONS.contains(token)) return true;
            for (String a : GROUP_ABBREVIATIONS) {
                if (a.length() >= 3 && (token.startsWith(a) || token.endsWith(a)) && token.length() <= a.length() + 4) {
                    return true;
                }
            }
        }
        return false;
    }

    private static final Set<String> OTHER_SCHOOLS = Set.of(
            "concordia.ca", "dawsoncollege.qc.ca", "umontreal.ca", "hec.ca", "polymtl.ca", "uqam.ca",
            "marianopolis.edu", "vaniercollege.qc.ca");

    static List<RankedAccount> rank(Reader csv) throws IOException {
        Map<String, RankedAccount> best = new LinkedHashMap<>();
        try (BufferedReader reader = new BufferedReader(csv)) {
            String header = reader.readLine();
            if (header == null) return List.of();
            List<String> cols = splitCsvLine(stripBom(header).toLowerCase(Locale.ROOT));
            int userCol = cols.indexOf("username");
            int foundCol = cols.indexOf("found_on");
            int urlCol = cols.indexOf("profile_url");
            if (userCol < 0 && urlCol < 0) {
                throw new IllegalArgumentException("The CSV needs a username or profile_url column");
            }
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                List<String> row = splitCsvLine(line);
                String handle = normaliseHandle(at(row, userCol), at(row, urlCol));
                if (handle == null) continue;
                String foundOn = at(row, foundCol);
                RankedAccount scored = score(handle, foundOn);
                best.merge(handle, scored, (a, b) -> a.score() >= b.score() ? a : b);
            }
        }
        List<RankedAccount> out = new ArrayList<>(best.values());
        out.sort(Comparator.comparing(RankedAccount::eligible).reversed()
                .thenComparing(Comparator.comparingInt(RankedAccount::score).reversed())
                .thenComparing(RankedAccount::handle));
        return out;
    }

    static RankedAccount score(String handle, String foundOn) {
        int score = 0;
        boolean eligible = true;
        String host = "";
        String path = "";
        if (foundOn != null && !foundOn.isBlank()) {
            try {
                URI uri = URI.create(foundOn.trim());
                host = Optional.ofNullable(uri.getHost()).orElse("").toLowerCase(Locale.ROOT);
                path = Optional.ofNullable(uri.getPath()).orElse("").toLowerCase(Locale.ROOT);
            } catch (IllegalArgumentException ignored) {
                // an unparseable source page just earns no source points
            }
        }
        host = host.startsWith("www.") ? host.substring(4) : host;

        if (host.equals("ssmu.ca")) score += 40;                  // SSMU club directory: student clubs
        else if (host.equals("mcgillathletics.ca")) score += 35;
        else if (host.equals("pgss.mcgill.ca")) score += 30;
        else if (host.equals("mcgill.ca") || host.endsWith(".mcgill.ca")) score += 28;
        else if (host.equals("mcgilldaily.com")) score += 12;
        else if (host.endsWith("mtl.org") || host.contains("cultmtl") || host.contains("mtlblog")
                || host.contains("narcity")) score += 4;          // Montreal venues: events, not McGill
        if (OTHER_SCHOOLS.stream().anyMatch(host::endsWith)) {
            score -= 40;
            eligible = false;
        }
        // McGill Daily author pages list journalists' personal accounts.
        if (host.equals("mcgilldaily.com") && path.startsWith("/author")) {
            score -= 100;
            eligible = false;
        }
        if (path.contains("/morsl") || path.contains("/oss") || path.contains("/studentlife")
                || path.contains("/involvement") || path.contains("/clubs")) score += 6;

        if (handle.contains("mcgill")) score += 25;
        if (handle.contains("ssmu")) score += 15;
        if (looksLikeAGroup(handle)) score += 8;
        if (FLAGSHIP.contains(handle)) score += 60;
        return new RankedAccount(handle, foundOn, score, eligible);
    }

    /** The handle from a username cell, or failing that from an instagram.com URL. */
    static String normaliseHandle(String username, String profileUrl) {
        String raw = username;
        if ((raw == null || raw.isBlank()) && profileUrl != null) {
            String p = profileUrl.replaceFirst("^https?://(www\\.)?instagram\\.com/", "");
            raw = p.contains("/") ? p.substring(0, p.indexOf('/')) : p;
        }
        if (raw == null) return null;
        String h = raw.trim().toLowerCase(Locale.ROOT).replaceFirst("^@", "");
        if (!h.matches("[a-z0-9._]{1,30}") || h.matches("\\.+")) return null;
        // Instagram paths that are not accounts.
        if (Set.of("p", "reel", "reels", "stories", "explore", "accounts", "tv").contains(h)) return null;
        return h;
    }

    private static String at(List<String> row, int i) {
        return i >= 0 && i < row.size() ? row.get(i).trim() : null;
    }

    private static String stripBom(String s) {
        return s.startsWith("﻿") ? s.substring(1) : s;
    }

    /** RFC 4180 enough for this file: quoted fields, doubled quotes inside them. */
    static List<String> splitCsvLine(String line) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (quoted) {
                if (ch == '"' && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cur.append('"');
                    i++;
                } else if (ch == '"') {
                    quoted = false;
                } else {
                    cur.append(ch);
                }
            } else if (ch == '"') {
                quoted = true;
            } else if (ch == ',') {
                out.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(ch);
            }
        }
        out.add(cur.toString());
        return out;
    }
}
