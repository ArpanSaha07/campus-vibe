-- Multi-role RBAC (see .claude/user-roles.md)

CREATE TABLE IF NOT EXISTS roles (
	id BIGSERIAL PRIMARY KEY,
	name TEXT NOT NULL UNIQUE
);

INSERT INTO roles (name) VALUES
	('ROLE_USER'),
	('ROLE_CLUB_ADMIN'),
	('ROLE_ADMIN');

CREATE TABLE IF NOT EXISTS user_roles (
	user_id BIGINT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
	role_id BIGINT NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE CASCADE,
	PRIMARY KEY (user_id, role_id)
);

-- Every user always has ROLE_USER
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.name = 'ROLE_USER';

-- Preserve elevated roles from the old single-role column
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.name = 'ROLE_' || u.role
WHERE u.role IN ('CLUB_ADMIN', 'ADMIN');

-- Club ownership lives on the club: one club <-> one club admin
ALTER TABLE clubs
	ADD COLUMN club_admin_id BIGINT NULL
	REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

UPDATE clubs c SET club_admin_id = u.id
FROM users u WHERE u.managed_club_id = c.id;

ALTER TABLE users DROP COLUMN role;
ALTER TABLE users DROP COLUMN managed_club_id;
ALTER TABLE users RENAME COLUMN date_joined TO created_at;

-- Club admin request workflow (replaces approved_club_admins)
CREATE TABLE IF NOT EXISTS club_admin_requests (
	id BIGSERIAL PRIMARY KEY,
	user_id BIGINT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
	club_id TEXT NOT NULL REFERENCES clubs(id) ON UPDATE CASCADE ON DELETE CASCADE,
	message TEXT,
	status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
	requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	reviewed_at TIMESTAMPTZ NULL
);

DROP TABLE IF EXISTS approved_club_admins;
