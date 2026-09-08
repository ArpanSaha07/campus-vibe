-- What CampusVibe is allowed to email someone.
--
-- Its own table, not five more columns on user_profiles, because these answer a
-- different question for a different reader. A profile is what other students
-- see; this is what the mail path may send. When something eventually asks
-- 'may I email this person about tomorrow's event', it should read five
-- booleans and not drag a bio, a faculty and three social links along with
-- them -- and a profile read should not be loading mail policy either.
--
-- Same shared primary key as user_profiles, for the same reasons: exactly one
-- row per person, no identity of its own, and the schema says so rather than a
-- comment plus a unique index.
--
-- There is deliberately no switch here for password resets or email
-- confirmations. Those are transactional -- the person asked for each one --
-- and a preference that could silence them would lock someone out of their own
-- account with no way back in.

CREATE TABLE IF NOT EXISTS user_notification_preferences (
	user_id BIGINT PRIMARY KEY,

	-- Defaults match emptyPreferences() and the editor's initial state in
	-- app/(protected)/profile/edit/notifications/page.tsx. Everything is on
	-- except product news, which is the honest split for a service whose whole
	-- purpose is telling you an event is happening: the four below are why
	-- someone signed up, and the fifth is marketing they did not ask for.
	--
	-- These defaults are what an absent row means, so the entity's field
	-- initialisers must agree with them. Change one and change both.
	event_reminders BOOLEAN NOT NULL DEFAULT TRUE,
	club_announcements BOOLEAN NOT NULL DEFAULT TRUE,
	weekly_digest BOOLEAN NOT NULL DEFAULT TRUE,
	new_follower_events BOOLEAN NOT NULL DEFAULT TRUE,
	product_news BOOLEAN NOT NULL DEFAULT FALSE,

	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

	CONSTRAINT fk_user_notification_preferences_user FOREIGN KEY (user_id)
		REFERENCES users(id)
		ON UPDATE CASCADE
		ON DELETE CASCADE
);
