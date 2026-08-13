import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GoogleAuthButton from "@/app/components/auth-components/GoogleAuthButton";
import type { GoogleCredentialResponse, GoogleIdConfiguration } from "@/app/types/google-identity";

const mockGoogleSignIn = jest.fn();

jest.mock("@/app/lib/auth-context", () => ({
  useAuth: () => ({ googleSignIn: mockGoogleSignIn }),
}));

// Stands in for the Google Identity Services script. The real one is never
// loaded here — these tests are about our side of the seam: that we forward a
// click to Google's button, and that we hand its ID token to the backend.
function installGis() {
  const googleButtonClick = jest.fn();
  let capturedConfig: GoogleIdConfiguration | undefined;

  window.google = {
    accounts: {
      id: {
        initialize: (config) => {
          capturedConfig = config;
        },
        renderButton: (parent) => {
          const rendered = document.createElement("div");
          rendered.setAttribute("role", "button");
          rendered.textContent = "Continue with Google";
          rendered.addEventListener("click", googleButtonClick);
          parent.appendChild(rendered);
        },
        prompt: jest.fn(),
        disableAutoSelect: jest.fn(),
      },
    },
  };

  return {
    googleButtonClick,
    /**
     * Fires the callback GIS would fire after an account pick. Wrapped in act
     * because it drives state updates from outside React's event system, the
     * same way the real script does.
     */
    signIn: async (response: GoogleCredentialResponse) => {
      await act(async () => {
        await capturedConfig?.callback(response);
      });
    },
  };
}

const ORIGINAL_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

afterEach(() => {
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = ORIGINAL_CLIENT_ID;
  delete window.google;
  jest.clearAllMocks();
});

describe("GoogleAuthButton", () => {
  it("says so plainly when no client id is configured", () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    render(<GoogleAuthButton label="Continue with Google" />);

    expect(screen.getByText("Google sign-in is not configured.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders our own button, styled with a border-only hover", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client-id";
    installGis();
    render(<GoogleAuthButton label="Continue with Google" />);

    const button = screen.getByRole("button", { name: /Continue with Google/ });
    await waitFor(() => expect(button).toBeEnabled());

    // The whole reason this component exists: Google's rendered button cannot
    // carry these, so the design's hover would be impossible without it.
    expect(button.className).toContain("hover:border-lavender-600");
    expect(button.className).not.toContain("hover:bg-");
  });

  it("forwards a click to Google's own hidden button", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client-id";
    const gis = installGis();
    render(<GoogleAuthButton label="Continue with Google" />);

    const button = screen.getByRole("button", { name: /Continue with Google/ });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);

    expect(gis.googleButtonClick).toHaveBeenCalledTimes(1);
  });

  it("exchanges the ID token and reports success", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client-id";
    const gis = installGis();
    const onSuccess = jest.fn();
    mockGoogleSignIn.mockResolvedValueOnce(undefined);
    render(<GoogleAuthButton label="Continue with Google" onSuccess={onSuccess} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Continue with Google/ })).toBeEnabled()
    );
    await gis.signIn({ credential: "an-id-token" });

    expect(mockGoogleSignIn).toHaveBeenCalledWith("an-id-token");
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("surfaces a failed exchange and does not report success", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client-id";
    const gis = installGis();
    const onSuccess = jest.fn();
    mockGoogleSignIn.mockRejectedValueOnce(
      new Error(JSON.stringify({ message: "Google account not recognised" }))
    );
    render(<GoogleAuthButton label="Continue with Google" onSuccess={onSuccess} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Continue with Google/ })).toBeEnabled()
    );
    await gis.signIn({ credential: "an-id-token" });

    expect(await screen.findByText("Google account not recognised")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("reports a cancelled pick rather than failing silently", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client-id";
    const gis = installGis();
    render(<GoogleAuthButton label="Continue with Google" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Continue with Google/ })).toBeEnabled()
    );
    await gis.signIn({});

    expect(await screen.findByText("Google did not return a sign-in token.")).toBeInTheDocument();
    expect(mockGoogleSignIn).not.toHaveBeenCalled();
  });
});
