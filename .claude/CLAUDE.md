# CampusVibe

## Project Overview

CampusVibe is a university event management platform inspired by Eventbrite. The goal is to provide a single place where students can discover events happening on or around campus while giving university clubs a dashboard to manage their events and club pages.

Target audience: **University students and student clubs**

---

# Where to look

This file is auto-loaded every session; nothing else is. So this file is a
**map**, not a library — it stays short on purpose, and points at the file that
holds each answer. **Read the one file your task needs, not all of them.**

| If you are about to… | Read | Size |
|---|---|---|
| Change how a subsystem works | [`.claude/docs/README.md`](docs/README.md) — the index, then the one doc it names | index is small |
| Pick up work, or add a task | [`.claude/TODO/todo.md`](TODO/todo.md) — open items only | ~26 KB |
| Check whether something was already built | [`.claude/TODO/tasks-completed.md`](TODO/tasks-completed.md) — finished work, by topic and by date | ~43 KB |
| Fix or report a defect | [`bugs.md`](bugs/bugs.md) (open) · [`fixed_bugs.md`](bugs/fixed_bugs.md) (resolved, with the reasoning) | large — grep, do not read whole |
| Touch a migration, seed or role grant | [`skills/database-lifecycle/SKILL.md`](skills/database-lifecycle/SKILL.md) — **mandatory** | — |
| Build or restyle UI | [`design-guidelines.md`](design-guidelines.md) — binding on all UI work | — |
| Write frontend code | `frontend/AGENTS.md` — **this is not the Next.js you know**; read `node_modules/next/dist/docs/` first | — |

**Fastest orientation, in order:** this file → *Recently shipped* at the foot of
`todo.md` (ten lines, tells you where the project actually is) → the one doc or
section your task needs. That is usually enough. Reading `bugs.md` and
`tasks-completed.md` end to end is rarely worth the tokens — grep them.

**Before starting anything, verify locally rather than pushing and waiting:**
`cd frontend && npm run verify` runs exactly what CI runs, in about 45 seconds.
A `pre-push` hook runs it automatically (`git config core.hooksPath .githooks`).

**Which doc does the code I touched belong to?** `scripts/docs-map.json` maps
code paths to docs, and `node scripts/check-docs.mjs` reports any area that
changed without its doc changing. The pre-push hook runs it as a notice — it
never blocks. Each doc carries a `**Code as of:**` stamp; `never` means it has
not been reconciled with the code, so read it with the same suspicion.

---

# Tech Stack

## Frontend
- Next.js
- TypeScript
- Tailwind CSS

## Backend
- Spring Boot (Java)
- Spring Security
- JWT Authentication
- Flyway

## Database
- PostgreSQL

## Infrastructure
- Docker
- AWS S3 (event banners, club logos)
- GitHub Actions (CI/CD)

## Testing
- Frontend: React Testing Library + Jest
- Backend: JUnit + Integration Tests

---

# Project Structure

```
campusvibe/
├── frontend/      # Next.js application
├── backend/       # Spring Boot API
├── db/            # PostgreSQL configuration
├── docker/        # Docker & Compose
└── .github/       # CI/CD workflows
```

---

# User Roles

### Regular User
- Browse events
- Search events and clubs
- Bookmark events
- Follow clubs
- Download events to Google Calendar
- Manage profile
- Sign in

### Club Admin
- All Regular User permissions
- Manage one assigned club
- Create, edit and delete events for that club

### Admin
- Full system access
- Create and manage clubs
- Assign Club Admins
- Manage all events and users

---

# Planned Features

## Public Website
- Home page with featured and upcoming events
- Event pages
- Club pages
- Event categories
- Category filtering
- Responsive design

## Authentication
- Email + password login
- Passwordless email code login
- Persistent login using secure cookies

## User Features
- Bookmark events
- Follow clubs
- Personalized profile
- Notifications (future)
- Google Calendar export

## Club Dashboard
- Create/edit/delete events
- Upload banners and club logos
- Manage club page

## Admin Dashboard
- Create clubs
- Assign Club Admins
- Manage users
- Moderate events

## Search
- Hybrid semantic search for:
  - Events
  - Clubs

---

# Features

- Responsive homepage
- Hero banner slider
- Category section
- Event card sections
- Club promotion section
- Event page
- Club page
- User profile page
- Frontend architecture
- Spring Boot backend architecture
- Flyway migrations
- Docker development environment
- Authentication workflow
- API integration
- Database models
- CI/CD pipeline

---

# Development Guidelines

- Complete **one feature at a time**.
- Once a feature is fully working, stop, so that I can review, commit and push it to Git before starting another.
- Reuse existing components whenever possible.
- Prefer strongly typed APIs using shared DTOs/interfaces.
- Keep Flyway migrations synchronized with backend entities.
- Follow Spring Boot layering:
  - Controller → Service → DAO/Repository
- Follow Next.js best practices (Server Components, dynamic routing, SSR where appropriate).
- Prefer reusable Tailwind components over duplicated UI.
- Follow software industry and development best practices.
- Always read and update `TODO/todo.md` after completing or discovering a task.
  **When a task is finished, move it out of `todo.md` into
  [`TODO/tasks-completed.md`](TODO/tasks-completed.md)** — under its original
  topic heading, keeping the date and the write-up — and add a line to
  *Recently shipped* at the foot of `todo.md`. The queue only stays useful if
  finished work leaves it.
- Update `bugs/fixed_bugs.md` and `bugs/bugs.md` after fixing or discovering a bug.
- After finishing a unit of work, record the reasoning in
  [`.claude/docs/architecture/`](docs/README.md) per the `implementation-docs`
  skill. *Why* it is shaped this way is the expensive thing to rediscover; the
  code already says *what*.

---

# Notes for Claude

- Keep frontend and backend types consistent.
- Maintain Docker compatibility for local development.
- Write clean, modular, production-quality code.
- Suggest improvements that follow modern Next.js and Spring Boot best practices.
- If you attempt a solution or test **three times without making progress, stop and inform me instead of continuing to iterate.**

## Informational websites:
- NextJS folder structure guidelines: https://medium.com/@kaveeshbc/building-production-grade-next-js-part-1-architecture-structure-c3b0e448d8f0