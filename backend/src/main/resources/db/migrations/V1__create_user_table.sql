-- Users
-- role is stored as TEXT to match Hibernate's @Enumerated(EnumType.STRING) binding
CREATE TABLE IF NOT EXISTS users (
	id BIGSERIAL PRIMARY KEY,
	name TEXT NOT NULL,
	email TEXT NOT NULL UNIQUE,
	password TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'CLUB_ADMIN', 'ADMIN')),
	date_joined TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	managed_club_id TEXT NULL
);

-- managed_club_id will reference clubs(id) in V2
