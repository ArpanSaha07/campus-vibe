# A weekly Trivy scan, so advisories are found between pull requests

**Status:** shipped 2026-11-07 · **Date:** 2026-11-07

> **Shipped 2026-11-07, uncommitted, unproved on GitHub.** Built as agreed,
> with all five proposals. `trivy-weekly.yml`, `.github/actions/setup-trivy`
> (the only Trivy pin, now also used by `_docker.yml`), and a comment fix in
> `codeql.yml`, whose permissions note called `security-events: write` *the
> only* elevated scope. **Drift from the spec:** none in design. One file
> beyond the list, `codeql.yml`, for that comment. **Proved locally:**
> `verify.mjs --all` green; every changed YAML file parses; the five shell
> steps pass `bash -n`; the jar glob matches exactly one jar beside a
> `.jar.original`. **Not run:** this spec's Verification section, which needs
> GitHub, and `actionlint`, which is not installed. Both are the P1 in
> `todo.md`.

## Goal

Every week, without a pull request, GitHub Actions builds `develop`, where
work lands and fixes are made, and scans it with Trivy at the PR gate's
threshold. Findings persist in the
repository's Security tab and a failure emails Arpan. Today the only scan is
the Docker job's gate, which runs when a PR or branch push triggers it. That
is why BUG-019, BUG-035, BUG-050 and BUG-064 were all found on a PR, after
the advisory had been public for days. The Elastic Beanstalk image production
actually runs, built from `deploy/eb/Dockerfile` on
`eclipse-temurin:25-jre-alpine`, has never been scanned at all: the gate scans
`backend/Dockerfile`'s `25-jdk-alpine` image instead.

## Out of scope

- **Third-party images and tool binaries:** `pgvector/pgvector:pg15`, the
  MinIO images (not anonymously pullable, BUG-063), and the pinned gitleaks and
  Trivy binaries. Considered and left out by Arpan.
- **`main`.** The schedule builds `develop` only; what reaches `main` is
  checked by the PR gate on the way.
- **Fixing anything the first run finds.** Each finding is its own bug, routed
  as the gate's message says.
- **Changing the PR gate's threshold**, or tightening it to HIGH.
- **Dependabot and CodeQL**, which keep their own weekly schedules.

## Decisions taken

- **Scope: three targets.** The two images the PR gate builds, the frontend
  `runner` target and `backend/Dockerfile`; the production image from
  `deploy/eb/Dockerfile`; and `trivy fs` over `backend/pom.xml` and
  `frontend/package-lock.json`, which is what Vercel builds from — Arpan,
  2026-11-07.
- **Branch: `develop`**, chosen over `main` and over both, so a finding lands
  where it is fixed and reaches `main` by PR — Arpan, 2026-11-07. Three
  consequences, accepted with it:
  - **The workflow file still lives on `main`.** A `schedule` fires only from
    the default branch, so the job checks out `develop` explicitly
    (`actions/checkout` with `ref: develop`). Nothing runs on a schedule
    until the PR that adds the file has reached `main`.
  - **A green scan does not mean the live site is clean.** While a fix sits on
    `develop` unmerged, `main` can still be vulnerable — the case on the day
    this was written: `develop` had `next` 16.4.5, and `main`, which Vercel
    serves, had 16.3.8. The window closes at merge, and the PR gate checks
    the merge.
  - **Alerts are filed against `develop`.** The Security tab opens on the
    default branch, so the `develop` branch filter shows them; the upload
    must name `develop` as its ref, not the default branch it ran from.
- **Alerting: fail the run, and upload SARIF to Security → Code scanning.**
  GitHub emails about a failed scheduled run; the alerts persist and close
  themselves when a later scan no longer finds them — Arpan, 2026-11-07.
- **Threshold: the PR gate's.** Fail on fixable CRITICAL, report fixable HIGH,
  and read `.trivyignore.yaml`, so ADR-022's exception and its 2026-12-31
  expiry apply here exactly as on a PR — Arpan, 2026-11-07.

## Open questions

Proposed by Claude, for Arpan to confirm or change with the spec:

- **Schedule: Mondays 08:00 UTC**, an hour after CodeQL's 07:00, plus
  `workflow_dispatch` for a run on demand.
- **One Trivy version pin, not two.** Move the install step out of
  `_docker.yml` into a composite action, `.github/actions/setup-trivy`, which
  both workflows use. The alternative is a second copy of `TRIVY_VERSION`,
  which `ci-cd-pipeline.md` already argued against for gitleaks.
- **Proof before merge:** a `pull_request` trigger limited to the new workflow
  file and the composite action, so the PR that adds the workflow runs it. A
  `workflow_dispatch` only becomes available once the file is on `main`.
- **A SARIF category per target** (`trivy-backend`, `trivy-frontend`,
  `trivy-eb`, `trivy-fs`), so one target's clean run cannot close another
  target's alerts.
- **Which jar the production image gets.** `deploy/eb/Dockerfile` copies a
  packaged jar; the job would run `./mvnw -B package -DskipTests` first, as
  `package-eb.mjs` does. To confirm against the Dockerfile at build.

## Files expected to change

- `.github/workflows/trivy-weekly.yml` — new.
- `.github/actions/setup-trivy/action.yml` — new, if the single-pin proposal
  is accepted; then `.github/workflows/_docker.yml` uses it.
- `scripts/docs-map.json` — `.github/actions/` mapped to the two below.
- Docs and rules mapped to `.github/workflows/`:
  [`ci-cd-pipeline.md`](../docs/architecture/ci-cd-pipeline.md) and
  [`rules/ci-and-build.md`](../rules/ci-and-build.md).

## Verification

- `node scripts/verify.mjs --all`, and a YAML parse of each new or changed
  workflow file.
- On the PR that adds it: the workflow runs and every target is scanned. The
  backend jar's known HIGHs (Jackson, Guava, pgjdbc) appear in the report,
  which proves the scan reads the jar. Both ADR-022 CVEs are absent from the
  gate, and four SARIF categories appear under Security → Code scanning.
- After merge to `main`: `gh workflow run trivy-weekly.yml` succeeds; its log
  shows `develop`'s commit checked out, not `main`'s; the SARIF alerts are
  listed under the `develop` branch filter. The first Monday run appears under
  `gh run list --workflow trivy-weekly.yml`.
- `_docker.yml`, if the composite action is adopted: the PR's Docker job
  still installs Trivy 0.74.0 and its gate result is unchanged.

## To update at wrap-up

- **[`ci-cd-pipeline.md`](../docs/architecture/ci-cd-pipeline.md):** the new
  workflow in the file-by-file breakdown and the trigger overview, why the EB
  image is scanned weekly but not on PRs, and the composite action.
- **[`rules/ci-and-build.md`](../rules/ci-and-build.md):** a weekly failure is
  routed like a gate failure, and fixed on `develop`; a green weekly scan
  says nothing about `main` while a fix is unmerged; never let SARIF
  categories collide; Trivy is bumped in one place.
- **`docs-map.json`**, `STATUS.md`, `tasks-completed.md`, and this spec marked
  shipped.
