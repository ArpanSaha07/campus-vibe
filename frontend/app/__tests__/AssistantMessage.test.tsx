import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AssistantMessage from "@/app/components/planner/AssistantMessage";
import { toClub, toEventInstance } from "@/app/lib/adapters";
import type { ApiClub, ApiEvent, PlannerMessage } from "@/app/types";

// The real cards pull in follow state, managed clubs and next/image. What is
// under test is how the answer lays them out, so they render as named stubs.
jest.mock("@/app/components/event/EventCard", () => ({
  __esModule: true,
  default: ({ event }: { event: { title: string } }) => <div data-testid="event-card">{event.title}</div>,
}));
jest.mock("@/app/components/club/ClubCard", () => ({
  __esModule: true,
  default: ({ club }: { club: { name: string } }) => <div data-testid="club-card">{club.name}</div>,
}));

const event = (id: number, title: string, dateTime: string) =>
  toEventInstance({
    id,
    title,
    description: null,
    dateTime,
    createdAt: "2026-09-01T00:00:00Z",
    location: "Lower Field",
    price: "Free",
    organizerId: "ssmu",
    organizerName: "SSMU Events",
    followers: 0,
    images: [],
    promoted: false,
    capacity: null,
    registered: 0,
    topics: [],
    formats: [],
  } satisfies ApiEvent);

const club = (id: string, name: string) =>
  toClub({
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
  } satisfies ApiClub);

const eventsAnswer: PlannerMessage = {
  id: "m-1",
  role: "assistant",
  content: "Here's a weekend that mixes both.",
  status: "complete",
  picks: [
    { kind: "event", reason: "matches your AI interest.", event: event(1, "AI Hack Night", "2026-09-18T22:00:00") },
    { kind: "event", reason: "is the music pick.", event: event(2, "Frosh Week Rave", "2026-09-19T21:00:00") },
  ],
};

const clubsAnswer: PlannerMessage = {
  id: "m-2",
  role: "assistant",
  content: "These three welcome beginners.",
  status: "complete",
  picks: [
    { kind: "club", reason: "runs photo walks.", club: club("photo-soc", "Photography Society") },
    { kind: "club", reason: "screens films weekly.", club: club("film-soc", "Film Society") },
  ],
};

describe("AssistantMessage", () => {
  it("renders an events answer as the intro, one row of event cards and a line per pick", () => {
    render(<AssistantMessage message={eventsAnswer} onFollowUp={() => {}} />);

    expect(screen.getByText("Here's a weekend that mixes both.")).toBeInTheDocument();
    expect(screen.getAllByRole("list", { name: /^Recommended/ })).toHaveLength(1);
    const row = screen.getByRole("list", { name: "Recommended events" });
    expect(within(row).getAllByTestId("event-card")).toHaveLength(2);
    expect(screen.queryByTestId("club-card")).not.toBeInTheDocument();

    const link = screen.getByRole("link", { name: "AI Hack Night" });
    expect(link).toHaveAttribute("href", "/events/1");
    expect(link.closest("p")).toHaveTextContent("AI Hack Night matches your AI interest.");
    expect(screen.getByText(/^2 events · /)).toBeInTheDocument();
  });

  it("renders a clubs answer as one row of club cards with club follow-ups", () => {
    render(<AssistantMessage message={clubsAnswer} onFollowUp={() => {}} />);

    const row = screen.getByRole("list", { name: "Recommended clubs" });
    expect(within(row).getAllByTestId("club-card")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Photography Society" })).toHaveAttribute("href", "/clubs/photo-soc");
    expect(screen.getByText("2 clubs")).toBeInTheDocument();

    const followUps = within(screen.getByRole("list", { name: "Follow-up prompts" })).getAllByRole("button");
    expect(followUps.map((b) => b.textContent)).toEqual(["Upcoming events from these clubs", "Clubs like these"]);
  });

  it("offers the event follow-ups under an events answer and sends the one tapped", async () => {
    const onFollowUp = jest.fn();
    render(<AssistantMessage message={eventsAnswer} onFollowUp={onFollowUp} />);

    const followUps = within(screen.getByRole("list", { name: "Follow-up prompts" })).getAllByRole("button");
    expect(followUps.map((b) => b.textContent)).toEqual([
      "Show related clubs to follow",
      "Something this weekend",
      "During the week",
    ]);

    await userEvent.click(followUps[0]);
    expect(onFollowUp).toHaveBeenCalledWith("Show related clubs to follow");
  });

  it("shows no card row and no follow-ups for an answer without picks", () => {
    render(
      <AssistantMessage message={{ ...eventsAnswer, picks: [], content: "Nothing fits that yet." }} onFollowUp={() => {}} />,
    );
    expect(screen.queryByRole("list", { name: /^Recommended/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Follow-up prompts" })).not.toBeInTheDocument();
  });

  it("holds follow-ups back until the reply is complete", () => {
    render(<AssistantMessage message={{ ...eventsAnswer, status: "streaming" }} onFollowUp={() => {}} />);
    expect(screen.queryByRole("list", { name: "Follow-up prompts" })).not.toBeInTheDocument();
  });

  it("explains a failed reply and offers to try again", async () => {
    const onRetry = jest.fn();
    render(
      <AssistantMessage
        message={{ ...eventsAnswer, picks: [], content: "", status: "failed", error: "The planner is unavailable right now." }}
        onFollowUp={() => {}}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The planner is unavailable right now.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });
});
