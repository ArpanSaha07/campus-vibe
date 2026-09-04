---
name: database-lifecycle
description: Standards for CampusVibe database migrations, seeding, and data ownership. Use this skill when adding or editing a Flyway migration, seeding mock/demo data, bootstrapping an admin account, granting roles, or deciding whether a change belongs in SQL, a dev seeder, or normal application CRUD.
---

# Flyway, Database Seeding & Data Management Standards

Mandatory standards for database migrations, mock data, and real application
data in the CampusVibe backend. Follow these for every database-related change.

This file is the rules. The current-state audit, the reasoning behind each rule,
and the ordered implementation sequence live in `PLAN.md` beside it.

---

# Guiding Principles

1. Flyway manages **database schema**, not application content.
2. Application data is created through the application.
3. Mock data is isolated from production.
4. Secrets are never committed to Git.
5. Migrations become immutable once shared.

---

# Known Deviations (read before "fixing" these)

The codebase does not yet fully satisfy these standards. These are tracked — do
not silently rewrite them.

| Deviation | Status |
|---|---|
| `V6__insert_mock_clubs.sql` seeds 8 clubs + images through Flyway | **Retired 2026-08-16** by `V12__remove_mock_club_seed_data.sql`. Both files stay: deleting V6 breaks Flyway validation. The clubs now come from `seed/DevDataSeeder` under the `dev` profile. |
| `V7__multi_role_rbac.sql` creates tables AND inserts the 3 role rows | Applied. Mixes schema with reference data. Leave as-is; keep them separate going forward. |
| No `dev` profile or `application-dev.yml` exists | **Resolved 2026-08-16.** `application-dev.yml` exists and `docker-compose.yml` sets `SPRING_PROFILES_ACTIVE: ${SPRING_PROFILES_ACTIVE:-dev}`. |

Steps 1–4 of PLAN.md's Implementation Sequence are therefore done; Step 5
(production posture in Elastic Beanstalk) is not, and automated tests for the
bootstrap and seeder are still open in `todo.md` — their verification so far was
manual.

