-- What a student chooses to say about themselves.
--
-- A separate table rather than columns on users, because users is the Spring
-- Security principal: JWTAuthenticationFilter loads that row on every single
-- authenticated request, and a bio nobody is reading has no business being in
-- that query. Nothing on this table is needed to decide whether a request is
-- allowed, so nothing here should be loaded to decide it.
--
-- Keyed on user_id rather than carrying its own BIGSERIAL. The profile has no
-- identity apart from the person it describes, there can only ever be one, and
-- a shared primary key says both of those things in the schema instead of in a
-- comment plus a unique index.
--
-- The row is created on first write, not at sign-up. Every account that exists
-- today predates this table, so a create-on-registration hook would still have
-- to cope with profiles that are absent -- and then there would be two ways for
-- a profile to come into being instead of one.

CREATE TABLE IF NOT EXISTS user_profiles (
	user_id BIGINT PRIMARY KEY,

	-- 500 to match BIO_LIMIT in app/(protected)/profile/edit/page.tsx. The
	-- textarea's maxLength is a courtesy to whoever is typing; this is the
	-- constraint, because the editor is not the only thing that can POST here.
	bio TEXT NULL CHECK (bio IS NULL OR char_length(bio) <= 500),

	-- Chosen from closed lists the frontend offers (DEGREES, MCGILL_FACULTIES),
	-- but stored as TEXT with no CHECK. Faculties get renamed -- Dentistry
	-- became Dental Medicine and Oral Health Sciences in 2022 -- and a CHECK
	-- constraint would turn each rename into a migration that must run before
	-- the frontend can ship its new list. Interests are the opposite case and
	-- do get a foreign key; see V19 for why the two differ.
	faculty TEXT NULL,
	degree TEXT NULL,

	-- Three columns, deliberately NOT the single JSON TEXT blob that
	-- clubs.social_links uses (V2). That column is opaque: nothing validates
	-- it, the contract test can only see one field name, and every reader has
	-- to parse it and cope with the parse failing. UserProfile.socialLinks is
	-- already a typed object on the frontend, so naming the three links here
	-- lets the schema, the DTO and the TypeScript interface all agree.
	--
	-- Stored as the user typed it. Nothing here is a trustworthy URL: the
	-- service rejects any scheme other than http and https on write, and
	-- normaliseProfileLink checks again on render, because a row written
	-- before that rule existed would still reach an href.
	instagram_url TEXT NULL,
	facebook_url TEXT NULL,
	linkedin_url TEXT NULL,

	-- Whether each optional block appears to other people. Separate from the
	-- values themselves, so hiding a block does not destroy what is behind it.
	-- Default TRUE to match emptyProfile() in app/lib/profile.ts -- a profile
	-- that has never been edited must look the same whether or not its row
	-- exists yet.
	show_interests BOOLEAN NOT NULL DEFAULT TRUE,
	show_social_links BOOLEAN NOT NULL DEFAULT TRUE,

	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

	CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id)
		REFERENCES users(id)
		ON UPDATE CASCADE
		ON DELETE CASCADE
);

-- What they study. Free text, and a collection rather than a column, for the
-- same reason event_categories is: there is no useful upper bound on how many
-- someone lists, and a comma-joined string cannot be queried.
--
-- No catalogue behind it, unlike interests. Nobody can enumerate every course
-- McGill offers, and a closed list that is missing your subject is worse than
-- free text -- it tells you your programme does not exist.
CREATE TABLE IF NOT EXISTS user_profile_subjects (
	user_id BIGINT NOT NULL,
	subject TEXT NOT NULL,
	PRIMARY KEY (user_id, subject),
	CONSTRAINT fk_user_profile_subjects_profile FOREIGN KEY (user_id)
		REFERENCES user_profiles(user_id)
		ON UPDATE CASCADE
		ON DELETE CASCADE
);
