# CampusVibe Club Administration, Governance, Notifications, and Audit Model

## Purpose

This document defines the finalized CampusVibe model for club administration, club ownership, administrator lifecycle management, official club email verification, notifications, audit logs, yearly leadership transitions, and recovery safeguards.

The goal is to keep club administration secure and maintainable while recognizing an important property of university clubs:

- Club leadership changes regularly, often every academic year.
- A club's official email address belongs to the organization, not to one student.
- Club administrators are still normal CampusVibe users with their own personal accounts.
- Club management permissions should be attached to a user's relationship with a specific club, rather than implemented as a separate shared club account.
- The club's official email should act as a durable organizational verification and notification channel.
- The system should preserve accountability by recording which individual user performed every important club-management action.

This model deliberately does **not** include granular administrator permissions. There are only two club-management roles:

- `CLUB_OWNER`
- `CLUB_ADMIN`

---

# 1. Core Account Model

## 1.1 Do not use shared club accounts

CampusVibe should not use a model where executives share and inherit a single login such as:

```text
robotics@ssmu.ca
password: shared between executives
```

A shared account creates several problems:

- Multiple people must know the same password.
- Former executives may retain access.
- It becomes difficult to identify who made a change.
- Personal and organizational data can become mixed.
- Annual leadership changes require password handoffs.
- Security incidents are harder to investigate.
- Account recovery becomes dependent on shared credentials.

Instead, every administrator should use their own CampusVibe account.

Example:

```text
Sarah's CampusVibe account
├── Personal CampusVibe activity
│   ├── Saved events
│   ├── Followed clubs
│   ├── Personal recommendations
│   ├── AI planner
│   └── Other personal features
│
└── Club access
    └── CLUB_OWNER → McGill Robotics
```

Another administrator could simultaneously have:

```text
Michael's CampusVibe account
└── CLUB_ADMIN → McGill Robotics
```

The club itself remains a separate entity.

---

# 2. Separate User Identity from Club Authority

A student's main CampusVibe account represents the student.

A club-management assignment represents authorization to manage a specific club.

Conceptually:

```text
USER
  │
  ├── Personal CampusVibe functionality
  │
  └── Club Membership / Administration Assignment
          │
          └── CLUB
```

The relationship between the user and the club determines whether the user can manage that club.

This is preferable to making `clubAdmin` a permanent global account type.

The platform-level roles can remain conceptually simple:

```text
USER
ADMIN
```

Club-level authority is stored separately:

```text
CLUB_OWNER
CLUB_ADMIN
```

This makes club permissions scoped to one club rather than to the entire CampusVibe platform.

---

# 3. Club Management Roles

## 3.1 CLUB_OWNER

Every club must have exactly one active `CLUB_OWNER`.

The Club Owner can:

- Manage the club page.
- Create, update, cancel, and manage the club's events.
- View club activity and audit logs.
- Invite or add Club Admins.
- Remove Club Admins.
- Transfer club ownership to another eligible user.
- Participate in yearly administrator review.
- Receive club-management notifications.

The Club Owner cannot change the club's official email address.

Only a CampusVibe platform `ADMIN` can change a club's official email.

The Club Owner should also not be allowed to leave the club in a way that causes the club to have no owner. Ownership must first be transferred to another user.

---

## 3.2 CLUB_ADMIN

A club may have multiple active `CLUB_ADMIN` users.

Club Admins can:

- Manage the club page.
- Create, update, cancel, and manage the club's events.
- View the club's audit logs.
- Receive club-management notifications.
- Participate in normal club operations.

Club Admins cannot:

- Remove other Club Admins.
- Remove the Club Owner.
- Transfer club ownership.
- Change the club's official email.
- Perform CampusVibe platform administration.

There are no additional administrator tiers or granular permission sets.

---

# 4. Personal User Features Remain Available

A user who becomes a Club Owner or Club Admin remains a normal CampusVibe user.

