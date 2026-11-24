<!--
Title: type(scope): summary, the same rules as a commit subject, because the
squash merge uses it. Example: feat(clubs): let owners pin an event
Suggested branch name: <owner>/<type>/<slug>, e.g. arpan/feat/club-pinned-events
/open-pr drafts this whole description for you from your session.
-->

Spec:

## What and why

<!-- Two to four sentences: what a student or club sees differently, and why. -->

## How I tested

<!-- What you ran in the local docker compose stack and what you saw. Name the tests you added. -->

- [ ] `node scripts/verify.mjs` passes
- [ ] Tried it in the local stack (`docker compose up`)

## Screenshots or clip

<!-- UI changes only. Delete this section otherwise. -->

## Checklist

- [ ] Everything in this PR is in the spec; anything extra is listed here
- [ ] Each behaviour in the spec has a test
- [ ] DTO field changes went through `contracts/api-dto-fields.json` and both contract tests
- [ ] `/wrap-up` ran, so STATUS, TODO and docs change in this PR
