import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminInstagramImport from "@/app/components/admin/AdminInstagramImport";
import type { AdminInstagram } from "@/app/types";

const mockGet = jest.fn();
const mockSetCount = jest.fn();
const mockImport = jest.fn();

jest.mock("@/app/lib/admin-instagram", () => ({
  getAdminInstagram: (...args: unknown[]) => mockGet(...args),
  setInstagramAccountCount: (...args: unknown[]) => mockSetCount(...args),
  startAdminInstagramImport: (...args: unknown[]) => mockImport(...args),
}));

function state(overrides: Partial<AdminInstagram> = {}): AdminInstagram {
  return {
    accountCount: 50,
    totalAccounts: 463,
    clubOptIns: 0,
    importAvailable: true,
    running: false,
    recentRuns: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockGet.mockReset();
  mockSetCount.mockReset();
  mockImport.mockReset();
});

describe("AdminInstagramImport", () => {
  it("shows N and saves a new one", async () => {
    mockGet.mockResolvedValue(state());
    mockSetCount.mockResolvedValue(state({ accountCount: 120 }));
    render(<AdminInstagramImport />);

    const input = await screen.findByLabelText("Number of accounts");
    expect(input).toHaveValue(50);
    await userEvent.clear(input);
    await userEvent.type(input, "120");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mockSetCount).toHaveBeenCalledWith(120);
    expect(await screen.findByText(/Runs now check the first 120 accounts/)).toBeInTheDocument();
  });

  it("refuses an N larger than the list without calling the server", async () => {
    mockGet.mockResolvedValue(state());
    render(<AdminInstagramImport />);

    const input = await screen.findByLabelText("Number of accounts");
    await userEvent.clear(input);
    await userEvent.type(input, "900");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mockSetCount).not.toHaveBeenCalled();
    expect(await screen.findByText(/from 1 to 463/)).toBeInTheDocument();
  });

  it("starts an import over the first N accounts", async () => {
    mockGet.mockResolvedValue(state());
    mockImport.mockResolvedValue(state({ running: true }));
    render(<AdminInstagramImport />);

    await userEvent.click(await screen.findByRole("button", { name: /Import now/ }));

    expect(mockImport).toHaveBeenCalled();
    expect(await screen.findByText(/A run is going/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importing/ })).toBeDisabled();
  });

  it("lists recent runs, naming a club's own run by its handle", async () => {
    mockGet.mockResolvedValue(
      state({
        recentRuns: [
          {
            id: 2, trigger: "MANUAL", status: "SUCCEEDED",
            startedAt: "2026-11-26T17:42:55Z", finishedAt: "2026-11-26T17:43:54Z",
            accountsRequested: 1, storiesFetched: 7, postsFetched: 3,
            eventsFound: 6, eventsPublished: 1, failures: 0,
            handle: "girlswhocodemcgill", error: null,
          },
          {
            id: 1, trigger: "SCHEDULED", status: "SUCCEEDED",
            startedAt: "2026-11-26T17:25:34Z", finishedAt: "2026-11-26T17:34:24Z",
            accountsRequested: 50, storiesFetched: 68, postsFetched: 110,
            eventsFound: 58, eventsPublished: 29, failures: 0,
            handle: null, error: null,
          },
        ],
      }),
    );
    render(<AdminInstagramImport />);

    expect(await screen.findByText("Club: @girlswhocodemcgill")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("68 stories · 110 posts")).toBeInTheDocument();
  });

  it("keeps Import now off when the server cannot import", async () => {
    mockGet.mockResolvedValue(state({ importAvailable: false }));
    render(<AdminInstagramImport />);

    expect(await screen.findByRole("button", { name: /Import now/ })).toBeDisabled();
    expect(screen.getByText(/isn't switched on for this server/)).toBeInTheDocument();
  });
});
