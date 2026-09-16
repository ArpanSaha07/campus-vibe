package com.campusvibe.ai.feature.planner;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads the {@code intro} string out of the model's JSON answer while the JSON
 * is still arriving, so the intro can stream to the page as {@code delta}
 * frames (spec 2026-09-16-planner-backend, one streamed call with a strict
 * schema).
 *
 * <p>The schema puts {@code intro} first and providers emit properties in
 * schema order, so the answer starts {@code {"intro":"}. Fragments split
 * anywhere, including inside an escape such as {@code é} or between the
 * two halves of a surrogate pair, so an incomplete escape is held until the
 * rest arrives and a lone high surrogate is never handed out: serialised alone
 * into a frame it would not be valid UTF-8.
 *
 * <p>If the answer does not start as expected, the reader stops emitting and
 * {@link #emitted()} stays short; the caller sends the rest of the intro from
 * the fully parsed answer. Nothing here is trusted for the stored answer,
 * which comes from a real JSON parse of the whole text.
 */
final class IntroStreamReader {

    private static final Pattern START = Pattern.compile("\\s*\\{\\s*\"intro\"\\s*:\\s*\"");

    private enum State { SEEKING, IN_INTRO, DONE, GAVE_UP }

    private final StringBuilder raw = new StringBuilder();
    private final StringBuilder decoded = new StringBuilder();
    private State state = State.SEEKING;
    private int position;
    private int emittedLength;

    /** Adds a fragment of the answer; returns the intro text it completes, possibly empty. */
    String feed(String fragment) {
        raw.append(fragment);

        if (state == State.SEEKING) {
            Matcher matcher = START.matcher(raw);
            if (matcher.lookingAt()) {
                position = matcher.end();
                state = State.IN_INTRO;
            } else if (!matcher.hitEnd()) {
                state = State.GAVE_UP;
            }
        }
        if (state == State.IN_INTRO) {
            decode();
        }

        int safeLength = decoded.length();
        if (state == State.IN_INTRO && safeLength > 0 && Character.isHighSurrogate(decoded.charAt(safeLength - 1))) {
            safeLength--;
        }
        if (safeLength <= emittedLength) {
            return "";
        }
        String out = decoded.substring(emittedLength, safeLength);
        emittedLength = safeLength;
        return out;
    }

    /** Everything handed out so far. */
    String emitted() {
        return decoded.substring(0, emittedLength);
    }

    private void decode() {
        while (position < raw.length()) {
            char c = raw.charAt(position);
            if (c == '"') {
                state = State.DONE;
                position++;
                return;
            }
            if (c != '\\') {
                decoded.append(c);
                position++;
                continue;
            }
            if (position + 1 >= raw.length()) {
                return;
            }
            char escape = raw.charAt(position + 1);
            switch (escape) {
                case '"', '\\', '/' -> decoded.append(escape);
                case 'b' -> decoded.append('\b');
                case 'f' -> decoded.append('\f');
                case 'n' -> decoded.append('\n');
                case 'r' -> decoded.append('\r');
                case 't' -> decoded.append('\t');
                case 'u' -> {
                    if (position + 6 > raw.length()) {
                        return;
                    }
                    try {
                        decoded.append((char) Integer.parseInt(raw.substring(position + 2, position + 6), 16));
                    } catch (NumberFormatException e) {
                        state = State.GAVE_UP;
                        return;
                    }
                    position += 6;
                    continue;
                }
                default -> {
                    state = State.GAVE_UP;
                    return;
                }
            }
            position += 2;
        }
    }
}
