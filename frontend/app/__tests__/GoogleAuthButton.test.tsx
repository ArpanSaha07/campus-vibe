import { act, render, screen, waitFor } from "@testing-library/react";
import GoogleAuthButton from "@/app/components/auth-components/GoogleAuthButton";
import type {
  GoogleButtonOptions,
  GoogleCredentialResponse,
  GoogleIdConfiguration,
} from "@/app/types/google-identity";

const mockGoogleSignIn = jest.fn();

jest.mock("@/app/lib/auth-context", () => ({
  useAuth: () => ({ googleSignIn: mockGoogleSignIn }),
}));

const GIS_SRC = "https://accounts.google.com/gsi/client";

/**
 * Stands in for the Google Identity Services script.
 *
 * It paints an **iframe**, **asynchronously** — which is what the real script
 * does, and what the fake before BUG-057 did not. The old one appended a
 * `div[role="button"]` synchronously, so it modelled Google's private DOM as
 * a stable contract and the suite stayed green through the outage that took
 * production down. Anything this component does must survive an opaque,
 * cross-origin child arriving on Google's schedule, not ours.
 *
 * `paints: false` is the failure BUG-057 actually produced: GIS loads, accepts
 * the call, and puts nothing in the box.
 */
function installGis({ paints = true }: { paints?: boolean } = {}) {
  let capturedConfig: GoogleIdConfiguration | undefined;
  let capturedOptions: GoogleButtonOptions | undefined;

  window.google = {
    accounts: {
      id: {
        initialize: (config) => {
          capturedConfig = config;
        },
        renderButton: (parent, options) => {
          capturedOptions = options;
          if (!paints) return;
          setTimeout(() => {
            const frame = document.createElement("iframe");
            frame.title = "Sign in with Google Button";
            frame.src = "https://accounts.google.com/gsi/button";
            parent.appendChild(frame);
          }, 0);
        },
        prompt: jest.fn(),
        disableAutoSelect: jest.fn(),
      },
    },
  };

  return {
    options: () => capturedOptions,
    config: () => capturedConfig,
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

const container = () => screen.getByTestId("google-button-container");

const ORIGINAL_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

afterEach(() => {
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = ORIGINAL_CLIENT_ID;
  delete window.google;
  document.querySelectorAll(`script[src="${GIS_SRC}"]`).forEach((s) => s.remove());
  jest.clearAllMocks();
});

describe("GoogleAuthButton", () => {
  it("says so plainly when no client id is configured", () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    render(<GoogleAuthButton text="continue_with" />);

    expect(screen.getByText("Google sign-in is not configured.")).toBeInTheDocument();
    expect(screen.queryByTestId("google-button-container")).not.toBeInTheDocument();
  });

  it("hands the container to Google and adds no control of its own", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client-id";
    installGis();
    render(<GoogleAuthButton text="continue_with" />);

    await waitFor(() => expect(container().querySelector("iframe")).toBeInTheDocument());

    // The whole point of ADR-018: whatever GIS paints is the real control, so
    // there is nothing of ours to click and nothing of ours to go stale.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container().querySelector('div[role="button"]')).toBeNull();
  });

  it("asks Google for the button the design calls for", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client-id";
    const gis = installGis();
    render(<GoogleAuthButton text="signin_with" />);

    await waitFor(() => expect(gis.options()).toBeDefined());
    expect(gis.options()).toMatchObject({ theme: "outline", shape: "pill", text: "signin_with" });
    expect(gis.config()?.client_id).toBe("test-client-id");

    // jsdom measures every element at 0, so this is the documented fallback
    // rather than a real measurement — the clamp is what is under test.
    expect(gis.options()?.width).toBe(400);
  });

  it("says sign-in is unavailable when Google paints nothing", async () => {
    jest.useFakeTimers();
    try {
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client-id";
      installGis({ paints: false });
      render(<GoogleAuthButton text="continue_with" />);

      // This is BUG-057: the script loaded, renderButton was called, and the
      // box stayed empty. The old component called that "not ready yet" and
      // invited the user to try again forever.
      expect(screen.queryByText(/could not load/)).not.toBeInTheDocument();
      act(() => {
        jest.advanceTimersByTime(8000);
      });

      expect(screen.getByText(/Google sign-in could not load/)).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it("says sign-in is unavailable when the GIS script itself fails to load", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client-id";
    render(<GoogleAuthButton text="continue_with" />);

    const script = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    expect(script).not.toBeNull();
    act(() => {
      script?.dispatchEvent(new Event("error"));
    });

    expect(await screen.findByText(/Google sign-in could not load/)).toBeInTheDocument();
  });

  it("exchanges the ID token and reports success", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client-id";
    const gis = installGis();
    const onSuccess = jest.fn();
    mockGoogleSignIn.mockResolvedValueOnce(undefined);
    render(<GoogleAuthButton text="continue_with" onSuccess={onSuccess} />);

    await waitFor(() => expect(gis.config()).toBeDefined());
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
    render(<GoogleAuthButton text="continue_with" onSuccess={onSuccess} />);

    await waitFor(() => expect(gis.config()).toBeDefined());
    await gis.signIn({ credential: "an-id-token" });

    expect(await screen.findByText("Google account not recognised")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("reports a cancelled pick rather than failing silently", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client-id";
    const gis = installGis();
    render(<GoogleAuthButton text="continue_with" />);

    await waitFor(() => expect(gis.config()).toBeDefined());
    await gis.signIn({});

    expect(await screen.findByText("Google did not return a sign-in token.")).toBeInTheDocument();
    expect(mockGoogleSignIn).not.toHaveBeenCalled();
  });
});
