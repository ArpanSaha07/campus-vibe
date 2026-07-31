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

### Required

| Property | Notes |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` — activates `application-prod.yml` |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://<rds-endpoint>:5432/campusvibe` |
| `SPRING_DATASOURCE_USERNAME` | RDS master username |
| `SPRING_DATASOURCE_PASSWORD` | RDS password. **Secret** |
| `JWT_SECRET` | **Secret.** Min 32 bytes; the app refuses to start otherwise. Generate with `openssl rand -hex 32`. Must differ from the development value |
| `CORS_ALLOWED_ORIGINS` | The deployed frontend origin, e.g. `https://campusvibe.vercel.app` |

### Optional

| Property | Default | Notes |
|---|---|---|
| `OPENAI_API_KEY` | *(blank)* | **Secret.** Blank runs search in keyword-only mode with no OpenAI calls. Use a key from a **separate OpenAI project** from development |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | |
| `OPENAI_CONNECT_TIMEOUT` | `2s` | |
| `OPENAI_READ_TIMEOUT` | `10s` | |
| `OPENAI_MAX_RETRIES` | `2` | Retries 429/5xx only |
| `GOOGLE_CLIENT_ID` | *(blank)* | Public client id, not a secret |
| `AWS_REGION` | `us-east-1` | |
| `AWS_S3_BUCKET_CLUBS` | `campusvibe-clubs` | |
| `AWS_S3_BUCKET_EVENTS` | `campusvibe-events` | |

`application-prod.yml` sets `aws.s3.mock: false`, so real S3 is used without
any environment property. Note that setting `AWS_S3_MOCK` explicitly *would*
override it — OS environment variables outrank profile config files in Spring's
property precedence. Leave it unset in production.

### Never set

`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. The backend uses the AWS
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
