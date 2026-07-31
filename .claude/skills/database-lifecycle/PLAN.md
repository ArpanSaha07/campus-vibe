# CampusVibe Backend Data & Bootstrapping Plan

## Purpose

This document defines the recommended approach for handling database schema changes, reference data, mock data, and initial admin/user bootstrapping for the CampusVibe project.

The goal is to keep the codebase safe, maintainable, reproducible, and aligned with common industry practice:

* Use **Flyway** for versioned database schema evolution and controlled reference data.
* Keep **application data** out of Flyway migrations.
* Bootstrap **admin and demo users** outside migrations, using environment-driven startup logic or secure seed workflows.
* Manage **mock data** with development-only mechanisms so it is easy to reset, change, or remove.

This plan assumes a stack similar to:

* Spring Boot backend
* PostgreSQL database
* Flyway for migrations
* Git-based deployment workflow

---

## Current State (audited)

Facts as measured against the running local database and the repo. The rest of
this plan is written to move from here to the target state.

**Migrations** — 8 applied, all `success = t`:

```
V1 create user table        V5 approved club admins
V2 create club table        V6 insert mock clubs      <-- violates mock-data rule
V3 create event table       V7 multi role rbac        <-- mixes schema + reference data
V4 create user links        V8 search embeddings
```

Path is `src/main/resources/db/migrations/`.

**Profiles** — `application.yml`, `application-prod.yml`, `application-test.yml`.
There is **no `application-dev.yml` and no `dev` profile.**
`SPRING_PROFILES_ACTIVE` is referenced only in `EB-DEPLOYMENT.md` for prod;
`docker-compose.yml` sets no profile at all.

**Bootstrap** — no `bootstrap/` or `seed/` package exists. No admin bootstrap
mechanism of any kind. The only `ROLE_ADMIN` references are two authorization
checks in `ClubPermissionService.java:34,51`.

**Data** — one real user, no admin:

