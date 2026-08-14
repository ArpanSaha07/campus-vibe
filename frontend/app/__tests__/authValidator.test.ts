import {
  hasErrors,
  validateEmail,
  validateLogin,
  validateSignup,
  MIN_PASSWORD_LENGTH,
} from "@/app/lib/validators/authValidator";

describe("validateEmail", () => {
  it("rejects an empty or whitespace-only address", () => {
    expect(validateEmail("")).toBe("Email is required");
    expect(validateEmail("   ")).toBe("Email is required");
  });

  it("rejects an address with no domain or no @", () => {
    expect(validateEmail("student")).toBe("Enter a valid email address");
    expect(validateEmail("student@campus")).toBe("Enter a valid email address");
  });

  it("accepts a normal address, ignoring surrounding whitespace", () => {
    expect(validateEmail("student@campus.com")).toBeUndefined();
    expect(validateEmail("  student@campus.com  ")).toBeUndefined();
  });
});

describe("validateLogin", () => {
  it("passes a filled-in form", () => {
    expect(hasErrors(validateLogin("student@campus.com", "anything"))).toBe(false);
  });

  it("reports a missing password", () => {
    expect(validateLogin("student@campus.com", "").password).toBe("Password is required");
  });

  it("does not apply the signup length rule — old accounts predate it", () => {
    // A short password can still be the correct one for an existing account.
    expect(validateLogin("student@campus.com", "abc").password).toBeUndefined();
  });

  it("reports both fields at once", () => {
    const errors = validateLogin("", "");
    expect(errors.email).toBe("Email is required");
    expect(errors.password).toBe("Password is required");
  });
});

describe("validateSignup", () => {
  it("passes a filled-in form", () => {
    expect(hasErrors(validateSignup("New Student", "new@campus.com", "password123"))).toBe(false);
  });

  it("requires a name", () => {
    expect(validateSignup("  ", "new@campus.com", "password123").name).toBe("Name is required");
  });

  it("enforces the backend minimum password length", () => {
    const tooShort = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validateSignup("New Student", "new@campus.com", tooShort).password).toBe(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
    expect(
      validateSignup("New Student", "new@campus.com", "a".repeat(MIN_PASSWORD_LENGTH)).password
    ).toBeUndefined();
  });

  it("prefers 'required' over 'too short' for an empty password", () => {
    expect(validateSignup("New Student", "new@campus.com", "").password).toBe(
      "Password is required"
    );
  });
});

describe("hasErrors", () => {
  it("is false for an empty result and true for any field", () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ email: "Email is required" })).toBe(true);
  });
});