Their personal account continues to support normal personal functionality such as:

- Following clubs.
- Saving events.
- Personal event recommendations.
- AI planner functionality.
- Find Friends or other social features.
- Personal profile and preferences.
- Personal notification settings.

Club-management access adds capabilities to the account; it does not replace the user's personal CampusVibe experience.

Personal activity must remain separate from club activity.

For example:

```text
Personal:
Sarah saved "Jazz Night"

Club:
Sarah edited "Robotics Fall Kickoff"
while acting as an administrator of McGill Robotics
```

---

# 5. Official Club Email

Each club has an official email address.

Example:

```text
robotics@ssmu.ca
```

The official club email belongs to the organization rather than to an individual administrator.

## 5.1 Who can change the official email?

Only a CampusVibe platform `ADMIN` can set or change the official club email.

Club Owners and Club Admins cannot modify it directly.

This protects the club's primary verification and recovery channel from unauthorized changes.

---

## 5.2 Purposes of the official club email

The official email should be used for:

- Verification when adding new Club Admins.
- Verification during ownership transfer.
- Club administrator security notifications.
- Club operational notifications.
- Ownership recovery.
- Annual administrator review reminders.
- Important club-account changes.
- Recovery when former executives are unavailable.

The official club email should therefore function as a durable institutional trust anchor for the club.

---

# 6. Adding a Club Admin

Club administrator management should normally be handled by the club itself.

The Club Owner initiates the process.

Recommended workflow:

```text
Club Owner selects "Add Club Admin"
        ↓
Owner selects or invites the CampusVibe user
        ↓
CampusVibe creates a pending invitation
        ↓
Verification is sent to the official club email
        ↓
The verification is completed
        ↓
Invited user accepts
        ↓
Membership becomes ACTIVE
        ↓
User receives CLUB_ADMIN authority for that club
```

The workflow should require explicit acceptance from the invited user.

A user should never silently become a Club Admin.

---

## 6.1 Suggested invitation states

```text
PENDING
ACTIVE
REVOKED
EXPIRED
```

For example:

```text
Sarah
McGill Robotics
CLUB_ADMIN
PENDING
```

becomes:

```text
Sarah
McGill Robotics
CLUB_ADMIN
ACTIVE
```

after successful verification and acceptance.

Expired invitations should not grant any access.

---

# 7. Removing a Club Admin

Only the current Club Owner should normally be able to remove a Club Admin.

Recommended workflow:

```text
Club Owner selects Club Admin
        ↓
Owner chooses "Remove Admin"
        ↓
CampusVibe asks for confirmation
        ↓
Membership is revoked
        ↓
User immediately loses club-management access
        ↓
Audit entry is recorded
        ↓
Security notification is sent
```

The removed user's personal CampusVibe account remains unchanged.

Only the relationship with the club is revoked.

For audit/history purposes, prefer marking the assignment as `REVOKED` rather than permanently deleting all evidence that the assignment existed.

---

# 8. Club Ownership Transfer

Leadership succession should be an explicit CampusVibe workflow.

The system should not depend on manually changing a role directly in the database.

Recommended normal workflow:

```text
Current Club Owner
        ↓
Selects "Transfer Ownership"
        ↓
Chooses an existing Club Admin or eligible user
        ↓
CampusVibe sends verification to the official club email
        ↓
New owner accepts the transfer
        ↓
Transfer is completed transactionally
        ↓
New user becomes CLUB_OWNER
        ↓
Previous owner becomes CLUB_ADMIN or is removed,
depending on the selected transition option
        ↓
Audit event is recorded
        ↓
Security notifications are sent
```

The transfer should require:

1. Authorization from the current Club Owner.
2. Verification through the official club email.
3. Acceptance from the incoming owner.

This significantly reduces the risk of accidental or unauthorized transfers.

---

# 9. Exactly One Active Club Owner

