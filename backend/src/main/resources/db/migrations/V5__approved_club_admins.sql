-- Approved Club Admins mapping and approval state
CREATE TABLE IF NOT EXISTS approved_club_admins (
    email TEXT PRIMARY KEY,
    club_id TEXT NULL REFERENCES clubs(id) ON UPDATE CASCADE ON DELETE CASCADE,
    approved BOOLEAN NOT NULL DEFAULT FALSE,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ NULL
);
