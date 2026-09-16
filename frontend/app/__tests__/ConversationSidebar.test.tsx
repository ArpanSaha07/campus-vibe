import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConversationSidebar from "@/app/components/planner/ConversationSidebar";
import type { PlannerConversationSummary } from "@/app/types";

const now = new Date(2026, 8, 16, 15, 0);

const chat = (id: string, title: string, lastActiveAt: Date): PlannerConversationSummary => ({
  id,
  title,
  lastActiveAt,
});

const conversations = [
  chat("a", "Ski trip clubs", new Date(2026, 7, 1, 12, 0)),
  chat("b", "Plan my weekend", new Date(2026, 8, 16, 9, 30)),
  chat("c", "Beginner photography clubs", new Date(2026, 8, 12, 18, 0)),
  chat("d", "Free food this week", new Date(2026, 8, 16, 14, 0)),
];

const usage = { used: 3, limit: 15, resetsAt: new Date(2026, 8, 17, 0, 0) };

function renderSidebar(onDelete = jest.fn().mockResolvedValue(undefined)) {
  render(
    <ConversationSidebar
      conversations={conversations}
      activeId="b"
      usage={usage}
      onDelete={onDelete}
      now={now}
    />,
  );
  return onDelete;
}

describe("ConversationSidebar", () => {
  it("groups chats into Today, Previous 7 days and Older, most recent first", () => {
    renderSidebar();

    const titles = (group: string) =>
      within(screen.getByRole("region", { name: group }))
        .getAllByRole("link")
        .map((link) => link.textContent);

    expect(titles("Today")).toEqual(["Free food this week", "Plan my weekend"]);
    expect(titles("Previous 7 days")).toEqual(["Beginner photography clubs"]);
    expect(titles("Older")).toEqual(["Ski trip clubs"]);
    expect(screen.getByRole("link", { name: "Plan my weekend" })).toHaveAttribute("aria-current", "page");
  });

  it("asks inline before deleting, and deletes only on confirm", async () => {
    const onDelete = renderSidebar();

    await userEvent.click(screen.getByRole("button", { name: "Delete Ski trip clubs" }));
    expect(screen.getByText("Delete this chat?")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("a");
  });

  it("puts the row back on cancel without deleting", async () => {
    const onDelete = renderSidebar();

    await userEvent.click(screen.getByRole("button", { name: "Delete Plan my weekend" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Delete this chat?")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plan my weekend" })).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("says so when a delete fails, and keeps the confirm open", async () => {
    renderSidebar(jest.fn().mockRejectedValue(new Error("500")));

    await userEvent.click(screen.getByRole("button", { name: "Delete Ski trip clubs" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be deleted");
    expect(screen.getByText("Delete this chat?")).toBeInTheDocument();
  });

  it("shows messages left today and the saved chat count", () => {
    renderSidebar();

    expect(screen.getByText("12 of 15 messages left today")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Messages left today" })).toHaveAttribute("aria-valuenow", "12");
    expect(screen.getByText("4/15 chats")).toBeInTheDocument();
  });
});
