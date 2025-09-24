-- Users and role enum
CREATE TYPE role AS ENUM ('USER', 'CLUB_ADMIN', 'ADMIN');

CREATE TABLE IF NOT EXISTS users (
	id BIGSERIAL PRIMARY KEY,
	name TEXT NOT NULL,
	email TEXT NOT NULL UNIQUE,
	password TEXT NOT NULL,
	role role NOT NULL DEFAULT 'USER',
	date_joined TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	managed_club_id TEXT NULL
);

-- managed_club_id will reference clubs(id) in V2