ADMIN adds the first club owner for each club. At the launch of this platform, clubs won't have any club owner or admin.

Once a club has a club owner, CampusVibe must guarantee that a club has exactly one active owner.

The application must prevent:

```text
0 active owners
```

and:

```text
2+ active owners
```

for the same club.

Ownership transfer must therefore be performed atomically in one database transaction.

Conceptually:

```text
BEGIN TRANSACTION

old owner: CLUB_OWNER → CLUB_ADMIN or REVOKED
new owner: CLUB_ADMIN → CLUB_OWNER

COMMIT
```

If any part fails, the entire transaction should roll back.

The database should also enforce the single-owner invariant where possible.

---

# 10. Annual Leadership Transition

University clubs frequently change executives once per academic year.

CampusVibe should explicitly support this lifecycle instead of assuming administrators remain valid indefinitely.

## 10.1 Annual Club Admin Review

Once per academic year, CampusVibe should prompt the Club Owner to review the current management team.

Example:

```text
Review your club's administrators

Current management:

Sarah — Club Owner
Michael — Club Admin
Emma — Club Admin
Alex — Club Admin
```

The owner can then:

- Keep existing administrators.
- Remove administrators who have left the club.
- Invite incoming administrators.
- Transfer ownership to the incoming executive.

Do not automatically remove administrators merely because a date has passed.

Different clubs may change leadership at different times.

The system should encourage review while leaving the final transition under the club's control.

---

# 11. Ownership Recovery

CampusVibe needs a recovery workflow for situations where:

- The previous owner graduated.
- The owner forgot to transfer ownership.
- The current owner is unreachable.
- The former executive no longer has access to CampusVibe.
- The new executive legitimately controls the official club email.

The recovery workflow should be stricter than a normal ownership transfer.

Recommended process:

```text
New executive requests ownership recovery
        ↓
CampusVibe verifies access to official club email
        ↓
Existing owner is notified if possible
        ↓
Platform ADMIN reviews the request
        ↓
ADMIN verifies the circumstances
        ↓
Ownership is transferred
        ↓
Previous unauthorized/outdated access is revoked if appropriate
        ↓
Audit event is recorded
        ↓
Security notifications are sent
```

Official-email access alone should not automatically allow a user to seize ownership.

The exceptional recovery path should require platform-admin approval.

This protects against cases where someone temporarily gains access to the club inbox.

---

# 12. Platform Admin Responsibilities

CampusVibe platform administrators remain separate from club administrators.

Platform `ADMIN` users can:

- Create clubs.
- Set a club's official email.
- Change a club's official email.
- Review ownership recovery requests.
- Resolve abandoned or disputed club ownership.
- Perform necessary platform-level administrative actions.

Club Owners and Club Admins should never automatically gain platform-wide administrative powers.

---

# 13. Notifications Architecture

CampusVibe should separate:

1. Personal-user notifications.
2. Club-operational notifications.

These represent different contexts and should not be mixed.

---

# 14. Personal Notifications

Personal notifications belong to the individual user's account.

They may include:

- Saved-event reminders.
- Followed-club updates.
- Personal recommendations.
- Personal planner notifications.
- Friend/social notifications.
- Other user-specific activity.

These notifications should use the personal email connected to the user's CampusVibe account.

Example:

```text
sarah@mail.mcgill.ca
```

Personal notification preferences are controlled by the user.

---

# 15. Club Notifications

Club-management notifications belong to the organization.

The official club email should receive club-related notifications.

Example:

```text
robotics@ssmu.ca
```

Possible notifications include:

- Important event-management changes.
- Event registration activity.
- Club administrative changes.
- Club Owner changes.
- New Club Admin invitations.
- Club Admin removals.
- Annual administrator review.
- Security-sensitive changes.
- Club-level system alerts.

---

# 16. Club Notifications to Personal Email

A Club Owner or Club Admin may optionally receive copies of club notifications at their personal account email.

