package com.campusvibe.instagram;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Loads the McGill Instagram accounts the import watches, once, when none are
 * stored yet: {@code instagram/mcgill-accounts.csv}, <b>in file order</b>, all
 * enabled. How many of them a run checks is the admin's account count
 * ({@link InstagramImportSettingsService}), not a flag on the row. Runs in every
 * profile, because without it the import has nothing to read;
 * {@code INSTAGRAM_SEED_SOURCES=false} turns it off.
 *
 * <p><strong>{@code enabled = false} means one thing: the account's club turned
 * auto-import off.</strong> Rows seeded before 2026-11-26 were switched off past
 * the old {@code max-accounts} cap instead; on a list already loaded, those rows
 * (off, and linked to no club) are switched back on, so a run reaching them once
 * the admin raises N does not mistake them for a club's choice.
 *
 * <p>The CSV is ranked by hand (Arpan, 2026-11-25): its row order is the
 * priority, so a wrong rank is fixed by moving the row. {@link InstagramAccountRanker}
 * is kept in the code but no longer called here — it scored accounts at runtime
 * and disagreed with the hand-ranked list.
 */
@Component
public class InstagramSourceSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(InstagramSourceSeeder.class);
    static final String CSV = "instagram/mcgill-accounts.csv";

    private final InstagramProperties props;
    private final InstagramSourceRepository sources;

    public InstagramSourceSeeder(InstagramProperties props, InstagramSourceRepository sources) {
        this.props = props;
        this.sources = sources;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws Exception {
        if (!props.seedSources()) return;
        if (sources.count() > 0) {
            int restored = sources.enableUnclaimedDisabled();
            if (restored > 0) {
                log.info("Instagram import: {} accounts switched off by the old cap are back in the ranked list", restored);
            }
            return;
        }
        ClassPathResource resource = new ClassPathResource(CSV);
        if (!resource.exists()) {
            log.warn("Instagram account list {} is missing; nothing to watch", CSV);
            return;
        }
        List<InstagramSource> rows = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            String header = reader.readLine();
            if (header == null) return;
            List<String> cols = List.of(header.replace("﻿", "").toLowerCase(Locale.ROOT).split(",", -1));
            int userCol = cols.indexOf("username");
            int foundCol = cols.indexOf("found_on");
            if (userCol < 0) {
                log.warn("Instagram account list {} has no username column; nothing to watch", CSV);
                return;
            }
            Set<String> seen = new HashSet<>();
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                String[] cells = line.split(",", -1);
                String handle = cell(cells, userCol);
                handle = handle == null ? null : handle.toLowerCase(Locale.ROOT).replaceFirst("^@", "");
                // Handles reach URLs and fetcher requests: Instagram's own alphabet only.
                if (handle == null || !HANDLE.matcher(handle).matches() || !seen.add(handle)) continue;
                InstagramSource s = new InstagramSource();
                s.setHandle(handle);
                s.setPriority(rows.size() + 1);
                String foundOn = cell(cells, foundCol);
                s.setFoundOn(foundOn == null || foundOn.isEmpty() ? null
                        : foundOn.length() > 500 ? foundOn.substring(0, 500) : foundOn);
                s.setEnabled(true);
                rows.add(s);
            }
        }
        sources.saveAll(rows);
        log.info("Instagram import: loaded {} accounts in file order; runs check the first N, set by an admin", rows.size());
    }

    private static final java.util.regex.Pattern HANDLE = java.util.regex.Pattern.compile("[a-z0-9._]{1,30}");

    private static String cell(String[] cells, int i) {
        return i >= 0 && i < cells.length ? cells[i].trim() : null;
    }
}
