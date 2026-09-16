package com.campusvibe.ai.feature.planner;

import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;

/**
 * A {@link PlannerReplySink} on a servlet {@link SseEmitter}.
 *
 * <p>A client that disconnects is noticed only when a write fails, or when the
 * container reports an error on the async request; either marks the sink gone,
 * and the next {@link #delta} throws so the provider stream is abandoned.
 * Every write is synchronised: the reply thread and the keep-alive scheduler
 * both write.
 */
final class SseReplySink implements PlannerReplySink {

    private final SseEmitter emitter;
    private volatile boolean gone;
    private volatile boolean timedOut;
    private volatile boolean completed;

    SseReplySink(SseEmitter emitter) {
        this.emitter = emitter;
        emitter.onTimeout(() -> {
            timedOut = true;
            gone = true;
        });
        emitter.onError(error -> gone = true);
        emitter.onCompletion(() -> {
            if (!completed) {
                gone = true;
            }
        });
    }

    @Override
    public void delta(String text) {
        send("delta", Map.of("text", text));
    }

    @Override
    public void done(PlannerReplyDoneDTO done) {
        send("done", done);
    }

    @Override
    public void error(String code, String message) {
        try {
            send("error", Map.of("code", code, "message", message));
        } catch (ClientGoneException ignored) {
            // Nobody left to tell.
        }
    }

    @Override
    public synchronized void keepAlive() {
        if (gone || completed) return;
        try {
            emitter.send(SseEmitter.event().comment("keep-alive"));
        } catch (IOException | IllegalStateException e) {
            gone = true;
        }
    }

    @Override
    public boolean isGone() {
        return gone;
    }

    @Override
    public boolean timedOut() {
        return timedOut;
    }

    @Override
    public synchronized void complete() {
        if (completed) return;
        completed = true;
        try {
            emitter.complete();
        } catch (IllegalStateException ignored) {
            // Already completed by a timeout or an error.
        }
    }

    private synchronized void send(String name, Object data) {
        if (gone || completed) {
            throw new ClientGoneException();
        }
        try {
            emitter.send(SseEmitter.event().name(name).data(data, MediaType.APPLICATION_JSON));
        } catch (IOException | IllegalStateException e) {
            gone = true;
            throw new ClientGoneException();
        }
    }
}
