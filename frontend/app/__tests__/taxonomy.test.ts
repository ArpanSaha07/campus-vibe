import {
  getClubCategories,
  getEventFormats,
  getInterests,
  labelFor,
} from "@/app/lib/taxonomy";
import { apiFetch } from "@/app/lib/api";

jest.mock("@/app/lib/api", () => ({ apiFetch: jest.fn() }));

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

/**
 * The three vocabularies are the one part of this API that is deliberately
 * anonymous *and* deliberately cached. Both halves are easy to break silently:
 * adding `auth: true` would make `apiFetch` refuse the cache policy outright,
 * and dropping the policy would re-fetch a list that only changes when a
 * migration runs.
 */
describe("taxonomy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApiFetch.mockResolvedValue([] as never);
  });

  it.each([
    ["/api/v1/interests", getInterests],
    ["/api/v1/club-categories", getClubCategories],
    ["/api/v1/event-formats", getEventFormats],
  ])("reads %s without a token and with a cache policy", async (path, call) => {
    await call();
    expect(mockedApiFetch).toHaveBeenCalledWith(path, { revalidate: 3600 });
  });

  it("never sends a token for a vocabulary", async () => {
    await getInterests();
    await getClubCategories();
    await getEventFormats();

    for (const [, options] of mockedApiFetch.mock.calls) {
      // apiFetch throws outright on auth + a cache policy, so this would be a
      // runtime failure rather than a slow leak -- but the assertion names why.
      expect(options ?? {}).not.toHaveProperty("auth");
    }
  });
});

describe("labelFor", () => {
  const vocabulary = [
    { slug: "ai-machine-learning", label: "AI & machine learning" },
    { slug: "chess", label: "Chess" },
  ];

  it("turns a stored slug into the words a human reads", () => {
    expect(labelFor(vocabulary, "ai-machine-learning")).toBe("AI & machine learning");
  });

  // A retired entry that something is still tagged with. Showing the slug is
  // poor; showing nothing hides that the tag is there at all, which is worse --
  // not least because it is the only clue that the vocabulary lost an entry.
  it("falls back to the slug rather than dropping an unknown tag", () => {
    expect(labelFor(vocabulary, "competitive-napping")).toBe("competitive-napping");
  });
});
