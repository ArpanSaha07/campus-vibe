-- Storage for the AI planner: saved chats, their messages, and each user's
-- daily message count (spec 2026-09-16-planner-backend).
--
-- Schema only; no rows are added.

-- A saved chat. At most 15 per user; creating a 16th deletes the least
-- recently active one first (PlannerConversationRepository.createEvicting).
-- title is null until the first reply completes, and the API sends New chat
-- for it. last_active_at moves only when a reply completes.
CREATE TABLE planner_conversations (
    id             UUID PRIMARY KEY,
    user_id        BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The sidebar list and the eviction choice both read a user's chats by
-- activity.
CREATE INDEX idx_planner_conversations_user_active
    ON planner_conversations (user_id, last_active_at DESC);

-- One turn. Only completed exchanges are stored: a reply that fails or is
-- stopped leaves neither its user message nor the reply behind.
--
-- picks is [{kind, id, reason}] on an assistant message and [] on a user one
-- (ADR-019). JSONB rather than a child table: it is always read with its
-- message, and an event id and a club slug could not share one foreign key
-- anyway. A picked item that is later deleted or ends is left out when the
-- chat is read, not removed from here.
CREATE TABLE planner_messages (
    id              BIGSERIAL PRIMARY KEY,
    conversation_id UUID        NOT NULL REFERENCES planner_conversations (id) ON DELETE CASCADE,
    role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT        NOT NULL,
    picks           JSONB       NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_planner_messages_conversation
    ON planner_messages (conversation_id, id);

-- Messages sent per user per day, the day being America/Toronto's.
--
-- Its own table rather than a count of planner_messages: deleting a chat,
-- or having one evicted, must not hand the day's messages back.
CREATE TABLE planner_daily_usage (
    user_id       BIGINT  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    usage_date    DATE    NOT NULL,
    message_count INTEGER NOT NULL CHECK (message_count >= 0),
    PRIMARY KEY (user_id, usage_date)
);
