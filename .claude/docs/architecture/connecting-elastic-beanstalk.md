# Connecting Elastic Beanstalk

**Code as of:** f8d32ba · **Account read:** 2026-09-12 · **Changed:** 2026-09-12 — `AWS_S3_BUCKET` set, `S3_BUCKET_NAME` removed
**Order:** 2 of 4 — after [`connecting-rds.md`](connecting-rds.md) §1–§5. The S3 and SES properties from [`connecting-s3.md`](connecting-s3.md) and [`connecting-ses.md`](connecting-ses.md) go in the same property pass.
**Related:** guide §12–§19 in [`CampusVibe_AWS_Deployment_Guide.md`](CampusVibe_AWS_Deployment_Guide.md) · packaging in [`aws-deployment.md`](aws-deployment.md) · property reference in [`docker/EB-DEPLOYMENT.md`](../../../docker/EB-DEPLOYMENT.md)

**Legend.** **Arpan · console** — an AWS change, *ask first* under
[`rules/aws-handling.md`](../../rules/aws-handling.md) · **Code unit** — a repo
change, started with `/start` · **Check** — read-only.

Every command assumes `export AWS_PROFILE=campusvibe-admin AWS_REGION=ca-central-1`.

---

## Where it stands

| | Account, 2026-09-12 | |
|---|---|---|
| Environment | `CampusVibe-Backend-Prod` in application `CampusVibe`, Docker on Amazon Linux 2023 v4.13.7, Green | ✅ |
| What it runs | **The sample application.** No CampusVibe version has ever been deployed | §5 |
| Topology | **Load balanced**: an Application Load Balancer, auto scaling 1 to 2, one t3.small | Kept, decided 2026-09-12 |
| Listener | **HTTP on 80 only** — no certificate | ⚠ §2 |
| Health check | Target group checks **`/`** for a 200 | ⚠ §1 — CampusVibe answers 401 there |
| Instance role | `CampusVibe-ElasticBeanstalk-EC2Role`: WebTier, **WorkerTier**, **MulticontainerDocker**, and the inline S3 grant | ⚠ §0 |
| Properties set | `AWS_REGION AWS_S3_BUCKET DB_HOST DB_NAME DB_PORT DB_USERNAME FRONTEND_URL SPRING_PROFILES_ACTIVE` — `AWS_S3_BUCKET` replaced `S3_BUCKET_NAME` 2026-09-12 | ⚠ §4 — five are read by nothing, and the database and JWT ones are missing |
| Proxy | **nginx**, default request body limit **1 MB** — under the 5 MB upload cap | ⚠ §3 |
| Logs | Streamed to CloudWatch, 7-day retention | ✅ |
| Loose ends | **Two Elastic IP addresses associated with nothing**, still billed | ⚠ §0 |
| Domain | `api.campusvibe-mcgill.com` does not resolve; DNS is at Namecheap | §2 |

**Current code cannot boot here as configured**: `JWT_SECRET`,
`SPRING_DATASOURCE_PASSWORD` and `AWS_S3_BUCKET` have no default and none is
set.

## Already done

- [x] Environment on Docker / Amazon Linux 2023, in the same VPC as RDS
- [x] Instance role with the S3 media grant; IMDSv2 required
- [x] CloudWatch log streaming and enhanced health
- [x] Production image and bundle script — `deploy/eb/Dockerfile`, `scripts/package-eb.mjs`
- [x] Budget alerts

---

## 0. Cleanup and cost — Arpan · console

- [ ] **Release the two idle Elastic IPs.** **EC2 → Elastic IPs** → select each
  address with no associated instance → **Actions → Release Elastic IP
  addresses**. Neither is attached to anything; both are billed while idle.
- [ ] **Detach the policies this environment never uses.** **IAM → Roles →
  `CampusVibe-ElasticBeanstalk-EC2Role` → Permissions** → remove
  `AWSElasticBeanstalkWorkerTier` and `AWSElasticBeanstalkMulticontainerDocker`.
  Keep `AWSElasticBeanstalkWebTier` and `CampusVibe-S3-Media-Access`. This is a
  single-container web environment; guide §9 asks for least privilege.
