-- Instagram auto-import: the club accounts we watch, the stories and posts we
-- fetched from them, the events Claude read out of each, and a log of runs.
--
-- A candidate is not an event. InstagramPublishService turns one into an event
-- when Claude classified it as an upcoming event with enough confidence and it
-- is not a duplicate; everything else stays here, unpublished. events.* gets
-- its Instagram link in V39.

CREATE TABLE IF NOT EXISTS instagram_sources (
    id              BIGSERIAL PRIMARY KEY,
    -- Lowercased, no @. Instagram handles are 1-30 of [a-z0-9._].
    handle          TEXT NOT NULL UNIQUE CHECK (handle ~ '^[a-z0-9._]{1,30}$'),
    display_name    TEXT NULL,
    -- The club this account publishes for. NULL until an admin maps it or
    -- creates a club for it; an unmapped account never auto-publishes.
    club_id         TEXT NULL REFERENCES clubs (id) ON DELETE SET NULL,
    -- 1 is the most important account. Scheduled runs take enabled sources in
    -- this order, up to campusvibe.instagram.max-accounts.
    priority        INT NOT NULL,
    score           INT NOT NULL DEFAULT 0,
    found_on        TEXT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    last_fetch_at   TIMESTAMPTZ NULL,
    last_success_at TIMESTAMPTZ NULL,
    -- The fetcher's per-account answer: ok, user_not_found, private, ...
    last_status     TEXT NULL,
    last_error      TEXT NULL,
    stories_seen    INT NOT NULL DEFAULT 0,
    events_found    INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instagram_sources_priority
    ON instagram_sources (enabled, priority);

CREATE TABLE IF NOT EXISTS instagram_stories (
    id             BIGSERIAL PRIMARY KEY,
    source_id      BIGINT NOT NULL REFERENCES instagram_sources (id) ON DELETE CASCADE,
    external_id    TEXT NOT NULL,
    -- A 24-hour story, or a permanent feed post.
    kind           TEXT NOT NULL DEFAULT 'STORY' CHECK (kind IN ('STORY', 'POST')),
    media_type     TEXT NOT NULL CHECK (media_type IN ('IMAGE', 'VIDEO')),
    -- A post's caption, where the event details often are.
    caption        TEXT NULL,
    posted_at      TIMESTAMPTZ NULL,
    expires_at     TIMESTAMPTZ NULL,
    fetched_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    permalink      TEXT NULL,
    link_url       TEXT NULL,
    feed_post_url  TEXT NULL,
    -- Our full-resolution copy of the image, under instagram-imports/.
    -- Instagram's own URLs are signed and expire, so they are never stored.
    image_key      TEXT NULL,
    ocr_text       TEXT NULL,
    extraction     JSONB NULL,
    classification TEXT NULL,
    status         TEXT NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')),
    attempt_count  INT NOT NULL DEFAULT 0,
    last_error     TEXT NULL,
    -- One row per piece of media per account, so a story seen by two runs
    -- (stories live 24h, runs are 12h apart) is read once.
    CONSTRAINT uq_instagram_stories_source_external UNIQUE (source_id, external_id)
);

CREATE TABLE IF NOT EXISTS instagram_event_candidates (
    id                        BIGSERIAL PRIMARY KEY,
    story_id                  BIGINT NOT NULL REFERENCES instagram_stories (id) ON DELETE CASCADE,
    source_id                 BIGINT NOT NULL REFERENCES instagram_sources (id) ON DELETE CASCADE,
    title                     TEXT NULL,
    description               TEXT NULL,
    summary                   TEXT NULL,
    highlights                JSONB NOT NULL DEFAULT '[]',
    audience                  TEXT NULL,
    collaborators             JSONB NOT NULL DEFAULT '[]',
    date_time                 TIMESTAMPTZ NULL,
    start_time_known          BOOLEAN NOT NULL DEFAULT FALSE,
    end_time                  TIMESTAMPTZ NULL,
    -- True when the story gave no end time and we filled start + default length.
    end_time_estimated        BOOLEAN NOT NULL DEFAULT FALSE,
    location                  TEXT NULL,
    price                     TEXT NULL,
    capacity                  INT NULL,
    registration_url          TEXT NULL,
    hosted_by                 TEXT NULL,
    is_repost                 BOOLEAN NOT NULL DEFAULT FALSE,
    topics                    JSONB NOT NULL DEFAULT '[]',
    formats                   JSONB NOT NULL DEFAULT '[]',
    classification            TEXT NOT NULL,
    confidence                DOUBLE PRECISION NOT NULL DEFAULT 0,
    missing_fields            JSONB NOT NULL DEFAULT '[]',
    uncertain_fields          JSONB NOT NULL DEFAULT '[]',
    warnings                  JSONB NOT NULL DEFAULT '[]',
    -- Why it was not published, one reason per line. Empty once published.
    review_reasons            JSONB NOT NULL DEFAULT '[]',
    status                    TEXT NOT NULL DEFAULT 'PENDING_REVIEW'
                              CHECK (status IN ('PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'DUPLICATE')),
    auto_published            BOOLEAN NOT NULL DEFAULT FALSE,
    event_id                  BIGINT NULL UNIQUE REFERENCES events (id) ON DELETE SET NULL,
    duplicate_of_event_id     BIGINT NULL REFERENCES events (id) ON DELETE SET NULL,
    duplicate_of_candidate_id BIGINT NULL REFERENCES instagram_event_candidates (id) ON DELETE SET NULL,
    reviewed_by               BIGINT NULL REFERENCES users (id) ON DELETE SET NULL,
    reviewed_at               TIMESTAMPTZ NULL,
    rejection_reason          TEXT NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instagram_candidates_status
    ON instagram_event_candidates (status, date_time);

CREATE INDEX IF NOT EXISTS idx_instagram_candidates_story
    ON instagram_event_candidates (story_id);

CREATE TABLE IF NOT EXISTS instagram_import_runs (
    id                 BIGSERIAL PRIMARY KEY,
    trigger            TEXT NOT NULL CHECK (trigger IN ('SCHEDULED', 'MANUAL')),
    status             TEXT NOT NULL DEFAULT 'RUNNING'
                       CHECK (status IN ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED')),
    started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at        TIMESTAMPTZ NULL,
    accounts_requested INT NOT NULL DEFAULT 0,
    stories_fetched    INT NOT NULL DEFAULT 0,
    stories_new        INT NOT NULL DEFAULT 0,
    candidates_created INT NOT NULL DEFAULT 0,
    auto_published     INT NOT NULL DEFAULT 0,
    failures           INT NOT NULL DEFAULT 0,
    -- Posts do not expire, so they are fetched less often than stories.
    included_posts     BOOLEAN NOT NULL DEFAULT FALSE,
    posts_fetched      INT NOT NULL DEFAULT 0,
    fetch_cost_usd     DOUBLE PRECISION NULL,
    error              TEXT NULL
);

-- A lease, not a lock held on a connection: an import run takes minutes, and
-- holding a transaction or a session advisory lock that long is worse than a
-- row with an expiry. One row, id 1, written by INSERT .. ON CONFLICT, so no
-- seed row is needed and two instances can never both start a run.
CREATE TABLE IF NOT EXISTS instagram_import_lock (
    id           SMALLINT PRIMARY KEY CHECK (id = 1),
    holder       TEXT NOT NULL,
    locked_until TIMESTAMPTZ NOT NULL
);
