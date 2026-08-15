import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthModal from "@/app/components/auth-components/AuthModal";
import {
  AuthModalProvider,
  useAuthModal,
  type AuthModalView,
} from "@/app/lib/auth-modal-context";

const mockLogin = jest.fn();
const mockRegister = jest.fn();
const mockGoogleSignIn = jest.fn();

jest.mock("@/app/lib/auth-context", () => ({
  useAuth: () => ({
    login: mockLogin,
    register: mockRegister,
    googleSignIn: mockGoogleSignIn,
  }),
}));

// NEXT_PUBLIC_GOOGLE_CLIENT_ID is unset under test, so GoogleAuthButton renders
// its "not configured" notice instead of reaching for the GIS script. That is
// the intended behaviour for an environment without a client id, and it keeps
// these tests off the network.

function Harness({ view, title }: { view?: AuthModalView; title?: string }) {
  const { openAuth } = useAuthModal();
  return (
    <button type="button" onClick={() => openAuth(view, title)}>
      trigger
    </button>
  );
}

function renderModal(props: { view?: AuthModalView; title?: string } = {}) {
  return render(
    <AuthModalProvider>
      <Harness {...props} />
      <AuthModal />
    </AuthModalProvider>
  );
}

async function open(props: { view?: AuthModalView; title?: string } = {}) {
  renderModal(props);
  await userEvent.click(screen.getByRole("button", { name: "trigger" }));
}

describe("AuthModal", () => {
  beforeEach(() => jest.clearAllMocks());

  it("stays closed until something opens it", () => {
    renderModal();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens on the signup view and uses the caller's contextual headline", async () => {
    await open({ view: "signup", title: "Sign up to save events" });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Sign up to save events" })
    ).toBeInTheDocument();
  });

  it("falls back to a generic headline when the trigger has nothing specific to say", async () => {
    await open({ view: "signup" });
    expect(screen.getByRole("heading", { name: "Sign up to CampusVibe" })).toBeInTheDocument();
  });

  it("goes signup -> email form and back again", async () => {
    await open({ view: "signup" });

    await userEvent.click(screen.getByRole("button", { name: "Sign up with email" }));
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Sign up with email" })).toBeInTheDocument();
  });

  it("crosses between signup and login in both directions", async () => {
    await open({ view: "signup" });

    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByRole("heading", { name: "Log in to CampusVibe" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sign up" }));
    expect(screen.getByRole("heading", { name: "Sign up to CampusVibe" })).toBeInTheDocument();
  });

  it("reaches recover password from login and backs out to login", async () => {
    await open({ view: "login" });

    await userEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByRole("heading", { name: "Recover password" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Log in to CampusVibe" })).toBeInTheDocument();
  });

  it("shows no back arrow on the two entry views", async () => {
    await open({ view: "login" });
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("closes on the X and on Escape", async () => {
    await open({ view: "login" });

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "trigger" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape even when focus has fallen outside the card", async () => {
    await open({ view: "login" });

    // Clicking a heading or a divider drops focus to <body>, where a keydown
    // never reaches a handler bound to the overlay element.
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("submits login credentials and closes on success", async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    await open({ view: "login" });

    await userEvent.type(screen.getByLabelText("Email"), "student@campus.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(mockLogin).toHaveBeenCalledWith("student@campus.com", "password123");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks an invalid login before it reaches the API", async () => {
    await open({ view: "login" });

    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps the card open and shows the backend message when login fails", async () => {
    mockLogin.mockRejectedValueOnce(new Error(JSON.stringify({ message: "Invalid credentials" })));
    await open({ view: "login" });

    await userEvent.type(screen.getByLabelText("Email"), "student@campus.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-pass");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("registers from the email form and closes on success", async () => {
    mockRegister.mockResolvedValueOnce(undefined);
    await open({ view: "signup-email" });

    await userEvent.type(screen.getByLabelText("Full name"), "New Student");
    await userEvent.type(screen.getByLabelText("Email"), "new@campus.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(mockRegister).toHaveBeenCalledWith("New Student", "new@campus.com", "password123");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("rejects a short signup password without calling register", async () => {
    await open({ view: "signup-email" });

    await userEvent.type(screen.getByLabelText("Full name"), "New Student");
    await userEvent.type(screen.getByLabelText("Email"), "new@campus.com");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(
      await screen.findByText("Password must be at least 8 characters")
    ).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("reveals and re-hides the password", async () => {
    await open({ view: "login" });
    const password = screen.getByLabelText("Password");

    expect(password).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("asks the backend for a reset link and confirms", async () => {
    // Assigned rather than spied on: this jsdom environment has no global fetch
    // to spy on.
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
      text: async () => "",
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      await open({ view: "recover" });

      await userEvent.type(screen.getByLabelText("Email"), "student@campus.com");
      await userEvent.click(screen.getByRole("button", { name: "Send link" }));

      expect(
        await screen.findByRole("heading", { name: "Check your email" })
      ).toBeInTheDocument();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toContain("/api/v1/auth/forgot-password");
      expect(JSON.parse(String(init.body))).toEqual({ email: "student@campus.com" });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("shows the same confirmation when the reset request fails", async () => {
    // The backend answers 204 for unknown addresses on purpose. Surfacing a
    // client-side failure here would undo that and turn the screen into an
    // account oracle.
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    try {
      await open({ view: "recover" });

      await userEvent.type(screen.getByLabelText("Email"), "student@campus.com");
      await userEvent.click(screen.getByRole("button", { name: "Send link" }));

      expect(
        await screen.findByRole("heading", { name: "Check your email" })
      ).toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("validates the address before confirming a reset", async () => {
    await open({ view: "recover" });

    await userEvent.click(screen.getByRole("button", { name: "Send link" }));

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Check your email" })).not.toBeInTheDocument();
  });

  it("names itself with the visible heading, for screen readers", async () => {
    await open({ view: "login" });
    const dialog = screen.getByRole("dialog");
    const heading = screen.getByRole("heading", { name: "Log in to CampusVibe" });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", heading.id);
  });
});
