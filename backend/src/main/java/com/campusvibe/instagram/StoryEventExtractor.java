package com.campusvibe.instagram;

import java.time.Instant;
import java.util.List;

/**
 * Reads a story image and returns its text and any events in it. Behind an
 * interface so tests and a future OCR worker can replace Claude.
 */
public interface StoryEventExtractor {

    boolean isConfigured();

    StoryExtraction extract(StoryContext context, byte[] image, List<byte[]> extraFrames);

    /** Everything about the story except its pixels. */
    record StoryContext(
            InstagramStory.Kind kind,
            String handle,
            String accountName,
            Instant postedAt,
            String linkUrl,
            String locationName,
            String caption,
            List<StoryFetcherClient.Countdown> countdowns,
            List<String> mentions,
            boolean video
    ) {}
}
