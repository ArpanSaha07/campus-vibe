import { render, screen } from "@testing-library/react";
import EventCard from "@/app/components/event/EventCard";
import type { EventInstance } from "@/app/types";

jest.mock("@/app/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: false, loading: false }),
}));
jest.mock("@/app/lib/auth-modal-context", () => ({
  useAuthModal: () => ({ openAuth: jest.fn() }),
}));
jest.mock("@/app/lib/event", () => ({ saveEvent: jest.fn(), unsaveEvent: jest.fn() }));

function event(overrides: Partial<EventInstance> = {}): EventInstance {
  return {
    eventId: "42",
    title: "Campus to Careers",
    details: "",
    dateTime: new Date("2026-11-28T18:00:00Z"),
    endTime: new Date("2026-11-28T20:00:00Z"),
    createdAt: new Date("2026-11-26T17:00:00Z"),
    location: { name: "Online", address: "", mapUrl: "" },
    price: "Free",
    organizer: "frosh",
    organizerName: "Frosh",
    followers: 0,
    images: [],
    promoted: false,
    capacity: 0,
    registered: 0,
    topics: [],
    formats: [],
    ...overrides,
  };
}

describe("EventCard", () => {
  it("opens the event page for an event imported from Instagram, not the post", () => {
    render(<EventCard event={event({ sourceUrl: "https://www.instagram.com/p/Df6RemWG3Sf/" })} />);

    const link = screen.getByRole("link", { name: /Campus to Careers/ });
    expect(link).toHaveAttribute("href", "/events/42");
    expect(link).not.toHaveAttribute("target");
    expect(screen.queryByText(/View on Instagram/)).not.toBeInTheDocument();
    expect(document.querySelector('a[href*="instagram.com"]')).toBeNull();
  });

  it("opens the event page for an ordinary event", () => {
    render(<EventCard event={event()} />);

    expect(screen.getByRole("link", { name: /Campus to Careers/ })).toHaveAttribute("href", "/events/42");
  });
});
