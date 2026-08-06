// Types for the Google Identity Services client loaded at runtime from
// https://accounts.google.com/gsi/client.
//
// Scope is deliberately narrow: only the calls this app makes are declared.
// The alternative was `(window as any).google`, which turns every typo in a
// GIS option name into a silent no-op at runtime — the library ignores keys it
// does not recognise.

export type GoogleCredentialResponse = {
  /** The Google ID token (a JWT). Absent if the user cancelled. */
  credential?: string;
  select_by?: string;
};

export type GoogleIdConfiguration = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void | Promise<void>;
  /** Fires when GIS itself fails to initialise — not on a cancelled sign-in. */
  error_callback?: () => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
};

export type GoogleButtonOptions = {
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "small" | "medium" | "large";
  type?: "standard" | "icon";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  width?: number | string;
};

export type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize(config: GoogleIdConfiguration): void;
      renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
      prompt(): void;
      disableAutoSelect(): void;
    };
  };
};

declare global {
  interface Window {
    /**
     * Present only after the GIS script has loaded, so always guard on it.
     * Optional rather than assumed for exactly that reason.
     */
    google?: GoogleIdentityServices;
  }
}
