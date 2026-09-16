package com.campusvibe.ai.feature.planner;

import com.campusvibe.ai.AiServiceUnavailableException;
import com.campusvibe.ai.client.LlmClient;
import com.campusvibe.ai.client.LlmException;
import com.campusvibe.ai.client.LlmRequest;
import com.campusvibe.exception.RequestValidationException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * Sends one message and streams the reply.
 *
 * <p>{@link #start} runs on the request thread and refuses what it can before
 * any stream exists, so the page sees a plain status: 400 for an empty or long
 * message, 404 for a chat that is not the caller's, 503 without a provider key,
 * 429 when the day's messages are used up. Only then is the message counted
 * and the reply handed to a virtual thread.
 *
 * <p>{@link #reply} is that thread's work. What happens to the message:
 * <ul>
 *   <li><b>completes</b>: both messages are stored and the {@code done} frame sent</li>
 *   <li><b>fails</b> (provider error, timeout, unusable answer): nothing stored,
 *       the message refunded, an {@code error} frame sent</li>
 *   <li><b>stopped</b> by the client: nothing stored, the message still counted,
 *       because the provider was already paid (Arpan, 2026-09-16)</li>
 * </ul>
 */
@Service
public class PlannerReplyService {

    private static final Logger log = LoggerFactory.getLogger(PlannerReplyService.class);

    static final String PROVIDER_ERROR = "AI_PROVIDER_ERROR";
    static final String CONVERSATION_FULL = "CONVERSATION_FULL";
    static final String CONVERSATION_GONE = "CONVERSATION_GONE";

    static final String PROVIDER_ERROR_MESSAGE = "The planner couldn't answer just now. Try again.";
    static final String REFUSED_MESSAGE = "The planner couldn't answer that. Try asking another way.";
    static final String CONVERSATION_FULL_MESSAGE =
            "This chat is full. Start a new chat to keep planning.";
    static final String CONVERSATION_GONE_MESSAGE = "This chat no longer exists.";

    /**
     * Longer than any reply can run (the provider's chatTimeout plus retrieval),
     * so the container's own async timeout, 30 seconds on Tomcat, never cuts a
     * reply off; a timeout here is refunded as the server's failure.
     */
    static final long STREAM_TIMEOUT_MS = Duration.ofMinutes(3).toMillis();

    /** Under the load balancer's 60-second idle timeout, with room to spare. */
    static final Duration KEEP_ALIVE = Duration.ofSeconds(15);

    private final PlannerConversationService conversationService;
    private final PlannerMessageRepository messageRepository;
    private final PlannerUsageService usageService;
    private final PlannerRetrievalService retrievalService;
    private final PlannerPromptBuilder promptBuilder;
    private final LlmClient llmClient;
    private final ObjectMapper objectMapper;

    private final ExecutorService replies = Executors.newVirtualThreadPerTaskExecutor();
    private final ScheduledExecutorService keepAlives = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "planner-keep-alive");
        thread.setDaemon(true);
        return thread;
    });

    public PlannerReplyService(PlannerConversationService conversationService,
                               PlannerMessageRepository messageRepository,
                               PlannerUsageService usageService,
                               PlannerRetrievalService retrievalService,
                               PlannerPromptBuilder promptBuilder,
                               LlmClient llmClient,
                               ObjectMapper objectMapper) {
        this.conversationService = conversationService;
        this.messageRepository = messageRepository;
        this.usageService = usageService;
        this.retrievalService = retrievalService;
        this.promptBuilder = promptBuilder;
        this.llmClient = llmClient;
        this.objectMapper = objectMapper;
    }

    @PreDestroy
    void shutdown() {
        keepAlives.shutdownNow();
        replies.shutdownNow();
    }

    /** Checks the request, counts the message, and starts the reply. */
    public SseEmitter start(long userId, String conversationId, String content) {
        String prompt = content == null ? "" : content.strip();
        if (prompt.isEmpty()) {
            throw new RequestValidationException("A message can't be empty.");
        }
        if (prompt.length() > PlannerLimits.MAX_PROMPT_LENGTH) {
            throw new RequestValidationException("A message can be at most 1,000 characters.");
        }
        UUID chatId = conversationService.requireOwned(conversationId, userId).id();
        if (!llmClient.isConfigured()) {
            throw new AiServiceUnavailableException("The planner is unavailable right now.");
        }

        SseEmitter emitter = new SseEmitter(STREAM_TIMEOUT_MS);
        SseReplySink sink = new SseReplySink(emitter);

        // A send that would take the chat past 40 is answered in the stream,
        // where the page shows the message as written, and never counted.
        if (messageRepository.count(chatId) + 2 > PlannerLimits.MAX_MESSAGES_PER_CONVERSATION) {
            sink.error(CONVERSATION_FULL, CONVERSATION_FULL_MESSAGE);
            sink.complete();
            return emitter;
        }

        LocalDate spentOn = usageService.spend(userId);
        try {
            replies.execute(() -> reply(userId, chatId, prompt, spentOn, sink));
        } catch (RejectedExecutionException e) {
            // Only during shutdown.
            usageService.refund(userId, spentOn);
            throw new AiServiceUnavailableException("The planner is unavailable right now.");
        }
        return emitter;
    }

    /**
     * Writes the reply to {@code sink}. The message is already counted against
     * {@code spentOn}; this refunds it on failure and never throws.
     */
    public void reply(long userId, UUID conversationId, String prompt, LocalDate spentOn, PlannerReplySink sink) {
        ScheduledFuture<?> keepAlive = keepAlives.scheduleAtFixedRate(sink::keepAlive,
                KEEP_ALIVE.toMillis(), KEEP_ALIVE.toMillis(), TimeUnit.MILLISECONDS);
        try {
            Instant now = Instant.now();
            List<PlannerMessageRepository.Row> history =
                    messageRepository.findRecent(conversationId, PlannerLimits.HISTORY_MESSAGES);
            String previousPrompt = history.stream()
                    .filter(row -> PlannerMessageRepository.USER.equals(row.role()))
                    .reduce((first, second) -> second).map(PlannerMessageRepository.Row::content).orElse(null);
            List<PlannerPickDTO> previousPicks = history.stream()
                    .filter(row -> PlannerMessageRepository.ASSISTANT.equals(row.role()))
                    .reduce((first, second) -> second).map(PlannerMessageRepository.Row::picks).orElse(List.of());

            PlannerRetrievalService.Candidates candidates =
                    retrievalService.retrieve(userId, prompt, previousPrompt, previousPicks, now);
            Map<String, String> names = retrievalService.namesFor(
                    history.stream().flatMap(row -> row.picks().stream()).toList());
            LlmRequest request = promptBuilder.build(prompt, history, names, candidates, now);

            IntroStreamReader introReader = new IntroStreamReader();
            String text = llmClient.streamStructured(request, fragment -> {
                String intro = introReader.feed(fragment);
                if (!intro.isEmpty()) {
                    sink.delta(intro);
                }
            });

            PlannerAnswers.ModelAnswer answer = PlannerAnswers.parse(text, objectMapper);
            List<PlannerPickDTO> picks = PlannerAnswers.keep(answer, candidates);
            String intro = PlannerAnswers.intro(answer, picks);
            // Counts only, never ids or text. A steady stream of dropped picks
            // means the model is naming things it was not offered.
            log.info("planner.answer kind={} picked={} kept={} candidates={}/{}",
                    answer.kind(), answer.picks().size(), picks.size(),
                    candidates.events().size(), candidates.clubs().size());

            // The page shows the deltas; make sure they add up to the stored
            // intro when the reader could not stream all of it.
            String streamed = introReader.emitted().stripLeading();
            if (intro.startsWith(streamed) && intro.length() > streamed.length()) {
                sink.delta(intro.substring(streamed.length()));
            }
            if (sink.isGone()) {
                throw new PlannerReplySink.ClientGoneException();
            }

            Optional<PlannerConversationService.StoredReply> stored =
                    conversationService.recordExchange(userId, conversationId, prompt, intro, picks);
            if (stored.isEmpty()) {
                usageService.refund(userId, spentOn);
                sink.error(CONVERSATION_GONE, CONVERSATION_GONE_MESSAGE);
                return;
            }
            sink.done(new PlannerReplyDoneDTO(
                    String.valueOf(stored.get().messageId()),
                    picks,
                    stored.get().cards().events(),
                    stored.get().cards().clubs(),
                    usageService.usage(userId),
                    stored.get().conversation()));

        } catch (PlannerReplySink.ClientGoneException e) {
            if (sink.timedOut()) {
                usageService.refund(userId, spentOn);
                log.warn("Planner reply ran past the stream timeout; refunded");
            } else {
                log.info("Planner reply stopped by the client; nothing stored, message counted");
            }
        } catch (LlmException e) {
            usageService.refund(userId, spentOn);
            log.warn("Planner reply failed ({}: {}); refunded", e.reason(), e.getMessage());
            sink.error(PROVIDER_ERROR,
                    e.reason() == LlmException.Reason.REFUSED ? REFUSED_MESSAGE : PROVIDER_ERROR_MESSAGE);
        } catch (IllegalArgumentException e) {
            usageService.refund(userId, spentOn);
            log.warn("Planner reply was not a usable answer ({}); refunded", e.getMessage());
            sink.error(PROVIDER_ERROR, PROVIDER_ERROR_MESSAGE);
        } catch (RuntimeException e) {
            usageService.refund(userId, spentOn);
            log.error("Planner reply failed unexpectedly; refunded", e);
            sink.error(PROVIDER_ERROR, PROVIDER_ERROR_MESSAGE);
        } finally {
            keepAlive.cancel(false);
            sink.complete();
        }
    }
}
