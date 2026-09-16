import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlannerComposer from "@/app/components/planner/PlannerComposer";

function Harness({
  onSubmit,
  messagesLeft = 12,
  streaming = false,
  onStop,
}: {
  onSubmit: (text: string) => void;
  messagesLeft?: number | null;
  streaming?: boolean;
  onStop?: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <PlannerComposer
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
      onStop={onStop}
      streaming={streaming}
      messagesLeft={messagesLeft}
      limit={15}
      placeholder="What would you like to plan?"
    />
  );
}

describe("PlannerComposer", () => {
  it("sends on Enter", async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.type(screen.getByRole("textbox"), "Plan my weekend{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("Plan my weekend");
  });

  it("starts a new line on Shift+Enter instead of sending", async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    const box = screen.getByRole("textbox");
    await userEvent.type(box, "Friday{Shift>}{Enter}{/Shift}Saturday");
    expect(box).toHaveValue("Friday\nSaturday");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not send a blank message", async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.type(screen.getByRole("textbox"), "   {Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("is disabled, and says why, with no messages left today", () => {
    render(<Harness onSubmit={jest.fn()} messagesLeft={0} />);

    const box = screen.getByRole("textbox");
    expect(box).toBeDisabled();
    expect(box.getAttribute("placeholder")).toMatch(/reset at midnight/);
    expect(screen.getByText("0 of 15 messages left today")).toBeInTheDocument();
  });

  it("turns send into stop while a reply streams", async () => {
    const onStop = jest.fn();
    render(<Harness onSubmit={jest.fn()} streaming onStop={onStop} />);

    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Stop the reply" }));
    expect(onStop).toHaveBeenCalled();
  });
});
