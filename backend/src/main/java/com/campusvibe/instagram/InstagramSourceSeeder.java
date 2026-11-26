package com.campusvibe.instagram;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Loads the McGill Instagram accounts the import watches, once, when none are
 * stored yet: {@code instagram/mcgill-accounts.csv}, ranked by
 * {@link InstagramAccountRanker}, the top {@code max-accounts} eligible ones
 * enabled. Runs in every profile, because without it the import has nothing to
 * read; {@code INSTAGRAM_SEED_SOURCES=false} turns it off.
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
        if (!props.seedSources() || sources.count() > 0) return;
        ClassPathResource resource = new ClassPathResource(CSV);
        if (!resource.exists()) {
            log.warn("Instagram account list {} is missing; nothing to watch", CSV);
            return;
        }
        List<InstagramAccountRanker.RankedAccount> ranked;
        try (InputStreamReader reader = new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8)) {
            ranked = InstagramAccountRanker.rank(reader);
        }
        List<InstagramSource> rows = new ArrayList<>();
        int priority = 0;
        int enabled = 0;
        for (InstagramAccountRanker.RankedAccount account : ranked) {
            priority++;
            InstagramSource s = new InstagramSource();
            s.setHandle(account.handle());
            s.setPriority(priority);
            s.setScore(account.score());
            String foundOn = account.foundOn();
            s.setFoundOn(foundOn == null ? null : foundOn.length() > 500 ? foundOn.substring(0, 500) : foundOn);
            boolean on = account.eligible() && priority <= props.maxAccounts();
            s.setEnabled(on);
            if (on) enabled++;
            rows.add(s);
        }
        sources.saveAll(rows);
        log.info("Instagram import: loaded {} accounts, watching the top {}", rows.size(), enabled);
    }
}
