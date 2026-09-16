import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlannerChat from "@/app/components/planner/PlannerChat";
import { PlannerProvider } from "@/app/components/planner/PlannerProvider";
import { ApiError } from "@/app/lib/api";
import { toEventInstance } from "@/app/lib/adapters";
import { PLANNER_PROMPT_KEY } from "@/app/lib/planner";
import * as plannerApi from "@/app/lib/planner-api";

jest.mock("@/app/lib/planner-api", () => {
  const actual = jest.requireActual("@/app/lib/planner-api");
  return {
    ...actual,
    listConversations: jest.fn(),
    createConversation: jest.fn(),
    getConversation: jest.fn(),
    deleteConversation: jest.fn(),
    getUsage: jest.fn(),
    sendPlannerMessage: jest.fn(),
  };
});

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  usePathname: () => "/planner",
}));

let authenticated = true;
jest.mock("@/app/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: authenticated, loading: false }),
}));

const mockOpenAuth = jest.fn();
jest.mock("@/app/lib/auth-modal-context", () => ({
  useAuthModal: () => ({ openAuth: mockOpenAuth }),
}));

jest.mock("@/app/components/event/EventCard", () => ({
  __esModule: true,
  default: ({ event }: { event: { title: string } }) => <div data-testid="event-card">{event.title}</div>,
}));

const api = plannerApi as jest.Mocked<typeof plannerApi>;

const usage = (used: number) => ({ used, limit: 15, resetsAt: new Date(2026, 8, 17) });
const summary = { id: "c-1", title: "", lastActiveAt: new Date(2026, 8, 16, 15) };

const hackNight = toEventInstance({
  id: 7,
  title: "AI Hack Night",
  description: null,
  dateTime: "2026-09-18T22:00:00Z",
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

function renderNewChat(initialPrompt = "") {
  return render(
    <PlannerProvider>
      <PlannerChat conversationId={null} initialPrompt={initialPrompt} />
    </PlannerProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  authenticated = true;
  sessionStorage.clear();
  Element.prototype.scrollIntoView = jest.fn();
  api.listConversations.mockResolvedValue({ conversations: [], usage: usage(2) });
  api.createConversation.mockResolvedValue({ conversation: summary, evictedId: null });
  api.getUsage.mockResolvedValue(usage(2));
});

describe("PlannerChat", () => {
  it("creates the chat on the first message, moves to its URL and streams the answer in", async () => {
    api.sendPlannerMessage.mockImplementation(async (_id, _text, { onDelta }) => {
      onDelta("Here's a weekend ");
      onDelta("for you.");
      return {
        messageId: "m-2",
        picks: [{ kind: "event", reason: "matches your AI interest.", event: hackNight }],
        usage: usage(3),
        conversation: { ...summary, title: "Plan my weekend" },
      };
    });
    const { rerender } = renderNewChat();

    const box = await screen.findByRole("textbox");
    await userEvent.type(box, "Plan my weekend{Enter}");

    await waitFor(() => expect(api.createConversation).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith("/planner/c-1");
    expect(api.sendPlannerMessage).toHaveBeenCalledWith("c-1", "Plan my weekend", expect.any(Object));

    // What the new URL renders: the provider already holds the thread, so
    // nothing is fetched and the streamed answer is there.
    rerender(
      <PlannerProvider>
        <PlannerChat conversationId="c-1" />
      </PlannerProvider>,
    );
    expect(await screen.findByText("Here's a weekend for you.")).toBeInTheDocument();
    expect(screen.getByText("Plan my weekend")).toBeInTheDocument();
    expect(screen.getByTestId("event-card")).toHaveTextContent("AI Hack Night");
    expect(screen.getByText("12 of 15 messages left today", { exact: false })).toBeInTheDocument();
    expect(api.getConversation).not.toHaveBeenCalled();
  });

  it("marks the reply failed with a reason when the daily limit refuses it", async () => {
    api.sendPlannerMessage.mockRejectedValue(new ApiError(429, ""));
    const { rerender } = renderNewChat();

    await userEvent.type(await screen.findByRole("textbox"), "Plan my weekend{Enter}");
    await waitFor(() => expect(api.sendPlannerMessage).toHaveBeenCalled());
    rerender(
      <PlannerProvider>
        <PlannerChat conversationId="c-1" />
      </PlannerProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("You've used all of today's messages.");
    expect(api.getUsage).toHaveBeenCalled();
  });

  it("sends the homepage prompt once the planner is ready", async () => {
    api.sendPlannerMessage.mockResolvedValue({
      messageId: "m-2",
      picks: [],
      usage: usage(3),
      conversation: summary,
    });
    renderNewChat("Find free events happening this week");

    await waitFor(() =>
      expect(api.sendPlannerMessage).toHaveBeenCalledWith("c-1", "Find free events happening this week", expect.any(Object)),
    );
    expect(api.sendPlannerMessage).toHaveBeenCalledTimes(1);
  });

  it("keeps a guest's message and asks them to sign in instead of sending it", async () => {
    authenticated = false;
    renderNewChat();

    await userEvent.type(await screen.findByRole("textbox"), "Plan my weekend{Enter}");

    expect(await screen.findByText(/Your message is kept/)).toBeInTheDocument();
    expect(sessionStorage.getItem(PLANNER_PROMPT_KEY)).toBe("Plan my weekend");
    expect(api.createConversation).not.toHaveBeenCalled();
  });

  it("puts the message back and explains when the chat cannot be started", async () => {
    api.createConversation.mockRejectedValue(new ApiError(503, ""));
    renderNewChat();

    const box = await screen.findByRole("textbox");
    await userEvent.type(box, "Plan my weekend{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("The planner is unavailable right now.");
    expect(box).toHaveValue("Plan my weekend");
  });

  it("shows the unavailable state when the chat list cannot be loaded", async () => {
    api.listConversations.mockRejectedValue(new ApiError(404, ""));
    renderNewChat();

    expect(await screen.findByText("The planner is unavailable")).toBeInTheDocument();
  });

  it("disables the box when today's messages are used up", async () => {
    api.listConversations.mockResolvedValue({ conversations: [], usage: usage(15) });
    renderNewChat();

    expect(await screen.findByText("0 of 15 messages left today")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
