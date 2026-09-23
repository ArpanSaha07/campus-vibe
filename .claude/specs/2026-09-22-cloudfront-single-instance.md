# Retire the load balancer: API HTTPS through CloudFront

**Status:** approved · **Date:** 2026-09-22

## Goal

`https://api.campusvibe-mcgill.com` is served by a CloudFront distribution in front of
`CampusVibe-Backend-Prod` running as a single-instance environment, and the Application Load
Balancer is gone ([ADR-017](../docs/decisions/ADR-017-api-https-through-cloudfront-not-a-load-balancer.md)).
September's bill ran at about $70 a month, with the load balancer and its addresses about $25 of it;
the target is about $43 including tax. Before any AWS change, the rate limiter bills a request to an
address the client cannot write, under the load balancer today and under CloudFront after.

## Out of scope

- Moving the rate limits out of memory, and a second instance.
- Encrypting the CloudFront-to-origin leg (ADR-017, *Revisit when*).
- Serving the frontend and the API from one domain.
- Resizing the instance or RDS, and RDS reservations.
- Any frontend change: the API URL and the CSP stay as they are.

## Decisions taken

- ADR-017 accepted and scheduled now, not after the demo — Arpan, 2026-09-22.
- **Client IP is counted from the right of `X-Forwarded-For`.** The load balancer and CloudFront
  both append the viewer, and EB's nginx appends the proxy, so the viewer is 2 from the right.
  `trusted-proxy-hops`, default 2 — Arpan, 2026-09-22. Rejected: `CloudFront-Viewer-Address`,
  which needs a custom origin request policy and works only after the cutover.
- **Port 80 is locked to the CloudFront origin-facing prefix list by one-off CLI commands**, recorded
  as manual drift, not by an `.ebextensions` override — Arpan, 2026-09-22.
- **Cutover in ADR order**, so `api.` is down from the environment switch (step 4) until DNS reaches
  CloudFront (step 6). The Namecheap TTL is lowered first to shorten that — Arpan, 2026-09-22.
- **AWS writes are granted for the implementing session**, run with `CAMPUSVIBE_ALLOW_AWS_WRITE=1` set
  when Claude Code starts, and every AWS command is printed to Arpan. Deletes are still asked one at a
  time — Arpan, 2026-09-22.
- Origin read timeout 60 s, matching the load balancer's idle timeout the planner's stream runs under
  today; `PriceClass_100` — Claude, carried in the approved plan.

## Open questions

- Whether EB's nginx appends to `X-Forwarded-For` as assumed. The production check below proves it;
  if it fails, Part B does not start.
- Whether switching `EnvironmentType` keeps the instance security group id. If it changes,
  `campusvibe-database-sg` must be re-pointed before the app can reach the database.
- Whether the existing Namecheap validation CNAME validates the `us-east-1` certificate by itself.

## Files expected to change

Part A, the code unit:
- `backend/src/main/java/com/campusvibe/security/ratelimit/ClientIpResolver.java`
- `backend/src/main/java/com/campusvibe/security/ratelimit/RateLimitProperties.java`
- `backend/src/main/resources/application.yml`, `docker/docker-compose.yml`
- `backend/src/test/java/com/campusvibe/security/ratelimit/ClientIpResolverTest.java` (new)

Part B changes AWS and Namecheap, not the repository.

## Verification

- Part A: `node scripts/verify.mjs`. After Arpan deploys it: 21 `POST /api/v1/auth/login` calls, each
  with a different forged `X-Forwarded-For`, and the 21st answers 429.
- Part B:
  - `curl -sI http://api.campusvibe-mcgill.com/actuator/health` answers 301 to https;
  - `curl -s https://api.campusvibe-mcgill.com/actuator/health` answers `UP`;
  - port 80 on the Elastic IP times out.
- In the browser: login, a club page, CORS from Vercel and localhost, a 3 MB upload, and the planner
  intro arriving in pieces.
- The forged header test repeated through CloudFront.
- `elbv2 describe-load-balancers` lists no CampusVibe load balancer.

## To update at wrap-up

- **ADR-017:** Implemented in.
- **[`aws-deployment.md`](../docs/architecture/aws-deployment.md) and [`connecting-elastic-beanstalk.md`](../docs/architecture/connecting-elastic-beanstalk.md):**
  CloudFront replaces the ALB, the cost table, the prefix-list rule as drift, and the load
  balancer's addresses are gone.
- **[`rules/aws-handling.md`](../rules/aws-handling.md):**
  - drop the load-balancer bullets (BUG-054's 503 advice, the two addresses);
  - add the distribution and the drift;
  - add that a CloudFront 502 or 504 is the origin.
- **[`connecting-ses.md`](../docs/architecture/connecting-ses.md)**, which maps the rate-limit package: the hop rule.
- **`todo.md`:** close the load balancer item and the HTTP redirect item; resolve the planner stream check.
- **`tasks-completed.md`, `STATUS.md`,** and this spec marked shipped.
