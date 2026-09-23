# ADR-017 — HTTPS for the API moves from the load balancer to CloudFront, in front of a single-instance environment

**Status:** Accepted 2026-09-22
**Date:** 2026-09-15
**Raised by:** the first production deploy. Arpan asked what the load balancer
costs, then what HTTPS without it would take, and asked for this record so the
move can be made after the demo. The 2026-09-12 choice to keep the load balancer
was never an ADR; it is recorded in
[`aws-deployment.md`](../architecture/aws-deployment.md) and
[`connecting-elastic-beanstalk.md`](../architecture/connecting-elastic-beanstalk.md).
**Approved by:** Arpan, 2026-09-22, scheduled for immediately rather than after the demo ([spec](../../specs/2026-09-22-cloudfront-single-instance.md))
**Implemented in:** — not yet built. Nothing changes until this is accepted and
scheduled; the load balancer stays for the demo.

## Context

**What runs today (2026-09-15).** `CampusVibe-Backend-Prod` is a load-balanced
Elastic Beanstalk environment:
- **Compute:** one t3.small, capped at one instance.
- **Load balancer:** an Application Load Balancer spanning `ca-central-1a`, `1b` and `1d`.
- **HTTPS:** terminates on the load balancer's 443 listener, with an ACM certificate in `ca-central-1`.
- **Port 80:** still serves plain HTTP; the redirect is queued in [`todo.md`](../../TODO/todo.md).

**The load balancer balances nothing.** `MaxSize` is 1, and it has to stay 1
while the login and search rate limits are counted in memory per instance
(`application.yml:129-140`). What the load balancer actually buys is a place to
attach an ACM certificate.

**It is the largest line on the bill.** Roughly $25–30 a month at this traffic,
including a public IPv4 address per zone, against a $50 budget
(`connecting-elastic-beanstalk.md` §0). Those figures are estimates, not measurements.