| id | email | roles |
|----|-------|-------|
| 1 | (the developer's account) | `ROLE_USER` only |

| table | rows | with embedding |
|-------|------|----------------|
| clubs | 8 (all from V6) | 0 |
| events | 0 | 0 |

The zero-embeddings figure is the direct, measurable consequence of seeding
through raw SQL instead of the service layer. It is the main evidence behind the
Pattern A recommendation below.

---

## Core Principles

### 1. Separate schema from data lifecycle

Flyway should manage database structure and a small amount of stable reference data. It should not be used as a content-management system for everyday records like clubs, events, or users created through the app.

### 2. Keep migrations immutable after release

Once a migration has been applied to any shared environment, treat it as immutable. If the database needs a new change, create a new migration file rather than editing an old one.

### 3. Never store secrets in migrations

Passwords, API keys, personal user details, and production-only bootstrap credentials must not be committed into Flyway SQL files.

### 4. Make bootstrapping idempotent

Admin and seed creation logic should be safe to run more than once without creating duplicates.

### 5. Make development easy to reset

Mock data should be easy to load, clear, and regenerate for local development.

---

## Recommended Responsibilities

### Flyway should handle

* Creating tables
* Adding or changing columns
* Constraints
* Indexes
* Foreign keys
* Stable reference data

  * roles
  * categories
  * permissions
  * system-level lookup values

### Flyway should not handle

* Real admin credentials
* End-user records
* Clubs created through the frontend
* Events created through the frontend
* Bookmarks, follows, RSVPs, chats, and similar runtime data
* Frequently edited mock data that changes during development

---

## Flyway Implementation Strategy

### Migration file conventions

Use a clear and consistent naming format:

* `V1__create_users_table.sql`
* `V2__create_clubs_table.sql`
* `V3__create_events_table.sql`
* `V4__add_user_role_column.sql`
* `V5__insert_reference_roles.sql`

Recommended rules:

* One logical change per migration.
* Do not combine unrelated schema changes in one file.
* Use descriptive names that explain the intent, not the implementation details.
* Never rename or edit an already-applied migration except in very early disposable development databases.

### What belongs in migrations

Use migrations for deterministic database setup:

```sql
CREATE TABLE users (...);
ALTER TABLE events ADD COLUMN location VARCHAR(255);
CREATE INDEX idx_events_start_time ON events(start_time);
INSERT INTO roles (name) VALUES ('USER'), ('CLUB_ADMIN'), ('ADMIN');
```

### What does not belong in migrations

Do not put dynamic app-generated content into Flyway, such as:

* event rows created from the frontend
* club rows created by an admin dashboard
* user profiles created during sign-up
* test data that changes often
* local experiments

---

## Reference Data Strategy

Reference data is stable data the application expects to exist in every environment.

Examples:

* roles
* default event categories
* fixed visibility options
* system configuration defaults

### Recommended practice

Keep reference data migrations separate from schema migrations.

Examples:

* `V1__create_users_table.sql`
* `V2__create_roles_table.sql`
* `V3__insert_default_roles.sql`

Use idempotent inserts where practical, such as:

```sql
INSERT INTO roles (name)
SELECT 'ADMIN'
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE name = 'ADMIN'
);
```

This reduces friction when setting up local databases and helps avoid duplicate seed values during repeated resets.

---

## Mock Data Strategy

Mock data should be treated as a separate concern from Flyway migrations.

### Best option: development-only seeding

Use a development profile that loads mock data on startup only in local/dev environments.

Recommended approach:

* Create a `dev` Spring profile.
* Add a seeder component that runs only under `dev`.
* Load clubs, events, and sample users programmatically or from dedicated seed files.
* Make the seeding logic idempotent.

### Why this is better than Flyway for mock data

* mock data changes often
* data can be recreated without changing schema history
* it is easier to delete and regenerate
* it avoids cluttering migration history with repeated edits
* it keeps production safer

### Good mock data patterns

Use one of these patterns:

#### Pattern A: programmatic seeder — USE THIS FOR CAMPUSVIBE

Create entities through services/repositories in a startup runner.

Good when:

* entities have relationships
* IDs need to be consistent
* seed logic is more complex than raw SQL
* password hashing is needed
* **columns are derived by the service layer**

The last point is decisive here and is not a matter of taste. `clubs.embedding`
and `events.embedding` are written by `SearchIndexService` as a side effect of
the normal create/update path. Seeding through the service layer populates them
for free; seeding with SQL leaves them NULL and the rows never match semantic
search. The 8 existing V6 clubs demonstrate the failure exactly — see
Current State.

If Pattern B or C is ever used anyway, the seed is only complete after a
`POST /api/v1/search/reindex` backfill.

#### Pattern B: dedicated seed SQL loaded only in dev

Store SQL seed files outside the Flyway migration path and load them only in development.

Good when:

* data is simple
* you want SQL readability
* you want easy iteration without schema impact

#### Pattern C: import script or admin panel seeding

Use a manual or semi-automated script to populate the development database.

Good when:

* seed data is large
* realistic content matters
* you want to validate app behavior through actual API flows

### Avoid

* editing old Flyway files every time mock data changes
* using migration files as a permanent editing surface for development content
* committing personal or secret bootstrap details into version control

---

## Admin Bootstrapping Strategy

The initial admin account is special and should be handled separately from normal users.

### Recommended approach

Use environment-driven bootstrap logic executed at application startup.

### Inputs should come from environment variables or secure secret storage

* `APP_BOOTSTRAP_ADMIN_ENABLED`
* `APP_BOOTSTRAP_ADMIN_EMAIL`
* `APP_BOOTSTRAP_ADMIN_PASSWORD` — only used when the account must be created

There is no first-name/last-name pair: the `users` table has a single `name`
column.

### Expected behavior

The step "if it exists, do nothing" is wrong for this project and is corrected
here. The account existing is the *normal* case — it was created by sign-up or
Google OAuth — and it still needs the role.

When bootstrap is enabled:

1. Look up the user by email.
2. **If the user exists → grant `ROLE_ADMIN` and stop.** No password involved;
   OAuth accounts have none.
3. If the user does not exist and a password is supplied → create the user with
   the password hashed by the same encoder the sign-up path uses, then grant.
4. If the user does not exist and no password is supplied → log a warning and
   stop. Never create a password-less account.
5. Grant idempotently: `user_roles` has PK `(user_id, role_id)`, so
   `ON CONFLICT DO NOTHING` is the guard.
6. Log the elevated email so the action is auditable.

Bootstrap grants only — it must never revoke `ROLE_ADMIN` from an account that
the env var no longer names.

### Ordering

Implement as an `ApplicationRunner`, not `@PostConstruct`. Spring Boot runs
Flyway before `ApplicationRunner` beans, guaranteeing `roles` and `user_roles`
exist. A `@PostConstruct` hook can race the migration and fail on a cold start.

### Why this is the right pattern

* no secrets in Git
* safe for local development and deployment
* repeatable and idempotent
* easy to disable in production after setup
* avoids editing migrations for account changes

### Strong recommendation

Use a dedicated bootstrap component instead of embedding admin creation inside Flyway.

---

## Normal User Bootstrapping Strategy

Regular users should be created by application flows, not by migrations.

Examples:

* sign-up page
* OAuth login
* invite flow
* admin-created user creation

### Rules

* never create ordinary users through Flyway in production
* never store plaintext passwords
* use the same validation and hashing logic for bootstrap users that you use for real users where possible

### When seed users are needed in development

Use development-only seed logic to create example users.

Example use cases:

* a demo club owner
* a sample admin
* test attendees for UI testing
* accounts for local integration tests

---

## Environment-Based Configuration

### Local development

Use a local `.env` file or local environment variables.

Important rules:

* do not commit `.env`
* commit a `.env.example` instead
* keep bootstrap toggles disabled by default
* use profile-specific config files where helpful

### Example environment split

* `application.yml` for shared defaults
* `application-dev.yml` for local mock data and bootstrap behavior
* `application-test.yml` for automated testing
* `application-prod.yml` for production-safe settings

### Suggested production setup

For deployed environments, use secure environment injection or cloud secret management.

Do not store production admin credentials in source code.

---

## Recommended Project Structure

```text
src/main/resources/
├── db/
│   └── migrations/
│       ├── V1__create_user_table.sql
│       ├── ...
│       └── V8__search_embeddings.sql
├── application.yml
├── application-dev.yml      <-- TO BE CREATED
├── application-test.yml
└── application-prod.yml
```

Suggested additional package structure:

```text
src/main/java/.../bootstrap/
├── AdminBootstrapRunner.java
├── DevDataSeeder.java
└── BootstrapProperties.java
```

---

## Decision Matrix

### Use Flyway when

* the database schema changes
* a stable lookup table is introduced
* a required system value must exist everywhere
* a structural change must be tracked and repeatable

### Use startup bootstrap code when

* creating the initial admin account
* creating local demo users
* creating local demo clubs or events
* checking whether seed data already exists

### Use application endpoints when

* a user creates an event
* a club admin updates a club page
* a user bookmarks or follows something
* runtime CRUD actions happen in the UI

---

## Handling Data Changes After the App Is Running

If a user creates, updates, or deletes data in the frontend:

* update the PostgreSQL database directly through normal application logic
* do not create or modify Flyway files
* do not regenerate migration scripts

### Example

If a club admin changes an event title in the dashboard, the application should run an `UPDATE` query against the database.
Flyway should not be involved.

### What if the schema needs to change later?

Create a new Flyway migration.

Example:

* add a new column
* split one table into two
* add an index
* rename a field in the database

That is a migration concern, not an app-data concern.

---

## Recommended Rules for Changing Existing Migrations

### Safe to modify only if

* the migration has never been applied anywhere important
* the database is disposable and local-only
* you are still in very early development

### Do not modify if

* the migration has been shared with other environments
* teammates may already have applied it
* the app has staging or production data

### Preferred fix when a migration is wrong

Create a new migration that corrects the issue.

Examples:

* `V6__add_missing_event_capacity_column.sql`
* `V7__backfill_event_capacity_values.sql`
* `V8__remove_unused_club_description_column.sql`

### Why deleting the file is not an option

The instinctive fix for a bad migration — delete the `.sql` and pretend it never
existed — breaks the application, and it is worth understanding why before
Step 4 of the implementation sequence.

Flyway tracks applied migrations in a `flyway_schema_history` table inside the
database, not in the filesystem. Removing the file deletes the *script*, not the
*record*. On the next startup Flyway compares the two, finds a history row with
no corresponding file, and aborts:

```
Detected applied migration not resolved locally: 6
```

The application will not boot, and it fails at startup on every environment that
had already run the migration — including a teammate's machine, where the change
arrives as an unexplained crash after a `git pull`.

The recovery options are all worse than not deleting it:

| Option | Cost |
|---|---|
| Restore the deleted file | Undoes the "cleanup" entirely |
| `flyway repair` | Extra operational step, must run everywhere, easy to forget |
| `ignoreMigrationPatterns` | Permanently weakens validation for all migrations |
| Drop the database | Fine locally, unacceptable anywhere with real data |

So the rule is to supersede: leave the original file untouched, and add a new
migration that reverses its effect. History stays honest, every environment
converges by simply running migrations, and nothing special has to be
remembered.

The exception is a purely local, disposable database — `docker compose down -v`
destroys the volume and the history table with it, so the migration is genuinely
gone rather than half-forgotten. That applies to CampusVibe today, but only
because nothing has been deployed yet.

---

## Seeding Policy for CampusVibe

### Must be seeded by app/startup logic

* admin user for local development
* demo club owner
* a small set of clubs
* a small set of events
* any UI demo records required to test workflows

### Must not be seeded through Flyway

* real user accounts
* production admin secrets
* frequently changing example events
* user-generated content

### Seed helpers

This is a Maven/Spring project, so there is no npm-style `seed:dev` task
runner. Use these mechanisms instead:

| Intent | Mechanism |
|---|---|
| Seed on startup | `DevDataSeeder` gated by `@Profile("dev")`, active because `docker-compose.yml` sets `SPRING_PROFILES_ACTIVE=dev` |
| Full reset | `docker compose down -v && docker compose up -d` — drops the `db_data` volume, Flyway replays from V1, seeder repopulates |
| Skip seeding | Run without the `dev` profile, or a `campusvibe.seed.enabled=false` property |
| Backfill derived data | `POST /api/v1/search/reindex` |

A full reset is the supported way to change seed content — edit the seeder and
recreate the volume, rather than writing a migration to mutate seed rows.

---

## Testing Strategy

### Migration tests

Verify that Flyway runs correctly against a clean database.

Test cases:

* migrations apply successfully from an empty schema
* tables are created as expected
* reference data exists
* duplicate application does not create unexpected behavior

### Bootstrap tests

Verify that admin bootstrap is:

* disabled when the flag is false
* idempotent when run twice — no duplicate `user_roles` row, no error
* secure with password hashing, when it creates an account
* tolerant of an account that is already an admin

And specifically for the two modes:

* **promotes an existing non-admin user** — the primary case; a user holding only
  `ROLE_USER` gains `ROLE_ADMIN` with no password supplied
* **refuses to create a password-less account** — email absent and no password
  configured must warn and stop, not insert a user
* **never revokes** — an admin not named by the env var keeps `ROLE_ADMIN`

### Seed tests

Verify that dev seeding:

* creates expected demo rows
* does not create duplicates
* can be reset cleanly
* does not run in production

---

## Operational Checklist

Before committing a migration:

* confirm it is schema or stable reference data
* confirm it does not contain secrets
* confirm it does not contain real user data
* confirm it is named clearly
* confirm it will not need frequent edits

Before deploying:

* confirm prod bootstrap is disabled or tightly controlled
* confirm secret values are not committed
* confirm migrations run cleanly in a fresh database
* confirm development-only seed logic is not enabled in production

Before changing mock data:

* decide whether it belongs in a dev seeder instead of Flyway
* avoid editing old migration files
* prefer re-running seed logic over rewriting history

---

## Implementation Sequence

Ordered, because later steps depend on earlier ones. The project is not
deployed, so the V6 cleanup is cheap now and expensive later.

### Step 1 — Create the `dev` profile (blocks everything else)

Nothing profile-gated works until this exists.

* Add `backend/src/main/resources/application-dev.yml`.
* Add `SPRING_PROFILES_ACTIVE: ${SPRING_PROFILES_ACTIVE:-dev}` to the `backend`
  service in `docker/docker-compose.yml`.
* Add `SPRING_PROFILES_ACTIVE=dev` to `docker/.env.example`.

Verify: the startup banner logs `The following 1 profile is active: "dev"`.
Confirm `application-test.yml` does **not** pull in `dev`, so seeding never
runs under test.

### Step 2 — Admin bootstrap

* Add `bootstrap/BootstrapProperties.java`, `bootstrap/AdminBootstrapRunner.java`.
* Implement both modes from the Admin Bootstrapping Strategy above; the
  promote-existing path is the one that matters today (user `id=1` holds only
  `ROLE_USER`).
* Add the three `APP_BOOTSTRAP_ADMIN_*` vars to `docker-compose.yml`,
  `.env.example` (blank/`false`), and `.env` (real local values).

Verify: restart with the vars set, then confirm `ROLE_ADMIN` is present for the
account; restart a second time and confirm no duplicate row and no error.

This step is what unblocks `POST /api/v1/search/reindex`, which is
`@PreAuthorize("hasRole('ADMIN')")`.

### Step 3 — Dev seeder (Pattern A)

* Add `seed/DevDataSeeder.java`, `@Profile("dev")`, idempotent (skip when clubs
  already exist).
* Port the 8 clubs from V6 into it, creating them **through the service layer**
  so `embedding` is populated on write.

Verify: `down -v` then `up`, and check `count(embedding) = count(*)` on `clubs`
— the metric that is currently 0 of 8.

### Step 4 — Retire V6

Only after Step 3 reproduces the same data.

* Do **not** delete `V6__insert_mock_clubs.sql` — Flyway fails validation on a
  missing applied migration and the app will not boot. See "Why deleting the
  file is not an option" above.
* Add `V9__remove_mock_club_seed_data.sql` deleting those 8 club ids, so
  environments that already ran V6 converge.
* Since the DB is local-only and disposable, `docker compose down -v` is the
  cleaner alternative — but ship V9 anyway if the migration was ever pushed.

### Step 5 — Production posture

* `APP_BOOTSTRAP_ADMIN_ENABLED=false` in EB once the admin exists.
* `SPRING_PROFILES_ACTIVE=prod` in EB, so `DevDataSeeder` cannot run.
* Secrets stay in EB environment properties; `.env` stays gitignored.

### Ongoing rules

1. Flyway for schema and stable lookup data only.
2. Mock data lives in the seeder, never in a migration.
3. Admin comes from env vars and startup code.
4. No secrets or personal values in Git.
5. `.env.example` documents; `.env` holds real local values.

---

## Final Recommendation

For CampusVibe, the most maintainable pattern is:

* **Flyway**: schema + stable reference data
* **Bootstrap runner**: initial admin + controlled demo setup
* **Development seeder**: mock clubs, mock events, mock users
* **Frontend/API**: all normal runtime CRUD data

This separation will keep your migrations clean, reduce Git exposure risk, and make future development much easier.