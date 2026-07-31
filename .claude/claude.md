# CampusVibe

## Project Overview

CampusVibe is a university event management platform inspired by Eventbrite. The goal is to provide a single place where students can discover events happening on or around campus while giving university clubs a dashboard to manage their events and club pages.

Target audience: **University students and student clubs**

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
- Ticket buying system like EventBrite

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

# Current Progress

Implemented:

- Responsive homepage
- Hero banner slider
- Category section
- Event card sections
- Club promotion section
- Event page
- Club page
- User profile page
- Login page UI
- Frontend architecture
- Spring Boot backend architecture
- Flyway migrations
- Docker development environment

In Progress:

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
- Always read and update todo.md after completing or discovering a task.
- Update fixed_bugs.md and bugs.md after fixing or discovering a bug.

---

# Notes for Claude

- Keep frontend and backend types consistent.
- Maintain Docker compatibility for local development.
- Write clean, modular, production-quality code.
- Suggest improvements that follow modern Next.js and Spring Boot best practices.
- If you attempt a solution or test **three times without making progress, stop and inform me instead of continuing to iterate.**

## Informational websites:
- NextJS folder structure guidelines: https://medium.com/@kaveeshbc/building-production-grade-next-js-part-1-architecture-structure-c3b0e448d8f0