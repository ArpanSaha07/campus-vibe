import { ApiError } from "@/app/lib/api";
import { getClubById } from "@/app/lib/club";
import { PUBLIC_READ_CACHE } from "@/app/lib/cache";
import type { ApiClub } from "@/app/types";

const mockApiFetch = jest.fn();

// ApiError is the real class — the whole point of these tests is the
// `instanceof` check inside getClubById, which a stubbed error would not
// exercise.
jest.mock("@/app/lib/api", () => {
  const actual = jest.requireActual("@/app/lib/api");
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

const apiClub: ApiClub = {
  id: "chess-club",
  name: "Chess Club",
  description: "Master the game of kings",
  followers: 45,
  logo: null,
  socialLinks: '{"email":"chess@campus.com"}',
  featured: false,
  images: [],
  createdAt: "2026-07-01T00:00:00Z",
  category: null,
  interests: [],
};

describe("getClubById", () => {
  beforeEach(() => jest.clearAllMocks());

  it("asks the API for the club and maps it to the UI shape", async () => {
    mockApiFetch.mockResolvedValue(apiClub);

    const club = await getClubById("chess-club");

    // The cache policy is part of the call, not decoration: a club read that
    // silently lost it would go back to hitting the backend on every render.
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/v1/clubs/chess-club",
      PUBLIC_READ_CACHE.clubs,
    );
    expect(club?.clubId).toBe("chess-club");
    expect(club?.name).toBe("Chess Club");
    expect(club?.socialLinks.email).toBe("chess@campus.com");
  });

  it("escapes the id rather than pasting it into the path", async () => {
    mockApiFetch.mockResolvedValue(apiClub);

    await getClubById("chess club/../admin");

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/v1/clubs/chess%20club%2F..%2Fadmin",
      PUBLIC_READ_CACHE.clubs,
    );
  });

  // The distinction the club page depends on: null routes to notFound(), a
  // throw routes to error.tsx. Collapsing them is what used to tell a user
  // their club had been deleted whenever the backend was merely down.
  it("returns null when no club has that id", async () => {
    mockApiFetch.mockRejectedValue(new ApiError(404, '{"message":"Club not found"}'));

    await expect(getClubById("no-such-club")).resolves.toBeNull();
  });

  it("rethrows a server error instead of reporting it as missing", async () => {
    mockApiFetch.mockRejectedValue(new ApiError(500, "Internal Server Error"));

    await expect(getClubById("chess-club")).rejects.toThrow(ApiError);
  });

  it("rethrows a network failure, which carries no status at all", async () => {
    mockApiFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(getClubById("chess-club")).rejects.toThrow("Failed to fetch");
  });
});

describe("ApiError", () => {
  it("keeps the response body as the message, so parseApiError still works", () => {
    const error = new ApiError(409, '{"message":"Already exists"}');

    expect(error.status).toBe(409);
    expect(error.message).toBe('{"message":"Already exists"}');
    expect(error).toBeInstanceOf(Error);
  });

  it("falls back to a readable message when the body is empty", () => {
    expect(new ApiError(503, "").message).toBe("Request failed: 503");
  });
});
