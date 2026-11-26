-- How many accounts, from the top of the ranked account list, scheduled and
-- admin-started imports check. Set by a platform admin from the admin
-- dashboard; until one does, the application uses campusvibe.instagram.max-accounts.
--
-- One row, enforced by the id check. No row is inserted here: the first save
-- writes it, and the configured default answers until then.
CREATE TABLE IF NOT EXISTS instagram_import_settings (
    id             SMALLINT    PRIMARY KEY CHECK (id = 1),
    account_count  INTEGER     NOT NULL CHECK (account_count BETWEEN 1 AND 1000),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by     BIGINT      NULL REFERENCES users (id) ON DELETE SET NULL
);
