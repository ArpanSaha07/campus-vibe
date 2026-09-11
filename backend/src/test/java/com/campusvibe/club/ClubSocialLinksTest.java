package com.campusvibe.club;

import com.campusvibe.exception.RequestValidationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The rule for a club's four contact values.
 *
 * <p>{@link com.campusvibe.common.WebLinks} is tested next to itself and covers
 * what makes a link safe. This covers what is specific to a club: the JSON
 * string, the email that is not a link, and what an all-blank object becomes.
 *
 * <p>A plain unit test, no Spring context. It exercises a pure function.
 */
class ClubSocialLinksTest {

    @Test
    void refusesAHostileSchemeInAnyOfTheThreeLinks() {
        for (String field : new String[] {"website", "facebook", "instagram"}) {
            assertThatThrownBy(() -> ClubSocialLinks.normalise(
                    "{\"%s\":\"javascript:alert(1)\"}".formatted(field)))
                    .as("%s must be refused", field)
                    .isInstanceOf(RequestValidationException.class);
        }
    }

    @Test
    void assumesHttpsForALinkTypedWithoutAScheme() {
        assertThat(ClubSocialLinks.normalise("{\"website\":\"robotics.ca\"}"))
                .contains("https://robotics.ca");
    }

    /**
     * The Instagram field takes a handle and the URL is built here — Arpan,
     * 2026-09-10. The rule itself is {@code WebLinks.normaliseInstagram} and is
     * tested there; this is only that a club goes through it.
     */
    @Test
    void buildsTheInstagramUrlFromAHandle() {
        assertThat(ClubSocialLinks.normalise("{\"instagram\":\"@robotics\"}"))
                .contains("\"instagram\":\"https://instagram.com/robotics\"");
    }

    @Test
    void refusesAnInstagramValueThatIsNotAHandle() {
        assertThatThrownBy(() -> ClubSocialLinks.normalise("{\"instagram\":\"evil.com/x\"}"))
                .isInstanceOf(RequestValidationException.class)
                .hasMessageContaining("Instagram");
    }

    /**
     * The reason the email is checked as an address rather than normalised as a
     * link: it has no scheme, so the link rule would read it as a bare host and
     * hand back {@code https://hello@robotics.ca} — a URI that parses, carries a
     * host, and is nonsense.
     */
    @Test
    void keepsAContactEmailAsAnAddress() {
        assertThat(ClubSocialLinks.normalise("{\"email\":\"hello@robotics.ca\"}"))
                .contains("\"email\":\"hello@robotics.ca\"")
                .doesNotContain("https://hello@robotics.ca");
    }

    @Test
    void refusesSomethingThatIsNotAnEmailAddress() {
        assertThatThrownBy(() -> ClubSocialLinks.normalise("{\"email\":\"robotics.ca\"}"))
                .isInstanceOf(RequestValidationException.class)
                .hasMessageContaining("Contact email");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{}",
            "{\"email\":\"\",\"website\":\"\",\"facebook\":\"\",\"instagram\":\"\"}",
            "{\"website\":\"   \"}",
    })
    void anObjectWithNothingInItBecomesNull(String empty) {
        // NULL rather than a husk of empty strings, so `has this club got any
        // contact details` stays one question with one answer.
        assertThat(ClubSocialLinks.normalise(empty)).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   ", "not json at all", "[1,2,3]", "\"a string\""})
    void refusesOrIgnoresAnythingThatIsNotAJsonObject(String raw) {
        if (raw.isBlank()) {
            assertThat(ClubSocialLinks.normalise(raw)).isNull();
        } else {
            assertThatThrownBy(() -> ClubSocialLinks.normalise(raw))
                    .isInstanceOf(RequestValidationException.class);
        }
    }

    @Test
    void treatsNullAsNotSet() {
        assertThat(ClubSocialLinks.normalise(null)).isNull();
    }

    /**
     * A key we do not know is dropped rather than refused. A future club editor
     * that learns a fifth link should not make every older row a 400 — and the
     * user cannot see the payload to fix it either way.
     */
    @Test
    void ignoresAKeyItDoesNotKnow() {
        assertThat(ClubSocialLinks.normalise("{\"email\":\"a@b.ca\",\"tiktok\":\"x\"}"))
                .contains("a@b.ca")
                .doesNotContain("tiktok");
    }

    @Test
    void alwaysWritesAllFourKeysSoTheFrontendTypeIsNotALie() {
        String stored = ClubSocialLinks.normalise("{\"email\":\"a@b.ca\"}");
        assertThat(stored)
                .contains("\"email\"")
                .contains("\"website\"")
                .contains("\"facebook\"")
                .contains("\"instagram\"");
    }

    @Test
    void refusesAValueTooLongToBeALink() {
        String long_ = "https://robotics.ca/" + "x".repeat(600);
        assertThatThrownBy(() -> ClubSocialLinks.normalise("{\"website\":\"%s\"}".formatted(long_)))
                .isInstanceOf(RequestValidationException.class);
    }
}
