-- Retire the platform-wide ROLE_CLUB_ADMIN.
--
-- Club authority is now club-scoped and lives in club_admin_assignments, so a
-- global role saying "this person administers some club, somewhere" answers no
-- question the system asks. The two platform roles that remain -- ROLE_USER and
-- ROLE_ADMIN -- describe the account itself.
--
-- The concrete reason for deleting it rather than leaving it as a convenience
-- flag: roles are copied into the JWT at sign-in, so a user removed from a club
-- would keep ROLE_CLUB_ADMIN in their token until it expired. Governance doc
-- section 28 requires revocation to take effect on the next request, and the
-- only way to guarantee that is for no authorisation decision to read a role
-- claim about club management. Authorisation now reads the assignment table on
-- every request, where a revoked row is visible immediately.
--
-- V7 inserts this row and cannot be edited (Flyway checksums applied
-- migrations), so on a fresh database it is created there and removed here.
-- That is the intended forward-only shape.

DELETE FROM user_roles
WHERE role_id IN (SELECT id FROM roles WHERE name = 'ROLE_CLUB_ADMIN');

DELETE FROM roles WHERE name = 'ROLE_CLUB_ADMIN';
