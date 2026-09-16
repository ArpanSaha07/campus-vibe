/**
 * @jest-environment node
 */
// Node, not jsdom: the reply is read from a real ReadableStream through
// TextDecoder, and jsdom provides neither.
import { ApiError } from "@/app/lib/api";
import { toPlannerPicks } from "@/app/lib/adapters";
import {
  createSseParser,
  PlannerReplyError,
  sendPlannerMessage,
  type SseFrame,
} from "@/app/lib/planner-api";
import type { ApiClub, ApiEvent, ApiPlannerReplyDone } from "@/app/types";

const apiEvent = (id: number, title: string): ApiEvent => ({
  id,
  title,
  description: null,
  dateTime: "2026-09-18T22:00:00Z",
  endTime: "2026-09-19T00:00:00Z",
  createdAt: "2026-09-01T00:00:00Z",
  location: "Trottier Building",
  price: "Free",
  organizerId: "ai-society",
  organizerName: "McGill AI Society",
  followers: 0,
  images: [],
  promoted: false,
  capacity: null,
  registered: 0,
  topics: [],
  formats: [],
});

const apiClub = (id: string, name: string): ApiClub => ({
  id,
  name,
  description: null,
  followers: 0,
  logo: null,
  socialLinks: null,
  featured: false,
  images: [],
  createdAt: "2026-09-01T00:00:00Z",
  category: null,
  interests: [],
});

const done: ApiPlannerReplyDone = {
  messageId: "m-2",
  picks: [
    { kind: "event", id: "7", reason: "matches your AI interest." },
    { kind: "event", id: "99", reason: "was deleted since." },
  ],
  events: [apiEvent(7, "AI Hack Night")],
  clubs: [],
  usage: { used: 4, limit: 15, resetsAt: "2026-09-17T04:00:00Z" },
  conversation: { id: "c-1", title: "Plan my weekend", lastActiveAt: "2026-09-16T15:00:00Z" },
};

function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** A 200 event stream delivering `chunks` exactly as split. */
function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

const mockFetch = jest.fn();

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe("createSseParser", () => {
  function parse(chunks: string[]): SseFrame[] {
    const frames: SseFrame[] = [];
    const parser = createSseParser((f) => frames.push(f));
    chunks.forEach((c) => parser.push(c));
    parser.flush();
    return frames;
  }

  it("holds a frame split mid-line and between its closing newlines until it is complete", () => {
    const whole = frame("delta", { text: "Here's a weekend" });
    const frames = parse([whole.slice(0, 9), whole.slice(9, whole.length - 1), whole.slice(-1)]);
    expect(frames).toEqual([{ event: "delta", data: '{"text":"Here\'s a weekend"}' }]);
  });

  it("accepts CRLF line endings, skips keep-alive comments, and joins multi-line data", () => {
    const frames = parse([": ping\r\n\r\nevent: delta\r\ndata: one\r\ndata: two\r\n\r\n"]);
    expect(frames).toEqual([{ event: "delta", data: "one\ntwo" }]);
  });

  it("delivers a last frame that ends without a blank line", () => {
    expect(parse(["event: done\ndata: {}"])).toEqual([{ event: "done", data: "{}" }]);
  });
});

describe("sendPlannerMessage", () => {
  it("streams the intro to onDelta and resolves with hydrated picks, usage and the chat", async () => {
    mockFetch.mockResolvedValue(
      streamResponse([frame("delta", { text: "Here's " }), frame("delta", { text: "a weekend." }), frame("done", done)]),
    );
    const deltas: string[] = [];

    const reply = await sendPlannerMessage("c-1", "Plan my weekend", { onDelta: (t) => deltas.push(t) });

    expect(deltas.join("")).toBe("Here's a weekend.");
    expect(reply.messageId).toBe("m-2");
    expect(reply.picks).toHaveLength(1);
    expect(reply.usage.used).toBe(4);
    expect(reply.conversation.title).toBe("Plan my weekend");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/planner\/conversations\/c-1\/messages$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ content: "Plan my weekend" });
  });

  it("rejects with PlannerReplyError on an error frame", async () => {
    mockFetch.mockResolvedValue(
      streamResponse([
        frame("delta", { text: "Here" }),
        frame("error", { code: "AI_TIMEOUT", message: "The planner took too long to answer." }),
      ]),
    );

    const failure = sendPlannerMessage("c-1", "hi", { onDelta: () => {} });
    await expect(failure).rejects.toBeInstanceOf(PlannerReplyError);
    await expect(failure).rejects.toMatchObject({ code: "AI_TIMEOUT" });
  });

  it("rejects when the stream ends without a done frame", async () => {
    mockFetch.mockResolvedValue(streamResponse([frame("delta", { text: "Here" })]));

    await expect(sendPlannerMessage("c-1", "hi", { onDelta: () => {} })).rejects.toMatchObject({
      code: "INCOMPLETE_STREAM",
    });
  });

  it.each([
    [429, "the daily message limit"],
    [503, "no AI provider"],
  ])("rejects with ApiError %i (%s) before any stream is read", async (status) => {
    mockFetch.mockResolvedValue(new Response('{"message":"no"}', { status }));

    const failure = sendPlannerMessage("c-1", "hi", { onDelta: () => {} });
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ status });
  });
});

describe("toPlannerPicks", () => {
  it("drops a pick whose card was not hydrated", () => {
    const picks = toPlannerPicks(done.picks, done.events, []);
    expect(picks.map((p) => (p.kind === "event" ? p.event.title : ""))).toEqual(["AI Hack Night"]);
  });

  it("keeps only the first pick's kind, so an answer has one card row", () => {
    const picks = toPlannerPicks(
      [
        { kind: "club", id: "photo-soc", reason: "runs beginner walks." },
        { kind: "event", id: "7", reason: "is on Friday." },
      ],
      [apiEvent(7, "AI Hack Night")],
      [apiClub("photo-soc", "Photography Society")],
    );
    expect(picks).toHaveLength(1);
    expect(picks[0].kind).toBe("club");
  });
});
