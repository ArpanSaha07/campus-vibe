# Deploy the planner: bring production's backend up to the frontend

## Context

Arpan reports the planner works locally but not on the deployed site, with the backend already on Elastic Beanstalk and `OPENAI_API_KEY` already set there.

Checked read-only on 2026-09-16, over public HTTP:

- **The live API predates event end time.**
  - `GET https://api.campusvibe-mcgill.com/api/v1/events` returns events with **no `endTime` field**.
  - `?upcoming=true` is silently ignored.
  - So production is running code from before `95418a1`: no V35, no V36, **no `/api/v1/planner/*` routes**.
- **The live frontend is already the new one.**
  - `https://www.campusvibe-mcgill.com/planner` serves the `(planner)` route group from `2b8cfe4` or later.
  - The page's first call, `GET /api/v1/planner/conversations`, reaches no handler, so it lands in the *planner is unavailable* state.
- **The mismatch also breaks pages outside the planner.**
  - `https://www.campusvibe-mcgill.com/events/1` answers **500**.
  - The event page formats `endTime`, which the old API does not send.
  - So every event page on the live site is down until the backend catches up.
- **Branches.**
  - The planner work (`2b8cfe4`, `95418a1`, `f682918`) is on `develop` and `feature/ai-planner`, pushed.
  - It is **not on `main`**.
  - Vercel is evidently deploying one of the branches that has it.
- **Not checked.**
  - This shell has no `campusvibe-admin` AWS profile, so the deployed version label and the property names were not read.
  - Whether `OPENAI_API_KEY` is set, and set under exactly that name, is taken from Arpan.

**Answer: yes, the backend must be redeployed.** Nothing else explains the missing `endTime`. The key alone cannot help, because the endpoints it would serve are not in the running jar.

## Checklist, in order

1. **Snapshot RDS first (Arpan, console).**
   - V35 rewrites every event row: `end_time` = start + 2h, NOT NULL, CHECKs.
   - V36 adds three tables.
   - Both run on backend start and cannot be undone by redeploying an older jar; Flyway would then refuse to start on unknown migrations.
   - A manual snapshot of `campusvibe-prod-db` is the rollback.
2. **Set the OpenAI budget cap** on the production OpenAI project (todo P1). Every planner message is now a generative call, and only the per-user daily quota bounds it.
3. **Build the bundle from `f682918`** on a clean tree:
   - `node scripts/verify.mjs --all --full`, which was green on this code at wrap-up
   - then `node scripts/package-eb.mjs`, **from PowerShell**, since it fails to spawn Maven from Git Bash (STATUS, P2 follow-ups)
   - The zip name must end in `-f682918` with **no `-dirty`**.
4. **Upload and deploy (Arpan, EB console)**, per `connecting-elastic-beanstalk.md` §5: Upload and deploy, version label = zip name, and wait for Green.
5. **Read the container log** for:
   - `prod` profile active
   - Flyway `Migrating schema ... to version 35` and `36`, both successful
   - `OpenAI configured (... chatModel=gpt-4.1-mini ...); semantic search and the planner enabled`. If it says *OPENAI_API_KEY is not set*, the property name is wrong or the environment did not restart.
   - `Started Main`
6. **Environment properties: nothing new is required.**
   - `OPENAI_CHAT_MODEL`, `OPENAI_MAX_OUTPUT_TOKENS` and `OPENAI_CHAT_TIMEOUT` have working defaults.
   - Confirm the key's name is exactly `OPENAI_API_KEY`, using the OptionName-only query in §4.
   - CORS already allows `https://www.campusvibe-mcgill.com` for the planner routes (preflight checked: 200 with that origin).
7. **Frontend (Vercel): no redeploy needed**, since it already serves the new planner.
   - Confirm in Vercel which commit production built. It must be `f682918` or a descendant, so the contract matches the backend exactly.
   - If Vercel production tracks `develop`, that is already true.
8. **Verify the fix, then the planner:**
   - `curl -s $API/api/v1/events` now includes `endTime`
   - `https://www.campusvibe-mcgill.com/events/1` answers 200
   - Signed in on the live site, `/planner` shows the sidebar and *15 of 15 messages left today*, not *unavailable*
   - Send one message. The intro should appear in pieces, not all at once at the end, which proves nginx is not buffering. Cards should arrive, and a reload should show the chat.
   - In the container log: `ai.usage feature=planner ...` and `planner.answer kind=... kept=...`
   - Tick the two P2 items in `todo.md` (proxy path, remaining browser states)
9. **Later, not blocking:** open the `develop` to `main` PR so `main` matches what is deployed. CI runs the full suite there.

## If step 8 still fails

- **503 from `/api/v1/planner/conversations/{id}/messages`, or the log line says the key is not set:** property name or restart.
- **An `error` frame reading *couldn't answer just now*:** the key is rejected (401 logged by `OpenAiLlmClient`) or the provider is unreachable.
- **The reply appears all at once:** nginx is buffering despite `X-Accel-Buffering: no`. Add `deploy/eb/.platform/nginx/conf.d/` with `proxy_buffering off` for `/api/v1/planner/`, as a new small unit.
- **The stream cuts off after about 60 s:** the load balancer idle timeout. The keep-alive every 15 s should prevent it; raise the idle timeout if not.
