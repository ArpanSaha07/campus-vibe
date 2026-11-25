package com.campusvibe.instagram;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Replays a captured /posts response (trimmed, image URLs replaced). */
class PostFetchParseTest {

    private static JsonNode fixture() throws Exception {
        try (InputStream in = PostFetchParseTest.class.getResourceAsStream("/instagram/posts-response.json")) {
            return new ObjectMapper().readTree(in);
        }
    }

    @Test
    void postsCarryTheirCaptionLinkAndFullSizeImage() throws Exception {
        var result = StoryFetcherClient.parsePosts(fixture(), List.of("dsignlabmcgill", "mcgillsavoysociety"));
        var dye = result.stories().stream().filter(p -> p.externalId().equals("4012965774183440330")).findFirst().orElseThrow();

        assertThat(dye.kind()).isEqualTo(InstagramStory.Kind.POST);
        assertThat(dye.permalink()).isEqualTo("https://www.instagram.com/p/Dew6xwqAR_K/");
        assertThat(dye.feedPostUrl()).isEqualTo(dye.permalink());
        assertThat(dye.caption()).contains("Natural Dye Workshop", "SSMU 201-B", "7:30pm");
        assertThat(dye.imageUrl()).contains("/fixture/post0.jpg");
        assertThat(dye.postedAt()).isEqualTo(Instant.parse("2026-10-21T17:14:20Z"));
        assertThat(dye.creatorFullName()).isEqualTo("Fixture Club");
    }

    @Test
    void carouselsKeepUpToThreeMoreSlidesWithoutTheCover() throws Exception {
        var faq = StoryFetcherClient.parsePosts(fixture(), List.of("mcgillsavoysociety")).stories().stream()
                .filter(p -> p.externalId().equals("3986951055971990496")).findFirst().orElseThrow();

        assertThat(faq.extraImageUrls()).hasSize(3).doesNotContain(faq.imageUrl());
    }

    @Test
    void collaboratorsPostsAreDroppedUnlessAskedFor() throws Exception {
        var result = StoryFetcherClient.parsePosts(fixture(), List.of("dsignlabmcgill", "mcgillsavoysociety"));

        assertThat(result.stories()).noneMatch(p -> p.handle().equals("circleoffashionmcgill"));
        assertThat(result.statusByHandle()).containsEntry("dsignlabmcgill", "ok");
    }
}
