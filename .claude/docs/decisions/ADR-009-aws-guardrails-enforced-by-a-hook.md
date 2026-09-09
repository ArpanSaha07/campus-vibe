# ADR-004 — AWS guardrails are enforced by a fail-closed hook, not by prose

**Status:** Proposed — only Arpan moves this to Accepted
**Date:** 2026-09-08
**Raised by:** reviewing [`rules/aws-handling.md`](../../rules/aws-handling.md),
which turned out to be unenforceable in two separate ways at once.
**Approved by:** — (pending)
**Implemented in:** `scripts/hooks/guard-aws.mjs`, registered in
`.claude/settings.json` — shipped 2026-09-08 (`7e7c4b5`)

## Context

`aws-handling.md` stated the right policy and could not apply it.

It carried no frontmatter, so the path-scoped loader every other file in
`rules/` relies on had nothing to match and the file loaded on nothing. That
alone was a one-line fix. The second problem is structural and is why this is an
ADR rather than a bug: **the other six rules fire when a source file is read,
and AWS work does not begin with a file read.** It begins with a command. A
session can call `aws ec2 terminate-instances` having opened no file at all —
which is exactly what happened in the session that found this, where seven AWS
calls ran before any project file was touched.

There is also more than one way in. The `aws-core` plugin is enabled in
`settings.json` and exposes `aws___run_script`, which executes arbitrary boto3
and never passes through a shell, so anything that inspects shell commands sees
none of it.

The account is not a sandbox: one Elastic Beanstalk environment serving as
production, one media bucket with **no versioning and no lifecycle**, and an
administrator-equivalent SSO role.

## Options considered

**A. Prose only — fix the frontmatter and stop there.** Costs nothing and
changes nothing about the failure mode: a rule that loads on a file read still
does not load before a command, and a rule that does load is advice a session
can read past. Every AWS operation would remain gated on the agent having
happened to read the right file first.

**B. A `permissions.deny` list in `settings.json`.** No code, nothing to
maintain, and it applies before the tool runs. But it matches patterns and
cannot express a condition. The policy Arpan set has conditions in it: writing
an S3 object is allowed while deleting one is not; a bucket may be created but
its policy may not be written; `describe-configuration-settings` is a read that
must be refused when it asks for `Value` and allowed when it asks for
`OptionName`. Encoding those as patterns produces either a list too coarse to
express the carve-out or one long enough that nobody can tell what it permits.

**C. A `PreToolUse` hook.** Real code, so it can hold conditions, and it runs on
every tool call whether or not any rule was read. The repository already has
this shape working — `guard-migrations.mjs` refuses a Flyway edit that cannot
ship, and its header makes the same argument this ADR makes: it is *the only
layer that does not depend on anybody having read anything*. The costs are that
it must be maintained alongside the rule it enforces, and that judging a shell
command string is inherently weaker than judging a structured `file_path`.

**Blocklist or allowlist, given C.** A list of known-dangerous verbs fails open:
every service and verb nobody anticipated is permitted by default, so the guard
silently weakens as AWS grows. An allowlist fails closed — an unrecognised verb
is refused — at the cost of blocking harmless calls until the list is extended.

## Decision

**C, allowlisted.** `guard-aws.mjs` runs before every `Bash` call and every
`aws___run_script`, permits read verbs and the S3 carve-out, and refuses
everything else with the five things `aws-handling.md` requires be said first.
Reads that return a secret value are refused despite being reads, because this
repository is public and `.claude/` is committed.

`CAMPUSVIBE_ALLOW_AWS_WRITE=1` is the bypass, mirroring
`CAMPUSVIBE_ALLOW_MIGRATION_EDIT=1`. A guard with no way through gets deleted
the first time it is wrong about something urgent.

Prose is kept as well, not replaced: the hook says no, the rule says why.

## Consequences

- The rule and the hook are now one unit. `guard-aws.mjs` is only correct with
  respect to what `aws-handling.md` claims, so `guard-aws.test.mjs` asserts the
  rule sentence by sentence and `verify.mjs` runs it when either changes.
- `verify.mjs` gains a step that mirrors no workflow, against the local/CI
  parity rule it exists to serve. A runner has no agent session for a
  `PreToolUse` hook to guard, so there is nothing for CI to assert;
  [`rules/ci-and-build.md`](../../rules/ci-and-build.md) names this as the one
  deliberate exception so it is not later reconciled away.
- Refusals will land on legitimate work. That is the allowlist working, and the
  remedy is to widen the list deliberately or use the bypass — never to loosen
  the default.
- Three gaps are accepted and documented in the hook's header: a command string
  can hide its verb behind a variable or a script file; an allowed `s3 cp` still
  overwrites an unversioned key ([BUG-039](../../bugs/bugs.md#bug-039)); and the
  hook reads the command, not the account it lands in.

## Revisit when

Provisioning moves to infrastructure as code, or a deploy pipeline starts making
AWS calls without a session behind them. A hook guards an agent at a keyboard;
it has nothing to say about a GitHub Actions job assuming a role, which is what
the OIDC item in [`todo.md`](../../TODO/todo.md) will introduce.
