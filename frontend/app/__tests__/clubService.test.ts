import { createClub } from "@/app/lib/services/clubService";
import type { ApiClub } from "@/app/types";

const mockApiFetch = jest.fn();

jest.mock("@/app/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const apiClub = {
  id: "rooftop-astronomy-club",
  name: "Rooftop Astronomy Club",
  description: "Telescopes on the roof",
  followers: 0,
  logo: null,
  socialLinks: null,
  featured: false,
  images: [],
  createdAt: "2026-09-10T00:00:00Z",
  category: null,
  interests: [],
} as unknown as ApiClub;

/**
 * The POST body `createClub` builds.
 *
 * Worth its own test for the same reason the interests wiring was: the form
 * tests stop at `createClubWithMedia`, so everything below that call could drop
 * a field with the whole suite green. `officialEmail` is exactly that kind of
 * field — nothing on the create form reads it back, and its absence looks like
 * a club that simply has no address rather than like a bug.
 */
describe("createClub", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFetch.mockResolvedValue(apiClub);
  });

  function bodyOf(): Record<string, unknown> {
    const [, options] = mockApiFetch.mock.calls[0];
    return JSON.parse((options as { body: string }).body);
  }

  const club = {
    name: "Rooftop Astronomy Club",
    description: "Telescopes on the roof",
    category: null,
    interests: [],
  };

  it("seeds the club's official email from the address it is given", async () => {
    await createClub({ ...club, officialEmail: "hello@astronomy.ca" });
    expect(bodyOf().officialEmail).toBe("hello@astronomy.ca");
  });

  it("sends null rather than an empty string when there is no address", async () => {
    // A club with no official email is the state every club was in before this
    // was seeded, and the column is nullable. An empty string would be a club
    // claiming an address it does not have.
    await createClub({ ...club, officialEmail: "   " });
    expect(bodyOf().officialEmail).toBeNull();

    mockApiFetch.mockClear();
    await createClub(club);
    expect(bodyOf().officialEmail).toBeNull();
  });

  it("derives the slug and sends it as the club id", async () => {
    await createClub(club);
    expect(bodyOf().id).toBe("rooftop-astronomy-club");
  });

  it("sends the write as the signed-in user and never asks for it to be cached", async () => {
    await createClub(club);
    const [url, options] = mockApiFetch.mock.calls[0];
    expect(url).toBe("/api/v1/clubs");
    expect(options).toMatchObject({ method: "POST", auth: true });
    expect(options).not.toHaveProperty("revalidate");
    expect(options).not.toHaveProperty("tags");
  });
});