- [ ] **Cap the environment at one instance.** **Elastic Beanstalk → Configuration →
  Instance traffic and scaling → Capacity → Max instances: 1**. Login and search
  rate limits are counted per instance, so a second instance silently doubles
  every limit.

**Rough monthly cost, ca-central-1** — approximate; confirm in the AWS Pricing
Calculator before relying on it:

| Item | About |
|---|---|
| Application Load Balancer, low traffic, including its public IPv4 addresses | $25–30 |
| t3.small instance, plus its public IPv4 address | $20 |
| RDS db.t4g.micro and 20 GB storage | $17 |
| S3, SES, CloudWatch at this scale | under $2 |
| Two idle Elastic IPs, until released | $7 |

That lands above the $50 budget once the idle addresses are gone. The load
balancer was kept knowingly on 2026-09-12; the instance size is the next lever
if the bill needs to come down.

## 1. Fix the health check before the first real deploy — Arpan · console

**Why.** The target group asks `/` for a 200. The sample app answers; CampusVibe
answers 401, because everything outside the public matchers requires a token.
The first real deploy would be marked unhealthy and fail. `/actuator/health` is
a public GET (`SecurityFilterChainConfig.java:90`) exposing only `health` and
`info` (`application.yml:37-41`).

- [ ] **Elastic Beanstalk → Configuration → Instance traffic and scaling →
  Processes → default → Actions → Edit → Health check path:
  `/actuator/health`**, HTTP code 200 → **Save → Apply**.

**Verify:**
```bash
aws elbv2 describe-target-groups \
  --query 'TargetGroups[?starts_with(TargetGroupName,`awseb`)].HealthCheckPath'
```

## 2. HTTPS for `api.campusvibe-mcgill.com` — Arpan · console

**Decided 2026-09-12:** keep the load balancer and terminate TLS on it with a
free ACM certificate. This replaces the single-instance-behind-Cloudflare plan
in `aws-deployment.md`; DNS stays at Namecheap.

- [ ] **Certificate Manager (region ca-central-1 — it must match the load
  balancer) → Request → Request a public certificate →
  `api.campusvibe-mcgill.com` → DNS validation → Request.**
- [ ] **Namecheap → Domain List → campusvibe-mcgill.com → Advanced DNS → Add New
  Record → CNAME.** Host is the record name ACM shows *without*
  `.campusvibe-mcgill.com.` — for example `_1a2b3c.api`. Value is ACM's value.
  Leave the record in place afterwards: ACM re-validates with it at renewal.
- [ ] Wait for the certificate status **Issued**.
- [ ] **Elastic Beanstalk → Configuration → Instance traffic and scaling →
  Listeners → Add listener**: port **443**, protocol **HTTPS**, the new
  certificate, SSL policy `ELBSecurityPolicy-TLS13-1-2-2021-06`, default process →
  **Save → Apply**. Elastic Beanstalk opens 443 on the load balancer's group.
- [ ] **Namecheap → Add New Record → CNAME**: Host `api`, Value
  `campusvibe-api-prod.ca-central-1.elasticbeanstalk.com`.

**Verify:**
```bash
nslookup api.campusvibe-mcgill.com
curl -sS -o /dev/null -w '%{http_code}\n' https://api.campusvibe-mcgill.com/actuator/health
```

## 3. Redirect HTTP to HTTPS — Code unit

**Why.** Guide §18 forbids running on plain HTTP. Elastic Beanstalk's listener
settings offer no redirect action, and editing the listener in the EC2 console
is overwritten by the next Elastic Beanstalk configuration update, so the
redirect has to ship inside the bundle.

- [ ] Add `deploy/eb/.ebextensions/https-redirect.config`, replacing the port 80
  listener's default action with a redirect — the pattern AWS documents for
  Elastic Beanstalk; confirm it on the first deploy that carries it:
  ```yaml
  Resources:
    AWSEBV2LoadBalancerListener:
      Type: AWS::ElasticLoadBalancingV2::Listener
      Properties:
        LoadBalancerArn:
          Ref: AWSEBV2LoadBalancer
        Port: 80
        Protocol: HTTP
        DefaultActions:
          - Type: redirect
            RedirectConfig:
              Protocol: HTTPS
              Port: '443'
              Host: '#{host}'
              Path: '/#{path}'
              Query: '#{query}'
              StatusCode: HTTP_301
  ```
