import { instagramHandle, isEmailShaped, normaliseWebLink } from "@/app/lib/links";

// The rejections are the point of this suite. normaliseWebLink is the only
// thing between a string a user typed and an href, so each case below is a
// stored-XSS vector if it ever starts returning non-null. It guards profile
// links and, since a proposal started carrying them, club contact links too.
describe("normaliseWebLink", () => {
  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)  ",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
  ])("refuses %s", (value) => {
    expect(normaliseWebLink(value)).toBeNull();
  });

  it("refuses nothing at all", () => {
    expect(normaliseWebLink(null)).toBeNull();
    expect(normaliseWebLink(undefined)).toBeNull();
    expect(normaliseWebLink("")).toBeNull();
    expect(normaliseWebLink("   ")).toBeNull();
  });

  it("keeps an absolute https link", () => {
    expect(normaliseWebLink("https://instagram.com/someone")).toBe(
      "https://instagram.com/someone",
    );
  });

  it("keeps http rather than silently upgrading it", () => {
    expect(normaliseWebLink("http://example.com/someone")).toBe(
      "http://example.com/someone",
    );
  });

  // The friendly case: almost nobody types a scheme.
  it("assumes https when no scheme is given", () => {
    expect(normaliseWebLink("instagram.com/someone")).toBe(
      "https://instagram.com/someone",
    );
  });

  // Guards the ordering inside the function. Prepend https before testing the
  // scheme and this returns 'https://javascript:alert(1)' — an https URL, so
  // the scheme check still passes and the value still reaches an href.
  it("does not disguise a bad scheme by prepending https", () => {
    expect(normaliseWebLink("javascript:alert(1)")).toBeNull();
  });
});

// The Instagram field takes a handle and the server builds the URL, so this
// has two jobs: refusing what the form should not submit, and turning a stored
// URL back into the handle the editor shows.
describe("instagramHandle", () => {
  it.each(["yourclub", "@yourclub", "  @yourclub  "])("reads %s as a handle", (value) => {
    expect(instagramHandle(value)).toBe("yourclub");
  });

  it.each([
    "instagram.com/yourclub",
    "https://instagram.com/yourclub",
    "https://www.instagram.com/yourclub/",
    "https://instagram.com/yourclub?hl=en",
  ])("reduces %s to the handle", (value) => {
    // Both for a paste into the form and for the stored value the profile
    // editor loads back, which is always the full URL.
    expect(instagramHandle(value)).toBe("yourclub");
  });

  it.each([
    "javascript:alert(1)",
    "evil.com/yourclub",
    "https://instagram.com.evil.com/yourclub",
    "https://instagram.com",
    "your club",
    "your/club",
    "",
    null,
    undefined,
  ])("refuses %s", (value) => {
    expect(instagramHandle(value)).toBeNull();
  });

  it("allows the dots and underscores Instagram allows, and stops at 30", () => {
    expect(instagramHandle("your.club_1")).toBe("your.club_1");
    expect(instagramHandle("a".repeat(30))).toBe("a".repeat(30));
    expect(instagramHandle("a".repeat(31))).toBeNull();
  });
});

// An email is not a link, and the two must not be confused: normaliseWebLink
// reads `hello@club.ca` as a bare host and returns `https://hello@club.ca`,
// which parses, has a host, and is nonsense.
describe("isEmailShaped", () => {
  it.each(["hello@club.ca", "a.b+c@mail.mcgill.ca"])("accepts %s", (value) => {
    expect(isEmailShaped(value)).toBe(true);
  });

  it.each(["club.ca", "hello@club", "hello @club.ca", ""])("refuses %s", (value) => {
    expect(isEmailShaped(value)).toBe(false);
  });

  it("does not care about surrounding whitespace", () => {
    expect(isEmailShaped("  hello@club.ca  ")).toBe(true);
  });
});
