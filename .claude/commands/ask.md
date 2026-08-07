---
description: Ask one teammate agent a question and relay their answer in full
argument-hint: "<agent> <question>  —  e.g. backend why does BUG-001 return zero results?"
---

Talk to one member of the CampusVibe team.

The first word of `$ARGUMENTS` is the agent name; everything after it is the
question.

## Built agents

`staff-eng` · `backend` · `frontend`

Planned but not yet built (Phase 2): `pm`, `design`, `security`, `sparring`,
`devops`, `qa-automation`, `qa-exploratory`, `ai-eng`, `growth`. If the user asks
for one of these, say it does not exist yet and offer the closest built agent —
do not silently substitute one.

Roster and ownership: `.claude/team/ROSTER.md`.

## What to do

1. **Resolve the agent.** If the first word is not a built agent name, do not
   guess — list the built agents and ask which they meant. If no agent name was
   given at all, read `ROSTER.md`, pick the owner of the topic, and **say which
   one you picked and why** before asking it.

2. **Is this a conversation already in progress?** If this agent was spawned
   earlier in this session, continue it with `SendMessage` rather than a fresh
   `Agent` call. That preserves its context, so a follow-up is a real
   conversation instead of a cold restart that re-reads everything. Only start a
   new agent if this one has not run yet in this session, or if the user changes
   the subject entirely.

3. **Spawn or continue it, with `run_in_background: false`** — the user is
   waiting for the answer, so this must be synchronous.

   Pass along: the question verbatim, plus any context from this session the
   agent cannot see. It starts cold and has no access to this conversation. If
   the user is asking about something you and they just discussed, summarise that
   in the prompt — otherwise the answer will be confidently about the wrong
   thing.

   Do **not** re-state the agent's own charter at it. That is in its definition
   file and repeating it wastes tokens and can conflict with it.

4. **Relay the answer in full.** Agent reports are never shown to the user, so
   anything you do not relay is lost. Give the substance — the reasoning, the
   `file:line` citations, the caveats — not a summary of it. If the agent
   returned a verdict, lead with the verdict.

   Attribute it: `**backend:**` before the answer, so it is obvious who is
   speaking. If you add anything of your own, mark it clearly as yours.

5. **If the agent refused the question** because it falls outside its charter,
   relay that, name the agent that does own it, and offer to ask them instead.
   That refusal is the roster working, not a failure.

## Scope

This is a conversation, not a work order. The agent should answer, explain,
investigate and advise. If the question implies actually building something,
have the agent describe what it would do and what it would cost — then stop and
let the user decide. **Nothing gets implemented from an `/ask`.**

$ARGUMENTS
