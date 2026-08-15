import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchBar from "@/app/components/SearchBar";
import { searchClubs, searchEvents } from "@/app/lib/search";
import { toClub, toEventInstance } from "@/app/lib/adapters";

jest.mock("@/app/lib/search");

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockedSearchEvents = searchEvents as jest.MockedFunction<typeof searchEvents>;
const mockedSearchClubs = searchClubs as jest.MockedFunction<typeof searchClubs>;

const chessEvent = toEventInstance({
  id: 1,
  title: "Chess Night",
  description: "Blitz games",
  dateTime: "2026-08-01T18:00:00Z",
  createdAt: "2026-07-01T00:00:00Z",
  location: "Student Hall",
  price: "Free",
  organizerId: "chess-club",
  organizerName: "Chess Club",
  followers: 0,
  images: [],
  promoted: false,
  capacity: 20,
  registered: 5,
  categories: [],
});

const chessClub = toClub({
  id: "chess-club",
  name: "Chess Club",
  description: "Kings and queens",
  followers: 45,
  logo: null,
  socialLinks: null,
  featured: false,
  images: [],
  createdAt: "2026-07-01T00:00:00Z",
});

describe("SearchBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSearchEvents.mockResolvedValue([chessEvent]);
    mockedSearchClubs.mockResolvedValue([chessClub]);
  });

  it("debounces typing and shows grouped event and club results", async () => {
    render(<SearchBar />);
    const input = screen.getByRole("textbox", { name: /search events and clubs/i });

    await userEvent.type(input, "chess");

    expect(await screen.findByText("Chess Night")).toBeInTheDocument();
    expect(screen.getByText("Chess Club")).toBeInTheDocument();
    expect(screen.getByText("Events")).toBeInTheDocument();
    expect(screen.getByText("Clubs")).toBeInTheDocument();

    // Debounce: one request after typing stops, not one per keystroke
    expect(mockedSearchEvents).toHaveBeenCalledTimes(1);
    expect(mockedSearchEvents).toHaveBeenCalledWith("chess", 5);
  });

  it("does not search below the minimum query length", async () => {
    render(<SearchBar />);
    await userEvent.type(screen.getByRole("textbox"), "c");

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(mockedSearchEvents).not.toHaveBeenCalled();
  });

  it("submits to the full results page", async () => {
    render(<SearchBar />);
    const input = screen.getByRole("textbox");

    await userEvent.type(input, "ai networking{enter}");

    expect(mockPush).toHaveBeenCalledWith("/events?q=ai%20networking");
  });

  it("shows an empty state when nothing matches", async () => {
    mockedSearchEvents.mockResolvedValue([]);
    mockedSearchClubs.mockResolvedValue([]);
    render(<SearchBar />);

    await userEvent.type(screen.getByRole("textbox"), "zzzz");

    expect(await screen.findByText(/no matches for/i)).toBeInTheDocument();
  });

  it("closes the panel and navigates when a result is clicked", async () => {
    render(<SearchBar />);
    await userEvent.type(screen.getByRole("textbox"), "chess");

    const link = await screen.findByText("Chess Night");
    expect(link.closest("a")).toHaveAttribute("href", "/events/1");

    await userEvent.click(link);
    await waitFor(() =>
      expect(screen.queryByText("Events")).not.toBeInTheDocument()
    );
  });
});
