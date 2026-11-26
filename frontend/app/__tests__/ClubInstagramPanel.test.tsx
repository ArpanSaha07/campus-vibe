import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClubInstagramPanel from "@/app/components/manage/ClubInstagramPanel";
import { toHandleInput } from "@/app/lib/club-instagram";
import type { ClubInstagram } from "@/app/types";

const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockImport = jest.fn();

jest.mock("@/app/lib/club-instagram", () => ({
  ...jest.requireActual("@/app/lib/club-instagram"),
  getClubInstagram: (...args: unknown[]) => mockGet(...args),
  updateClubInstagram: (...args: unknown[]) => mockUpdate(...args),
  importClubInstagramNow: (...args: unknown[]) => mockImport(...args),
}));

function state(overrides: Partial<ClubInstagram> = {}): ClubInstagram {
  return {
    handle: null,
    autoImport: false,
    importAvailable: true,
    running: false,
    lastImportedAt: null,
    nextImportAllowedAt: null,
    eventsFound: 0,
    lastRunStatus: null,
    lastRunPublished: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockGet.mockReset();
  mockUpdate.mockReset();
  mockImport.mockReset();
});

describe("toHandleInput", () => {
  it("strips @, the instagram.com prefix and any trailing path", () => {
    expect(toHandleInput("@mcgillchess")).toBe("mcgillchess");
    expect(toHandleInput("https://www.instagram.com/mcgillchess/?hl=en")).toBe("mcgillchess");
    expect(toHandleInput("  ")).toBe("");
  });
});

describe("ClubInstagramPanel", () => {
  it("asks for a handle when none is stored, with the controls below it locked", async () => {
    mockGet.mockResolvedValue(state());
    render(<ClubInstagramPanel clubId="chess" />);

    expect(await screen.findByLabelText(/Instagram handle/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /auto-import/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Import now/ })).toBeDisabled();
  });

  it("connects a handle and unlocks auto-import and Import now", async () => {
    mockGet.mockResolvedValue(state());
    mockUpdate.mockResolvedValue(state({ handle: "mcgillchess" }));
    render(<ClubInstagramPanel clubId="chess" />);

    await userEvent.type(await screen.findByLabelText(/Instagram handle/), "@McGillChess");
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(mockUpdate).toHaveBeenCalledWith("chess", { handle: "McGillChess" });
    expect(await screen.findByRole("link", { name: /@mcgillchess/ })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /auto-import/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Import now/ })).toBeEnabled();
  });

  it("shows a stored handle with a way to change it instead of an empty field", async () => {
    mockGet.mockResolvedValue(state({ handle: "mcgillchess" }));
    render(<ClubInstagramPanel clubId="chess" />);

    expect(await screen.findByRole("link", { name: /@mcgillchess/ })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Instagram handle/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Change account/ }));
    expect(screen.getByLabelText(/Instagram handle/)).toHaveValue("mcgillchess");
  });

  it("sends the toggle with the saved handle", async () => {
    mockGet.mockResolvedValue(state({ handle: "mcgillchess" }));
    mockUpdate.mockResolvedValue(state({ handle: "mcgillchess", autoImport: true }));
    render(<ClubInstagramPanel clubId="chess" />);

    await userEvent.click(await screen.findByRole("switch", { name: /auto-import/i }));

    expect(mockUpdate).toHaveBeenCalledWith("chess", { handle: "mcgillchess", autoImport: true });
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /auto-import/i })).toHaveAttribute("aria-checked", "true"),
    );
  });

  it("keeps Import now off during the cooldown and says until when", async () => {
    mockGet.mockResolvedValue(
      state({ handle: "mcgillchess", nextImportAllowedAt: "2030-01-01T15:00:00Z" }),
    );
    render(<ClubInstagramPanel clubId="chess" />);

    expect(await screen.findByText(/You can import again after/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Import now/ })).toBeDisabled();
  });

  it("starts an import of the club's handle and reports what it published", async () => {
    mockGet
      .mockResolvedValueOnce(state({ handle: "mcgillchess" }))
      .mockResolvedValue(
        state({ handle: "mcgillchess", lastRunStatus: "SUCCEEDED", lastRunPublished: 2 }),
      );
    mockImport.mockResolvedValue(
      state({ handle: "mcgillchess", running: true, lastRunStatus: "RUNNING" }),
    );
    render(<ClubInstagramPanel clubId="chess" />);

    await userEvent.click(await screen.findByRole("button", { name: /Import now/ }));

    expect(mockImport).toHaveBeenCalledWith("chess");
    expect(await screen.findByText(/Importing @mcgillchess now/)).toBeInTheDocument();
    expect(
      await screen.findByText(/Last import: 2 new events published/, {}, { timeout: 8000 }),
    ).toBeInTheDocument();
  }, 15000);

  it("does not start an import when the handle is saved", async () => {
    mockGet.mockResolvedValue(state());
    mockUpdate.mockResolvedValue(state({ handle: "mcgillchess" }));
    render(<ClubInstagramPanel clubId="chess" />);

    await userEvent.type(await screen.findByLabelText(/Instagram handle/), "mcgillchess");
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(await screen.findByText(/Press Import now/)).toBeInTheDocument();
    expect(mockImport).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Import now" })).toBeEnabled();
  });

  it("shows the server's message when Import now is refused", async () => {
    mockGet.mockResolvedValue(state({ handle: "mcgillchess" }));
    mockImport.mockRejectedValue(
      new Error(JSON.stringify({ message: "Your import is already running." })),
    );
    render(<ClubInstagramPanel clubId="chess" />);

    await userEvent.click(await screen.findByRole("button", { name: /Import now/ }));

    expect(await screen.findByText(/already running/)).toBeInTheDocument();
  });
});
