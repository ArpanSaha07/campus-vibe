# CampusVibe
A campus event platform to allow students to discover, get notified, plan and keep track of events around their university, and allow campus clubs to post their events in a single dedicated space, fostering closer communities and ensuring students never miss their favourite events again!


- **Frontend** — Next.js (App Router) + TypeScript + Tailwind CSS v4
- **Backend** — Spring Boot REST API under `/api/v1`
- **Auth** — Spring Security with JWT, email/password and Google sign-in
- **Database** — PostgreSQL with Flyway migrations
- **Search** — hybrid semantic + keyword search over pgvector embeddings
- **Storage** — AWS S3 client for event banners and club logos
- **Browse and discover** — home page, event pages, club pages, categories
- **Accounts** — follow clubs, save events, RSVP, export to Google Calendar
- **Roles** — regular user, club admin, admin, enforced server-side
- **Local development** — Docker Compose with live reload for all three services
- **CI** — GitHub Actions: lint, type-check, Jest, build, JUnit unit and
  integration suites, Flyway migration checks, Docker stack boot, Trivy image
  scan and gitleaks secret scanning
- **Testing** — React Testing Library + Jest (frontend), JUnit + Testcontainers
  integration suites (backend)
- Deployment — frontend to Vercel, backend to AWS Elastic Beanstalk, database to
  AWS RDS. The Elastic Beanstalk configuration exists under `docker/`;
- Notifications
- Admin dashboard for managing clubs, roles and moderation
- End-to-end browser tests

&nbsp;

## High-Level Architecture Diagram

                            ┌─────────────────────┐
                            │   GitHub Actions    │
                            │  CI/CD Pipeline     │
                            │  - Run tests        │
                            │  - Build images     │
                            │  - Deploy frontend  │
                            │  - Deploy backend   │
                            └─────────┬───────────┘
                                      |
    ┌───────────────────────┐         │         ┌────────────────────────┐
    │      Vercel           │ <───────┘         │ AWS Elastic Beanstalk  │
    │  (Next.js + Tailwind) │                   │ (Spring Boot + Docker) │
    │  Serves Frontend      │───── API Calls ─▶ │  REST API Controllers  │
    └───────────────────────┘                   │      Services +        |
                                                |Security (JWT and OAuth)│
                                                └──────────┬─────────────┘
                                                            │
                                  ┌────────────────────────┼────────────────────────┐
                                  │                        │                        │
                                  ▼                        ▼                        ▼
                        ┌───────────────────┐     ┌──────────────────┐     ┌──────────────────┐
                        │ AWS RDS (Postgres)│     │ AWS S3 (Storage) │     │ Fake S3 (Testing)│
                        │ - Persistent DB   │     │ - File uploads   │     │ - Local Dev/Test │
                        │ - User/Event Data │     │ - Images, Docs   │     │ - S3 Mock        │
                        └───────────────────┘     └──────────────────┘     └──────────────────┘

###  Work in progress....
