#!/usr/bin/env node
/**
 * PreToolUse hook — hold the line rules/aws-handling.md only describes.
 *
 * WHY THIS EXISTS
 *
 * aws-handling.md is layers one and two: a rule a session reads if it happens
 * to open a matching file. AWS work does not start with a file read — it starts
 * with a command. A session can run `aws ec2 terminate-instances` having opened
 * nothing, and the rule never loads. This is the layer that does not depend on
 * anybody having read anything, the same argument guard-migrations.mjs makes
 * for Flyway.
 *
 * WHAT IT CHECKS
 *
 * An ALLOWLIST, so it fails closed. A new service or a verb nobody anticipated
 * is refused rather than waved through, which is the opposite of what a list of
 * known-bad verbs does.
 *
 *   Allowed unasked:
 *     - read-only verbs: describe, list, get, head, lookup, search
 *     - the S3 carve-out Arpan granted: create a bucket, write an object, and
 *       the put-bucket-* calls needed to match the campusvibe-prod-media
 *       baseline (encryption, tagging, public access block, ownership, CORS,
 *       versioning)
 *
 *   Refused even though they read:
 *     - secret VALUES. secretsmanager get-secret-value, ssm get-parameter
 *       --with-decryption, ec2 get-password-data. Names and ARNs are fine.
 *     - elasticbeanstalk describe-configuration-settings unless the --query
 *       keeps Value out of the result. It returns every environment variable in
 *       plaintext; this repository is public and .claude/ is committed, so a
 *       value read here is one paste away from a push.
 *
 *   Refused because they are security controls, not S3 plumbing:
 *     - put-bucket-policy and put-bucket-acl, and any write aimed at the
 *       Elastic Beanstalk service bucket.
 *
 * TWO ENTRY POINTS
 *
 * The AWS CLI through Bash, and the aws-core MCP tool aws___run_script, which
 * runs arbitrary boto3 and never passes through a shell. Both are matched. The
 * boto3 side reads operation_name= out of the source; code that builds an
 * operation name dynamically cannot be judged and is refused.
 *
 * KNOWN GAPS — read these before trusting it
 *
 *   1. A command string is not structured input. guard-migrations.mjs reads one
 *      unambiguous file_path; here the verb can hide behind a variable, a
 *      $(...) substitution, a heredoc or a script file. Ordinary shell defeats
 *      this without meaning to.
 *   2. Deny is per invocation, not per effect. `aws s3 cp` onto a key that
 *      already exists still overwrites it, and campusvibe-prod-media has no
 *      versioning (BUG-039).
 *   3. It reads the command, not the account. Nothing here proves which account
 *      the call lands in beyond the profile check.
 *
 * BYPASS
 *
 *   CAMPUSVIBE_ALLOW_AWS_WRITE=1
 *
 * Exit 2 blocks the call and shows stderr to the model. Every other path exits
 * 0: this runs on every Bash call in the session, so a hook that cannot read
 * its own input, or that throws, must never be what stops the work.
 */

import { readFileSync } from "node:fs";

const RULE = ".claude/rules/aws-handling.md";
const BYPASS = "CAMPUSVIBE_ALLOW_AWS_WRITE=1";
const EB_BUCKET = /elasticbeanstalk-[a-z0-9-]+-\d{12}/;

const allow = () => process.exit(0);

function refuse(what, why, remedy) {
  console.error(
    [
      `Refused: ${what}`,
      "",
      why,
      "",
      remedy,
      "",
      `See ${RULE}. If Arpan has approved this, ${BYPASS} bypasses this hook.`,
    ].join("\n"),
  );
  process.exit(2);
}

// ---------------------------------------------------------------- the policy

const READ_VERBS = ["describe", "list", "get", "head", "lookup", "search"];

