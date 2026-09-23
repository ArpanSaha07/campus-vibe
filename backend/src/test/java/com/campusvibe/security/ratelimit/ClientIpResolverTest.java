package com.campusvibe.security.ratelimit;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class ClientIpResolverTest {

    private static ClientIpResolver resolver(boolean trustForwardedHeader, int hops) {
        return new ClientIpResolver(new RateLimitProperties(
                true, 20, Duration.ofMinutes(1), 5, Duration.ofMinutes(15), trustForwardedHeader, hops));
    }

    private static MockHttpServletRequest request(String forwardedFor) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("172.17.0.1");
        if (forwardedFor != null) {
            request.addHeader("X-Forwarded-For", forwardedFor);
        }
        return request;
    }

    @Test
    void billsTheViewerTheEdgeProxyAppendedNotWhatTheCallerWrote() {
        // Caller forged 1.1.1.1; CloudFront appended the viewer, nginx appended CloudFront.
        String ip = resolver(true, 2).resolve(request("1.1.1.1, 203.0.113.7, 130.176.0.10"));

        assertThat(ip).isEqualTo("203.0.113.7");
    }

    @Test
    void billsTheViewerWhenTheCallerSentNoHeader() {
        String ip = resolver(true, 2).resolve(request("203.0.113.7, 130.176.0.10"));

        assertThat(ip).isEqualTo("203.0.113.7");
    }

    @Test
    void takesTheLeftMostEntryWhenFewerProxiesAppendedThanConfigured() {
        String ip = resolver(true, 2).resolve(request("203.0.113.7"));

        assertThat(ip).isEqualTo("203.0.113.7");
    }

    @Test
    void honoursAConfiguredHopCount() {
        String ip = resolver(true, 1).resolve(request("1.1.1.1, 203.0.113.7"));

        assertThat(ip).isEqualTo("203.0.113.7");
    }

    @Test
    void ignoresTheHeaderWhenNotTrusted() {
        String ip = resolver(false, 2).resolve(request("1.1.1.1, 203.0.113.7, 130.176.0.10"));

        assertThat(ip).isEqualTo("172.17.0.1");
    }

    @Test
    void fallsBackToTheRemoteAddressWhenTheHeaderIsAbsentOrEmpty() {
        assertThat(resolver(true, 2).resolve(request(null))).isEqualTo("172.17.0.1");
        assertThat(resolver(true, 2).resolve(request(" "))).isEqualTo("172.17.0.1");
        assertThat(resolver(true, 2).resolve(request(", "))).isEqualTo("172.17.0.1");
    }
}
