import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Toast from "@/app/components/ui/Toast";

/**
 * The hovering message a failed form submission surfaces in.
 *
 * Written after the fact: this shipped with the create-club rebuild and had no
 * coverage at all, having only ever been checked by hand in a browser.
 *
 * Two of these pin behaviour that is easy to break without noticing. The first
 * is that an empty message renders *nothing* — a toast frame containing no text
 * is worse than no toast, because it draws the eye and then says nothing. The
 * second is the timer's independence from the caller's identity: every caller
 * passes an inline arrow, so a toast whose auto-hide restarted on each render
 * would simply never close.
 */
describe("Toast", () => {
  it("renders nothing at all when there is no message", () => {
    const { container } = render(<Toast message={null} onDismiss={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for an empty message", () => {
    const { container } = render(<Toast message="" onDismiss={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces the message as an alert", () => {
    render(<Toast message="The server is not accepting new clubs right now." onDismiss={jest.fn()} />);

    // role=alert rather than a live region on a wrapper: the element mounts at
    // the moment there is something to say, which is what the role is for.
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The server is not accepting new clubs right now.");
  });

  it("calls onDismiss when the close control is used", async () => {
    const onDismiss = jest.fn();
    render(<Toast message="Something went wrong." onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  describe("auto-hide", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("dismisses itself once the delay has passed", () => {
      const onDismiss = jest.fn();
      render(<Toast message="Something went wrong." onDismiss={onDismiss} autoHideMs={8000} />);

      expect(onDismiss).not.toHaveBeenCalled();
      act(() => void jest.advanceTimersByTime(8000));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("stays up indefinitely when the delay is zero", () => {
      const onDismiss = jest.fn();
      render(<Toast message="Something went wrong." onDismiss={onDismiss} autoHideMs={0} />);

      act(() => void jest.advanceTimersByTime(600_000));
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it("does not restart the timer when the parent re-renders with a new callback", () => {
      // The real caller passes an inline arrow, so onDismiss is a different
      // function object on every render. Without the ref inside Toast, this
      // sequence keeps resetting the timeout and the toast never closes.
      const onDismiss = jest.fn();
      const { rerender } = render(
        <Toast message="Something went wrong." onDismiss={() => onDismiss()} autoHideMs={8000} />,
      );

      act(() => void jest.advanceTimersByTime(5000));
      rerender(<Toast message="Something went wrong." onDismiss={() => onDismiss()} autoHideMs={8000} />);
      act(() => void jest.advanceTimersByTime(3000));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("restarts the timer when the message itself changes", () => {
      // A second, different failure is a new thing to read, so it gets its own
      // full delay rather than inheriting the remainder of the first one's.
      const onDismiss = jest.fn();
      const { rerender } = render(
        <Toast message="First failure." onDismiss={onDismiss} autoHideMs={8000} />,
      );

      act(() => void jest.advanceTimersByTime(7000));
      rerender(<Toast message="Second failure." onDismiss={onDismiss} autoHideMs={8000} />);
      act(() => void jest.advanceTimersByTime(7000));
      expect(onDismiss).not.toHaveBeenCalled();

      act(() => void jest.advanceTimersByTime(1000));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
