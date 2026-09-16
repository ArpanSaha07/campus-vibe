# Elastic Beanstalk Deployment — Environment Properties

The backend reads **all** configuration from environment variables. The same
build artifact runs unchanged in local development and in production; only the
source of the values differs:

| Environment | Source |
|---|---|
| Local | `docker/.env` (gitignored), loaded by Compose |
| Production | Elastic Beanstalk environment properties |

No secret is committed, and no application code changes between environments.

---

## Environment properties to configure

Set these under **Configuration → Updates, monitoring, and logging →
Environment properties** in the EB console (or via `eb setenv`).

Step-by-step runbooks, with the order and the account as it stood on
2026-09-12: `.claude/docs/architecture/connecting-elastic-beanstalk.md`, and
`connecting-rds.md`, `connecting-s3.md` and `connecting-ses.md` beside it.

### Required

The application refuses to start without these.

| Property | Notes |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` — activates `application-prod.yml` |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://<rds-endpoint>:5432/campusvibe?sslmode=require` — RDS forces TLS |
| `SPRING_DATASOURCE_USERNAME` | RDS master username, until a dedicated application user exists |
| `SPRING_DATASOURCE_PASSWORD` | **Secret.** A self-managed master password — an RDS-managed one rotates and breaks this copy |
| `JWT_SECRET` | **Secret.** Min 32 bytes; the app refuses to start otherwise. Generate with `openssl rand -hex 32`. Must differ from the development value |
| `AWS_S3_BUCKET` | `campusvibe-prod-media`. No default, and blank is rejected (ADR-012) |

### Required for correct behaviour

| Property | Notes |
|---|---|
| `CORS_ALLOWED_ORIGINS` | The deployed frontend origin: `https://www.campusvibe-mcgill.com` |
| `APP_BASE_URL` | The public frontend URL links in mail point at |
| `AUTH_RATE_LIMIT_TRUST_XFF` | `true` behind the load balancer, and only there |

### Optional

| Property | Default | Notes |
|---|---|---|
| `AWS_REGION` | `ca-central-1` | Where the bucket is |
| `OPENAI_API_KEY` | *(blank)* | **Secret.** Blank runs search in keyword-only mode with no OpenAI calls. Use a key from a **separate OpenAI project** from development |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | |
| `OPENAI_CONNECT_TIMEOUT` | `2s` | |
| `OPENAI_READ_TIMEOUT` | `10s` | |
| `OPENAI_MAX_RETRIES` | `2` | Retries 429/5xx only; the planner retries only before its first streamed token |
| `OPENAI_CHAT_MODEL` | `gpt-4.1-mini` | The planner's model. Without `OPENAI_API_KEY` the planner answers 503 |
| `OPENAI_MAX_OUTPUT_TOKENS` | `1200` | Cap per planner reply |
| `OPENAI_CHAT_TIMEOUT` | `60s` | One whole streamed planner reply |
| `GOOGLE_CLIENT_ID` | *(blank)* | Public client id, not a secret |
| `SPRING_MAIL_HOST` | *(unset)* | `email-smtp.ca-central-1.amazonaws.com`. Unset means mail is logged, not sent |
| `SPRING_MAIL_PORT` | | `587` |
| `SPRING_MAIL_USERNAME` | | SES SMTP user name (ADR-013) |
| `SPRING_MAIL_PASSWORD` | | **Secret.** SES SMTP password (ADR-013) |
| `MAIL_FROM` | `no-reply@campusvibe.local` | Must be an address at the verified SES domain |
| `APP_BOOTSTRAP_ADMIN_ENABLED` | `false` | Set `true` once, with `APP_BOOTSTRAP_ADMIN_EMAIL`, to grant the first administrator; switch it back off after |

There is no S3 mock flag any more. The client is always real; setting
`AWS_S3_ENDPOINT` points it at an S3-compatible store instead of AWS, which is
what local development does with MinIO and production must never do (ADR-011).

### Never set

`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`; and `AWS_S3_ENDPOINT`,
`AWS_S3_ACCESS_KEY` and `AWS_S3_SECRET_KEY`. The backend uses the AWS
default credential provider chain (`s3/S3Config.java`), which resolves the EC2
instance role automatically. Attach an IAM role granting S3 access to the EB
environment instead — static keys in environment properties are strictly worse.

---

## Platform note

`Dockerrun.aws.json` is **version 1** (single-container Docker) deliberately.

On the multi-container platform (Dockerrun v2, ECS-managed) EB environment
properties are *not* passed into containers — every value has to be hardcoded
in the `containerDefinitions` environment array, which forces secrets into a
committed file. That platform is also retired. On v1, EB injects environment
properties as real OS environment variables, which Spring reads natively.

If the deployment is ever moved to ECS or multi-container, secrets must move to
AWS Secrets Manager at the same time; do not reintroduce hardcoded values.

---

## OpenAI key hygiene

1. **One project per environment.** Create separate OpenAI projects for
   development and production with separate keys, so a leaked development key
   cannot touch production spend and either can be rotated independently.
2. **Set a hard monthly budget cap** on each project in the OpenAI dashboard.
   This is the only control that bounds the loss from a leaked key to a known
   amount — no amount of application code can do that.
3. **Rotation** is a value change in the EB console plus a restart. No redeploy
   and no code change, because the key is only ever read through
   `OpenAiProperties`.

---

## Future: AWS Secrets Manager

Environment properties are adequate at current scale. To migrate later, add
`io.awspring.cloud:spring-cloud-aws-starter-secrets-manager` and put

```yaml
spring:
  config:
    import: aws-secretsmanager:/campusvibe/prod
```

in `application-prod.yml`, granting the instance role
`secretsmanager:GetSecretValue` on that secret ARN. Because every secret is
already read through a placeholder or `@ConfigurationProperties`, **no feature
code changes** — the values simply arrive from a different property source.
That is the reason for routing OpenAI configuration through `OpenAiProperties`
now rather than reading environment variables directly across the codebase.
