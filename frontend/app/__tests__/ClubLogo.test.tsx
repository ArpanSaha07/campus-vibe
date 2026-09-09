import { render, screen } from "@testing-library/react";
import ClubLogo from "@/app/components/club/ClubLogo";

/**
 * The crash this pins down: `ClubController.uploadLogo` stores a raw S3 object
 * key (`clubs/{id}/logo-{filename}`) in `clubs.logo`, and `ClubDTO` hands it to
 * the browser untouched. next/image throws on it —
 * `Failed to construct 'URL': Invalid URL` — which is a render-time throw, so
 * the component's own onError fallback never gets a chance and the whole
 * /clubs page comes down.
 *
 * Latent until the club-governance work wired the upload, because before that
 * nothing had ever written `clubs.logo` and it was null everywhere.
 */
// Queried through the DOM rather than by role: the component sets alt="" by
// design (the club name is always rendered as text beside it), and an img with
// an empty alt is exposed as `presentation`, not `img`. getByRole("img") would
// therefore fail even when an image *is* rendered -- and, worse, the negative
// assertions would pass trivially in every case.
const imageIn = (container: HTMLElement) => container.querySelector("img");

describe("ClubLogo", () => {
  it("renders the initial rather than throwing on a raw S3 object key", () => {
    let container!: HTMLElement;
    expect(() => {
      ({ container } = render(
        <ClubLogo name="Quantum Society" logo="clubs/quantum/logo-logo.png" />,
      ));
    }).not.toThrow();

    expect(screen.getByText("Q")).toBeInTheDocument();
    expect(imageIn(container)).toBeNull();
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["empty", ""],
    ["whitespace only", "   "],
  ])("renders the initial when the logo is %s", (_label, logo) => {
    const { container } = render(<ClubLogo name="chess club" logo={logo} />);

    expect(screen.getByText("C")).toBeInTheDocument();
    expect(imageIn(container)).toBeNull();
  });

  it("renders an image for an absolute https URL", () => {
    const { container } = render(
      <ClubLogo name="Coding Club" logo="https://images.unsplash.com/photo-1517694712202.jpg" />,
    );

    expect(imageIn(container)).not.toBeNull();
    expect(screen.queryByText("C")).not.toBeInTheDocument();
  });

  it("renders an image for a root-relative path served by the frontend", () => {
    const { container } = render(<ClubLogo name="Coding Club" logo="/new-campusvibe-logo.png" />);

    expect(imageIn(container)).not.toBeNull();
  });

  it("rejects a non-http protocol", () => {
    // javascript: and data: parse as valid URLs, so the protocol check is what
    // keeps them out of an img src rather than the try/catch.
    const { container } = render(<ClubLogo name="Sneaky" logo="javascript:alert(1)" />);

    expect(screen.getByText("S")).toBeInTheDocument();
    expect(imageIn(container)).toBeNull();
  });
});
