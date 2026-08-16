package com.campusvibe.common;

/**
 * Makes a caller-supplied value safe to write into a log line.
 *
 * <p>Anything that arrives in a request — a URI, an email address, a subject —
 * is written by whoever made the request, and a log line is just text. A value
 * containing a newline therefore does not appear <em>in</em> an entry; it ends
 * the entry and starts one the attacker composed. That is log forging, and it
 * matters most in exactly the lines an investigation would read: the unhandled
 * exception, the failed delivery.
 *
 * <p>Stripping the whole {@code Cntrl} class rather than just CR and LF also
 * removes ESC (0x1B). A log tailed in a terminal interprets escape sequences,
 * so an unfiltered value can repaint or clear the operator's screen.
 *
 * <p>Truncation bounds the other half of the problem: nothing forces a request
 * URI to be short, and a log line is not a place to copy an unbounded string.
 */
public final class Logs {

    /** Long enough for any legitimate URI or header we log; short enough to read. */
    private static final int MAX_LENGTH = 300;

    private Logs() {}

    /** The value with control characters replaced and its length bounded. */
    public static String safe(String value) {
        if (value == null) {
            return "null";
        }
        // The first two calls are redundant at runtime: \p{Cntrl} already covers
        // CR and LF, so removing them changes nothing about what this returns.
        // They are here for the static analyser. CodeQL's log-injection barrier
        // is syntactic — it recognises a replace whose pattern is a compile-time
        // constant naming \n or \r, and cannot reason that a character class
        // subsumes them. Written with \p{Cntrl} alone, the sanitiser is invisible
        // to it and every call site stays flagged (java/log-injection).
        //
        // So: do not delete these as dead code. They buy nothing at runtime and
        // three alerts' worth of signal in review.
        String stripped = value
                .replace("\r", "_")
                .replace("\n", "_")
                .replaceAll("\\p{Cntrl}", "_");
        return stripped.length() <= MAX_LENGTH
                ? stripped
                : stripped.substring(0, MAX_LENGTH) + "…[truncated]";
    }

    /**
     * The same, for a value whose line breaks are meant to be kept — an email
     * body being the case that exists.
     *
     * <p>Every line is prefixed, so content the caller supplied cannot be read
     * as a log entry of its own even though it still spans several lines. Length
     * is not bounded here: the callers of this are printing a whole document on
     * purpose, and truncating it would defeat the point of printing it.
     *
     * <p><b>CodeQL will keep flagging the call sites of this method, and that is
     * expected.</b> Keeping {@code \n} is the whole feature, and a barrier that
     * preserves newlines is by definition not a newline sanitiser, so no
     * rewriting here will satisfy the query without destroying what it is for.
     * The prefix is the real mitigation and static analysis cannot see it.
     */
    public static String safeBlock(String value) {
        if (value == null) {
            return "null";
        }
        return value.replace("\r", "_")
                .replaceAll("[^\\P{Cntrl}\\n]", "_")
                .replaceAll("(?m)^", "| ");
    }
}