For example:

```text
Club notifications

Official club email:
robotics@ssmu.ca   ← organizational delivery

Also send copies to:
sarah@mail.mcgill.ca   ← optional personal delivery
```

The user's preference should control only the additional personal-email copy.

Disabling the personal copy must not disable required delivery to the official club email.

---

# 17. Mandatory Club-Email Security Notifications

Certain security-sensitive notifications should always be delivered to the official club email and should not be opt-out.

Examples:

- Club Admin added.
- Club Admin removed.
- Ownership transfer requested.
- Ownership transfer completed.
- Ownership recovery requested.
- Ownership recovery completed.
- Official club email changed.
- Other security-sensitive administrator changes.

This ensures the organization retains an independent record even if an individual's personal notification preferences are disabled.

---

# 18. Notify Existing Administrators About Sensitive Changes

Sensitive administrator changes should be difficult to hide.

When a major action occurs, notify:

```text
Official club email
+
remaining Club Owners/Admins who enabled personal copies
```

Examples:

```text
Sarah removed Michael as a Club Admin.
```

```text
Club ownership was transferred from Alex to Sarah.
```

```text
Emma was added as a Club Admin.
```

This improves transparency and helps the management team detect unauthorized changes quickly.

---

# 19. Club Audit Logs

Every important club-management action should create an immutable audit entry.

All active Club Owners and Club Admins should be able to view their club's audit logs from the club-management dashboard.

Audit logs are especially important because multiple users can manage the same club.

The system must record the individual CampusVibe account responsible for each change.

---

# 20. Suggested Audit Log Schema

Example table:

```sql
club_audit_logs
---------------
id
club_id
actor_user_id
action
entity_type
entity_id
metadata
created_at
```

Recommended fields:

### `id`

Unique audit event identifier.

### `club_id`

The club affected by the action.

### `actor_user_id`

The individual CampusVibe user who performed the action.

This is critical for accountability.

### `action`

Examples:

```text
CLUB_PROFILE_UPDATED
EVENT_CREATED
EVENT_UPDATED
EVENT_CANCELLED
CLUB_ADMIN_INVITED
CLUB_ADMIN_ADDED
CLUB_ADMIN_REMOVED
OWNERSHIP_TRANSFER_REQUESTED
OWNERSHIP_TRANSFERRED
OWNERSHIP_RECOVERY_COMPLETED
```

### `entity_type`

Examples:

```text
CLUB
EVENT
CLUB_ADMIN_ASSIGNMENT
```

### `entity_id`

Identifier of the affected resource.

### `metadata`

Optional structured JSON containing useful context.

Example:

```json
{
  "eventName": "Fall Kickoff",
  "changedFields": ["location", "startTime"]
}
```

Do not store secrets, access tokens, passwords, or other sensitive credentials in audit metadata.

### `created_at`

UTC timestamp of the action.

---

# 21. Audit Log UI

The club-management dashboard can display entries such as:

```text
Aug 17, 2026 · 11:23 AM
Sarah updated "Fall Kickoff"

Aug 16, 2026 · 4:02 PM
Michael updated the club Instagram URL

Aug 15, 2026 · 2:41 PM
Sarah added Emma as Club Admin

Aug 15, 2026 · 2:39 PM
Alex transferred ownership to Sarah
```

Useful dashboard filters may include:

- All activity.
- Club page.
- Events.
- Administration.

This filtering affects presentation only and does not introduce granular admin permissions.

---

# 22. Audit Log Safeguards

Audit logs should be:

- Read-only from the club-management dashboard.
- Immutable to Club Owners.
- Immutable to Club Admins.
- Retained for an appropriate historical period.
- Recorded server-side rather than trusted from frontend input.
- Timestamped using server time.
- Associated with the authenticated actor.

Club administrators should not have the ability to delete their own audit trail.

If audit-log retention or deletion is required for platform operations, it should be handled through a controlled platform-level process rather than from the club dashboard.