// Reads that hand back a secret value. Checked before the read allowlist.
const SECRET_READS = [
  { service: "secretsmanager", op: /^(batch-)?get-secret-value$/ },
  { service: "ssm", op: /^get-parameters?(-by-path)?$/, onlyIf: /--with-decryption/ },
  { service: "ec2", op: /^get-password-data$/ },
];

// The S3 carve-out: create a bucket, write an object, and configure a new
// bucket up to the campusvibe-prod-media baseline. Deletion is Arpan's.
const S3API_WRITES = new Set([
  "create-bucket",
  "put-object",
  "copy-object",
  "put-object-tagging",
  "create-multipart-upload",
  "upload-part",
  "upload-part-copy",
  "complete-multipart-upload",
  "abort-multipart-upload",
  "put-bucket-encryption",
  "put-bucket-tagging",
  "put-public-access-block",
  "put-bucket-ownership-controls",
  "put-bucket-cors",
  "put-bucket-versioning",
  "put-bucket-lifecycle-configuration",
]);

const S3_SUBCOMMANDS = new Set(["cp", "mb", "sync", "ls", "website", "presign"]);

const toKebab = (s) =>
  s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2").toLowerCase();

/**
 * The one judgement, shared by both entry points.
 * Returns null to allow, or {what, why, remedy} to refuse.
 */
