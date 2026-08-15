-- Password reset and email verification.
--
-- One table for both, because they are the same object: a single-use secret
-- with an expiry that proves the holder controls an inbox. Splitting them would
-- duplicate the hashing, expiry and single-use logic in two places, and those
-- are exactly the parts that must not diverge.

CREATE TABLE IF NOT EXISTS auth_tokens (
	id BIGSERIAL PRIMARY KEY,
	user_id BIGINT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
	-- The SHA-256 of the token, never the token. A leaked database must not
	-- hand over working reset links, which is the whole point of a reset token
	-- being a credential rather than an identifier.
	token_hash TEXT NOT NULL UNIQUE,
	purpose TEXT NOT NULL CHECK (purpose IN ('PASSWORD_RESET', 'EMAIL_VERIFICATION')),
	expires_at TIMESTAMPTZ NOT NULL,
	-- Set on redemption. Single-use is enforced by this being NULL, not by
	-- deleting the row, so a replayed link can be told from an unknown one.
	used_at TIMESTAMPTZ NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Redemption looks a token up by its hash; expiry sweeps scan by user.
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_purpose ON auth_tokens (user_id, purpose);

ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Google has already proven the address — googleSignIn refuses a token whose
-- email_verified claim is not true, so any GOOGLE row is verified by definition.
UPDATE users SET email_verified = TRUE WHERE auth_provider = 'GOOGLE';

-- Existing password accounts are grandfathered in. They were created before
-- verification existed, so treating them as unverified would retroactively
-- lock out people who did nothing wrong. New accounts start FALSE.
UPDATE users SET email_verified = TRUE WHERE auth_provider = 'LOCAL';
