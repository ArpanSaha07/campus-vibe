import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateClubForm from "@/app/components/club/CreateClubForm";
import { Role, type User } from "@/app/types";

/**
 * The one club-creation form, on both of its paths.
 *
 * Written after the fact: the rebuild shipped with no coverage, and the two
 * things most worth pinning were both found by hand rather than by a test.
 *
 * The first is that the paths differ in what they *render*, not merely in what
 * they submit — a proposal has no club id and no S3 key, so the logo and links
 * are absent rather than disabled (ADR-004). A regression there is invisible
 * until somebody uploads into a club that does not exist.
 *
 * The second is BUG-045: the success callback used to run inside the try that
 * wrapped the write, so a failure to navigate was reported as a failure to
 * create, on top of a club that had just been created. That one has its own
 * test at the bottom.
 */

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: (...args: unknown[]) => mockPush(...args) }),
}));

// Which path the form takes is decided by the signed-in user's roles, so it is
// set per test rather than mocked once with a fixed answer.
let currentUser: User | null = null;
jest.mock("@/app/lib/auth-context", () => ({
  useAuth: () => ({ user: currentUser, isAuthenticated: !!currentUser, loading: false }),
}));

const mockRefresh = jest.fn();
jest.mock("@/app/lib/managed-clubs-context", () => ({
  useManagedClubs: () => ({ refresh: mockRefresh }),
}));

const mockRevalidateClubs = jest.fn();
jest.mock("@/app/lib/actions/revalidate", () => ({
  revalidateClubs: (...args: unknown[]) => mockRevalidateClubs(...args),
}));

jest.mock("@/app/hooks/useClubCategories", () => ({
  useClubCategories: () => ({
    categories: [{ slug: "academic", label: "Academic and professional" }],
    failed: false,
  }),
}));

// Stubbed rather than rendered: it fetches the whole interest catalogue, and
// nothing here is about interests — a change to the picker should not fail
// nineteen tests about logos and required markers.
//
// It is NOT an inert stub, though. It takes `selected` and `onChange` and
// drives them, because stubbing the picker away entirely would leave nothing
// proving that a chosen interest reaches the payload: the form could drop them
// silently and every other test here would still pass. The heading is kept so
// a test can prove the section is present on both paths.
jest.mock("@/app/components/profile/edit/InterestPicker", () => ({
  __esModule: true,
  default: ({
    title,
    selected,
    onChange,
  }: {
    title: string;
    selected: string[];
    onChange: (slugs: string[]) => void;
  }) => (
    <div>
      <h2>{title}</h2>
      {/* type=button, or clicking it would submit the form it sits in. */}
      <button type="button" onClick={() => onChange([...selected, "chess"])}>
        stub: add chess
      </button>
      <span data-testid="stub-selected">{selected.join(",")}</span>
    </div>
  ),
}));

const mockCreateClubWithMedia = jest.fn();
const mockCheckClubNameExists = jest.fn();
jest.mock("@/app/lib/services/clubService", () => ({
  // clubSlug stays real: it decides the URL preview this file asserts on, and
  // a stubbed one would make that assertion prove nothing.
  ...jest.requireActual("@/app/lib/services/clubService"),
  checkClubNameExists: (...args: unknown[]) => mockCheckClubNameExists(...args),
  createClubWithMedia: (...args: unknown[]) => mockCreateClubWithMedia(...args),
}));

const mockProposeClub = jest.fn();
jest.mock("@/app/lib/club-creation-requests", () => ({
  proposeClub: (...args: unknown[]) => mockProposeClub(...args),
}));

function user(...roles: Role[]): User {
  return {
    id: 1,
    name: "Test Person",
    email: "test@campusvibe.local",
    roles,
    createdAt: "2026-09-01T00:00:00Z",
    emailVerified: true,
  } as User;
}

