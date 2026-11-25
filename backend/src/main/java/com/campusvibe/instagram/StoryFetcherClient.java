package com.campusvibe.instagram;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Talks to the story fetcher: {@code POST /stories {"usernames": [...]}} answers
 * Instagram's raw story objects, and {@code GET /health} reports credit use.
 *
 * <p>The fetcher is an external service behind a URL from configuration. Nothing
 * here trusts what it returns: {@link #parse} keeps only stories whose owner is
 * one of the handles asked for, and media URLs are checked again by
 * {@link StoryMediaDownloader} before anything is downloaded.
 */
@Component
public class StoryFetcherClient {

    private final InstagramProperties.Fetcher config;
    private final ObjectMapper mapper;
    private final RestClient restClient;

    public StoryFetcherClient(InstagramProperties properties, ObjectMapper mapper) {
        this.config = properties.fetcher();
        this.mapper = mapper;
        HttpClient http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(config.timeout());
        RestClient.Builder builder = RestClient.builder().requestFactory(factory);
        if (config.isConfigured()) {
            builder.baseUrl(stripTrailingSlash(config.baseUrl()));
        }
        if (config.apiKey() != null && !config.apiKey().isBlank()) {
            builder.defaultHeader("x-api-key", config.apiKey());
        }
        this.restClient = builder.build();
    }

    public boolean isConfigured() {
        return config.isConfigured();
    }

    public int batchSize() {
        return config.batchSize();
    }

    /** Stories for up to {@link #batchSize()} handles, plus each handle's status. */
    public FetchResult fetch(List<String> handles) {
        requireConfigured();
        String body = restClient.post()
                .uri("/stories")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("usernames", handles))
                .retrieve()
                .body(String.class);
        try {
            return parse(mapper.readTree(body), handles);
        } catch (java.io.IOException e) {
            throw new IllegalStateException("The story fetcher answered something that is not JSON", e);
        }
    }

    /** The newest {@code limit} feed posts of up to {@link #batchSize()} handles. */
    public FetchResult fetchPosts(List<String> handles, int limit) {
        requireConfigured();
        String body = restClient.post()
                .uri("/posts")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("usernames", handles, "limit", limit))
                .retrieve()
                .body(String.class);
        try {
            return parsePosts(mapper.readTree(body), handles);
        } catch (java.io.IOException e) {
            throw new IllegalStateException("The post fetcher answered something that is not JSON", e);
        }
    }

    /** Dollars of fetcher credit used so far, or null when it cannot say. */
    public Optional<Health> health() {
        if (!config.isConfigured()) return Optional.empty();
        try {
            JsonNode node = mapper.readTree(restClient.get().uri("/health").retrieve().body(String.class));
            return Optional.of(new Health(
                    node.path("ok").asBoolean(false),
                    node.path("accounts").asInt(0),
                    node.path("usedUsd").asDouble(0),
                    node.path("capUsd").asDouble(0),
                    node.path("remainingUsd").asDouble(0)));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    // ------------------------------------------------------------------ parsing

    /**
     * Reads the fetcher's answer. Package-private and static so a captured
     * response can be replayed in a unit test without the network.
     */
    static FetchResult parse(JsonNode root, Collection<String> requested) {
        Set<String> wanted = new HashSet<>();
        requested.forEach(h -> wanted.add(h.toLowerCase(Locale.ROOT)));
        Map<String, String> statuses = new LinkedHashMap<>();
        List<FetchedStory> stories = new ArrayList<>();

        if (!root.path("ok").asBoolean(true)) {
            throw new IllegalStateException("The story fetcher reported failure: "
                    + root.path("error").asText("no reason given"));
        }
        for (JsonNode item : root.path("items")) {
            String owner = text(item.path("owner").path("username"));
            if (owner == null) owner = text(item.path("username"));
            if (owner == null) owner = text(item.path("creator_username"));
            if (owner == null) continue;
            owner = owner.toLowerCase(Locale.ROOT);
            if (!wanted.contains(owner)) continue;

            String id = text(item.path("id"));
            if (id == null) {
                // A placeholder: {"username": .., "stories_count": 0, "status": "user_not_found"}
                statuses.putIfAbsent(owner, Optional.ofNullable(text(item.path("status"))).orElse("no_stories"));
                continue;
            }
            statuses.put(owner, "ok");
            stories.add(toStory(owner, id, item));
        }
        for (String handle : wanted) {
            statuses.putIfAbsent(handle, "no_stories");
        }
        return new FetchResult(stories, statuses);
    }

    private static FetchedStory toStory(String owner, String id, JsonNode item) {
        // Some ids arrive as "<media>_<user>"; the media part is the stable one.
        String externalId = id.contains("_") ? id.substring(0, id.indexOf('_')) : id;
        boolean video = item.path("media_type").asInt(1) == 2 || item.path("is_video").asBoolean(false);

        // The largest version Instagram offers: the poster's small print is
        // what the event details are written in.
        String imageUrl = null;
        int bestWidth = -1;
        for (JsonNode candidate : item.path("image_versions").path("items")) {
            String url = text(candidate.path("url"));
            int width = candidate.path("width").asInt(0);
            if (url != null && width > bestWidth) {
                imageUrl = url;
                bestWidth = width;
            }
        }
        if (imageUrl == null) imageUrl = text(item.path("thumbnail_url"));
        String videoUrl = video ? text(item.path("video_versions").path(0).path("url")) : null;

        String feedPostUrl = null;
        String code = text(item.path("story_feed_media").path(0).path("media_code"));
        if (code != null && code.matches("[A-Za-z0-9_-]{5,40}")) {
            feedPostUrl = "https://www.instagram.com/p/" + code + "/";
        }

        List<String> links = new ArrayList<>();
        addIfPresent(links, text(item.path("story_link_url")));
        for (JsonNode sticker : item.path("story_link_stickers")) {
            addIfPresent(links, text(sticker.path("story_link").path("url")));
        }

        List<Countdown> countdowns = new ArrayList<>();
        for (JsonNode c : item.path("story_countdowns")) {
            JsonNode sticker = c.path("countdown_sticker");
            long end = sticker.path("end_ts").asLong(0);
            countdowns.add(new Countdown(text(sticker.path("text")), end > 0 ? Instant.ofEpochSecond(end) : null));
        }

        List<String> mentions = new ArrayList<>();
        for (JsonNode m : item.path("reel_mentions")) {
            addIfPresent(mentions, text(m.path("user").path("username")));
        }
        for (JsonNode t : item.path("tagged_users")) {
            addIfPresent(mentions, text(t.path("user").path("username")));
        }

        String permalink = text(item.path("story_permalink"));
        if (permalink == null) {
            permalink = "https://www.instagram.com/stories/" + owner + "/" + externalId + "/";
        }

        return new FetchedStory(
                InstagramStory.Kind.STORY,
                owner,
                externalId,
                video ? InstagramStory.MediaType.VIDEO : InstagramStory.MediaType.IMAGE,
                epoch(item.path("taken_at")),
                epoch(item.path("expiring_at")),
                permalink,
                imageUrl,
                videoUrl,
                links.isEmpty() ? null : links.get(0),
                feedPostUrl,
                text(item.path("location").path("name")),
                text(item.path("caption_text")),
                text(item.path("creator_full_name")),
                countdowns,
                mentions,
                List.of());
    }

    /**
     * Reads the fetcher's post answer (Apify's Instagram post shape). Static
     * for the same reason as {@link #parse}.
     */
    static FetchResult parsePosts(JsonNode root, Collection<String> requested) {
        Set<String> wanted = new HashSet<>();
        requested.forEach(h -> wanted.add(h.toLowerCase(Locale.ROOT)));
        if (!root.path("ok").asBoolean(true)) {
            throw new IllegalStateException("The post fetcher reported failure: "
                    + root.path("error").asText("no reason given"));
        }
        Map<String, String> statuses = new LinkedHashMap<>();
        List<FetchedStory> posts = new ArrayList<>();
        for (JsonNode item : root.path("items")) {
            String owner = text(item.path("ownerUsername"));
            if (owner == null) owner = text(item.path("username"));
            if (owner == null) continue;
            owner = owner.toLowerCase(Locale.ROOT);
            if (!wanted.contains(owner)) continue;
            String id = text(item.path("id"));
            String url = text(item.path("url"));
            if (id == null || !id.matches("[0-9]{1,40}") || url == null) {
                statuses.putIfAbsent(owner, Optional.ofNullable(text(item.path("error"))).orElse("no_posts"));
                continue;
            }
            statuses.put(owner, "ok");
            boolean video = "Video".equalsIgnoreCase(item.path("type").asText(""));

            List<String> extra = new ArrayList<>();
            for (JsonNode img : item.path("images")) {
                String u = img.isTextual() ? text(img) : text(img.path("url"));
                addIfPresent(extra, u);
            }
            for (JsonNode child : item.path("childPosts")) {
                addIfPresent(extra, text(child.path("displayUrl")));
            }
            String display = text(item.path("displayUrl"));
            extra.remove(display);

            List<String> mentions = new ArrayList<>();
            for (JsonNode m : item.path("mentions")) addIfPresent(mentions, text(m));
            for (JsonNode t : item.path("taggedUsers")) addIfPresent(mentions, text(t.path("username")));
            for (JsonNode c : item.path("coauthorProducers")) addIfPresent(mentions, text(c.path("username")));

            Instant posted = null;
            String ts = text(item.path("timestamp"));
            if (ts != null) {
                try {
                    posted = Instant.parse(ts);
                } catch (java.time.format.DateTimeParseException ignored) {
                    // left null; the run treats it as recent
                }
            }
            posts.add(new FetchedStory(
                    InstagramStory.Kind.POST,
                    owner,
                    id,
                    video ? InstagramStory.MediaType.VIDEO : InstagramStory.MediaType.IMAGE,
                    posted,
                    null,
                    url,
                    display,
                    video ? text(item.path("videoUrl")) : null,
                    null,
                    url,
                    text(item.path("locationName")),
                    text(item.path("caption")),
                    text(item.path("ownerFullName")),
                    List.of(),
                    mentions,
                    extra.stream().limit(3).toList()));
        }
        for (String handle : wanted) statuses.putIfAbsent(handle, "no_posts");
        return new FetchResult(posts, statuses);
    }

    private static Instant epoch(JsonNode node) {
        long v = node.asLong(0);
        return v > 0 ? Instant.ofEpochSecond(v) : null;
    }

    private static String text(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        String s = node.asText();
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static void addIfPresent(List<String> list, String value) {
        if (value != null && !list.contains(value)) list.add(value);
    }

    private void requireConfigured() {
        if (!config.isConfigured()) {
            throw new IllegalStateException("No story fetcher is configured (INSTAGRAM_FETCHER_URL)");
        }
    }

    private static String stripTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    // ------------------------------------------------------------------ types

    public record FetchResult(List<FetchedStory> stories, Map<String, String> statusByHandle) {}

    public record Health(boolean ok, int accounts, double usedUsd, double capUsd, double remainingUsd) {}

    public record Countdown(String text, Instant endsAt) {}

    /** A story or a post, whichever was fetched. */
    public record FetchedStory(
            InstagramStory.Kind kind,
            String handle,
            String externalId,
            InstagramStory.MediaType mediaType,
            Instant postedAt,
            Instant expiresAt,
            String permalink,
            String imageUrl,
            String videoUrl,
            String linkUrl,
            String feedPostUrl,
            String locationName,
            String caption,
            String creatorFullName,
            List<Countdown> countdowns,
            List<String> mentions,
            // Further carousel images of a post, beyond imageUrl. Empty for stories.
            List<String> extraImageUrls
    ) {}
}