- [ ] Teach `scripts/package-eb.mjs` to stage `.ebextensions/` beside
  `Dockerfile` and `app.jar` — today it copies exactly those two.
- [ ] **Raise nginx's request body limit** — the platform's nginx refuses
  bodies over 1 MB by default, under the 5 MB upload cap, and no local test has
  an nginx to catch it. `deploy/eb/.platform/nginx/conf.d/client_max_body_size.conf`
  at `10M`, staged the same way; part of the approved
  [event photo unit](../../specs/2026-09-12-event-images-served-and-eb-upload-limit.md),
  which also teaches the script to stage hidden directories generally.
- [ ] **Verify:** `curl -sI http://api.campusvibe-mcgill.com/actuator/health` → `301` with an `https://` location.

Until this lands, every client uses the `https://` address explicitly.

## 4. Environment properties — Arpan · console

**Decided 2026-09-12:** secrets live in environment properties for the first
deployment; no Secrets Manager. **Elastic Beanstalk → Configuration → Updates,
monitoring, and logging → Environment properties.** Every save restarts the
application.

**Required — the application refuses to start without these:**

| Property | Value | Notes |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` | Already set; keep |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://<rds-endpoint>:5432/campusvibe?sslmode=require` | [`connecting-rds.md`](connecting-rds.md) §5 |
| `SPRING_DATASOURCE_USERNAME` | the RDS master user | Until the dedicated user lands |
| `SPRING_DATASOURCE_PASSWORD` | **secret** | The self-managed password from [`connecting-rds.md`](connecting-rds.md) §1 |
| `JWT_SECRET` | **secret** — `openssl rand -hex 32` | At least 32 bytes; must differ from development |
| `AWS_S3_BUCKET` | `campusvibe-prod-media` | **Set 2026-09-12.** [`connecting-s3.md`](connecting-s3.md); no default |

**Required for correct behaviour:**

| Property | Value | Notes |
|---|---|---|
| `AWS_REGION` | `ca-central-1` | Already set; keep |
| `CORS_ALLOWED_ORIGINS` | `https://www.campusvibe-mcgill.com` | Comma-separated. Add another origin only if it really serves the frontend |
| `APP_BASE_URL` | `https://www.campusvibe-mcgill.com` | Links in mail point here |
| `AUTH_RATE_LIMIT_TRUST_XFF` | `true` | Behind the load balancer every request arrives from its address; without this the whole internet shares one login budget |

**Optional:** `OPENAI_API_KEY` (**secret**; blank runs search keyword-only),
`GOOGLE_CLIENT_ID` (public). Mail properties: [`connecting-ses.md`](connecting-ses.md) §8.

**One time only — the first administrator.** `AdminBootstrapRunner` grants
`ROLE_ADMIN` at startup and never revokes it:

- [ ] Sign up on the deployed site first, then set `APP_BOOTSTRAP_ADMIN_ENABLED=true`
  and `APP_BOOTSTRAP_ADMIN_EMAIL=<that address>`, leaving the password blank to
  promote the existing account — the only way that works for a Google account.
- [ ] After the restart and one admin login, set `APP_BOOTSTRAP_ADMIN_ENABLED=false`
  and remove the email.

**Remove — read by no code:** `DB_HOST`, `DB_NAME`, `DB_PORT`, `DB_USERNAME`,
`FRONTEND_URL`. (`S3_BUCKET_NAME` was removed 2026-09-12.)

**Never set:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`; and
`AWS_S3_ENDPOINT`, `AWS_S3_ACCESS_KEY`, `AWS_S3_SECRET_KEY`, which point the S3
client away from AWS ([ADR-011](../decisions/ADR-011-minio-replaces-fakes3.md)).

**Verify the names** — query `OptionName` only; values come back in plaintext:
```bash
aws elasticbeanstalk describe-configuration-settings \
  --application-name CampusVibe --environment-name CampusVibe-Backend-Prod \
  --query 'ConfigurationSettings[0].OptionSettings[?Namespace==`aws:elasticbeanstalk:application:environment`].OptionName'