/** Fills the fields both paths share. */
async function fillCommon(name = "Rooftop Astronomy Club") {
  await userEvent.type(screen.getByLabelText(/Club name/), name);
  await userEvent.type(
    screen.getByLabelText(/Description/),
    "Telescopes on the Burnside roof every clear Thursday night.",
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  currentUser = null;
  mockCheckClubNameExists.mockResolvedValue(false);
  mockCreateClubWithMedia.mockResolvedValue({ clubId: "rooftop-astronomy-club" });
  mockProposeClub.mockResolvedValue({ id: 1 });
  mockRevalidateClubs.mockResolvedValue(undefined);
});

describe("CreateClubForm — which controls each path renders", () => {
  it("gives a platform admin the logo and the contact links", () => {
    currentUser = user(Role.USER, Role.ADMIN);
    render(<CreateClubForm />);

    expect(screen.getByRole("heading", { name: "Create a club" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Logo/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contact email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Website/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Instagram/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Facebook/)).toBeInTheDocument();
  });

  it("withholds only the logo from an ordinary user, and asks for a message instead", () => {
    currentUser = user(Role.USER);
    render(<CreateClubForm />);

    expect(screen.getByRole("heading", { name: "Propose a club" })).toBeInTheDocument();
    // Absent, not disabled: a proposal has no club id to upload against.
    expect(screen.queryByLabelText(/Logo/)).not.toBeInTheDocument();
    // The links need neither a club id nor an S3 key, and a club page is empty
    // without them, so a proposal collects them like any other field.
    expect(screen.getByLabelText(/Contact email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Website/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Instagram/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Facebook/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Anything the reviewer should know/)).toBeInTheDocument();
  });

  it.each([
    ["an admin", [Role.USER, Role.ADMIN]],
    ["an ordinary user", [Role.USER]],
  ])("offers no club-photos control to %s", (_label, roles) => {
    currentUser = user(...roles);
    render(<CreateClubForm />);

    // Banner photos moved to the club editor; ten pickers made the first thing
    // a new club sees a chore.
    expect(screen.queryByText(/photos/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Club Photos/i)).not.toBeInTheDocument();
  });

  it("keeps the interests section on both paths", () => {
    currentUser = user(Role.USER);
    render(<CreateClubForm />);
    expect(screen.getByRole("heading", { name: "What is this club about?" })).toBeInTheDocument();
  });
});

describe("CreateClubForm — interests reach the payload", () => {
  // What the picker is *for*. Everything else in this file could pass while the
  // form quietly discarded every interest, because nothing else looks at them:
  // they are not a field the user can read back, so a break here is invisible
  // until a club is tagged with nothing and stops matching anyone.

  it("holds what the picker reports and hands it back to it", async () => {
    currentUser = user(Role.USER);
    render(<CreateClubForm />);

    expect(screen.getByTestId("stub-selected")).toHaveTextContent("");
    await userEvent.click(screen.getByRole("button", { name: "stub: add chess" }));

    // Round-tripped through the form's state rather than held by the picker.
    expect(screen.getByTestId("stub-selected")).toHaveTextContent("chess");
  });

  it("sends them with a proposal", async () => {
    currentUser = user(Role.USER);
    render(<CreateClubForm />);

    await fillCommon();
    await userEvent.click(screen.getByRole("button", { name: "stub: add chess" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    await waitFor(() => expect(mockProposeClub).toHaveBeenCalledTimes(1));
    expect(mockProposeClub).toHaveBeenCalledWith(
      expect.objectContaining({ interests: ["chess"] }),
    );
  });

  it("sends them when an admin creates the club directly", async () => {
    currentUser = user(Role.USER, Role.ADMIN);
    render(<CreateClubForm />);

    await fillCommon();
    await userEvent.type(screen.getByLabelText(/Contact email/), "hello@yourclub.ca");
    await userEvent.click(screen.getByRole("button", { name: "stub: add chess" }));
    await userEvent.click(screen.getByRole("button", { name: "Create club" }));

    await waitFor(() => expect(mockCreateClubWithMedia).toHaveBeenCalledTimes(1));
    // Two arguments: the club itself, then the media and links. Interests ride
    // on the first, since they are part of what the club *is*.
    expect(mockCreateClubWithMedia).toHaveBeenCalledWith(
      expect.objectContaining({ interests: ["chess"] }),
      expect.anything(),
    );
  });

  it("sends an empty list when nothing was picked", async () => {
    currentUser = user(Role.USER);
    render(<CreateClubForm />);

    await fillCommon();
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    await waitFor(() => expect(mockProposeClub).toHaveBeenCalledTimes(1));
    // An empty array, not undefined or a missing key: the backend caps the list
    // rather than requiring one, and a null would not survive the JSON body.
    expect(mockProposeClub).toHaveBeenCalledWith(expect.objectContaining({ interests: [] }));
  });
});

describe("CreateClubForm — contact links reach the payload", () => {
  // Same reason the interests have a block of their own: a link is not
  // something the user reads back off the form after submitting, so the whole
  // file could stay green while the proposal path dropped every one of them --
  // which is exactly what it did until 2026-09-10.

  it("sends what was typed with a proposal", async () => {
    currentUser = user(Role.USER);
    render(<CreateClubForm />);

    await fillCommon();
    await userEvent.type(screen.getByLabelText(/Contact email/), "hello@astronomy.ca");
    await userEvent.type(screen.getByLabelText(/Website/), "https://astronomy.ca");
    await userEvent.type(screen.getByLabelText(/Instagram/), "@astronomy");
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    await waitFor(() => expect(mockProposeClub).toHaveBeenCalledTimes(1));
    expect(mockProposeClub).toHaveBeenCalledWith(
      expect.objectContaining({
        socialLinks: expect.objectContaining({
          email: "hello@astronomy.ca",
          website: "https://astronomy.ca",
          // Sent as typed. The handle becomes https://instagram.com/astronomy
          // on the server, which is the one place that decision lives.
          instagram: "@astronomy",
        }),
      }),
    );
  });

  it("refuses an Instagram value that is not a handle", async () => {
    currentUser = user(Role.USER);
    render(<CreateClubForm />);

    await fillCommon();
    await userEvent.type(screen.getByLabelText(/Instagram/), "evil.com/astronomy");
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    // Not silently turned into an Instagram link that is not one.
    expect(await screen.findByText(/should be your handle/)).toBeInTheDocument();
    expect(mockProposeClub).not.toHaveBeenCalled();
  });

  it("lets a proposal through with none of them, unlike the admin path", async () => {
    currentUser = user(Role.USER);
    render(<CreateClubForm />);

    await fillCommon();
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    // A student may not have an address for the club yet, and refusing the
    // form over it would be refusing the club.
    await waitFor(() => expect(mockProposeClub).toHaveBeenCalledTimes(1));
  });

  it("refuses a link that could not go in an href, on the proposal path too", async () => {
    currentUser = user(Role.USER);
    render(<CreateClubForm />);

    await fillCommon();
    await userEvent.type(screen.getByLabelText(/Website/), "javascript:alert(1)");
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    // The server refuses this too, and that is the control -- this is what
    // turns its 400 into a message beside the field that caused it.
    expect(await screen.findByText(/must be a http or https link/)).toBeInTheDocument();
    expect(mockProposeClub).not.toHaveBeenCalled();
  });

  it("refuses an address that is not one, without demanding it", async () => {
    currentUser = user(Role.USER);
    render(<CreateClubForm />);

    await fillCommon();
    await userEvent.type(screen.getByLabelText(/Contact email/), "astronomy.ca");
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    expect(await screen.findByText(/valid email address/)).toBeInTheDocument();
    expect(mockProposeClub).not.toHaveBeenCalled();
  });
});

describe("CreateClubForm — the URL preview", () => {
  it("shows an admin the slug their name will take", async () => {
    currentUser = user(Role.USER, Role.ADMIN);
    render(<CreateClubForm />);

    await userEvent.type(screen.getByLabelText(/Club name/), "Rooftop Astronomy Club");

    expect(screen.getByText("rooftop-astronomy-club")).toBeInTheDocument();
  });

  it("shows nothing before a name is typed", () => {
    currentUser = user(Role.USER, Role.ADMIN);
    render(<CreateClubForm />);
    expect(screen.queryByText(/^\/clubs\/$/)).not.toBeInTheDocument();
  });

  it("hides it from a proposer, whose slug is settled at approval", async () => {
    currentUser = user(Role.USER);
    render(<CreateClubForm />);

    await userEvent.type(screen.getByLabelText(/Club name/), "Rooftop Astronomy Club");

    expect(screen.queryByText("rooftop-astronomy-club")).not.toBeInTheDocument();
  });
});

describe("CreateClubForm — required fields", () => {
  it("marks name and description on the proposal path", () => {
    currentUser = user(Role.USER);
    render(<CreateClubForm />);

    expect(screen.getAllByText("Required")).toHaveLength(2);
    expect(screen.getByLabelText(/Club name/)).toHaveAttribute("aria-required", "true");
    expect(screen.getByLabelText(/Description/)).toHaveAttribute("aria-required", "true");
  });

  it("also marks the contact email on the admin path, which the validator demands", () => {
    currentUser = user(Role.USER, Role.ADMIN);
    render(<CreateClubForm />);

    expect(screen.getAllByText("Required")).toHaveLength(3);
    expect(screen.getByLabelText(/Contact email/)).toHaveAttribute("aria-required", "true");
  });

  it("does not set the native required attribute, which would pre-empt the validator", () => {
    currentUser = user(Role.USER);
    render(<CreateClubForm />);
    // Asserted on the attribute, not with toBeRequired: jest-dom counts
    // aria-required as required, so that matcher cannot tell the two apart —
    // and the whole point here is that one is set and the other is not.
    expect(screen.getByLabelText(/Club name/)).not.toHaveAttribute("required");
  });

  it("turns off native validation, which pre-empts the validator just as hard", () => {
    currentUser = user(Role.USER);
    render(<CreateClubForm />);

    // Without this, a form holding an invalid type=email or type=url control
    // never fires submit at all: the browser blocks it and shows a bubble, and
    // the message `clubValidator` wrote beside the field is never rendered.
    // The contact email is optional on this path, so a typo in it used to be
    // silently unsubmittable rather than explained.
    expect(screen.getByLabelText(/Club name/).closest("form")).toHaveAttribute("novalidate");
  });
});

describe("CreateClubForm — submitting a proposal", () => {
  it("creates no club and confirms that a reviewer has it", async () => {
    currentUser = user(Role.USER);
    render(<CreateClubForm />);

    await fillCommon();
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    expect(await screen.findByRole("heading", { name: "Your club is with a reviewer" }))
      .toBeInTheDocument();
    expect(mockProposeClub).toHaveBeenCalledTimes(1);
    // The proposal path must not touch the club-creating endpoint at all.
    expect(mockCreateClubWithMedia).not.toHaveBeenCalled();
    // Nowhere to send them: no club exists and nothing notifies them yet.
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("offers a way back to the form from the confirmation", async () => {
    currentUser = user(Role.USER);
    render(<CreateClubForm />);

    await fillCommon();
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    await screen.findByRole("heading", { name: "Your club is with a reviewer" });

    await userEvent.click(screen.getByRole("button", { name: "Propose another" }));

    expect(screen.getByRole("heading", { name: "Propose a club" })).toBeInTheDocument();
  });
});

describe("CreateClubForm — submitting as an admin", () => {
  it("creates the club, refreshes what the UI knows, and lands on its dashboard", async () => {
    currentUser = user(Role.USER, Role.ADMIN);
    render(<CreateClubForm />);

    await fillCommon();
    await userEvent.type(screen.getByLabelText(/Contact email/), "hello@yourclub.ca");
    await userEvent.click(screen.getByRole("button", { name: "Create club" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/manage/rooftop-astronomy-club"));
    // Without these the admin owns a club the navbar does not know about, and
    // the clubs grid is missing it for up to five minutes.
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockRevalidateClubs).toHaveBeenCalled();
  });
});

describe("CreateClubForm — how failures surface", () => {
  // These tests reject on purpose, and the hook logs every failure it handles.
  // Silenced here rather than suite-wide, so an unexpected console.error
  // anywhere else still shows up in the run.
  let logged: jest.SpyInstance;
  beforeEach(() => {
    logged = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => logged.mockRestore());

  it("puts a submission failure in the toast, not above the form", async () => {
    currentUser = user(Role.USER);
    mockProposeClub.mockRejectedValue(new Error("The server is not accepting new clubs right now."));
    render(<CreateClubForm />);

    await fillCommon();
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The server is not accepting new clubs right now.");
    // Still on the form, with what was typed still there.
    expect(screen.getByLabelText(/Club name/)).toHaveValue("Rooftop Astronomy Club");
  });

  it("reports the server's message rather than the raw response body", async () => {
    currentUser = user(Role.USER);
    // ApiError carries the response body as its message, so an unparsed one
    // showed the user a line of JSON.
    mockProposeClub.mockRejectedValue(new Error('{"message":"That name is already taken."}'));
    render(<CreateClubForm />);

    await fillCommon();
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("That name is already taken.");
    expect(alert).not.toHaveTextContent("{");
  });

  it("keeps a per-field error beside its field", async () => {
    currentUser = user(Role.USER);
    render(<CreateClubForm />);

    await userEvent.type(screen.getByLabelText(/Club name/), "ab");
    await userEvent.type(screen.getByLabelText(/Description/), "Long enough to pass.");
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    expect(await screen.findByText(/at least 3 characters/i)).toBeInTheDocument();
    // A validation failure is not a submission failure, so nothing hovers.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockProposeClub).not.toHaveBeenCalled();
  });

  it("says the club WAS created when only the navigation fails (BUG-045, BUG-047)", async () => {
    currentUser = user(Role.USER, Role.ADMIN);
    // The club is written, then revalidating the cache tag throws. Two wrong
    // answers are possible here and both have shipped: claiming the club could
    // not be created (BUG-045), and saying nothing at all while blanking the
    // form (BUG-047). The right answer names what happened.
    mockRevalidateClubs.mockRejectedValue(new Error("revalidation exploded"));
    render(<CreateClubForm />);

    await fillCommon();
    await userEvent.type(screen.getByLabelText(/Contact email/), "hello@yourclub.ca");
    await userEvent.click(screen.getByRole("button", { name: "Create club" }));

    await waitFor(() => expect(mockCreateClubWithMedia).toHaveBeenCalledTimes(1));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Your club was created/i);
    expect(alert).toHaveTextContent(/under Manage/i);
    expect(alert).not.toHaveTextContent(/could not be created/i);
    // And it is still logged, so the cause is recoverable from the console
    // rather than being swallowed by the friendlier message.
    expect(logged).toHaveBeenCalledWith("Error after creating club:", expect.any(Error));
  });

  it("tells a proposer their proposal landed even if the page could not finish", async () => {
    currentUser = user(Role.USER);
    // Same shape on the other path, and the message has to differ: no club
    // exists, so there is nothing under Manage to send them to.
    mockProposeClub.mockResolvedValue({ id: 1 });
    render(<CreateClubForm />);

    await fillCommon();
    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    // The proposal path's callback only flips local state, so it cannot fail
    // the way the admin path's can; this pins that it reaches the confirmation
    // rather than an error.
    expect(await screen.findByRole("heading", { name: "Your club is with a reviewer" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
