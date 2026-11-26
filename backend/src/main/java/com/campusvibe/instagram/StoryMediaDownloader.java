package com.campusvibe.instagram;

import com.campusvibe.common.Logs;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

/**
 * Downloads story media from Instagram's CDN, and pulls frames out of videos.
 *
 * <p>The URLs come from the fetcher, an outside service, so they are treated as
 * untrusted: https only, Instagram/Facebook CDN hosts only, no redirects, and a
 * size cap. That keeps a bad fetcher answer from turning the backend into a
 * proxy into the private network (SSRF).
 */
@Component
public class StoryMediaDownloader {

    private static final Logger log = LoggerFactory.getLogger(StoryMediaDownloader.class);

    static final long MAX_IMAGE_BYTES = 8L * 1024 * 1024;
    static final long MAX_VIDEO_BYTES = 40L * 1024 * 1024;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    private final InstagramProperties.Extraction config;

    public StoryMediaDownloader(InstagramProperties properties) {
        this.config = properties.extraction();
    }

    /** JPEG, PNG or WebP bytes, checked by signature. */
    public byte[] downloadImage(String url) throws IOException {
        byte[] bytes = download(url, MAX_IMAGE_BYTES);
        if (imageMediaType(bytes) == null) {
            throw new IOException("Story image is not JPEG, PNG or WebP");
        }
        return bytes;
    }

    /**
     * Up to {@code video-frames} JPEG frames, one every three seconds, or an empty
     * list when frames are off, ffmpeg is missing or the video cannot be read.
     * Text on a story video often appears after the first frame, which is all
     * the thumbnail shows.
     */
    public List<byte[]> videoFrames(String url) {
        int wanted = config.videoFrames();
        if (wanted <= 0 || url == null) return List.of();
        Path dir = null;
        try {
            byte[] video = download(url, MAX_VIDEO_BYTES);
            dir = Files.createTempDirectory("ig-story-");
            Path input = dir.resolve("story.mp4");
            Files.write(input, video);
            Process process = new ProcessBuilder(
                    config.ffmpegPath(), "-hide_banner", "-loglevel", "error",
                    "-i", input.toString(),
                    "-vf", "fps=1/3,scale=720:-2",
                    "-frames:v", Integer.toString(wanted),
                    dir.resolve("frame_%02d.jpg").toString())
                    .redirectErrorStream(true)
                    .start();
            process.getInputStream().transferTo(java.io.OutputStream.nullOutputStream());
            if (!process.waitFor(60, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                return List.of();
            }
            List<byte[]> frames = new ArrayList<>();
            try (Stream<Path> files = Files.list(dir)) {
                for (Path p : files.filter(f -> f.getFileName().toString().startsWith("frame_"))
                        .sorted().toList()) {
                    frames.add(Files.readAllBytes(p));
                }
            }
            return frames;
        } catch (IOException e) {
            log.info("No frames from story video ({}); using its thumbnail only", Logs.safe(e.getMessage()));
            return List.of();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return List.of();
        } finally {
            deleteQuietly(dir);
        }
    }

    byte[] download(String url, long maxBytes) throws IOException {
        URI uri = requireInstagramCdn(url);
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(60))
                .header("User-Agent", "Mozilla/5.0 (CampusVibe story import)")
                .GET()
                .build();
        try {
            HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream body = response.body()) {
                if (response.statusCode() != 200) {
                    throw new IOException("Instagram CDN answered " + response.statusCode());
                }
                byte[] bytes = body.readNBytes((int) maxBytes + 1);
                if (bytes.length > maxBytes) {
                    throw new IOException("Story media is larger than " + maxBytes + " bytes");
                }
                if (bytes.length == 0) {
                    throw new IOException("Story media is empty");
                }
                return bytes;
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Interrupted while downloading story media", e);
        }
    }

    /** Package-private for tests. */
    static URI requireInstagramCdn(String url) throws IOException {
        if (url == null) throw new IOException("No media URL");
        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException e) {
            throw new IOException("Malformed media URL");
        }
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        boolean allowedHost = host.endsWith(".cdninstagram.com") || host.endsWith(".fbcdn.net");
        if (!"https".equalsIgnoreCase(uri.getScheme()) || !allowedHost
                || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)) {
            throw new IOException("Refusing to download media from outside Instagram's CDN");
        }
        return uri;
    }

    /** "image/jpeg", "image/png", "image/webp", or null. */
    static String imageMediaType(byte[] b) {
        if (b == null || b.length < 12) return null;
        if ((b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "image/jpeg";
        if ((b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "image/png";
        if (b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "image/webp";
        return null;
    }

    private static void deleteQuietly(Path dir) {
        if (dir == null) return;
        try (Stream<Path> walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException ignored) {
                    // temp dir; the OS cleans it eventually
                }
            });
        } catch (IOException ignored) {
            // nothing to clean
        }
    }
}
