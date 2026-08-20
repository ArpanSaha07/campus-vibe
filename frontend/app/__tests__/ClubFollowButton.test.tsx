import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClubFollowButton from "@/app/components/club/ClubFollowButton";
import AuthModal from "@/app/components/auth-components/AuthModal";
import { AuthModalProvider } from "@/app/lib/auth-modal-context";
import { FollowedClubsProvider } from "@/app/lib/followed-clubs-context";
import type { Club } from "@/app/types";

const mockGetMyClubs = jest.fn();
const mockFollowClub = jest.fn();
const mockUnfollowClub = jest.fn();

jest.mock("@/app/lib/club", () => ({
  getMyClubs: (...args: unknown[]) => mockGetMyClubs(...args),
  followClub: (...args: unknown[]) => mockFollowClub(...args),
  unfollowClub: (...args: unknown[]) => mockUnfollowClub(...args),
}));

// Auth is the switch the whole component turns on, so it is set per test rather
// than mocked once with a fixed answer.
let authenticated = false;
jest.mock("@/app/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: authenticated, loading: false }),
}));

function club(clubId: string, name: string): Club {
  return {
    clubId,
    name,
    description: "",
    followers: 0,
    logo: "",
    socialLinks: { email: "" },
    featured: false,
    images: [],
    category: null,
  interests: [],
  createdAt: new Date("2026-07-01T00:00:00Z"),
  };
}

function renderButton(clubId = "chess-club") {
  return render(
    <AuthModalProvider>
      <FollowedClubsProvider>
        <ClubFollowButton clubId={clubId} />
        <AuthModal />
      </FollowedClubsProvider>
    </AuthModalProvider>,
  );
}

/** The button once the followed list has settled and it is clickable again. */
async function readyButton() {
  const button = await screen.findByRole("button", { name: /^Follow(ing)?$/ });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

describe("ClubFollowButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authenticated = false;
    mockGetMyClubs.mockResolvedValue([]);
    mockFollowClub.mockResolvedValue(undefined);
    mockUnfollowClub.mockResolvedValue(undefined);
  });

  describe("signed out", () => {
    it("asks the visitor to sign up, naming the club action", async () => {
      renderButton();

      await userEvent.click(await readyButton());

      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveAccessibleName("Sign up to follow this club");
    });

    it("does not write anything, and does not even ask who is following", async () => {
      renderButton();

      await userEvent.click(await readyButton());

      expect(mockFollowClub).not.toHaveBeenCalled();
      expect(mockUnfollowClub).not.toHaveBeenCalled();
      // Nothing is fetched for a signed-out visitor either — the answer is
      // known without a round trip.
      expect(mockGetMyClubs).not.toHaveBeenCalled();
    });

    it("still reads Follow afterwards, since nothing was followed", async () => {
      renderButton();

      const button = await readyButton();
      await userEvent.click(button);

      expect(button).toHaveTextContent("Follow");
      expect(button).toHaveAttribute("aria-pressed", "false");
    });
  });

  describe("signed in", () => {
    beforeEach(() => {
      authenticated = true;
    });

    it("reads Follow for a club the user does not follow", async () => {
      mockGetMyClubs.mockResolvedValue([club("drama-troupe", "Drama Troupe")]);

      renderButton();

      const button = await readyButton();
      expect(button).toHaveTextContent("Follow");
      expect(button).toHaveAttribute("aria-pressed", "false");
    });

    it("reads Following for a club already in the user's list", async () => {
      mockGetMyClubs.mockResolvedValue([club("chess-club", "Chess Club")]);

      renderButton();

      const button = await readyButton();
      expect(button).toHaveTextContent("Following");
      expect(button).toHaveAttribute("aria-pressed", "true");
    });

    it("follows on click, without raising the signup card", async () => {
      renderButton();

      await userEvent.click(await readyButton());

      expect(mockFollowClub).toHaveBeenCalledWith("chess-club");
      expect(await screen.findByRole("button", { name: "Following" })).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("unfollows a club it is already following", async () => {
      mockGetMyClubs.mockResolvedValue([club("chess-club", "Chess Club")]);

      renderButton();
      await userEvent.click(await readyButton());

      expect(mockUnfollowClub).toHaveBeenCalledWith("chess-club");
      expect(mockFollowClub).not.toHaveBeenCalled();
      expect(await screen.findByRole("button", { name: "Follow" })).toBeInTheDocument();
    });

    it("puts the label back when the follow request fails", async () => {
      mockFollowClub.mockRejectedValue(new Error("network"));

      renderButton();
      await userEvent.click(await readyButton());

      // Optimistic while in flight, reverted once the server refuses — the
      // button must not claim a follow the database never recorded.
      expect(await screen.findByRole("button", { name: "Follow" })).toBeInTheDocument();
    });

    it("puts the label back when the unfollow request fails", async () => {
      mockGetMyClubs.mockResolvedValue([club("chess-club", "Chess Club")]);
      mockUnfollowClub.mockRejectedValue(new Error("network"));

      renderButton();
      await userEvent.click(await readyButton());

      expect(await screen.findByRole("button", { name: "Following" })).toBeInTheDocument();
    });

    it("treats an unreadable follow list as following nothing", async () => {
      mockGetMyClubs.mockRejectedValue(new Error("500"));

      renderButton();

      // Following again is idempotent server-side, so guessing "not following"
      // is the recoverable guess; guessing "Following" would offer an unfollow
      // that does nothing.
      const button = await readyButton();
      expect(button).toHaveTextContent("Follow");
    });
  });
});