---

# 23. Recommended Database Model

A straightforward schema can use the following tables.

---

## 23.1 `users`

```sql
users
-----
id
name
email
password_hash / external_auth_identifier
platform_role
created_at
updated_at
```

Example platform roles:

```text
USER
ADMIN
```

Do not store a global `CLUB_ADMIN` role here as the main source of club authorization.

Club administration is club-scoped.

---

## 23.2 `clubs`

```sql
clubs
-----
id
name
slug
official_email
description
...
created_at
updated_at
```

`official_email` may only be modified through authorized platform-admin logic.

---

## 23.3 `club_admin_assignments`

Suggested table:

```sql
club_admin_assignments
----------------------
id
club_id
user_id
role
status
invited_by_user_id
created_at
activated_at
revoked_at
```

Possible roles:

```text
CLUB_OWNER
CLUB_ADMIN
```

Possible status values:

```text
PENDING
ACTIVE
REVOKED
EXPIRED
```

Recommended constraints:

```text
UNIQUE active assignment per (club_id, user_id)
```

and:

```text
Exactly one ACTIVE CLUB_OWNER per club
```

The exact implementation of the single-owner database constraint may depend on PostgreSQL strategy, such as a partial unique index.

Example concept:

```sql
CREATE UNIQUE INDEX one_active_owner_per_club
ON club_admin_assignments (club_id)
WHERE role = 'CLUB_OWNER' AND status = 'ACTIVE';
```

---

## 23.4 `club_admin_invitations`

This can either be represented by pending records in `club_admin_assignments` or by a separate table.

A separate table may contain:

```sql
club_admin_invitations
----------------------
id
club_id
invited_user_id
invited_by_user_id
role
verification_token_hash
expires_at
accepted_at
created_at
```

Never store raw verification tokens if a hashed-token design can be used.

Tokens should:

- Be cryptographically random.
- Expire.
- Be single-use.
- Be invalidated after acceptance.
- Be invalidated if the invitation is revoked.

---

## 23.5 `club_audit_logs`

```sql
club_audit_logs
---------------
id
club_id
actor_user_id
action
entity_type
entity_id
metadata
created_at
```

Indexes should likely include:

```text
club_id
created_at
actor_user_id
```

The most common dashboard query will likely be:

```text
Get recent audit events for club X ordered by newest first
```

---

## 23.6 Notification Preferences

Personal notification preferences should remain attached to the user.

Example:

```sql
user_notification_preferences
-----------------------------
user_id
personal_event_email_enabled
followed_club_email_enabled
social_email_enabled
...
```

Club-notification copies can be represented separately.

Example:

```sql
club_admin_notification_preferences
-----------------------------------
club_admin_assignment_id
personal_email_copy_enabled
```

The official club-email delivery rules should not depend on this flag.

---

## 23.7 Notification Records

If CampusVibe stores notification history:

```sql
notifications
-------------
id
recipient_type
recipient_id
notification_type
payload
created_at
read_at
```

or use separate user and club notification tables if that better matches the implementation.

Email delivery should be treated as an output channel rather than as the only record of the notification.

---

# 24. Authorization Rules

Backend authorization must be enforced server-side.

Frontend visibility is not a security boundary.

For every management request, verify:

1. The user is authenticated.
2. The user has an `ACTIVE` club administration assignment.
3. The assignment belongs to the requested `club_id`.
4. The action is permitted for the user's club role.

Example:

```text
PUT /api/clubs/{clubId}
```

Allowed:

```text
ACTIVE CLUB_OWNER of clubId
OR
ACTIVE CLUB_ADMIN of clubId
OR
platform ADMIN
```

Example:

```text
DELETE /api/clubs/{clubId}/admins/{userId}
```

Allowed:

```text
ACTIVE CLUB_OWNER of clubId
OR
platform ADMIN
```

