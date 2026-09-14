import {
  emptyProfile,
  getNotificationPreferences,
  getProfile,
  saveNotificationPreferences,
  saveProfile,
} from "@/app/lib/profile";
import { apiFetch } from "@/app/lib/api";

jest.mock("@/app/lib/api", () => ({ apiFetch: jest.fn() }));

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

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
