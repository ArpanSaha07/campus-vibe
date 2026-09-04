import {
  emptyProfile,
  getNotificationPreferences,
  getProfile,
  normaliseProfileLink,
  saveNotificationPreferences,
  saveProfile,
} from "@/app/lib/profile";
import { apiFetch } from "@/app/lib/api";

jest.mock("@/app/lib/api", () => ({ apiFetch: jest.fn() }));

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

// The rejections are the point of this suite. normaliseProfileLink is the only
// thing between a string a user typed and an href, so each case below is a
// stored-XSS vector if it ever starts returning non-null.
describe("normaliseProfileLink", () => {
  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)  ",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
  ])("refuses %s", (value) => {
    expect(normaliseProfileLink(value)).toBeNull();
  });

  it("refuses nothing at all", () => {
    expect(normaliseProfileLink(null)).toBeNull();
    expect(normaliseProfileLink(undefined)).toBeNull();
    expect(normaliseProfileLink("")).toBeNull();
    expect(normaliseProfileLink("   ")).toBeNull();
  });

  it("keeps an absolute https link", () => {
    expect(normaliseProfileLink("https://instagram.com/someone")).toBe(
      "https://instagram.com/someone",
    );
  });

  it("keeps http rather than silently upgrading it", () => {
    expect(normaliseProfileLink("http://example.com/someone")).toBe(
      "http://example.com/someone",
    );
  });

  // The friendly case: almost nobody types a scheme.
  it("assumes https when no scheme is given", () => {
    expect(normaliseProfileLink("instagram.com/someone")).toBe(
      "https://instagram.com/someone",
    );
  });

  // Guards the ordering inside the function. Prepend https before testing the
  // scheme and this returns 'https://javascript:alert(1)' — an https URL, so
  // the scheme check still passes and the value still reaches an href.
  it("does not disguise a bad scheme by prepending https", () => {
    expect(normaliseProfileLink("javascript:alert(1)")).toBeNull();
  });
});

/**
 * The request shapes, not the responses.
 *
 * Two things here are load-bearing and easy to break silently. Every per-user
 * call must set `auth: true` -- omit it and `apiFetch` sends the request
 * anonymously, which 403s rather than failing at the type level. And none of
 * them may pass a cache policy: `apiFetch` throws on `auth` + `revalidate`
 * because the data cache is keyed on the URL, so one student's profile would be
 * served to the next caller.
 */
describe("profile API calls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApiFetch.mockResolvedValue(undefined as never);
  });

  it("reads the profile as the signed-in user", async () => {
    await getProfile();
    expect(mockedApiFetch).toHaveBeenCalledWith("/api/v1/users/me/profile", { auth: true });
  });

  it("saves the profile with PUT, because the write replaces everything", async () => {
    const profile = emptyProfile();
    await saveProfile(profile);

    expect(mockedApiFetch).toHaveBeenCalledWith("/api/v1/users/me/profile", {
      method: "PUT",
      body: JSON.stringify(profile),
      auth: true,
    });
  });

  it("reads and writes notification preferences as the signed-in user", async () => {
    await getNotificationPreferences();
    expect(mockedApiFetch).toHaveBeenCalledWith("/api/v1/users/me/notification-preferences", {
      auth: true,
    });

    const preferences = {
      eventReminders: false,
      clubAnnouncements: false,
      weeklyDigest: false,
      newFollowerEvents: false,
      productNews: false,
    };
    await saveNotificationPreferences(preferences);
    expect(mockedApiFetch).toHaveBeenCalledWith("/api/v1/users/me/notification-preferences", {
      method: "PUT",
      body: JSON.stringify(preferences),
      auth: true,
    });
  });

  it("never asks for an authenticated response to be cached", async () => {
    await getProfile();
    await saveProfile(emptyProfile());
    await getNotificationPreferences();

    for (const [, options] of mockedApiFetch.mock.calls) {
      expect(options ?? {}).not.toHaveProperty("revalidate");
      expect(options ?? {}).not.toHaveProperty("tags");
    }
  });
});
