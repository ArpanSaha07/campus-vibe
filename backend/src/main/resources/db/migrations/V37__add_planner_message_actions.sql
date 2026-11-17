-- What the planner agent did to the student's account in a turn: followed a
-- club, RSVPed, saved, or offered a calendar link (ADR-023, spec
-- 2026-11-16-planner-agent).
--
-- Schema only; no rows are added.
--
-- actions is [{type, targetKind, id, name, outcome}] on an assistant message
-- and [] everywhere else, including every message stored before this
-- migration. JSONB beside picks for the same reasons V36 gives: always read
-- with its message, and an event id and a club slug cannot share a foreign
-- key. The follows, RSVPs and saves themselves live in their own tables; this
-- is the record of what the reply said it did.
ALTER TABLE planner_messages
    ADD COLUMN actions JSONB NOT NULL DEFAULT '[]'::jsonb;
