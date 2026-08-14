# User Roles & Authorization Architecture (CampusVibe)

**Code as of:** never — this document has not been reconciled with the
code. See the banner above; do not read a distance into this.

> ⚠ **Part specification, part implementation doc — unverified.** Moved here
> from `.claude/user-roles.md` on 2026-08-06. Much of it is written as
> *there should be three roles*, which is a spec for intended behaviour, not a
> description of shipped code. It does not yet follow
> [`implementation-docs`](../../skills/implementation-docs/SKILL.md).
>
> It is nonetheless **binding** — `V7__multi_role_rbac.sql`, `JWTUtil.java:49`,
> `ClubController.java:60` and `frontend/app/types/index.ts:45` all cite it as
> the authority for the role model, so it is the closest thing to a source of
> truth for RBAC. Where it and the code disagree, the code wins and the
> disagreement is a bug worth filing.
>
> Splitting the spec from the as-built description is tracked in
> [`todo.md`](../../TODO/todo.md), owned by `backend` with `security` reviewing.
>
> **`V7__multi_role_rbac.sql:1` still cites the old path `.claude/user-roles.md`
> and always will.** Flyway checksums the whole file, so editing one comment in
> an applied migration causes `Migration checksum mismatch` on every existing
> database. The stale path is the cheaper of the two costs. See
> [`database-lifecycle/SKILL.md`](../../skills/database-lifecycle/SKILL.md).

## Overview

CampusVibe uses **Role-Based Access Control (RBAC)** with **Spring Security** and **JWT authentication**.

There should be **three roles**:

- `ROLE_USER`
- `ROLE_CLUB_ADMIN`
- `ROLE_ADMIN`

Every authenticated user should always have `ROLE_USER`.

A Club Admin also has `ROLE_USER`.

The Main Admin also has `ROLE_USER`.

Future support for multiple roles should be built into the system even though there are currently only three roles.

---

# User Roles

## ROLE_USER

Permissions:

- Register/Login
- View events
- Search events
- Search clubs
- Follow clubs
- Bookmark events
- Edit own profile
- create club/Request Club Admin access

---

## ROLE_CLUB_ADMIN

Inherits all ROLE_USER permissions.

Additional permissions:

- Manage one assigned club
- Create/Edit/Delete events for that club
- Update club information
- Upload club banner/logo
- View analytics for their own club (future)

A Club Admin can only manage **one club** for now.

---

## ROLE_ADMIN

Inherits all ROLE_USER permissions.

Additional permissions:

- Manage every club
- Manage every event
- Manage every user
- Approve Club Admin requests
- Promote/Demote users
- View entire platform dashboard
- Access platform analytics (future)

---

# JWT

JWT should contain:

```json
{
  "sub": "123",
  "email": "user@email.com",
  "roles": [
    "ROLE_USER",
    "ROLE_CLUB_ADMIN"
  ]
}
```

JWT should **NOT** contain:

- club ids
- permissions
- profile information

Only identity + roles.

Ownership should always be checked against the database.

---

# Spring Security

Use Spring Security with JWT authentication.

Example role checks:

```java
@PreAuthorize("hasRole('ADMIN')")
```

```java
@PreAuthorize("hasRole('CLUB_ADMIN')")
```

```java
@PreAuthorize("hasRole('USER')")
```

For club ownership:

Create a permission service.

```java
clubPermissionService.canManageClub(userId, clubId)
```

Example:

```java
@PreAuthorize("@clubPermissionService.canManageClub(authentication, #clubId)")
```

This verifies:

- user is club admin
- user owns that club

Admin bypasses ownership checks.

Never trust frontend permissions.

---

# Database Tables

## User

```
id
name
email
password_hash
created_at
```

---

## Role

```
id
name

ROLE_USER
ROLE_CLUB_ADMIN
ROLE_ADMIN
```

---

## UserRole

Supports multiple roles.

```
user_id
role_id
```

Example:

```
ROLE_USER
ROLE_CLUB_ADMIN
```

---

## Club

```
club_id
name
description
club_admin_id
...
```

For now:

One club ←→ One club admin

Later this can become a join table if multiple admins are supported.

---

## Event

```
event_id
club_id
title
description
...
```

---

## SavedEvent

```
user_id
event_id
saved_at
```

---

## ClubFollower

