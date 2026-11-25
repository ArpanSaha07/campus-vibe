package com.campusvibe.instagram;

import com.campusvibe.taxonomy.EventFormatDTO;
import com.campusvibe.taxonomy.InterestDTO;
import com.campusvibe.taxonomy.TaxonomyService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The Claude call end to end against a local server that answers like the
 * Messages API: what the request carries, and how the structured answer is read.
 * No key, no network.
 */
class ClaudeStoryEventExtractorTest {

    private HttpServer server;
    private final AtomicReference<String> requestBody = new AtomicReference<>();
    private String answer;

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/messages", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] body = answer.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private ClaudeStoryEventExtractor extractor() {
        InstagramProperties props = new InstagramProperties(false, null, "America/Toronto", 200, null, null,
                new InstagramProperties.Extraction("test-key", "http://127.0.0.1:" + server.getAddress().getPort(),
                        "claude-haiku-5-5", 1, 0, "ffmpeg"),
                null, null, null, false, false, null);
        TaxonomyService taxonomy = mock(TaxonomyService.class);
        when(taxonomy.listInterests()).thenReturn(List.of(new InterestDTO("arts-culture", "Arts", null)));
        when(taxonomy.listEventFormats()).thenReturn(List.of(new EventFormatDTO("workshop", "Workshop", null)));
        return new ClaudeStoryEventExtractor(props, taxonomy);
    }

    private void answerWith(Object structured) throws IOException {
        String text = new ObjectMapper().writeValueAsString(structured);
        answer = new ObjectMapper().writeValueAsString(Map.of(
                "id", "msg_test", "type", "message", "role", "assistant", "model", "claude-haiku-5-5",
                "content", List.of(Map.of("type", "text", "text", text)),
                "stop_reason", "end_turn",
                "usage", Map.of("input_tokens", 1200, "output_tokens", 300)));
    }

    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0, 0, 0, 0, 0, 0, 0};

    @Test
    void sendsThePosterAndCaptionAndReadsTheEventBack() throws IOException {
        answerWith(Map.of(
                "ocrText", "NATURAL DYE WORKSHOP\nSSMU 201-B · 7:30PM",
                "classification", "UPCOMING_EVENT",
                "events", List.of(Map.ofEntries(
                        Map.entry("title", "Natural Dye Workshop"),
                        Map.entry("summary", "Dye fabric with plants at SSMU."),
                        Map.entry("description", "A second natural dye workshop with MOC."),
                        Map.entry("highlights", List.of("Materials provided")),
                        Map.entry("audience", "All welcome"),
                        Map.entry("collaborators", List.of("@mcgilloutdoorsclub")),
                        Map.entry("startDate", "2026-10-28"),
                        Map.entry("startTime", "19:30"),
                        Map.entry("endDate", ""),
                        Map.entry("endTime", ""),
                        Map.entry("location", "SSMU 201-B"),
                        Map.entry("price", ""),
                        Map.entry("capacity", ""),
                        Map.entry("registrationUrl", ""),
                        Map.entry("hostedBy", ""),
                        Map.entry("repost", false),
                        Map.entry("topics", List.of("arts-culture")),
                        Map.entry("formats", List.of("workshop")),
                        Map.entry("confidence", 0.95),
                        Map.entry("uncertainFields", List.of()),
                        Map.entry("warnings", List.of())))));

        var context = new StoryEventExtractor.StoryContext(InstagramStory.Kind.POST, "dsignlabmcgill", "Dsign Lab",
                Instant.parse("2026-10-21T17:14:20Z"), null, null,
                "Natural Dye Workshop happening in SSMU 201-B at 7:30pm on Wednesday the 28th",
                List.of(), List.of("mcgilloutdoorsclub"), false);

        StoryExtraction x = extractor().extract(context, JPEG, List.of());

        assertThat(x.classification()).isEqualTo(StoryExtraction.Classification.UPCOMING_EVENT);
        var e = x.events().get(0);
        assertThat(e.title()).isEqualTo("Natural Dye Workshop");
        assertThat(e.summary()).isEqualTo("Dye fabric with plants at SSMU.");
        assertThat(e.highlights()).containsExactly("Materials provided");
        assertThat(e.startTime()).isEqualTo("19:30");

        String sent = requestBody.get();
        assertThat(sent).contains("\"model\":\"claude-haiku-5-5\"")
                .contains("\"type\":\"image\"", "image/jpeg")
                .contains("Instagram feed post by @dsignlabmcgill")
                .contains("Caption (often holds the full details)")
                .contains("Wednesday 2026-10-21 13:14")
                .contains("Topic slugs: arts-culture")
                .contains("output_config");
    }

    @Test
    void aNonEventComesBackWithNoEvents() throws IOException {
        answerWith(Map.of("ocrText", "MEMBERSHIPS ON SALE", "classification", "NOT_EVENT", "events", List.of()));
        var context = new StoryEventExtractor.StoryContext(InstagramStory.Kind.STORY, "ssmuski", null,
                Instant.now(), null, null, null, List.of(), List.of(), false);

        StoryExtraction x = extractor().extract(context, JPEG, List.of());

        assertThat(x.classification()).isEqualTo(StoryExtraction.Classification.NOT_EVENT);
        assertThat(x.events()).isEmpty();
    }

    @Test
    void withoutAKeyNothingIsRead() {
        InstagramProperties props = new InstagramProperties(false, null, null, 0, Duration.ofHours(1), null,
                null, null, null, null, false, false, null);
        ClaudeStoryEventExtractor x = new ClaudeStoryEventExtractor(props, mock(TaxonomyService.class));

        assertThat(x.isConfigured()).isFalse();
    }
}