A Club Admin from Club A must never be able to manage Club B merely because they are an administrator somewhere.

---

# 25. Do Not Trust Club IDs from the Frontend

The backend must validate club scope from authenticated user permissions.

Never rely only on a request such as:

```json
{
  "clubId": 17
}
```

The fact that the frontend sent `clubId = 17` does not prove that the caller manages Club 17.

Always query/verify the authenticated user's active club assignment.

---

# 26. Sensitive Actions Should Be Transactional

Actions involving multiple security-sensitive changes should use database transactions.

Examples:

- Ownership transfer.
- Administrator activation.
- Administrator removal plus related updates.
- Recovery completion.

For ownership transfer:

```text
BEGIN

verify current owner
verify target user
verify official-email confirmation
demote/revoke old owner
promote new owner
write audit log
create security notifications

COMMIT
```

If the operation fails before completion:

```text
ROLLBACK
```

The system should never leave the club without an owner because half of an ownership-transfer operation succeeded.

---

# 27. Verification Safeguards

Verification links or codes used for administrator changes should:

- Be short-lived.
- Be single-use.
- Be generated server-side.
- Use cryptographically secure random values.
- Store only a hash where practical.
- Expire after a defined period.
- Become invalid once consumed.
- Become invalid if the underlying invitation or transfer is cancelled.

Security-sensitive confirmation pages should clearly display:

- Club name.
- Requested action.
- User being added or promoted.
- Expiration information.

---

# 28. Session and Access Revocation

When a Club Admin is removed:

- Their personal CampusVibe account remains active.
- Their club assignment becomes revoked.
- Subsequent API requests must immediately fail authorization checks.

Do not rely exclusively on stale JWT claims that could continue granting club access after removal.

Prefer checking mutable club-scoped authorization from the backend/database, or use a token/version strategy that makes revoked privileges take effect promptly.

---

# 29. Club Management Dashboard

The club-management dashboard should clearly separate personal CampusVibe functionality from organizational management.

Example:

```text
Personal CampusVibe
-------------------
Home
Explore
Saved Events
Following
Friends
Profile

Manage McGill Robotics
----------------------
Overview
Club Page
Events
Administrators
Activity Log
```

The `Administrators` area should show:

```text
Sarah
Club Owner

Michael
Club Admin

Emma
Club Admin
```

For the Club Owner, this area additionally contains actions such as:

```text
Add Admin
Remove Admin
Transfer Ownership
```

Club Admins may view the administrator list but do not receive owner-only management actions.

---

# 30. Activity Log Dashboard

All Club Owners and Club Admins should have access to:

```text
Manage Club → Activity Log
```

Show:

- Actor.
- Action.
- Affected resource.
- Date/time.
- Relevant context.

Do not expose sensitive internal system fields or secrets.

For event changes, useful display examples include:

```text
Sarah changed the location of "Fall Kickoff"

Old:
University Centre Room 201

New:
University Centre Room 302
```

Detailed old/new snapshots may be added when useful, but the first implementation can remain simpler.

---

# 31. Recommended Security Notifications

Examples of events that should generate high-priority notifications:

```text
CLUB_ADMIN_INVITED
CLUB_ADMIN_ADDED
CLUB_ADMIN_REMOVED
OWNERSHIP_TRANSFER_REQUESTED
OWNERSHIP_TRANSFER_COMPLETED
OWNERSHIP_RECOVERY_REQUESTED
OWNERSHIP_RECOVERY_COMPLETED
OFFICIAL_EMAIL_CHANGED
```

These should generally:

1. Create an audit log.
2. Create an in-app notification where appropriate.
3. Send email to the official club email.
4. Send personal copies to active administrators according to their preferences when applicable.

---

# 32. Official Email Change Workflow

Because only a platform Admin can change the official email, the change should be treated as highly sensitive.

Recommended workflow:

