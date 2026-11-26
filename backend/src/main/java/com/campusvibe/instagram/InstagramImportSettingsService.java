package com.campusvibe.instagram;

import com.campusvibe.exception.RequestValidationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * How many accounts an import run checks: the first N rows of the ranked
 * account list, set by a platform admin (Arpan, 2026-11-26). Until an admin
 * saves a value, {@code campusvibe.instagram.max-accounts} answers.
 */
@Service
public class InstagramImportSettingsService {

    static final int MAX_ACCOUNT_COUNT = 1000;

    private final InstagramImportSettingsRepository settings;
    private final InstagramSourceRepository sources;
    private final InstagramProperties props;

    public InstagramImportSettingsService(InstagramImportSettingsRepository settings,
                                          InstagramSourceRepository sources,
                                          InstagramProperties props) {
        this.settings = settings;
        this.sources = sources;
        this.props = props;
    }

    @Transactional(readOnly = true)
    public int accountCount() {
        return settings.findById(InstagramImportSettings.ID)
                .map(InstagramImportSettings::getAccountCount)
                .orElse(props.maxAccounts());
    }

    /** How many accounts the list holds; N above this checks them all. */
    @Transactional(readOnly = true)
    public long totalAccounts() {
        return sources.count();
    }

    @Transactional
    public int setAccountCount(Integer count, Long adminUserId) {
        if (count == null || count < 1) {
            throw new RequestValidationException("Choose at least 1 account");
        }
        long total = sources.count();
        int cap = (int) Math.min(MAX_ACCOUNT_COUNT, Math.max(total, 1));
        if (count > cap) {
            throw new RequestValidationException("The account list has %d accounts; choose %d or fewer"
                    .formatted(cap, cap));
        }
        InstagramImportSettings row = settings.findById(InstagramImportSettings.ID)
                .orElseGet(InstagramImportSettings::new);
        row.setAccountCount(count);
        row.setUpdatedAt(Instant.now());
        row.setUpdatedBy(adminUserId);
        settings.save(row);
        return count;
    }
}
