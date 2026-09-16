import { formatEventDateRange } from "@/app/lib/event-zone";
import type { PlannerConversationSummary, PlannerPick, PlannerPickKind } from "@/app/types";

/**
 * AI planner helpers that need no server: the prompt stash, the chip lists and
 * the labels the page derives. Endpoint calls are in `planner-api.ts`.
 */

/** Guest prompts survive the trip through sign-in under this key. */
export const PLANNER_PROMPT_KEY = "campusvibe.planner.prompt";

/** Saved chats per user. Starting one more deletes the least recently active. */
export const MAX_CONVERSATIONS = 15;

/** The server rejects a longer message. */
export const MAX_PROMPT_LENGTH = 1000;

/** Chip label and the prompt it starts, shared by the homepage card and a new chat. */
export const PLANNER_SUGGESTIONS: { label: string; prompt: string }[] = [
  { label: "Plan my weekend", prompt: "Plan my weekend around campus events I'd enjoy" },
  { label: "Find free events", prompt: "Find free events happening this week" },
  { label: "Beginner-friendly clubs", prompt: "Show me beginner-friendly clubs with social events" },
  {
    label: "Meet people with similar interests",
    prompt: "Help me meet people who share my interests",
  },
];

/** Follow-ups offered under an answer, chosen by what the answer recommended. */
export const FOLLOW_UPS: Record<PlannerPickKind, string[]> = {
  event: ["Show related clubs to follow", "Something this weekend", "During the week"],
  club: ["Upcoming events from these clubs", "Clubs like these"],
};

export type ConversationGroup = {
  label: "Today" | "Previous 7 days" | "Older";
  conversations: PlannerConversationSummary[];
};

/** Most recent first, bucketed by the viewer's local day. Empty groups are left out. */
export function groupConversations(
  conversations: PlannerConversationSummary[],
  now: Date = new Date(),
): ConversationGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
  const groups: ConversationGroup[] = [
    { label: "Today", conversations: [] },
    { label: "Previous 7 days", conversations: [] },
    { label: "Older", conversations: [] },
  ];
  const sorted = [...conversations].sort(
    (a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime(),
  );
  for (const conversation of sorted) {
    const at = conversation.lastActiveAt.getTime();
    const group = at >= startOfToday ? groups[0] : at >= weekAgo ? groups[1] : groups[2];
    group.conversations.push(conversation);
  }
  return groups.filter((group) => group.conversations.length > 0);
}

/** The chat a new one would replace: the least recently active, once the cap is reached. */
export function chatToEvict(
  conversations: PlannerConversationSummary[],
): PlannerConversationSummary | null {
  if (conversations.length < MAX_CONVERSATIONS) return null;
  return conversations.reduce((oldest, c) =>
    c.lastActiveAt.getTime() < oldest.lastActiveAt.getTime() ? c : oldest,
  );
}

/** A chat's title as the sidebar shows it before the server has named it. */
export function titleFromPrompt(prompt: string): string {
  const flat = prompt.replace(/\s+/g, " ").trim();
  return flat.length > 60 ? `${flat.slice(0, 59)}…` : flat;
}

/** The printed label above a card row, e.g. `4 events · Fri, Sep 18 – Sun, Sep 20`. */
export function pickRowLabel(picks: PlannerPick[]): string {
  const count = picks.length;
  if (picks[0]?.kind !== "event") return `${count} ${count === 1 ? "club" : "clubs"}`;

  const times = picks.map((pick) => (pick.kind === "event" ? pick.event.dateTime.getTime() : 0));
  const first = new Date(Math.min(...times));
  const last = new Date(Math.max(...times));
  const range = formatEventDateRange(first, last);
  return `${count} ${count === 1 ? "event" : "events"} · ${range}`;
}