**The lesson worth carrying forward** is the one that step turned up. Seeding
through the service layer is mandated here so that derived columns get written,
but doing it exposed that `ClubService.create` was not writing them either
([BUG-034](../../bugs/fixed_bugs.md#bug-034)): `Club.id` is assigned rather than
generated, so Hibernate had not issued the INSERT when the raw-JDBC embedding
UPDATE ran, and it silently matched zero rows. Any code that mixes a JPA write
with a `JdbcTemplate` write in one transaction needs a flush between them —
`JdbcTemplate` is not a JPA query and will not trigger one.

---

# Ownership: what writes what

| Data | Owner |
|---|---|
| Tables, columns, constraints, foreign keys, indexes, views | Flyway |
| Stable reference data — roles, permissions, event categories, visibility types, system lookups | Flyway |
| Mock/demo clubs, events, users | Dev seeder (`@Profile("dev")`) |
| Initial admin role grant | Bootstrap runner |
| Everything users create or edit at runtime | Application (Controller → Service → Repository) |

## Flyway MUST NOT contain

User-created events or clubs, user profiles, bookmarks, followers, messages,
tickets, payments, OAuth users, personal admin accounts, or frequently changing
demo data.

The test: **if the data can be created from the frontend, API, or admin
dashboard, it does not belong in Flyway.**

---

# Migration Rules

## Naming

Descriptive and intent-revealing.

Good — `V1__create_users_table.sql`, `V3__add_event_capacity.sql`,
`V4__insert_reference_roles.sql`

Bad — `V5.sql`, `V6__changes.sql`, `V7__update.sql`

## One responsibility per migration

One logical change per file. "Create events table", or "Add event capacity
column" — never "create events table + add users table + create indexes + insert
demo users" in one file.

Keep reference-data inserts in their own migration, separate from the schema
migration that creates the table.

## Never edit released migrations

Once applied to shared development, staging, or production, a migration is
immutable. Add `V12__add_capacity_column.sql`; do not modify
`V8__create_events.sql`.

**Local exception** — editing is acceptable only when ALL are true: the project
is still early, the migration exists only locally, and the local database can be
recreated.

## Never delete an applied migration file

Deleting the `.sql` does not undo it. The `flyway_schema_history` row remains,
and startup fails validation:

```
Detected applied migration not resolved locally: 6
```

The application will not boot.

To retire a bad migration, **supersede** it — add a new migration reversing the
effect and leave the original file in place:

```
V9__remove_mock_club_seed_data.sql
```

Deleting the file is acceptable only when the entire local database is dropped
and rebuilt (`docker compose down -v`), and only if the migration never ran
anywhere else.

---

# Reference Data Rules

Reference data belongs in Flyway. Examples: `ROLE_USER`, `ROLE_ADMIN`,
`ROLE_CLUB_ADMIN`, event categories, visibility settings.

It must rarely change, exist in every environment, and contain no secrets.
Prefer idempotent inserts so repeated local resets do not duplicate rows.

---

# Real Data Rules

Real application data is never managed by Flyway — new events, club updates,
profile edits, bookmarks, RSVPs. These happen through
Controller → Service → Repository → database, never through migration scripts.

---

# Mock Data Rules

Mock data is not migration data. It belongs in a development seeder, dev-only
SQL, or an import script — never inside a versioned Flyway migration.

**Good mock data:** development clubs, development users, sample events, demo
organizers, UI-testing fixtures.

**Bad mock data:** your personal account, real email addresses, real passwords,
production users, changing demo events committed into Flyway.

## Development Seeder Rules

Seeders must run only under the `dev` profile, never in production or test, be
idempotent, avoid duplicates, and recreate a demo environment quickly. Always
check whether data already exists before inserting.

---

# Derived Data Rules

Some columns are not authored — they are computed by the service layer:

- `clubs.embedding`  — written by `SearchIndexService.indexClub`
- `events.embedding` — written by `SearchIndexService.indexEvent`

Any seed that inserts rows with derived columns MUST either:

1. write through the service/repository layer, so the value is produced as a
   side effect of the normal write path (**preferred**), or
2. trigger a backfill afterwards —
   `POST /api/v1/search/reindex` (requires `ROLE_ADMIN`).

Raw `INSERT` bypasses the service layer and leaves derived columns NULL. This is
not hypothetical: every club seeded by `V6__insert_mock_clubs.sql` has
`embedding IS NULL` and is invisible to the semantic half of hybrid search.

---

# Admin Bootstrap Rules

The initial admin account is not a Flyway migration. Use an `ApplicationRunner`
— never `@PostConstruct`, which can race Flyway on a cold start.

Configuration comes from environment variables:

```
APP_BOOTSTRAP_ADMIN_ENABLED
APP_BOOTSTRAP_ADMIN_EMAIL
APP_BOOTSTRAP_ADMIN_PASSWORD     (only when the account must be created)
```

Do NOT invent `_FIRST_NAME` / `_LAST_NAME` variables — `users` has a single
`name` column.

## Support both modes

- **Promote an existing user** (the common case) — the account already exists
  from sign-up or Google OAuth, so only grant the role. No password is involved;
  OAuth accounts have none.
- **Create, then grant** — only when the email does not exist yet. Hash the
  password with the same encoder the real sign-up path uses.

## Required behavior

1. `ENABLED` false or `EMAIL` blank → no-op.
2. Look up the user by email.
3. Absent + password supplied → create the user (hashed). Absent + no password →
   log a warning and stop; never create a password-less account.
4. Grant `ROLE_ADMIN` idempotently. `user_roles` PK is `(user_id, role_id)`, so
   `ON CONFLICT DO NOTHING` is the correct guard.
5. Log which email was elevated, so the action is auditable.

## Never revoke

Bootstrap grants only. It must not remove `ROLE_ADMIN` from accounts the env var
no longer names — that would silently lock administrators out of production on
an unrelated config change. Revocation is a deliberate manual act.

---

# Secrets Rules

Never commit passwords, API keys, OAuth secrets, JWT secrets, personal email
addresses, or production credentials.

Never place secrets inside Flyway SQL, Java source, YAML, properties files, or
committed JSON.

Secrets belong in the local `.env`, Elastic Beanstalk environment variables, or
AWS Secrets Manager (future).

---

# Environment Rules

| Environment | Config source |
|---|---|
| Local | `.env` + `application-dev.yml` |
| Testing | `application-test.yml` |
| Production | environment variables + cloud secret manager |

Commit `.env.example`. Never commit `.env`.

---

# CRUD Rules

Runtime data flows through the application, never through migrations:

```
Frontend → POST   /events      → Service → Repository → INSERT
Frontend → PUT    /events/{id} → Service → Repository → UPDATE
Frontend → DELETE /events/{id} → Service → Repository → DELETE
```

None of these operations create or modify a Flyway migration.

---

# Schema Change Rules

**Structure changes → create a migration.**
Add column · create index · add constraint · rename table.

**Content changes → do NOT create a migration.**
User edits profile · club changes description · user creates event · user
bookmarks event.

---

# Repository Structure

```
src/main/resources/db/
    migrations/          <-- PLURAL. application.yml pins
        V1__ ... V8__        locations: classpath:db/migrations

src/main/java/com/campusvibe/bootstrap/
    AdminBootstrapRunner

src/main/java/com/campusvibe/seed/
    DevDataSeeder
```

Keep these responsibilities separate.

The directory is `db/migrations`, not `db/migration`. Flyway resolves exactly
the configured path; a migration placed in the singular directory is silently
never applied.

---

# Checklists

## Before creating a Flyway migration

Confirm ALL — schema changed · not user data · no secrets · descriptive filename
· one logical responsibility. If any fails, do not create a migration.

## Before adding mock data

Ask: *"Will this data exist in production forever?"* If no, it goes in the
development seeder, not Flyway.

## Before committing

Verify — no personal accounts · no real email addresses · no passwords · no API
keys · no changing mock data in migrations · migrations forward-only · migration
names descriptive.

---

# CampusVibe Standards

| Layer | Owns |
|---|---|
| Flyway | database schema + stable reference data |
| Development seeder | mock users, clubs, events, demo data |
| Bootstrap runner | initial admin account |
| Application | all runtime CRUD operations |

This separation is mandatory throughout the project.
