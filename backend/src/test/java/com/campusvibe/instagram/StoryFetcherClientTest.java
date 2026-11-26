package com.campusvibe.instagram;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Replays a captured fetcher response (trimmed, URLs replaced) without the network. */
class StoryFetcherClientTest {

    private static JsonNode fixture() throws Exception {
        try (InputStream in = StoryFetcherClientTest.class.getResourceAsStream("/instagram/stories-response.json")) {
            return new ObjectMapper().readTree(in);
        }
    }

    @Test
    void readsStoriesAndPerAccountStatus() throws Exception {
        var result = StoryFetcherClient.parse(fixture(), List.of("buss.mcgill", "ssmu_aeum", "mcgillaus"));

        assertThat(result.stories()).hasSize(5);
        assertThat(result.stories()).allMatch(s -> s.handle().equals("buss.mcgill"));
        assertThat(result.statusByHandle())
                .containsEntry("buss.mcgill", "ok")
                .containsEntry("ssmu_aeum", "user_not_found")
                .containsEntry("mcgillaus", "user_not_found");
    }

    @Test
    void mapsTheFieldsAnEventNeeds() throws Exception {
        var first = StoryFetcherClient.parse(fixture(), List.of("buss.mcgill")).stories().get(0);

        assertThat(first.externalId()).isEqualTo("4037594621613434468");
        assertThat(first.mediaType()).isEqualTo(InstagramStory.MediaType.IMAGE);
        assertThat(first.postedAt()).isEqualTo(Instant.ofEpochSecond(1795538807));
        assertThat(first.expiresAt()).isEqualTo(Instant.ofEpochSecond(1795625207));
        assertThat(first.permalink()).isEqualTo("https://www.instagram.com/stories/buss.mcgill/4037594621613434468/");
        assertThat(first.imageUrl()).startsWith("https://scontent-yyz1-1.cdninstagram.com/");
        assertThat(first.feedPostUrl()).isEqualTo("https://www.instagram.com/p/Dfh6fhNy9Gs/");
        assertThat(first.creatorFullName()).isEqualTo("Fixture Club");
        assertThat(first.countdowns()).singleElement()
                .satisfies(c -> assertThat(c.endsAt()).isEqualTo(Instant.ofEpochSecond(1795653001)));
    }

    @Test
    void videosKeepTheirVideoUrlAndThumbnail() throws Exception {
        var video = StoryFetcherClient.parse(fixture(), List.of("buss.mcgill")).stories().stream()
                .filter(s -> s.mediaType() == InstagramStory.MediaType.VIDEO).findFirst().orElseThrow();

        assertThat(video.videoUrl()).endsWith(".mp4");
        assertThat(video.imageUrl()).isNotNull();
    }

    @Test
    void dropsStoriesFromAccountsThatWereNotAskedFor() throws Exception {
        var result = StoryFetcherClient.parse(fixture(), List.of("buss.mcgill"));

        assertThat(result.stories()).noneMatch(s -> s.handle().equals("someone_else"));
    }

    @Test
    void accountsMissingFromTheAnswerHaveNoStories() throws Exception {
        var result = StoryFetcherClient.parse(fixture(), List.of("buss.mcgill", "quiet.club"));

        assertThat(result.statusByHandle()).containsEntry("quiet.club", "no_stories");
    }

    @Test
    void aFailedFetchIsAnError() throws Exception {
        JsonNode failed = new ObjectMapper().readTree("{\"ok\": false, \"error\": \"cap reached\"}");

        assertThatThrownBy(() -> StoryFetcherClient.parse(failed, List.of("x")))
                .hasMessageContaining("cap reached");
    }
}
