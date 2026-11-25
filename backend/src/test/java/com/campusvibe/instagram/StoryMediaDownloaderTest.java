package com.campusvibe.instagram;

import com.campusvibe.s3.MediaKeys;
import org.junit.jupiter.api.Test;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The SSRF guard on fetcher-supplied media URLs, and the staging key. */
class StoryMediaDownloaderTest {

    @Test
    void instagramCdnUrlsAreAllowed() {
        assertThatCode(() -> StoryMediaDownloader.requireInstagramCdn(
                "https://scontent-cph2-1.cdninstagram.com/v/t51/x.jpg?sig=1")).doesNotThrowAnyException();
        assertThatCode(() -> StoryMediaDownloader.requireInstagramCdn(
                "https://video.xx.fbcdn.net/o1/v/x.mp4")).doesNotThrowAnyException();
    }

    @Test
    void anythingElseIsRefused() {
        for (String url : new String[]{
                "http://scontent.cdninstagram.com/x.jpg",            // not https
                "https://169.254.169.254/latest/meta-data/",          // cloud metadata
                "https://localhost/x.jpg",
                "https://cdninstagram.com.evil.example/x.jpg",        // suffix trick
                "https://evilcdninstagram.com/x.jpg",                 // no dot boundary
                "https://user@scontent.cdninstagram.com/x.jpg",       // userinfo
                "https://scontent.cdninstagram.com:8443/x.jpg",       // odd port
                "file:///etc/passwd",
                "not a url"}) {
            assertThatThrownBy(() -> StoryMediaDownloader.requireInstagramCdn(url))
                    .as(url).isInstanceOf(IOException.class);
        }
    }

    @Test
    void imageTypesAreReadFromTheBytes() {
        byte[] jpeg = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0, 0, 0, 0, 0, 0, 0, 0, 0};
        byte[] html = "<html><body>x</body></html>".getBytes();

        assertThat(StoryMediaDownloader.imageMediaType(jpeg)).isEqualTo("image/jpeg");
        assertThat(StoryMediaDownloader.imageMediaType(html)).isNull();
    }

    @Test
    void stagingKeysLiveUnderTheirOwnPrefix() {
        byte[] jpeg = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0};
        String key = MediaKeys.instagramStory("buss.mcgill", "4037594621613434468", jpeg);

        assertThat(key).startsWith("instagram-imports/buss.mcgill/4037594621613434468/").endsWith(".jpg");
        assertThat(MediaKeys.isInstagramStory(key)).isTrue();
        assertThatThrownBy(() -> MediaKeys.instagramStory("..", "1", jpeg)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> MediaKeys.instagramStory("ok", "../1", jpeg)).isInstanceOf(IllegalArgumentException.class);
    }
}
