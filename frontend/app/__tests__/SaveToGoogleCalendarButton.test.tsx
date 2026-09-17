import { render, screen } from "@testing-library/react";
import Button from "@/app/components/ui/Button";

describe("Button", () => {
  it("opens an external href in a new tab without handing over the opener", () => {
    render(
      <Button href="https://calendar.google.com/calendar/render?action=TEMPLATE" external>
        Save this event to your calendar
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Save this event to your calendar" });
    expect(link).toHaveAttribute("href", "https://calendar.google.com/calendar/render?action=TEMPLATE");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("keeps an internal href in the same tab", () => {
    render(<Button href="/events">Browse events</Button>);

    const link = screen.getByRole("link", { name: "Browse events" });
    expect(link).toHaveAttribute("href", "/events");
    expect(link).not.toHaveAttribute("target");
  });
});
