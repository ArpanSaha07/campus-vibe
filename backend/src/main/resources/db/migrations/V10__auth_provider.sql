-- Distinguish a Google account from an email/password account.
--
-- Before this, the system could not tell them apart. `password` was NOT NULL
-- (V1), so AuthenticationService.googleSignIn stored a random bcrypt hash of
-- 'google-login-' + System.nanoTime() to satisfy the constraint. That made
-- three things unanswerable: whether a given account can log in with a
-- password, what 'reset your password' should do for a Google user, and
-- whether a signup collision should say 'log in' or 'continue with Google'.

ALTER TABLE users
	ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'LOCAL'
	CHECK (auth_provider IN ('LOCAL', 'GOOGLE'));

-- A Google account genuinely has no password. Nothing may be written here for
-- one, so the column has to admit NULL.
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Existing rows stay LOCAL. The placeholder hashes written by the old code are
-- bcrypt output and so are indistinguishable from real ones — there is no
-- predicate that could sort them, and guessing would silently lock a real user
-- out of their password. Any Google account created before this migration
-- therefore keeps a working (but unknown) password hash and is labelled LOCAL.
-- Sign-in still works for them: googleSignIn matches on email, not on provider.

-- Emails are matched case-insensitively by the application, so they must be
-- stored in one form or 'is this address taken?' answers differently depending
-- on how the user typed it. The UNIQUE constraint from V1 is case-sensitive and
-- would otherwise allow Ada@campus.com beside ada@campus.com as two accounts.
-- (@campus.com deliberately: the migration lint in .github/workflows/_database.yml
--  rejects any other email-shaped text anywhere in this directory, comments
--  included, because a migration runs in every environment and is permanent.)
UPDATE users SET email = lower(email) WHERE email <> lower(email);

ALTER TABLE users ADD CONSTRAINT users_email_is_lowercase CHECK (email = lower(email));

-- Every LOCAL account must actually have a password. Google accounts must not.
ALTER TABLE users
	ADD CONSTRAINT users_password_matches_provider CHECK (
		(auth_provider = 'LOCAL'  AND password IS NOT NULL)
		OR (auth_provider = 'GOOGLE' AND password IS NULL)
	);
