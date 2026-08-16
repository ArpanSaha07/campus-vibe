package com.campusvibe.common;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The scrubbing applied to caller-supplied values before they reach a log.
 *
 * <p>The case each test defends is log forging: a value that ends the current
 * entry and starts one the caller wrote.
 */
class LogsTest {

    @Test
    void newlinesCannotEndTheEntry() {
        String forged = "/api/v1/events\n2026-08-16 INFO  admin promoted user 7";

        assertThat(Logs.safe(forged)).doesNotContain("\n");
    }

    @Test
    void carriageReturnsAreStrippedToo() {
        // \r alone repositions the cursor in a terminal, overwriting the entry
        // that was already there — the same forgery by a different route.
        assertThat(Logs.safe("a\rb")).isEqualTo("a_b");
    }

    @Test
    void terminalEscapesAreStripped() {
        assertThat(Logs.safe("clear:[2J")).isEqualTo("clear:_[2J");
    }

    @Test
    void crLfAndOtherControlCharactersAreAllHandledTogether() {
        // Pins the redundancy in Logs.safe. CR and LF are stripped by an
        // explicit replace *and* by the \p{Cntrl} class that follows; ESC is
        // only caught by the class. If someone removes the explicit pair as
        // dead code this still passes — which is the point of the comment
        // there — but this at least fixes the contract the pair exists to keep
        // visible to CodeQL.
        assertThat(Logs.safe("a\rb\ncd")).isEqualTo("a_b_c_d");
    }

    @Test
    void ordinaryTextIsUntouched() {
        assertThat(Logs.safe("/api/v1/auth/login")).isEqualTo("/api/v1/auth/login");
        assertThat(Logs.safe("ann@campus.com")).isEqualTo("ann@campus.com");
    }

    @Test
    void anUnboundedValueIsTruncated() {
        String result = Logs.safe("x".repeat(5_000));

        assertThat(result).hasSizeLessThan(400).endsWith("[truncated]");
    }

    @Test
    void nullBecomesTextRatherThanThrowing() {
        assertThat(Logs.safe(null)).isEqualTo("null");
    }

    @Test
    void safeBlockKeepsLineBreaksButPrefixesEveryLine() {
        // The mail body is printed as a block on purpose, so its newlines
        // survive; the prefix is what stops an injected line reading as an
        // entry of its own.
        String body = "Hello Ann,\n2026-08-16 ERROR  system compromised";

        assertThat(Logs.safeBlock(body))
                .isEqualTo("| Hello Ann,\n| 2026-08-16 ERROR  system compromised");
    }

    @Test
    void safeBlockStillStripsControlCharactersOtherThanNewline() {
        assertThat(Logs.safeBlock("a\r\nb")).isEqualTo("| a_\n| b");
    }
}
