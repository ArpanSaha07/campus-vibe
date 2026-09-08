#!/usr/bin/env node
/**
 * Flyway migration lint.
 *
 * These rules used to live as inline shell inside
 * .github/workflows/_database.yml, which meant they could only ever fail on
 * GitHub — minutes after a push, on a change that is expensive to amend once
 * the migration has been applied anywhere. They are here instead so the
 * pre-push hook and CI run the same checks from one implementation; the
 * workflow now calls this file.
 *
 * Node rather than shell so it behaves the same on Windows, where the hook's
 * `grep` pipeline is Git Bash's and `verify.mjs` is already the thing the hook
 * shells out to.
 *
 * Usage:
 *   node scripts/lint-migrations.mjs           # exits 1 on any error
 *   node scripts/lint-migrations.mjs --quiet   # print only problems
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));

// PLURAL. application.yml pins Flyway to classpath:db/migrations, and a file
// dropped in the singular directory is silently never applied.
const MIGRATIONS_DIR = join(REPO, "backend", "src", "main", "resources", "db", "migrations");
const REL = "backend/src/main/resources/db/migrations";

const quiet = process.argv.includes("--quiet");

const errors = [];
const warnings = [];

function error(file, message) {
  errors.push(file ? `${REL}/${file}: ${message}` : message);
}

function warn(file, message) {
  warnings.push(file ? `${REL}/${file}: ${message}` : message);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const NAME_PATTERN = /^V[0-9]+__[a-z0-9_]+\.sql$/;

// Deliberately the same shape as the workflow's grep. It is broad on purpose:
// a migration runs in EVERY environment including production and is immutable
// once applied, so anything personal committed here is permanent.
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

// The sanctioned placeholder domains. Examples in comments and mock seed data
// must use these; see V10__auth_provider.sql, which carries the same note.
const ALLOWED_EMAIL_DOMAINS = /@campus\.(com|edu)$/i;

const SECRET_PATTERN = /(password|secret|api[_-]?key|token)\s*(=|:)\s*['"][^'"]{6,}/gi;

// Advisory only. User rows come from sign-up, OAuth, or the bootstrap runner —
// never from Flyway.
const USER_INSERT_PATTERN = /INSERT\s+INTO\s+users/gi;

function lint() {
  if (!existsSync(MIGRATIONS_DIR)) {
    error(null, `Migrations directory not found: ${REL}`);
    return;
  }

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    error(null, `No .sql files in ${REL}`);
    return;
  }

  if (!quiet) {
    console.log(`Linting ${files.length} migration(s) in ${REL}`);
  }

  const versions = new Map();

  for (const file of files) {
    if (!NAME_PATTERN.test(file)) {
      error(file, `bad name. Expected V<n>__<snake_case>.sql`);
      continue;
    }

    // Flyway refuses to start on a duplicate version, but only at runtime —
    // which on a shared database means after the bad file has already shipped.
    const version = file.match(/^V([0-9]+)__/)[1];
    if (versions.has(version)) {
      error(file, `duplicate version V${version}, already used by ${versions.get(version)}`);
    } else {
      versions.set(version, file);
    }

    const contents = readFileSync(join(MIGRATIONS_DIR, file), "utf8");

    contents.split(/\r?\n/).forEach((line, index) => {
      const lineNo = index + 1;

      // Checked per match rather than per line: a line carrying both an allowed
      // and a real address must still fail, which a line-level allowlist filter
      // would let through.
      for (const match of line.match(EMAIL_PATTERN) ?? []) {
        if (!ALLOWED_EMAIL_DOMAINS.test(match)) {
          error(
            file,
            `line ${lineNo}: real-looking email address '${match}'.\n` +
              `    Comments count too. Use an @campus.com or @campus.edu example instead;\n` +
              `    personal accounts are bootstrapped from environment variables, never seeded in SQL.`,
          );
        }
      }

      for (const match of line.match(SECRET_PATTERN) ?? []) {
        error(file, `line ${lineNo}: possible secret literal '${match.slice(0, 40)}...'`);
      }

      if (USER_INSERT_PATTERN.test(line)) {
        warn(file, `line ${lineNo}: inserts into users. Accounts must not be seeded through Flyway.`);
        USER_INSERT_PATTERN.lastIndex = 0;
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

lint();

for (const w of warnings) {
  console.warn(`  warning: ${w}`);
}

if (errors.length > 0) {
  console.error(`\nMigration lint failed - ${errors.length} problem(s):\n`);
  for (const e of errors) {
    console.error(`  error: ${e}`);
  }
  console.error(
    `\nThese run in every environment and are immutable once applied,\n` +
      `which is why they are checked before the push rather than after.\n`,
  );
  process.exit(1);
}

if (!quiet) {
  console.log("Migration lint passed.");
}
