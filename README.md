# CampusVibe
A campus events management app to allow campus clubs to post their events in a single dedicated space, fostering closer communities and ensuring students never miss their favourite events again!

## Features:
- Responsive and dynamic frontend
- Search for events based on preferred tags
- Role based access management
- Sign-in using email or Google account.
- Notifications and add events to your calendar to never miss your event again.

## Technologies
- <b>Next.js + Tailwind CSS</b> frontend and <b>Spring Boot</b> backend.
- Implemented <b>Spring Security + OAuth</b> authentication, <b>PostgreSQL + Flyway</b> for schema management.
- Integrated <b>AWS S3</b> for media storage; Deployed storage on <b>AWS RDS</b>.
- Tested with <b>JUnit, Mockito, and Playwright</b>.
- <b>Dockerized</b> deployment and automated CI/CD pipelines with <b>GitHub Actions</b>.
- Deployed frontend on  <b>Vercel</b> and backend on  <b>AWS Elastic Beanstalk</b>.
- <b>TypeScript</b> for strong type safety; <b>ESLint</b> and <b>Prettier</b> for linting and <b>Webpack</b> for building the frontend.

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
