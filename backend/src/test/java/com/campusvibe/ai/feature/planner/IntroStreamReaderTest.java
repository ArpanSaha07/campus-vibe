package com.campusvibe.ai.feature.planner;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The intro is streamed out of JSON that arrives in arbitrary pieces, so every
 * test here feeds one answer split in awkward places and checks that the
 * pieces handed out join to exactly the decoded intro.
 */
class IntroStreamReaderTest {

    private static List<String> feedAll(IntroStreamReader reader, String... fragments) {
        List<String> out = new ArrayList<>();
        for (String fragment : fragments) {
            String text = reader.feed(fragment);
            if (!text.isEmpty()) out.add(text);
        }
        return out;
    }

    @Test
    void streamsTheIntroAsItArrivesAndStopsAtItsClosingQuote() {
        IntroStreamReader reader = new IntroStreamReader();

        List<String> out = feedAll(reader,
                "{\"in", "tro\": \"Here are ", "three picks", " for tonight.\",\"kind\":\"event\",",
                "\"picks\":[{\"id\":\"1\",\"reason\":\"is fun.\"}]}");

        assertThat(out).containsExactly("Here are ", "three picks", " for tonight.");
        assertThat(reader.emitted()).isEqualTo("Here are three picks for tonight.");
    }

    @Test
    void holdsAnEscapeSplitAcrossFragmentsUntilItIsComplete() {
        IntroStreamReader reader = new IntroStreamReader();

        List<String> out = feedAll(reader,
                "{\"intro\":\"Caf", "\\", "u00", "e9 night, a \\", "\"quiet\\", "\" one\\", "nand more\"}");

        assertThat(String.join("", out)).isEqualTo("Café night, a \"quiet\" one\nand more");
        // Nothing is handed out mid-escape.
        assertThat(out).allSatisfy(piece -> assertThat(piece).doesNotContain("\\"));
    }

    @Test
    void neverHandsOutHalfASurrogatePair() {
        IntroStreamReader reader = new IntroStreamReader();

        // U+1F389, a party popper, escaped as a surrogate pair split between fragments.
        List<String> out = feedAll(reader, "{\"intro\":\"Party \\uD83C", "\\uDF89 time\"}");

        assertThat(out).allSatisfy(piece ->
                assertThat(Character.isHighSurrogate(piece.charAt(piece.length() - 1))).isFalse());
        assertThat(String.join("", out)).isEqualTo("Party 🎉 time");
    }

    @Test
    void rawUnicodeInTheStreamPassesThrough() {
        IntroStreamReader reader = new IntroStreamReader();

        assertThat(String.join("", feedAll(reader, "{\"intro\":\"Soirée ", "à Montréal\"}")))
                .isEqualTo("Soirée à Montréal");
    }

    @Test
    void anAnswerThatDoesNotStartWithTheIntroStreamsNothing() {
        IntroStreamReader reader = new IntroStreamReader();

        List<String> out = feedAll(reader, "{\"kind\":\"none\",", "\"intro\":\"Nothing fits.\",\"picks\":[]}");

        assertThat(out).isEmpty();
        assertThat(reader.emitted()).isEmpty();
    }

    @Test
    void waitsWhileTheOpeningCouldStillMatch() {
        IntroStreamReader reader = new IntroStreamReader();

        assertThat(reader.feed("  {")).isEmpty();
        assertThat(reader.feed(" \"intro\" :")).isEmpty();
        assertThat(reader.feed(" \"Hi")).isEqualTo("Hi");
    }
}
