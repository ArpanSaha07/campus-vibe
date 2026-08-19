import { normaliseProfileLink } from "@/app/lib/profile";

// The rejections are the point of this suite. normaliseProfileLink is the only
// thing between a string a user typed and an href, so each case below is a
// stored-XSS vector if it ever starts returning non-null.
describe("normaliseProfileLink", () => {
  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)  ",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
  ])("refuses %s", (value) => {
    expect(normaliseProfileLink(value)).toBeNull();
  });

  it("refuses nothing at all", () => {
    expect(normaliseProfileLink(null)).toBeNull();
    expect(normaliseProfileLink(undefined)).toBeNull();
    expect(normaliseProfileLink("")).toBeNull();
    expect(normaliseProfileLink("   ")).toBeNull();
  });

  it("keeps an absolute https link", () => {
    expect(normaliseProfileLink("https://instagram.com/someone")).toBe(
      "https://instagram.com/someone",
    );
  });

  it("keeps http rather than silently upgrading it", () => {
    expect(normaliseProfileLink("http://example.com/someone")).toBe(
      "http://example.com/someone",
    );
  });

  // The friendly case: almost nobody types a scheme.
  it("assumes https when no scheme is given", () => {
    expect(normaliseProfileLink("instagram.com/someone")).toBe(
      "https://instagram.com/someone",
    );
  });

  // Guards the ordering inside the function. Prepend https before testing the
  // scheme and this returns 'https://javascript:alert(1)' — an https URL, so
  // the scheme check still passes and the value still reaches an href.
  it("does not disguise a bad scheme by prepending https", () => {
    expect(normaliseProfileLink("javascript:alert(1)")).toBeNull();
  });
});