```text
Platform ADMIN opens club
        ↓
Chooses "Change Official Email"
        ↓
Enters new official email
        ↓
New address is verified
        ↓
Database is updated
        ↓
Audit event is recorded
        ↓
Notification is sent to old official email when possible
        ↓
Notification is sent to new official email
        ↓
Current club administrators are notified
```

This protects the club's verification/recovery anchor.

---

# 33. Recommended API Shape

Exact endpoint naming may vary, but a clear structure would be:

```text
GET    /api/clubs/{clubId}/admins
POST   /api/clubs/{clubId}/admins/invitations
DELETE /api/clubs/{clubId}/admins/{userId}

POST   /api/clubs/{clubId}/ownership-transfer
POST   /api/clubs/{clubId}/ownership-transfer/{transferId}/accept

POST   /api/clubs/{clubId}/ownership-recovery

GET    /api/clubs/{clubId}/audit-logs

GET    /api/clubs/{clubId}/notification-preferences
PUT    /api/clubs/{clubId}/notification-preferences
```

Admin-only endpoints may include:

```text
PUT /api/admin/clubs/{clubId}/official-email
POST /api/admin/clubs/{clubId}/ownership-recovery/{requestId}/approve
POST /api/admin/clubs/{clubId}/ownership-recovery/{requestId}/reject
```

---

# 34. Suggested Service Boundaries

A maintainable Spring Boot implementation may use services such as:

```text
ClubService
ClubAdminService
ClubOwnershipService
ClubVerificationService
ClubAuditService
NotificationService
EmailService
```

Do not create microservices for these functions.

These can remain normal Spring services inside the existing CampusVibe backend.

---

# 35. Audit Logging Should Be Centralized

Do not scatter inconsistent raw audit inserts throughout controllers.

Prefer a central service such as:

```java
clubAuditService.record(...)
```

Controllers/services performing business operations should call it after validated actions.

Example conceptual flow:

```text
ClubEventService.updateEvent()
    ↓
validate authorization
    ↓
update event
    ↓
record audit event
    ↓
create/send required notifications
```

Audit information should originate from trusted server-side state.

---

# 36. Protect Against Self-Lockout

The current Club Owner must not be allowed to:

- Remove themselves while they are still the owner.
- Revoke their own owner assignment directly.
- Leave the club without transferring ownership.

Instead, direct them to:

```text
Transfer Ownership
```

This guarantees continuity.

---

# 37. Protect Against Administrator Takeover

Because Club Admins cannot remove other administrators or transfer ownership, a compromised ordinary Club Admin account has reduced ability to take over the organization.

Additional safeguards:

- Official-email verification for adding admins.
- Official-email verification for ownership transfer.
- Notifications to other administrators.
- Immutable audit trail.
- Platform-admin recovery.
- Expiring verification tokens.
- Server-side authorization checks.

---

# 38. Protect Against Former Executives Retaining Access

Annual review helps, but removal must be explicit.

When a former executive leaves:

```text
Owner removes Club Admin
        ↓
assignment = REVOKED
        ↓
management authorization ends immediately
```

Their personal account continues to work normally.

They simply lose the club-scoped management relationship.

---

# 39. Important Separation of Data

Personal data belongs to the user.

Examples:

```text
saved_events
followed_clubs
personal_preferences
friend_connections
AI planner history
```

Club data belongs to the club.

Examples:

```text
club profile
club events
club administrator assignments
club audit logs
club operational notifications
```

Do not transfer a departing administrator's personal information to the incoming administrator.

Only organizational information remains with the club.

---

# 40. Final Role Summary

## USER

Can use normal CampusVibe features.

May additionally hold club-scoped management assignments.

---

## CLUB_ADMIN

A club-scoped assignment held by a normal user.

Can:

```text
Manage club page
Manage club events
View activity logs
Receive club notifications
```

Cannot:

```text
Manage other club admins
Transfer club ownership
Change official club email
Perform platform administration
```

---

