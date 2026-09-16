package com.campusvibe.ai.feature.planner;

import com.campusvibe.user.User;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * The AI planner, the endpoints {@code frontend/app/lib/planner-api.ts} calls.
 *
 * <p>Every route is the signed-in user's own: the user comes from the JWT,
 * never from the path, and a chat id that is not theirs is a 404. Signed-in
 * only because every path here falls through to
 * {@code anyRequest().authenticated()} in {@code SecurityFilterChainConfig}.
 * Each message costs a provider call, so the daily quota is the rate limit.
 */
@RestController
@RequestMapping("/api/v1/planner")
public class PlannerController {

    public record SendMessageRequest(String content) {}

    private final PlannerConversationService conversationService;
    private final PlannerUsageService usageService;
    private final PlannerReplyService replyService;

    public PlannerController(PlannerConversationService conversationService,
                             PlannerUsageService usageService,
                             PlannerReplyService replyService) {
        this.conversationService = conversationService;
        this.usageService = usageService;
        this.replyService = replyService;
    }

    @GetMapping("/conversations")
    public PlannerConversationListDTO list(@AuthenticationPrincipal User user) {
        return conversationService.list(user.getId());
    }

    @PostMapping("/conversations")
    @ResponseStatus(HttpStatus.CREATED)
    public PlannerCreatedConversationDTO create(@AuthenticationPrincipal User user) {
        return conversationService.create(user.getId());
    }

    @GetMapping("/conversations/{conversationId}")
    public PlannerConversationDTO get(@AuthenticationPrincipal User user, @PathVariable String conversationId) {
        return conversationService.get(conversationId, user.getId());
    }

    @DeleteMapping("/conversations/{conversationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal User user, @PathVariable String conversationId) {
        conversationService.delete(conversationId, user.getId());
    }

    @GetMapping("/usage")
    public PlannerUsageDTO usage(@AuthenticationPrincipal User user) {
        return usageService.usage(user.getId());
    }

    /**
     * Streams the reply as {@code text/event-stream}: {@code delta} frames,
     * then {@code done} or {@code error}.
     *
     * <p>{@code X-Accel-Buffering: no} tells nginx in front of the Elastic
     * Beanstalk container to pass each frame on as it is written; buffered,
     * the whole reply would arrive at once at the end.
     */
    @PostMapping(value = "/conversations/{conversationId}/messages",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<SseEmitter> send(@AuthenticationPrincipal User user,
                                           @PathVariable String conversationId,
                                           @RequestBody SendMessageRequest request) {
        SseEmitter emitter = replyService.start(user.getId(), conversationId, request.content());
        return ResponseEntity.ok()
                .header("X-Accel-Buffering", "no")
                .header(HttpHeaders.CACHE_CONTROL, "no-cache")
                .body(emitter);
    }
}