**It has already caused one outage.** A change that recreated the Auto Scaling
group moved the instance into a zone the load balancer did not serve, so a
healthy deploy answered 503 ([BUG-054](../../bugs/fixed_bugs.md#bug-054)).

**HTTPS itself is not optional.** The browser calls the API directly
(`frontend/app/lib/api.tsx:1`), and the CSP's `connect-src` is built from the
same URL (`frontend/next.config.ts:24`, `:69`). An HTTP API behind the HTTPS
site is blocked as mixed content.

**One code fact any proxy change touches.** With `AUTH_RATE_LIMIT_TRUST_XFF=true`
(`application.yml:140`), `ClientIpResolver` takes the **left-most**
`X-Forwarded-For` entry (`ClientIpResolver.java:33`). A proxy that appends to
the header leaves that entry as whatever the client sent.

## Options considered

### A. Keep the Application Load Balancer

The status quo.

**Keeps:**
- ACM renews the certificate itself.
- Target-group health checks on `/actuator/health`.
- Rolling or immutable deploys without an outage.
- Room for a second instance.

**Costs:** about $25–30 a month for capacity nobody uses, zone coupling between
the Auto Scaling group and the load balancer (BUG-054), and an HTTP redirect
that has to be written as an `.ebextensions` override of the listener.

**Not chosen:** the money buys balancing across one instance.

### B. CloudFront in front of a single-instance environment — chosen

- **Environment type → `SingleInstance`.** Set with `aws:elasticbeanstalk:environment EnvironmentType`; AWS documents switching both ways by configuration. The load balancer and its addresses go away, and the instance gets an Elastic IP. The environment's CNAME, `campusvibe-api-prod.ca-central-1.elasticbeanstalk.com`, stays.
- **One distribution**, whose custom origin is that CNAME over HTTP on port 80, into Elastic Beanstalk's nginx.
- **Alternate domain `api.campusvibe-mcgill.com`**, with a **new ACM certificate in `us-east-1`**. CloudFront accepts certificates only from that region, so the existing `ca-central-1` certificate cannot move over. DNS validation works as today, through a CNAME at Namecheap.
- **Viewer protocol policy: redirect HTTP to HTTPS.** This closes the queued redirect item at the edge, with no bundle change.
- **One behaviour for every path:**
  - all methods allowed, `OPTIONS` included for CORS preflight;
  - caching disabled;
  - the managed `AllViewerExceptHostHeader` origin request policy. With caching off it forwards `Authorization`, which every authenticated call carries.
- **The origin accepts only CloudFront.** The instance security group allows port 80 only from the managed prefix list `com.amazonaws.global.cloudfront.origin-facing`, and the `0.0.0.0/0` rule is removed. Without that, anyone could skip CloudFront and reach the origin over plain HTTP.
- **Limits fit:**
  - CloudFront's request-body maximum is 64 GB, against the 10 MB `max-request-size` (`application.yml:35`).
  - The origin response timeout defaults to 30 s, adjustable to 120 s.
- **Cost:**
  - CloudFront's always-free tier covers 1 TB out and 10 million requests a month.
  - The instance's public IPv4 is about $3.60 a month.
  - Net saving: roughly $25 a month.

**What it costs:**
- **The CloudFront-to-origin leg is unencrypted.** The prefix list limits who can connect, not who can read. Encrypting that leg needs a certificate on the instance, which is option C's burden again. Accepted for now; see *Revisit when*.
- **Deploys become an outage.** One container restarts, and the first boot took 22 s to `Started Main`. Whether an immutable deploy policy is worth enabling on a single instance is to be measured at build, not assumed.
- **No target-group health check.** Elastic Beanstalk's enhanced health still reports. `-XX:+ExitOnOutOfMemoryError` (`deploy/eb/Dockerfile:37`) is what restarts a JVM that has run out of memory. Nothing restarts a JVM that is merely stuck.
- **A new failure layer.** CloudFront answers its own 502 and 504 when the origin is down or slow, which reads differently from a Spring error.
- **The rate limiter must stop trusting the left-most `X-Forwarded-For` first.** CloudFront appends the viewer address to any header the client sent, and nginx appends CloudFront's. Take the client address from a position CloudFront controls, or from the `CloudFront-Viewer-Address` header, instead of `ClientIpResolver.java:33`'s left-most entry. Confirm the header's exact form at build.

### C. Let's Encrypt on the instance, single instance

Cheapest: only the instance's public IPv4, and no CloudFront.

**Not chosen:**
- **The certificate lives on an instance Elastic Beanstalk replaces**, so every replacement re-issues it. That needs certbot, renewal and re-issue hooks under `deploy/eb/.platform/hooks/`, and it runs into Let's Encrypt's re-issue rate limits.
- **Port 443 opens on the instance to the world.**
- **The redirect is ours to write.**

This is the most operational work of the four, all of it code this project would
own.

### D. Cloudflare's proxy in front, single instance

The original plan in `aws-deployment.md`, replaced 2026-09-12. Free plan.

**Not chosen:**
- **DNS has to move.** The domain's nameservers move from Namecheap to Cloudflare, so every record is recreated there: Vercel's, the ACM validation record, and the SES DKIM, MAIL FROM and DMARC records `connecting-ses.md` writes at Namecheap.
- **The origin leg stays unencrypted by default.** Encrypting it needs Cloudflare's origin certificate on the instance.
- **It sits outside the AWS account**, so the guard hook, the budget alerts and CloudTrail see none of it.

## Decision

**When the load balancer is retired, HTTPS for `api.campusvibe-mcgill.com`
terminates at a CloudFront distribution in front of `CampusVibe-Backend-Prod`
converted to a single-instance environment.**
- **Certificate:** from ACM in `us-east-1`.
- **Edge:** HTTP redirected to HTTPS; caching disabled; all viewer headers except `Host` forwarded.
- **Origin:** HTTP on port 80, reachable only from the CloudFront origin-facing prefix list.

**Timing is Arpan's**; this record does not schedule it. **The order, when it is built:**

1. **Fix `ClientIpResolver`** so the rate limiter cannot be fed a client-written address behind CloudFront — a code unit, through `/start`.
2. **Request the `us-east-1` certificate**, and add its validation CNAME at Namecheap.
3. **Create the distribution** against the current environment CNAME. Test it on its `*.cloudfront.net` name while the load balancer still serves `api`.
4. **Switch the environment to `SingleInstance`.** Check what happens to the listener, `ELBSubnets` and health check settings.
5. **Replace the instance group's `0.0.0.0/0` rule on port 80** with the CloudFront prefix list.
6. **Repoint the `api` CNAME** at Namecheap to the distribution.
7. **Verify:** health, both CORS origins, login, a 3 MB upload, the HTTP redirect, and a request straight to the Elastic IP being refused.
8. **Delete the `ca-central-1` certificate.** Arpan's — every delete is.

Every AWS step is a write the guard hook refuses, so each goes to Arpan with the
exact command, per [`rules/aws-handling.md`](../../rules/aws-handling.md).

**Rollback:**
- Set `EnvironmentType` back to `LoadBalanced`.
- Re-apply the 443 listener and `ELBSubnets`, which a recreated load balancer will not remember.
- Repoint the CNAME.

## Consequences

**Easier:**
- Roughly $25 a month less.
- The HTTP redirect comes for free.
- TLS terminates at the edge with AWS Shield Standard in front.
- No zone coupling of the BUG-054 kind.

**Harder:**
- Every deploy takes the API down for the length of a boot.
- The origin leg is plain HTTP.
- One more AWS service to configure and document.
- CloudFront's own errors are a new layer to diagnose.
- The certificate lives in a region nothing else here uses.

**Foreclosed:** a second backend instance without re-adding a load balancer.
CloudFront can sit in front of one later, so this is reversible rather than
closed.

## Revisit when

- **A second instance is needed.** That first needs the rate limits moved out of
  memory, and then a load balancer returns behind the same distribution.
- **Deploy downtime becomes visible to users**, or a boot grows much past the
  22 s measured on 2026-09-15.
- **Traffic approaches the free tier:** 10 million requests or 1 TB a month.
- **A security review requires encryption on the origin leg.**
- **The frontend and API are put behind one domain.** A single distribution could
  serve both and remove CORS; that is its own decision.
