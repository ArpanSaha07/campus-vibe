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
  const { user, loading, isAuthenticated, login, logout } = useAuth();
  if (loading) return <p>loading</p>;
  return (
    <div>
      <p>{isAuthenticated ? `signed-in:${user?.email}` : "signed-out"}</p>
      <button onClick={() => login("test@campus.com", "password123")}>login</button>
      <button onClick={logout}>logout</button>
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
});
