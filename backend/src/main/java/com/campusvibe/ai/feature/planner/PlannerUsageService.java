package com.campusvibe.ai.feature.planner;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;

/**
 * The daily message quota: 15 per user per America/Toronto day, across every
 * chat.
 *
 * <p>Spent before the provider is called, so a reply cannot be paid for twice
 * by two tabs. Refunded when a reply fails; kept when the person stops a reply,
 * because the provider was already paid (Arpan, 2026-09-16). Deleting a chat
 * never touches it.
 */
@Service
public class PlannerUsageService {

    private final PlannerUsageRepository usageRepository;

    public PlannerUsageService(PlannerUsageRepository usageRepository) {
        this.usageRepository = usageRepository;
    }

    public PlannerUsageDTO usage(long userId) {
        Instant now = Instant.now();
        int used = usageRepository.used(userId, PlannerDay.of(now));
        return new PlannerUsageDTO(Math.min(used, PlannerLimits.DAILY_MESSAGES), PlannerLimits.DAILY_MESSAGES,
                PlannerDay.resetsAt(now));
    }

    /**
     * Counts one message against today.
     *
     * @return the day it was counted against, which a refund must name: a reply
     *         that starts before midnight and fails after it refunds the day it
     *         was spent on
     * @throws PlannerQuotaExceededException when today's messages are used up
     */
    public LocalDate spend(long userId) {
        Instant now = Instant.now();
        LocalDate day = PlannerDay.of(now);
        if (!usageRepository.trySpend(userId, day, PlannerLimits.DAILY_MESSAGES)) {
            long seconds = Math.max(1, Duration.between(now, PlannerDay.resetsAt(now)).toSeconds());
            throw new PlannerQuotaExceededException(seconds);
        }
        return day;
    }

    public void refund(long userId, LocalDate day) {
        usageRepository.refund(userId, day);
    }
}
