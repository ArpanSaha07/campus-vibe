import { popularEvents, clubs } from "@/app/data/data";
import type { EventInstance, Plan, PlanSlot } from "@/app/types";

/**
 * AI planner mock layer. There is no retrieval and no LLM yet, so plans are
 * assembled from the same static events the homepage renders. Everything here
 * is derived from real event fields — nothing invents user history — so the
 * copy stays true once buildMockPlan is swapped for the RAG endpoint.
 */

/** Guest prompts survive the trip through sign-in under this key. */
export const PLANNER_PROMPT_KEY = "campusvibe.planner.prompt";

/** How long the mock generation runs before the plan appears. */
export const PLANNER_DELAY_MS = 1800;

const SLOTS_PER_PLAN = 3;
const CLUBS_PER_PLAN = 3;

/** Stable per-prompt offset, so a follow-up visibly changes the plan. */
function promptSeed(prompt: string): number {
  let seed = 0;
  for (let i = 0; i < prompt.length; i++) {
    seed = (seed * 31 + prompt.charCodeAt(i)) >>> 0;
  }
  return seed;
}

function rotate<T>(items: T[], offset: number, count: number): T[] {
  if (items.length === 0) return [];
  return Array.from(
    { length: Math.min(count, items.length) },
    (_, i) => items[(offset + i) % items.length],
  );
}

/** Grounded in the event's own fields — a real endpoint would explain the match. */
function rationale(event: EventInstance): string {
  const cost = event.price === "Free" ? "free to attend" : "ticketed";
  const tags = event.categories.slice(0, 2).join(" and ");
  return tags
    ? `Picked for its ${tags} tags — ${cost}.`
    : `Picked because it is ${cost} and fits the time slot.`;
}

/** The slot label is the event's own start time — never a time it does not have. */
function slotTime(event: EventInstance): string {
  return event.dateTime.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildMockPlan(prompt: string, refinements: string[] = []): Plan {
  const seed = promptSeed([prompt, ...refinements].join(" "));
  const events = rotate(popularEvents, seed % Math.max(popularEvents.length, 1), SLOTS_PER_PLAN);

  const slots: PlanSlot[] = events
    .slice()
    .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
    .map((event) => ({
      time: slotTime(event),
      event,
      rationale: rationale(event),
    }));

  const freeCount = slots.filter((slot) => slot.event.price === "Free").length;
  const featured = clubs.filter((club) => club.featured);

  return {
    prompt,
    refinements,
    title: "Your CampusVibe plan",
    summary: `${slots.length} picks across the day, ${freeCount} of them free to attend.`,
    slots,
    clubs: rotate(featured.length > 0 ? featured : clubs, seed % Math.max(clubs.length, 1), CLUBS_PER_PLAN),
    nextSteps: [
      "Save the events you like so they show up on your profile.",
      "Follow a club to hear about their next event first.",
      "Refine this plan with a follow-up below.",
    ],
  };
}
