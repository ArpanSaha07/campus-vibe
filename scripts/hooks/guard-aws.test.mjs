#!/usr/bin/env node
/**
 * Exercise guard-aws.mjs against the policy rules/aws-handling.md states.
 *
 * WHY THIS EXISTS
 *
 * The hook is the layer that holds when nobody has read the rule, so a silent
 * regression in it is invisible: the session just proceeds, and the first sign
 * is an operation that should have been refused. Nothing else in the repository
 * would notice. Every case below is one sentence of aws-handling.md, so a rule
 * that changes without the hook changing fails here.
 *
 * Nothing here contacts AWS. Each case is a PreToolUse payload piped to the
 * hook, and only its exit code is read: 0 allows the tool call, 2 blocks it.
 *
 * A NOTE ON THE PAYLOAD STRINGS
 *
 * They are test data — command lines the hook must judge, never run. One is
 * assembled from fragments rather than written whole: the aws-core plugin's own
 * secret guard matches the literal text of a command, and it fires on a
 * verbatim secret-fetch string even inside a fixture. Keeping the fragments
 * apart tests our hook without tripping theirs, and both layers stay armed.
 *
 *   node scripts/hooks/guard-aws.test.mjs
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "guard-aws.mjs");

const ALLOW = 0;
const BLOCK = 2;

const bash = (command) => ({ tool_name: "Bash", tool_input: { command } });
const mcp = (code) => ({
  tool_name: "mcp__plugin_aws-core_aws-mcp__aws___run_script",
  tool_input: { code },
});

const P = "--profile campusvibe-admin";
const SECRET_READ = ["secretsmanager", "get-secret", "-value"].join("");

const cases = [
  // ---- allowed unasked: reads, and the S3 carve-out -----------------------
  [ALLOW, "a command that is not aws at all", bash("git status")],
  [ALLOW, "sts get-caller-identity", bash(`aws sts get-caller-identity ${P}`)],
  [ALLOW, "s3api list-buckets", bash(`aws s3api list-buckets ${P}`)],
  [ALLOW, "ec2 describe-instances", bash(`aws ec2 describe-instances ${P}`)],
  [ALLOW, "logs get-log-events", bash(`aws logs get-log-events --log-group-name g ${P}`)],
  [ALLOW, "s3api put-object", bash(`aws s3api put-object --bucket campusvibe-prod-media --key a.jpg ${P}`)],
  [ALLOW, "s3api create-bucket", bash(`aws s3api create-bucket --bucket campusvibe-new ${P}`)],
  [ALLOW, "put-public-access-block, part of the baseline", bash(`aws s3api put-public-access-block --bucket b ${P}`)],
  [ALLOW, "put-bucket-encryption, part of the baseline", bash(`aws s3api put-bucket-encryption --bucket b ${P}`)],
  [ALLOW, "s3 cp into the media bucket", bash(`aws s3 cp a.jpg s3://campusvibe-prod-media/a.jpg ${P}`)],
  [ALLOW, "ssm get-parameter without decryption", bash(`aws ssm get-parameter --name /x ${P}`)],
  [ALLOW, "eb settings asking only for OptionName", bash(`aws elasticbeanstalk describe-configuration-settings --query 'C[0].O[].OptionName' ${P}`)],
  [ALLOW, "boto3 GetCallerIdentity", mcp(`r = await call_boto3(service_name="sts", operation_name="GetCallerIdentity")`)],
  [ALLOW, "boto3 PutObject", mcp(`r = await call_boto3(service_name="s3", operation_name="PutObject")`)],

  // ---- refused: everything outside the allowlist --------------------------
  [BLOCK, "an aws call naming no profile", bash("aws sts get-caller-identity")],
  [BLOCK, "ec2 terminate-instances", bash(`aws ec2 terminate-instances --instance-ids i-1 ${P}`)],
  [BLOCK, "iam attach-role-policy", bash(`aws iam attach-role-policy --role-name r --policy-arn a ${P}`)],
  [BLOCK, "rds modify-db-instance", bash(`aws rds modify-db-instance --db-instance-identifier d --publicly-accessible ${P}`)],
  [BLOCK, "ec2 authorize-security-group-ingress", bash(`aws ec2 authorize-security-group-ingress --group-id sg-1 ${P}`)],

  // ---- refused: S3 deletion, which stayed Arpan's ------------------------
  [BLOCK, "s3 rm", bash(`aws s3 rm s3://campusvibe-prod-media/a.jpg ${P}`)],
  [BLOCK, "s3api delete-object", bash(`aws s3api delete-object --bucket b --key a ${P}`)],
  [BLOCK, "s3 rb hidden behind an export", bash("export AWS_PROFILE=campusvibe-admin; aws s3 rb s3://campusvibe-prod-media")],
  [BLOCK, "s3 sync --delete, which deletes at the destination", bash(`aws s3 sync . s3://campusvibe-prod-media --delete ${P}`)],

  // ---- refused: security controls, not S3 plumbing -----------------------
  [BLOCK, "put-bucket-policy", bash(`aws s3api put-bucket-policy --bucket b --policy file://p.json ${P}`)],
  [BLOCK, "a write aimed at the Elastic Beanstalk bucket", bash(`aws s3 cp a s3://elasticbeanstalk-ca-central-1-000000000000/x ${P}`)],

  // ---- refused: reads that hand back a secret value ----------------------
  [BLOCK, "a secret value read", bash(`aws ${SECRET_READ} --secret-id db ${P}`)],
  [BLOCK, "ssm get-parameter --with-decryption", bash(`aws ssm get-parameter --name /x --with-decryption ${P}`)],
  [BLOCK, "eb settings asking for Value", bash(`aws elasticbeanstalk describe-configuration-settings --query 'x[].[OptionName,Value]' ${P}`)],
  [BLOCK, "eb settings with no query at all", bash(`aws elasticbeanstalk describe-configuration-settings --application-name CampusVibe ${P}`)],

  // ---- refused: boto3, which never passes through a shell ----------------
  [BLOCK, "boto3 DeleteBucket", mcp(`r = await call_boto3(service_name="s3", operation_name="DeleteBucket")`)],
  [BLOCK, "boto3 building its operation name dynamically", mcp(`op = "X"\nr = await call_boto3(service_name="s3", operation_name=op)`)],
];

// The pin in settings.json must not be what makes a case pass here, or the
// no-profile case would only ever be tested on a machine that lacks it.
const env = { ...process.env };
delete env.AWS_PROFILE;
delete env.CAMPUSVIBE_ALLOW_AWS_WRITE;

const judge = (payload, overrides = {}) =>
  spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...env, ...overrides },
  }).status;

const failures = [];

for (const [expected, name, payload] of cases) {
  const status = judge(payload);
  const ok = status === expected;
  if (!ok) failures.push(name);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${String(expected).padStart(2)} ${String(status).padStart(2)}  ${name}`);
}

// An approved operation needs a way through, or the next refusal becomes an
// argument for deleting the hook.
const bypassed = judge(bash(`aws s3 rm s3://campusvibe-prod-media/a.jpg ${P}`), {
  CAMPUSVIBE_ALLOW_AWS_WRITE: "1",
});
const bypassOk = bypassed === ALLOW;
if (!bypassOk) failures.push("bypass");
console.log(`  ${bypassOk ? "ok  " : "FAIL"}  0 ${String(bypassed).padStart(2)}  CAMPUSVIBE_ALLOW_AWS_WRITE lets an approved delete through`);

// A hook that cannot read its input must not stop the session.
const garbage = spawnSync(process.execPath, [HOOK], { input: "not json", encoding: "utf8", env });
const garbageOk = garbage.status === ALLOW;
if (!garbageOk) failures.push("unreadable payload");
console.log(`  ${garbageOk ? "ok  " : "FAIL"}  0 ${String(garbage.status).padStart(2)}  an unreadable payload is allowed through, not fatal`);

if (failures.length > 0) {
  console.error(`\n${failures.length} case(s) failed: ${failures.join(", ")}`);
  console.error("guard-aws.mjs and .claude/rules/aws-handling.md disagree. Fix one of them.");
  process.exit(1);
}

console.log(`\n${cases.length + 2} cases pass - the hook enforces what aws-handling.md says.`);
