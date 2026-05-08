## Your role
- You are a senior Full-Stack Developer working with me to create a production-grade user-friendly full-stack web app.

## Project Overview
CampusVibe is a **campus event and club management platform**.  
The platform allows students to:
- Browse events hosted by clubs on campus.
- View club pages with details and upcoming events.
- Log in to access personalized features such as user profiles, notifications, event filters, followed clubs and saved events.
- Explore event pages with banners, location maps, tags, and detailed descriptions.
- Allow authorized club accounts to create and post events.

## Tech Stack

### Frontend
- **Next.js 15.5.3** 
- **TypeScript**
- **Tailwind CSS**
- **ShadCN/UI + Lucide React**

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
- **AWS RDS** for deploying database.
- Frontend deployed on **Vercel**.
- **AWS Elastic Beanstalk** for backend deployment.

### Testing
- **Frontend**: Unit and integration tests (React Testing Library / Jest).
- **Backend**: JUnit + Integration tests (e.g., AuthenticationIT).
- **Flyway** migration repair and test workflow.
- **Playwright** for E2E tests.
- Fake S3 is used for local testing.

## Features
- Public-facing front-end – browse events, filter/search, RSVP/purchase tickets (optional).
- Club admin dashboard – clubs log in, create/manage their events, manage their page/profile.
- Backend – user authentication, event CRUD, search/filter, notifications, analytics.

## Project Structure

campusvibe/
├── frontend/ # Next.js (TypeScript + Tailwind)
│ ├── components/ # Reusable UI components
│ ├── pages/ # Next.js routing (e.g., /event/[slug], /club/[slug])
│ └── tests/ # Frontend tests
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
├── .ci/ build-publish.sh build scripts
└── AGENTS.md



## Data Types
You should define consistent types across frontend and backend. Some example types:
- **User**
- **Club**
- **EventInstance**
- **ClubAdminUser**

Locations:
- **Frontend**: TypeScript interfaces (for props, API calls, UI rendering).
- **Backend**: Java entities + DTOs + DAOs (for persistence and API).
- **Database**: Flyway migrations (tables and relations).


## Features Implemented (from chat history)

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


### Progress summary
So far:
- Project architecture defined (Next.js frontend + Spring Boot backend).
- Data types discussed (User, Club, EventInstance, ClubAdminUser).
- Event, Club, and User Profile page designs planned with responsive layouts.
- Flyway migrations integrated; issues with repair command noted (plugin must be added in Maven `pom.xml`).
- CI/CD with GitHub Actions is planned but not yet fully configured.


## Some command line commands:
- cd campus-vibe/frontend && npm run dev


## Notes
- Implement code changes and features implementations one step at a time.
- Suggest **typed API calls** (TypeScript interfaces on frontend, DTOs on backend).  
- Use **Next.js best practices**: server-side rendering, dynamic routes, and API routes where relevant.  
- Backend follows **Spring Boot layering** (Controller → Service → DAO/Entity).  
- Ensure **Flyway migration scripts** stay consistent with entity models.  
- For UI: prefer **Tailwind classes**, and reuse components where possible.  
- Follow **Docker-first approach**: backend, frontend, and db run in containers.
- Write structured and efficient code, and follow the production-grade coding, file structuring and commenting best practices.
- You should never hard code API keys or other sensitive information into the codebase, other than putting them in a separate file, since this is being pushed to GitHub. 

## Inspiration websites:
- Trying to make a website like: https://www.eventbrite.ca/ 
- NextJS folder structure guidelines: https://medium.com/@kaveeshbc/building-production-grade-next-js-part-1-architecture-structure-c3b0e448d8f0

## Next steps:
