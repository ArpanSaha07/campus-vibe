// Client-side checks for the auth modal. These exist to name the problem next
// to the field the user can fix — the backend stays the authority, and anything
// it rejects still surfaces as a general error on the form.

export interface AuthFieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

/** Minimum accepted by the backend's RegisterRequest. */
export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "Email is required";
  if (!EMAIL_PATTERN.test(email.trim())) return "Enter a valid email address";
  return undefined;
}

export function validateLogin(email: string, password: string): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  // No length rule on login: an old account may predate the current minimum,
  // and telling someone their existing password is "too short" is nonsense.
  if (!password) errors.password = "Password is required";
  return errors;
}

export function validateSignup(name: string, email: string, password: string): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  if (!name.trim()) errors.name = "Name is required";
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  if (!password) {
    errors.password = "Password is required";
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return errors;
}

export function hasErrors(errors: AuthFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
