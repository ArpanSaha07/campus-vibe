-- Clubs
CREATE TABLE IF NOT EXISTS clubs (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	description TEXT,
	followers INT NOT NULL DEFAULT 0,
	logo TEXT,
	featured BOOLEAN NOT NULL DEFAULT FALSE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Club images (one-to-many)
CREATE TABLE IF NOT EXISTS club_images (
	club_id TEXT NOT NULL,
	url TEXT NOT NULL,
	PRIMARY KEY (club_id, url),
	CONSTRAINT fk_club_images_club FOREIGN KEY (club_id)
		REFERENCES clubs(id)
		ON UPDATE CASCADE
		ON DELETE CASCADE
);

-- Link users.managed_club_id to clubs
ALTER TABLE users
	ADD CONSTRAINT fk_users_managed_club
	FOREIGN KEY (managed_club_id)
	REFERENCES clubs(id)
	ON UPDATE CASCADE
	ON DELETE SET NULL;

