package com.campusvibe.club;

import com.campusvibe.AbstractIntegrationTest;
import com.campusvibe.user.RoleName;
import com.campusvibe.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The per-file upload cap, against a real Tomcat.
 *
 * <p>Its own class, on a random port, because MockMvc never runs the multipart
 * resolver: a {@code MockMultipartFile} of any size reaches the controller, so
 * the cap in {@code application.yml} is invisible to every other media test.
 *
 * <p>The cap went from 10MB to 5MB on 2026-09-11 ({@code reference.md} §12).
 * Before this, an oversize file fell through to the catch-all handler and
 * answered 500, which at 5MB any phone photo would reach.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class MediaUploadLimitIT extends AbstractIntegrationTest {

    private static final int MB = 1024 * 1024;
    private static final byte[] PNG_SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};

    @LocalServerPort
    private int port;

    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void aFileOverFiveMegabytesIsA413WithASentence() throws Exception {
        HttpResponse<String> response = uploadLogo(5 * MB + 1);

        assertThat(response.statusCode()).isEqualTo(413);
        assertThat(response.body()).contains("5MB");
    }

    @Test
    void aFileJustUnderTheCapIsAccepted() throws Exception {
        HttpResponse<String> response = uploadLogo(5 * MB - 1024);

        assertThat(response.statusCode()).isEqualTo(200);
    }

    private HttpResponse<String> uploadLogo(int size) throws Exception {
        User admin = createUser("Root", "root@campus.com", "password123",
                RoleName.ROLE_USER, RoleName.ROLE_ADMIN);
        Club club = createClub("robotics", "Robotics");
        makeClubOwner(club, admin);

        byte[] file = Arrays.copyOf(PNG_SIGNATURE, size);
        String boundary = "campusvibe-" + System.nanoTime();
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        body.write(("--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"file\"; filename=\"big.png\"\r\n"
                + "Content-Type: image/png\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
        body.write(file);
        body.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.US_ASCII));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + "/api/v1/clubs/robotics/logo"))
                .header("Authorization", bearer(admin))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray()))
                .build();
        return http.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