```
user_id
club_id
followed_at
```

---

## Category

(Optional)

```
category_id
name
```

---

## UserCategoryPreference

```
user_id
category_id
```

---

## ClubAdminRequest

Stores requests sent by users wanting to become Club Admin.

```
id

user_id

club_id

message

status

requested_at

reviewed_at
```

Status:

```
PENDING

APPROVED

REJECTED
```

---

# TypeScript Types

Use one User interface.

```ts
export enum Role {
    USER = "ROLE_USER",
    CLUB_ADMIN = "ROLE_CLUB_ADMIN",
    ADMIN = "ROLE_ADMIN"
}

export interface User {
    id: number;
    name: string;
    email: string;
    roles: Role[];
    createdAt: Date;
}
```

Do NOT create separate Admin/User/ClubAdmin interfaces.

Role-specific data should come from separate API endpoints.

Examples:

```
GET /api/me
```

```
GET /api/my-club
```

```
GET /api/my-saved-events
```

---

# Club Admin Request Workflow

Users can request Club Admin access.

Workflow:

```
User

↓

Clicks

Become Club Admin

↓

Selects Club

↓

Writes message

↓

Submits request

↓

Stored in ClubAdminRequest table

↓

Email notification sent to Admin

↓

Appears in Admin Dashboard

↓

Admin reviews request

↓

Checks if club already has Club Admin

↓

Approve or Reject
```

Approval:

- User receives ROLE_CLUB_ADMIN
- Club.club_admin_id updated
- Request marked APPROVED

Reject:

- Request marked REJECTED

---

# Permission Workflow

ROLE_USER

Can:

- browse
- search
- bookmark
- follow
- update own profile

Cannot:

- create events
- manage clubs

---

ROLE_CLUB_ADMIN

Can:

- create events

Only for

their assigned club.

Backend always verifies ownership.

---

ROLE_ADMIN

Can:

- everything

No ownership checks required.

---

# Frontend Routes

Public

```
/
```

Regular User

```
/dashboard
```

Club Admin

```
/club-dashboard
```

Admin

```
/admin
```

---

# Regular User Dashboard

Sections:

- Upcoming Events
- Saved Events
- Followed Clubs
- Recommended Events
- Notifications
- Profile Settings

---

# Club Admin Dashboard

Purpose:

Manage one assigned club.

Sidebar:

```
Overview

Events

Media

Settings
```

Overview

Cards:

- Upcoming Events
- Total Followers
- Upcoming Deadlines

Future:

- Event analytics

---

Events

- Upcoming
- Draft
- Published
- Archived

Actions:

- Create
- Edit
- Delete

---

Event Editor

Fields:

- Title
- Description
- Images
- Date
- Time
- Location
- Capacity
- Categories
- Tags
- Registration Link

---

Media

Manage:

- Logo
- Banner
- Gallery

Stored in AWS S3.

---

Settings

Manage:

- Club description
- Social links
- Contact info

---

# Admin Dashboard

Sidebar

```
Overview

Users

Club Admin Requests

Clubs

Events

System
```

---

Overview

Cards:

- Total Users
- Total Clubs
- Total Events
- Pending Club Admin Requests

---

Users

Actions:

- View user
- Promote
- Demote
- Delete

---

Club Admin Requests

List:

- User
- Requested Club
- Date
- Message

Actions:

- Approve
- Reject

Approval process:

1. Verify club has no Club Admin.
2. Assign ROLE_CLUB_ADMIN.
3. Update club_admin_id.
4. Update request status.

---

Clubs

Actions:

- Create
- Edit
- Delete
- Assign Club Admin

---

Events

Actions:

- View
- Edit
- Delete
- Hide inappropriate events

---

System

Future:

- Platform settings
- Maintenance mode
- Announcement banner

---

# Security Principles

Never trust frontend role checks.

Frontend controls visibility.

Backend controls authorization.

Every protected endpoint must verify:

1. Authentication
2. Role
3. Ownership (when applicable)

The frontend should only hide unavailable UI elements for better user experience; all authorization decisions must be enforced on the backend.

---

# Future Improvements

- Multiple Club Admins per Club
- Platform analytics
- Club analytics
- Audit logging
- Granular permissions (e.g. EVENT_CREATE, EVENT_EDIT)
- Moderator role
- Faculty Advisor role