## CLUB_OWNER

A club-scoped assignment held by exactly one active user per club.

Can:

```text
Everything a CLUB_ADMIN can do
Add Club Admins
Remove Club Admins
Transfer ownership
Manage yearly administration transition
```

Cannot:

```text
Change official club email
Perform platform administration solely because they are Club Owner
```

---

## ADMIN

A CampusVibe platform-level role.

Can:

```text
Create clubs
Set/change official club email
Handle exceptional ownership recovery
Perform platform administration
```

---

# 41. Final Governance Model

The finalized CampusVibe design is:

```text
                          CAMPUSVIBE
                              │
                 ┌────────────┴────────────┐
                 │                         │
               USER                      ADMIN
                 │                         │
                 │                Platform administration
                 │
        Personal CampusVibe account
                 │
                 └── Club Admin Assignment
                         │
                 ┌───────┴────────┐
                 │                │
           CLUB_OWNER        CLUB_ADMIN
                 │                │
          Manage admins       Manage club
          Transfer owner      Manage events
          Manage club         View logs
          Manage events
          View logs

                         CLUB
                          │
             ┌────────────┴────────────┐
             │                         │
      Official club email       Organizational data
             │
       Verification
       Notifications
       Recovery
       Security anchor
```

---

# 42. MVP Implementation Priorities

A sensible implementation order is:

1. Replace/extend the current one-to-one Club Admin design with a club-scoped administrator-assignment table.
2. Add `CLUB_OWNER` and `CLUB_ADMIN`.
3. Enforce one active owner per club.
4. Build club administrator listing.
5. Build Club Owner admin-invitation workflow.
6. Add official-email verification.
7. Build administrator removal.
8. Build ownership transfer.
9. Add immutable audit logging.
10. Add Activity Log UI to the club dashboard.
11. Separate personal notification preferences from club notifications.
12. Send mandatory security notifications to official club email.
13. Add optional personal copies of club notifications.
14. Add annual management-review workflow.
15. Add platform-admin ownership-recovery workflow.

Each feature should be completed and tested independently before moving to the next one.

---

# 43. Non-Goals

The following should **not** be introduced into this implementation:

- Shared club login accounts.
- Shared club passwords.
- Granular Club Admin permissions.
- Event-manager / communications-manager / treasurer permission roles.
- Arbitrary administrator-created custom roles.
- Automatic ownership transfer based only on date.
- Automatic removal of admins at the end of the academic year.
- Club-admin ability to change official club email.
- Client-side-only authorization.
- Deletion of club audit history by club administrators.

Keeping these out of the initial system preserves a much simpler and safer governance model.

---

# 44. Final Principles

The implementation should follow these principles:

### Individual identity

Every administrator uses their own CampusVibe account.

### Organizational continuity

Club information survives annual leadership changes.

### Club-scoped authorization

Club administration belongs to the user's relationship with a specific club.

### Clear ownership

Every club has exactly one active Club Owner.

### Simple permissions

Only `CLUB_OWNER` and `CLUB_ADMIN` exist at club level.

### Official-email trust anchor

The official club email is the durable verification, security-notification, and recovery channel.

### Accountability

Every meaningful club-management action identifies the user who performed it.

### Immutable history

Club administrators can view activity logs but cannot modify or delete them.

### Secure succession

Normal ownership transfer requires current-owner authorization, official-email verification, and incoming-owner acceptance.

### Safe recovery

Exceptional ownership recovery requires official-email verification and CampusVibe platform-admin approval.

### Notification separation

Personal CampusVibe notifications go to the user's personal email, while organizational notifications go to the club's official email, with optional personal copies for administrators.

### Least privilege

Club Admins can manage club content and events but cannot control ownership or other administrators.

### Server-side enforcement

Every permission check is enforced in the backend, regardless of what controls are visible in the frontend.

This model should be treated as the source of truth for future implementation of CampusVibe club administration and governance.
