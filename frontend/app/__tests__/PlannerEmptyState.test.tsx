import { render, screen } from "@testing-library/react";
import PlannerEmptyState from "@/app/components/planner/PlannerEmptyState";
import { chatToEvict, MAX_CONVERSATIONS } from "@/app/lib/planner";
import type { PlannerConversationSummary } from "@/app/types";

function chats(count: number): PlannerConversationSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `c-${i}`,
    // c-3 is the least recently active.
    title: i === 3 ? "Ski trip clubs" : `Chat ${i}`,
    lastActiveAt: new Date(2026, 8, i === 3 ? 1 : 10 + (i % 5), 12, 0),
  }));
}

function renderFor(conversations: PlannerConversationSummary[]) {
  const evict = chatToEvict(conversations);
  render(
    <PlannerEmptyState evictTitle={evict ? evict.title : null} composer={<div />} onSuggestion={() => {}} />,
  );
}

describe("PlannerEmptyState eviction notice", () => {
  it("is absent below the cap", () => {
    renderFor(chats(MAX_CONVERSATIONS - 1));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("names the least recently active chat at 15 of 15", () => {
    renderFor(chats(MAX_CONVERSATIONS));
    expect(screen.getByRole("note")).toHaveTextContent(
      "Sending your first message here deletes your oldest chat, Ski trip clubs.",
    );
  });
});
