# Copilot Instructions

This file provides context about the **CampusVibe** project so GitHub Copilot can better assist with code suggestions.  
It explains the project goals, chosen tech stack, folder structure, and progress made so far.

---

## 🚀 Project Overview

CampusVibe is a **campus event management platform**.  
The platform allows students to:
- Browse events hosted by clubs on campus.
- View club pages with details and upcoming events.
- Log in to access personalized features such as user profiles, notifications, and saved events.
- Explore event pages with banners, location maps, tags, and detailed descriptions.
- Administer clubs and events by selected user profiles through a secure backend.

---

## 🛠️ Tech Stack

### Frontend
- **Next.js** (React framework for server-side rendering and SEO).
- **TypeScript** (type safety).
- **Tailwind CSS** (utility-first styling).

### Backend
- **Spring Boot (Java)** for REST API.
  - Controllers: Events, Clubs, Users, Authentication.
  - Services: Core business logic.
  - Spring Security + JWT: Authentication and authorization.
- **PostgreSQL** (database).
- **Flyway** (database schema migrations).

### Infrastructure
- **Docker** for containerization.
- **AWS S3** for file storage (e.g., event banners, club logos).
- **GitHub Actions** for CI/CD workflows.

### Testing
- **Frontend**: Unit and integration tests (React Testing Library / Jest).
- **Backend**: JUnit + Integration tests (e.g., AuthenticationIT).
- **Flyway** migration repair and test workflow.

---

## 📂 Project Structure
campusvibe/
├── frontend/ # Next.js (TypeScript + Tailwind)
│ ├── app/ # Main app directory (Next.js 13+)
│   ├── components/ # Reusable UI components
│   ├── lib/
│   ├── types/ # TypeScript interfaces/types
│   └── tests/ # Frontend tests
│
├── backend/ # Spring Boot with Maven
│ ├── src/main/java/com/campusvibe/
│ │ ├── controllers/ # REST controllers
│ │ ├── services/ # Business logic
│ │ ├── models/ # Entities
│ │ ├── dto/ # Data Transfer Objects
│ │ ├── dao/ # Data Access Objects
│ │ └── security/ # Spring Security + JWT
│ ├── src/test/java/ # Backend tests
│ └── resources/db/migration/ # Flyway migration scripts
│
├── db/ # PostgreSQL database config
├── docker/ # Docker setup and Docker Compose
├── .github/workflows/ # GitHub Actions CI/CD pipelines

---

## 📑 Data Types

You should define consistent types across frontend and backend:
- **Club**: id, name, description, followers, socialLinks (email, Facebook, Instagram, website), featured, createdAt, images.
- **EventInstance**: id, title, description, dateTime, location, price, organizer (Club), followers, images, promoted, capacity, registered, tags, createdAt.
- **User**: id, name, email, password (hashed), role (user, clubAdmin, admin), dateJoined.
- **ClubAdminUser**: extends User, managedClub (Club Id).
- **RegularUser**: extends User, savedEvents (EventInstance[]), followedClubs (Club[]), preferredCategories (string[]).
- **AdminUser**: extends User, role: "admin".

These data types are currently defined in the frontend `types/index.ts` file and should be mirrored in these locations:
- **Frontend**: TypeScript interfaces (for props, API calls, UI rendering).
- **Backend**: Java entities + DTOs + DAOs (for persistence and API).
- **Database**: Flyway migrations (tables and relations).

---

## 📈 Features Implemented

- **Event Pages**  
  - Banner at the top.  
  - Two-column layout:  
    - Left (75%): Details, tags, description.  
    - Right (25%): Card with date, location, embedded Google Maps preview.  

- **Club Pages (`/club/[slug]`)**  
  - Displays club info (logo optional — hidden if empty).  
  - Events section reuses `EventSection` component.  
  - Slug passed dynamically via Next.js routing.  

- **User Profile Page**  
  - Accessible only after login.  
  - Custom Navbar with profile + notifications buttons.  
  - “Upcoming Events” button opens a popup with filters (Upcoming, Past, All).  

- **Categories Section**  
  - Desktop: Icons + text in a single row with bottom slider.  
  - Mobile: 4 columns with smaller icons/text.  

- **Events Cards Section**  
  - Background-color matching cards.  
  - Shadow effect on hover.  

---

## 🧩 Notes for Copilot

- Suggest **typed API calls** (TypeScript interfaces on frontend, DTOs on backend).  
- Use **Next.js best practices**: server-side rendering, dynamic routes, and API routes where relevant.  
- Backend follows **Spring Boot layering** (Controller → Service → DAO/Entity).  
- Ensure **Flyway migration scripts** stay consistent with entity models.  
- For UI: prefer **Tailwind classes**, and reuse components where possible.  
- Follow **Docker-first approach**: backend, frontend, and db run in containers.  

---

## ✅ Progress Summary

So far:
- Project architecture defined (Next.js frontend + Spring Boot backend).
- Data types discussed (User, Club, EventInstance, ClubAdminUser).
- Event, Club, and User Profile page designs planned with responsive layouts.
- Flyway migrations integrated; issues with repair command noted (plugin must be added in Maven `pom.xml`).
- CI/CD with GitHub Actions is planned but not yet fully configured.

Next steps:
1. Implement and test DTOs/DAOs for data models.  
2. Connect frontend API calls to Spring Boot backend.  
3. Expand Flyway migrations with seed data.  
4. Finalize GitHub Actions workflow for build + test + deploy.  

---
