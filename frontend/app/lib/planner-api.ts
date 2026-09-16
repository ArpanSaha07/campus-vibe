import { ApiError, apiFetch, apiFetchResponse } from "@/app/lib/api";
import {
  toPlannerConversationSummary,
  toPlannerMessage,
  toPlannerPicks,
  toPlannerUsage,
} from "@/app/lib/adapters";
import type {
  ApiPlannerConversation,
  ApiPlannerConversationList,
  ApiPlannerCreatedConversation,
  ApiPlannerReplyDone,
  ApiPlannerUsage,
  PlannerConversationSummary,
  PlannerMessage,
  PlannerPick,
  PlannerUsage,
} from "@/app/types";

/**
 * The planner endpoints (Unit 2 of the AI planner plan). Every response here
 * is one user's data, so nothing is cached.
 */

const BASE = "/api/v1/planner";

export async function listConversations(): Promise<{
  conversations: PlannerConversationSummary[];
  usage: PlannerUsage;
}> {
  const body = await apiFetch<ApiPlannerConversationList>(`${BASE}/conversations`, { auth: true });
  return {
    conversations: body.conversations.map(toPlannerConversationSummary),
    usage: toPlannerUsage(body.usage),
  };
}

/** Creates an empty chat. At the cap the server deletes the least recently active one first. */
export async function createConversation(): Promise<{
  conversation: PlannerConversationSummary;
  evictedId: string | null;
}> {
  const body = await apiFetch<ApiPlannerCreatedConversation>(`${BASE}/conversations`, {
    method: "POST",
    auth: true,
  });
  return {
    conversation: toPlannerConversationSummary(body.conversation),
    evictedId: body.evictedId,
  };
}

/** Null when the chat does not exist, or belongs to somebody else: both are a 404. */
export async function getConversation(
  id: string,
): Promise<{ conversation: PlannerConversationSummary; messages: PlannerMessage[] } | null> {
  try {
    const body = await apiFetch<ApiPlannerConversation>(
      `${BASE}/conversations/${encodeURIComponent(id)}`,
      { auth: true },
    );
    return {
      conversation: toPlannerConversationSummary(body),
      messages: body.messages.map(toPlannerMessage),
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function deleteConversation(id: string): Promise<void> {
  await apiFetch<void>(`${BASE}/conversations/${encodeURIComponent(id)}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function getUsage(): Promise<PlannerUsage> {
  return toPlannerUsage(await apiFetch<ApiPlannerUsage>(`${BASE}/usage`, { auth: true }));
}

/** An `error` frame: the request was accepted, and the reply failed part way. */
export class PlannerReplyError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PlannerReplyError";
    this.code = code;
  }
}

export interface PlannerReply {
  messageId: string;
  picks: PlannerPick[];
  usage: PlannerUsage;
  conversation: PlannerConversationSummary;
}

export interface SseFrame {
  event: string;
  data: string;
}

/**
 * Splits a `text/event-stream` into frames as chunks arrive.
 *
 * A chunk boundary falls anywhere, including inside a line or between the two
 * newlines that end a frame, so text is held until a blank line closes it.
 * Lines starting with `:` are comments (keep-alives) and are ignored.
 */
export function createSseParser(onFrame: (frame: SseFrame) => void) {
  let buffer = "";

  function emit(block: string) {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
    if (data.length > 0) onFrame({ event, data: data.join("\n") });
  }

  return {
    push(chunk: string) {
      buffer += chunk.replace(/\r\n?/g, "\n");
      let end = buffer.indexOf("\n\n");
      while (end !== -1) {
        emit(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
        end = buffer.indexOf("\n\n");
      }
    },
    /** A stream that ends without a closing blank line still delivers its last frame. */
    flush() {
      if (buffer.trim()) emit(buffer);
      buffer = "";
    },
  };
}

/**
 * Sends one message and streams the reply.
 *
 * `onDelta` receives the intro as it is written. Resolves with the `done`
 * frame. Rejects with `ApiError` when the request is refused (429 at the daily
 * limit, 503 without an AI provider), with `PlannerReplyError` on an `error`
 * frame, and with an `AbortError` when `signal` fires.
 */
export async function sendPlannerMessage(
  conversationId: string,
  content: string,
  { onDelta, signal }: { onDelta: (text: string) => void; signal?: AbortSignal },
): Promise<PlannerReply> {
  const res = await apiFetchResponse(
    `${BASE}/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      auth: true,
      body: JSON.stringify({ content }),
      headers: { Accept: "text/event-stream" },
      signal,
    },
  );
  if (!res.body) throw new PlannerReplyError("EMPTY_STREAM", "The planner sent no reply.");

  // An object rather than two lets: TypeScript does not see assignments made
  // inside the callback, and would narrow both to null after it.
  const outcome: { done: ApiPlannerReplyDone | null; failure: PlannerReplyError | null } = {
    done: null,
    failure: null,
  };
  const parser = createSseParser(({ event, data }) => {
    if (outcome.done || outcome.failure) return;
    const payload = JSON.parse(data);
    if (event === "delta") onDelta(payload.text ?? "");
    else if (event === "done") outcome.done = payload as ApiPlannerReplyDone;
    else if (event === "error") outcome.failure = new PlannerReplyError(payload.code, payload.message);
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done: ended } = await reader.read();
    if (ended) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
  parser.push(decoder.decode());
  parser.flush();

  if (outcome.failure) throw outcome.failure;
  const reply = outcome.done;
  if (!reply) throw new PlannerReplyError("INCOMPLETE_STREAM", "The reply was cut off.");
  return {
    messageId: reply.messageId,
    picks: toPlannerPicks(reply.picks, reply.events, reply.clubs),
    usage: toPlannerUsage(reply.usage),
    conversation: toPlannerConversationSummary(reply.conversation),
  };
}
