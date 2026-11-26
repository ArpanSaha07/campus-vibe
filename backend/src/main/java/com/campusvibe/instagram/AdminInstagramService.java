package com.campusvibe.instagram;

import com.campusvibe.ai.AiServiceUnavailableException;
import com.campusvibe.exception.DuplicateResourceException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The platform admin's import controls: how many accounts runs check (N, the
 * first N rows of the ranked account list), and Import now over those N
 * (Arpan, 2026-11-26). The schedule itself stays fixed; an interval setting
 * was considered and set aside.
 *
 * <p>Import now runs exactly what the scheduled run does, under the same lease,
 * so the two can never overlap: the same N accounts, plus the accounts clubs
 * opted in. Each event it publishes is an ordinary event row, so its event page
 * exists the moment it is published.
 */
@Service
public class AdminInstagramService {

    static final int RECENT_RUNS = 10;

    private final InstagramImportService importService;
    private final InstagramImportSettingsService settings;
    private final InstagramSourceRepository sources;

    public AdminInstagramService(InstagramImportService importService,
                                 InstagramImportSettingsService settings,
                                 InstagramSourceRepository sources) {
        this.importService = importService;
        this.settings = settings;
        this.sources = sources;
    }

    public AdminInstagramDTO get() {
        List<InstagramImportRun> runs = importService.recentRuns(RECENT_RUNS);
        Map<Long, String> handles = sources.findAllById(runs.stream()
                        .map(InstagramImportRun::getSourceId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(InstagramSource::getId, InstagramSource::getHandle));
        return new AdminInstagramDTO(
                settings.accountCount(),
                settings.totalAccounts(),
                sources.findByEnabledTrueAndClubOptedInTrue().size(),
                importService.isConfigured(),
                importService.isRunning(),
                runs.stream().map(r -> toDto(r, handles::get)).toList());
    }

    public AdminInstagramDTO setAccountCount(Integer count, Long adminUserId) {
        settings.setAccountCount(count, adminUserId);
        return get();
    }

    public AdminInstagramDTO importNow() {
        if (!importService.isConfigured()) {
            throw new AiServiceUnavailableException(
                    "Instagram import isn't set up on this server: INSTAGRAM_FETCHER_URL or ANTHROPIC_API_KEY is missing.");
        }
        if (importService.startAdminRun() == null) {
            throw new DuplicateResourceException("An import is already running. Wait for it to finish.");
        }
        return get();
    }

    static InstagramImportRunDTO toDto(InstagramImportRun r, Function<Long, String> handleOf) {
        return new InstagramImportRunDTO(
                r.getId(),
                r.getTrigger().name(),
                r.getStatus().name(),
                r.getStartedAt(),
                r.getFinishedAt(),
                r.getAccountsRequested(),
                r.getStoriesFetched(),
                r.getPostsFetched(),
                r.getCandidatesCreated(),
                r.getAutoPublished(),
                r.getFailures(),
                r.getSourceId() == null ? null : handleOf.apply(r.getSourceId()),
                r.getError());
    }
}