```

## 5. Build and deploy the first real version — Arpan

Depends on §1, §4 and [`connecting-rds.md`](connecting-rds.md) §1–§4.

- [ ] `node scripts/verify.mjs --all --full` green on the commit being deployed.
- [ ] `node scripts/package-eb.mjs` → `dist/eb/campusvibe-backend-<timestamp>-<sha>.zip`.
  A `-dirty` suffix means uncommitted changes went in — do not deploy it.
- [ ] **Elastic Beanstalk → Environment → Upload and deploy** → the zip, version
  label the zip's name.
- [ ] Watch **Events** until health is Green. If it goes Severe, read the
  container log (`MSYS_NO_PATHCONV=1` stops Git Bash rewriting the leading slash):
  ```bash
  MSYS_NO_PATHCONV=1 aws logs tail \
    /aws/elasticbeanstalk/CampusVibe-Backend-Prod/var/log/eb-docker/containers/eb-current-app/stdouterr.log \
    --since 15m --follow
  ```
- [ ] Expect: the `prod` profile active, Flyway applying every migration,
  `Started Main`, and `Mail: no spring.mail.host configured` until SES is wired.
- [ ] Check the database side: [`connecting-rds.md`](connecting-rds.md) §7.

## 6. Verify end to end — Check

```bash
API=https://api.campusvibe-mcgill.com
curl -s $API/actuator/health                                   # status UP
curl -s -o /dev/null -w '%{http_code}\n' $API/api/v1/clubs      # 200
curl -s -o /dev/null -w '%{http_code}\n' $API/api/v1/events     # 200
curl -s -o /dev/null -w '%{http_code}\n' $API/api/v1/users/me   # 401 without a token
curl -si -X OPTIONS $API/api/v1/clubs \
  -H 'Origin: https://www.campusvibe-mcgill.com' \
  -H 'Access-Control-Request-Method: GET' | grep -i access-control-allow-origin
```

- [ ] Sign up and log in from the deployed frontend; an authenticated page loads
- [ ] First administrator bootstrapped, then the bootstrap switched off
- [ ] A club logo uploads and displays — [`connecting-s3.md`](connecting-s3.md) §5
- [ ] An upload without a token is refused
- [ ] The container log holds no password, token, JWT or `Authorization` header (guide §19)

## 7. The frontend's side — Arpan · Vercel, not AWS

- [ ] In the Vercel project, set `NEXT_PUBLIC_API_URL` and `API_INTERNAL_URL` to
  `https://api.campusvibe-mcgill.com`. The `/media/**` rewrite resolves
  `API_INTERNAL_URL` at request time (`frontend/next.config.ts`), so uploaded
  images break without it. Vercel's configuration is recorded nowhere yet —
  [BUG-018](../../bugs/bugs.md#bug-018).

---

## Later — not needed to connect

- [ ] Deploy from CI with GitHub OIDC and an ECR image per commit — guide §21–§22; no OIDC provider or ECR repository exists yet
- [ ] Secrets Manager, when a second environment or a second person with AWS access appears — the move is configuration only
- [ ] Revisit the instance size against measured memory

## Appendix — how this was read

```bash
aws elasticbeanstalk describe-environments
aws elasticbeanstalk describe-environment-resources --environment-name CampusVibe-Backend-Prod
aws elasticbeanstalk describe-configuration-settings --application-name CampusVibe --environment-name CampusVibe-Backend-Prod --query '…OptionName'
aws elbv2 describe-listeners --load-balancer-arn <from describe-environment-resources>
aws elbv2 describe-target-groups --load-balancer-arn <same>
aws autoscaling describe-auto-scaling-groups
aws iam list-attached-role-policies --role-name CampusVibe-ElasticBeanstalk-EC2Role
aws ec2 describe-addresses
nslookup api.campusvibe-mcgill.com
```
