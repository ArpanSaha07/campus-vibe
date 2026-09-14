# Connecting RDS PostgreSQL

**Code as of:** 806a1d0 · **Account read:** 2026-09-12, read-only
**Order:** 1 of 4 — before [`connecting-elastic-beanstalk.md`](connecting-elastic-beanstalk.md), whose first deploy is the first Flyway run against this database.
**Related:** [`connecting-beanstalk-to-rds.md`](connecting-beanstalk-to-rds.md) (the security-group walkthrough, already done) · guide §5–§7, §14 in [`CampusVibe_AWS_Deployment_Guide.md`](CampusVibe_AWS_Deployment_Guide.md)

**Legend.** **Arpan · console** — an AWS change, *ask first* under
[`rules/aws-handling.md`](../../rules/aws-handling.md) · **Code unit** — a repo
change, started with `/start` · **Check** — read-only, anyone may run it.

Every command assumes `export AWS_PROFILE=campusvibe-admin AWS_REGION=ca-central-1`.

---

## Where it stands

| | Account, 2026-09-12 | |
|---|---|---|
| Instance | `campusvibe-prod-db`, db.t4g.micro, Single-AZ, 20 GB growing to 50 | ✅ matches guide §5 |
| Engine | **PostgreSQL 18.3**, parameter group `default.postgres18` | ⚠ the repo pins 15 — §6 |
| Network | Not publicly accessible, default VPC, same VPC as Elastic Beanstalk | ✅ |
| Security group | `campusvibe-database-sg` admits the EB instance group on 5432 **and one personal /32 address** | ⚠ §2 |
| Encryption, backups | Encrypted, 7-day automated backups, deletion protection on | ✅ |
| TLS | `rds.force_ssl = 1` — plaintext connections are refused | §5 |
| Master password | **RDS-managed in Secrets Manager, rotating every 7 days — next rotation 2026-09-18** | ⚠ §1 |
| Admin access | None — no bastion, and the EB instance is not registered with Systems Manager | ⚠ §3 |

## Already done

- [x] Private PostgreSQL instance with encryption, automated backups, Single-AZ and deletion protection
- [x] Database `campusvibe` created
- [x] Inbound 5432 from the Elastic Beanstalk instance security group — [`connecting-beanstalk-to-rds.md`](connecting-beanstalk-to-rds.md)

---

## 1. Stop the password rotating out from under the app — Arpan · console

**Why.** Secrets live in Elastic Beanstalk environment properties for the first
deployment (decided 2026-09-12, no Secrets Manager). A property is a copy, and
RDS rotates the managed master password every 7 days, so a copied password stops
working at the next rotation and the backend loses its database without a single
code change. Switching to a self-managed password makes the copy the truth.

- [ ] Generate the new password locally and keep it only in a password manager:
  ```bash
  openssl rand -hex 24
  ```
  Hex, so no character needs escaping anywhere it is pasted.
- [ ] **RDS → Databases → `campusvibe-prod-db` → Modify → Settings →
  Credentials management → Self managed** → enter the new master password →
  **Continue → Apply immediately → Modify DB instance**.
- [ ] Do this before the first deploy, and in any case before **2026-09-18**.

RDS deletes the `rds!db-…` secret as part of the switch, which also stops its
monthly charge.

**Verify:**
```bash
aws rds describe-db-instances --db-instance-identifier campusvibe-prod-db \
  --query 'DBInstances[0].MasterUserSecret' --output text      # None
```

## 2. Remove the personal-address rule — Arpan · console

**Why.** The instance is not publicly accessible, so today that rule admits
nobody. It is still a standing grant that becomes live the moment someone flips
public access on, and guide §6 rules out a personal address outright. The admin
path is §3, not this rule.

- [ ] **EC2 → Security Groups → `campusvibe-database-sg` → Inbound rules → Edit
  inbound rules** → delete the PostgreSQL rule whose source is a `/32` address →
  keep the rule whose source is the `awseb-…-AWSEBSecurityGroup-…` group →
  **Save rules**.

**Verify** — an empty address list, one group:
```bash
aws ec2 describe-security-groups --filters Name=group-name,Values=campusvibe-database-sg \
  --query 'SecurityGroups[0].IpPermissions[].{Cidr:IpRanges[].CidrIp,FromGroup:UserIdGroupPairs[].GroupId}'
```

## 3. An admin path into a private database — Arpan · console

**Why.** §4 and §7 need `psql`, the dedicated application user queued in
[`todo.md`](../../TODO/todo.md) needs it, and there is no bastion. Session
Manager port forwarding through the Elastic Beanstalk instance needs no open
port, no SSH key and no new server: the agent ships with Amazon Linux 2023, and
the instance only lacks the permission to register.

- [ ] **IAM → Roles → `CampusVibe-ElasticBeanstalk-EC2Role` → Add permissions →
  Attach policies → `AmazonSSMManagedInstanceCore`**.
- [ ] Wait for the instance to register — the agent retries on its own, which
  can take up to about half an hour.
  ```bash
  aws ssm describe-instance-information \
    --query 'InstanceInformationList[].{Id:InstanceId,Ping:PingStatus}'   # Online
  ```
