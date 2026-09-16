package com.campusvibe.ai.feature.planner;

/**
 * Where a streamed reply's frames go (ADR-019): {@code delta} frames of intro
 * text, then one {@code done} or {@code error} frame.
 *
 * <p>An interface rather than {@code SseEmitter} itself, so a test can play a
 * client that goes away part way through.
 */
public interface PlannerReplySink {

    /** @throws ClientGoneException when the client has disconnected */
    void delta(String text);

    /** @throws ClientGoneException when the client has disconnected */
    void done(PlannerReplyDoneDTO done);

    /** Best effort: a client that has gone is not told. */
    void error(String code, String message);

    /** A comment line that keeps proxies from closing an idle stream. Best effort. */
    void keepAlive();

    /** True once the client has disconnected or the stream timed out. */
    boolean isGone();

    /** True when the stream ended because the server took too long, which is not the client's doing. */
    boolean timedOut();

    /** Ends the stream. Safe to call more than once. */
    void complete();

    /** The client stopped reading: pressed Stop, closed the tab, or lost its connection. */
    final class ClientGoneException extends RuntimeException {
        public ClientGoneException() {
            super("The client disconnected", null, false, false);
        }
    }
}
