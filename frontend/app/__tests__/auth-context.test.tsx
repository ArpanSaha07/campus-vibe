import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "@/app/lib/auth-context";
import { Role, type User } from "@/app/types";
import * as userLib from "@/app/lib/user";
import { setToken, clearToken } from "@/app/lib/api";

jest.mock("@/app/lib/user");

const mockedUserLib = userLib as jest.Mocked<typeof userLib>;

const testUser: User = {
  id: 1,
  name: "Test",
  email: "test@campus.com",
  roles: [Role.USER],
  createdAt: "2026-01-01T00:00:00Z",
    emailVerified: true,
    authProvider: "LOCAL",
};

function Probe() {
  const { user, loading, isAuthenticated, login, logout, refreshUser, applyUser } = useAuth();
  if (loading) return <p>loading</p>;
  return (
    <div>
      <p>{isAuthenticated ? `signed-in:${user?.email}` : "signed-out"}</p>
      <p>name:{user?.name ?? "none"}</p>
      <button onClick={() => login("test@campus.com", "password123")}>login</button>
      <button onClick={logout}>logout</button>
      <button onClick={() => void refreshUser()}>refresh</button>
      <button onClick={() => applyUser({ ...testUser, name: "Applied" })}>apply</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearToken();
  });

  it("starts signed out when no token is stored", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(await screen.findByText("signed-out")).toBeInTheDocument();
    expect(mockedUserLib.me).not.toHaveBeenCalled();
  });

  it("restores the session from a stored token via /me", async () => {
    setToken("stored-jwt");
    mockedUserLib.me.mockResolvedValueOnce(testUser);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    expect(await screen.findByText("signed-in:test@campus.com")).toBeInTheDocument();
  });

  it("clears the token when the stored token is rejected", async () => {
    setToken("expired-jwt");
    mockedUserLib.me.mockRejectedValueOnce(new Error("401"));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    expect(await screen.findByText("signed-out")).toBeInTheDocument();
    expect(localStorage.getItem("cv_jwt")).toBeNull();
  });

  it("login sets the user; logout clears user and token", async () => {
    mockedUserLib.login.mockResolvedValueOnce(testUser);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await screen.findByText("signed-out");

    await userEvent.click(screen.getByRole("button", { name: "login" }));
    expect(await screen.findByText("signed-in:test@campus.com")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "logout" }));
    await waitFor(() => {
      expect(screen.getByText("signed-out")).toBeInTheDocument();
      expect(localStorage.getItem("cv_jwt")).toBeNull();
    });
  });

  /*
   * `user` is fetched once, on mount. Everything below exists because the
   * profile editor can change the account after that -- renaming yourself
   * would otherwise leave the navbar and the profile header showing the old
   * name until a reload.
   */

  it("refreshUser re-reads the account and replaces the stored user", async () => {
    setToken("stored-jwt");
    mockedUserLib.me.mockResolvedValueOnce(testUser);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(await screen.findByText("name:Test")).toBeInTheDocument();

    mockedUserLib.me.mockResolvedValueOnce({ ...testUser, name: "Renamed" });
    await userEvent.click(screen.getByRole("button", { name: "refresh" }));

    expect(await screen.findByText("name:Renamed")).toBeInTheDocument();
  });

  it("refreshUser does nothing without a token", async () => {
    // Calling /me unauthenticated just 403s, and signing someone out over a
    // failed refresh would be a worse outcome than a stale name.
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await screen.findByText("signed-out");

    await userEvent.click(screen.getByRole("button", { name: "refresh" }));

    expect(mockedUserLib.me).not.toHaveBeenCalled();
    expect(screen.getByText("signed-out")).toBeInTheDocument();
  });

  it("applyUser adopts an already-fetched account without another request", async () => {
    // The cheaper path, for a caller that already holds the PATCH response.
    setToken("stored-jwt");
    mockedUserLib.me.mockResolvedValueOnce(testUser);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(await screen.findByText("name:Test")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "apply" }));

    expect(await screen.findByText("name:Applied")).toBeInTheDocument();
    expect(mockedUserLib.me).toHaveBeenCalledTimes(1);
  });
});
