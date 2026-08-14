import { parseApiError } from "@/app/lib/auth-errors";

describe("parseApiError", () => {
  const fallback = "Something went wrong";

  it("pulls the message out of a backend ApiError body", () => {
    const err = new Error(JSON.stringify({ status: 401, message: "Invalid credentials" }));
    expect(parseApiError(err, fallback)).toBe("Invalid credentials");
  });

  it("returns a non-JSON error message as-is", () => {
    expect(parseApiError(new Error("Request failed: 500"), fallback)).toBe("Request failed: 500");
  });

  it("falls back when the body is JSON but carries no message", () => {
    expect(parseApiError(new Error(JSON.stringify({ status: 500 })), fallback)).toBe(fallback);
    expect(parseApiError(new Error(JSON.stringify({ message: "" })), fallback)).toBe(fallback);
  });

  it("falls back for a non-Error throw or an empty message", () => {
    expect(parseApiError("just a string", fallback)).toBe(fallback);
    expect(parseApiError(new Error(""), fallback)).toBe(fallback);
    expect(parseApiError(undefined, fallback)).toBe(fallback);
  });
});