function judge({ service, operation, raw }) {
  const op = operation.toLowerCase();

  for (const rule of SECRET_READS) {
    if (service !== rule.service || !rule.op.test(op)) continue;
    if (rule.onlyIf && !rule.onlyIf.test(raw)) continue;
    return {
      what: `${service} ${op} returns a secret value.`,
      why: "This repository is public and .claude/ is committed, so a value read\ninto context is one paste away from being pushed.",
      remedy: "Read the name, the ARN or the metadata instead of the value.",
    };
  }

  // Returns every environment variable in plaintext unless the query excludes it.
  if (service === "elasticbeanstalk" && op === "describe-configuration-settings") {
    const query = /--query[= ]/.test(raw) || /["']query["']\s*:/.test(raw);
    if (!query || /Value/.test(raw)) {
      return {
        what: "elasticbeanstalk describe-configuration-settings would return environment variable VALUES.",
        why: "Every variable on the environment comes back in plaintext, secrets included.",
        remedy:
          "Narrow it, e.g.\n  --query \"ConfigurationSettings[0].OptionSettings[?Namespace=='aws:elasticbeanstalk:application:environment'].OptionName\"",
      };
    }
    return null;
  }

  if (READ_VERBS.some((verb) => op === verb || op.startsWith(`${verb}-`))) return null;

  if (service === "s3api" || service === "s3") {
    const writingToEbBucket = EB_BUCKET.test(raw);
    const isWrite = service === "s3api" ? S3API_WRITES.has(op) : op !== "ls" && op !== "presign";

    if (writingToEbBucket && isWrite) {
      return {
        what: "that write targets the Elastic Beanstalk service bucket.",
        why: "Elastic Beanstalk owns and manages that bucket. Application media\nbelongs in campusvibe-prod-media.",
        remedy: "Retarget the call at the media bucket.",
      };
    }
    if (service === "s3api" && S3API_WRITES.has(op)) return null;
    if (service === "s3" && S3_SUBCOMMANDS.has(op)) {
      if (op === "sync" && /--delete\b/.test(raw)) {
        return {
          what: "aws s3 sync --delete removes objects at the destination.",
          why: "Deleting objects needs Arpan, and campusvibe-prod-media has no\nversioning, so a delete is not recoverable.",
          remedy: "Drop --delete, or ask first.",
        };
      }
      return null;
    }
  }

  return {
    what: `${service} ${op} is not a read, and not part of the S3 carve-out.`,
    why: "aws-handling.md allows read-only calls and S3 bucket/object writes\nunasked. Everything else needs Arpan, told first: what changes, why,\nthe cost, the security effect, and the exact command.",
    remedy: "Put those five to Arpan and wait for the answer.",
  };
}

// -------------------------------------------------------------- CLI, via Bash

const VALUE_FLAGS = new Set([
  "--profile",
  "--region",
  "--output",
  "--query",
  "--endpoint-url",
  "--color",
  "--ca-bundle",
  "--cli-read-timeout",
  "--cli-connect-timeout",
  "--cli-binary-format",
]);

/** Every `aws ...` invocation in a command line, split on shell separators. */
function awsInvocations(command) {
  const found = [];
  for (const segment of command.split(/\n|;|\|\||&&|\||\$\(|`/)) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);
    let i = 0;
    while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) i++; // VAR=x aws ...
    const head = tokens[i];
    if (head !== "aws" && !/(^|\/)aws(\.exe)?$/.test(head ?? "")) continue;

    const words = [];
    for (let j = i + 1; j < tokens.length; j++) {
      const token = tokens[j];
      if (token.startsWith("-")) {
        if (VALUE_FLAGS.has(token)) j++; // skip its value
        continue;
      }
      words.push(token);
      if (words.length === 2) break;
    }
    if (words.length === 2) found.push({ service: words[0], operation: words[1], raw: segment });
  }
  return found;
}

// ------------------------------------------------------------ boto3, via MCP

function boto3Invocations(code) {
  const found = [];
  const call = /call_boto3\s*\(([\s\S]*?)\)/g;
  let match;
  while ((match = call.exec(code)) !== null) {
    const args = match[1];
    const service = /service_name\s*=\s*["']([\w-]+)["']/.exec(args);
    const operation = /operation_name\s*=\s*["'](\w+)["']/.exec(args);
    if (!service || !operation) {
      found.push({ service: "<dynamic>", operation: "<dynamic>", raw: code, dynamic: true });
      continue;
    }
    found.push({
      service: service[1] === "s3" ? "s3api" : service[1], // boto3 s3 is the s3api surface
      operation: toKebab(operation[1]),
      raw: code,
    });
  }
  return found;
}

// ------------------------------------------------------------------- the hook

try {
  if (process.env.CAMPUSVIBE_ALLOW_AWS_WRITE === "1") allow();

  let payload;
  try {
    payload = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    allow();
  }

  const tool = payload?.tool_name ?? "";
  const input = payload?.tool_input ?? {};

  let invocations = [];
  let profilePinned = true;

  if (tool === "Bash") {
    const command = typeof input.command === "string" ? input.command : "";
    if (!command.includes("aws")) allow();
    invocations = awsInvocations(command);
    profilePinned =
      Boolean(process.env.AWS_PROFILE) ||
      /--profile\b/.test(command) ||
      /AWS_PROFILE=/.test(command);
  } else if (tool.includes("aws___run_script")) {
    invocations = boto3Invocations(typeof input.code === "string" ? input.code : "");
  } else {
    allow();
  }

  if (invocations.length === 0) allow();

  // The default profile holds a dead static key; an unpinned call fails with a
  // bare InvalidClientTokenId that says nothing about why.
  if (!profilePinned) {
    refuse(
      "that AWS call names no profile.",
      "The default profile holds a dead static key and fails InvalidClientTokenId.\nAn AWS_PROFILE exported in a terminal does not reach a tool shell.",
      "Pass --profile campusvibe-admin, or export AWS_PROFILE in the same command.",
    );
  }

  for (const invocation of invocations) {
    if (invocation.dynamic) {
      refuse(
        "that boto3 call builds its operation name dynamically.",
        "This hook judges the operation it can read in the source. One it cannot\nread is refused rather than assumed safe.",
        "Write operation_name as a literal, or run the equivalent AWS CLI command.",
      );
    }
    const verdict = judge(invocation);
    if (verdict) refuse(verdict.what, verdict.why, verdict.remedy);
  }

  allow();
} catch {
  allow(); // never be the reason a session stops
}