- [ ] Install the Session Manager plugin for the AWS CLI on your machine.
- [ ] Open the tunnel. The instance id changes whenever Elastic Beanstalk
  replaces the instance, so look it up rather than saving it:
  ```bash
  INSTANCE=$(aws ec2 describe-instances \
    --filters Name=tag:elasticbeanstalk:environment-name,Values=CampusVibe-Backend-Prod \
              Name=instance-state-name,Values=running \
    --query 'Reservations[0].Instances[0].InstanceId' --output text)
  RDS=$(aws rds describe-db-instances --db-instance-identifier campusvibe-prod-db \
    --query 'DBInstances[0].Endpoint.Address' --output text)
  aws ssm start-session --target "$INSTANCE" \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters "host=$RDS,portNumber=5432,localPortNumber=5433"
  ```
- [ ] In a second terminal, as the master user (its name comes from
  `aws rds describe-db-instances --query 'DBInstances[0].MasterUsername'`):
  ```bash
  psql 'host=localhost port=5433 dbname=campusvibe user=<master-username> sslmode=require'
  ```

The tunnel reaches RDS from the instance, so the security group already allows
it. No cost.

## 4. Confirm pgvector exists before the first deploy — Check

**Why.** `V8__search_embeddings.sql:4` runs `CREATE EXTENSION IF NOT EXISTS
vector`. If the extension is not available on this engine version, the first
deploy fails in Flyway and nothing boots.

```sql
SELECT name, default_version, installed_version
FROM pg_available_extensions WHERE name = 'vector';
```

- [ ] One row, `installed_version` empty before the first deploy. No row: stop
  here — the deploy cannot succeed.

## 5. The connection string — set in the Elastic Beanstalk pass

```text
SPRING_DATASOURCE_URL=jdbc:postgresql://<rds-endpoint>:5432/campusvibe?sslmode=require
```

- [ ] Endpoint from `aws rds describe-db-instances --db-instance-identifier campusvibe-prod-db --query 'DBInstances[0].Endpoint.Address'`.
- [ ] Username is the master user for now: V8 needs `rds_superuser`, and Flyway
  runs on every start. The dedicated user comes later.
- [ ] Password is the one from §1.

**Why `sslmode=require`.** `rds.force_ssl` already refuses plaintext, and the
driver's default would negotiate TLS anyway, but `require` turns a downgrade
into a startup failure instead of something that quietly works.
`verify-full` is better and needs the RDS certificate bundle in the image — see
*Later*.

The values go in the property table in
[`connecting-elastic-beanstalk.md`](connecting-elastic-beanstalk.md#4-environment-properties--arpan--console).

## 6. Move the repository to PostgreSQL 18 — Code unit

**Why.** Decided 2026-09-12: RDS stays on 18.3, and every test moves to the
version production actually runs. This supersedes the 15.x decision in
[`aws-deployment.md`](aws-deployment.md). `pgvector/pgvector:pg18` exists.

- [ ] Replace `pgvector/pgvector:pg15` with `pgvector/pgvector:pg18` in all five places:
  - `docker/docker-compose.yml:9`
  - `.github/workflows/_database.yml:90`
  - `backend/src/test/java/com/campusvibe/PostgresTestContainer.java:52`
  - `backend/src/test/java/com/campusvibe/search/SearchIT.java:74`
  - `backend/src/test/java/com/campusvibe/search/SearchRateLimitIT.java:55`
- [ ] Recreate the local database volume — a major version cannot reuse the old
  data directory. `docker compose down -v` **deletes local development data**,
  so it is Arpan's to run; it also clears the local V12 checksum mismatch.
- [ ] `node scripts/verify.mjs --all --full` green.
- [ ] Record the supersession in `aws-deployment.md` at wrap-up.

Ideally before the first deploy, so the suite that approves a release runs on
the same major version the release meets.

## 7. After the first deploy — Check

The first Elastic Beanstalk deploy runs every migration. Through the §3 tunnel:

```sql
SELECT count(*) AS applied, max(version) AS latest, bool_and(success) AS all_ok
FROM flyway_schema_history;

SELECT extversion FROM pg_extension WHERE extname = 'vector';

SELECT count(*) FROM clubs;
```

- [ ] `all_ok` true, `latest` equal to the highest `V` in `backend/src/main/resources/db/migrations/`
- [ ] `vector` installed
- [ ] `clubs` is 0 — V32 retires the rows V6 inserts, and `DevDataSeeder` runs only under `dev`

---

## Later — not needed to connect

- [ ] **Dedicated application user** instead of the master — queued in
  [`todo.md`](../../TODO/todo.md); needs §3.
- [ ] **`sslmode=verify-full`** — add the RDS certificate bundle to
  `deploy/eb/Dockerfile` and point the driver at it.
- [ ] A custom parameter group, when a setting actually needs changing.
- [ ] One restore from an automated backup, to know it works.

## Appendix — how this was read

```bash
aws rds describe-db-instances --query 'DBInstances[].{Engine:EngineVersion,Class:DBInstanceClass,Public:PubliclyAccessible,Encrypted:StorageEncrypted,Backup:BackupRetentionPeriod,Protect:DeletionProtection,Secret:MasterUserSecret.SecretStatus}'
aws secretsmanager describe-secret --secret-id '<the rds!db-… name>' --query '{Rules:RotationRules,Next:NextRotationDate}'
aws rds describe-db-parameters --db-parameter-group-name default.postgres18 --query 'Parameters[?ParameterName==`rds.force_ssl`]'
aws ec2 describe-security-groups --filters Name=group-name,Values=campusvibe-database-sg
aws ssm describe-instance-information
```
