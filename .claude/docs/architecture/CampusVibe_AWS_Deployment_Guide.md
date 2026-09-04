# CampusVibe AWS Deployment Guide

## Purpose

This document is the implementation guide for deploying the CampusVibe production backend and infrastructure to AWS in a secure, cost-conscious manner.

The AWS account setup, MFA, root-account hardening, and billing/budget alerts are already complete.

Claude Code should follow this document sequentially and avoid introducing additional infrastructure unless explicitly requested.

---

## 1. Target Production Architecture

CampusVibe should use the following production architecture:

```text
Users
  |
  v
Vercel
Next.js frontend
  |
  | HTTPS
  v
AWS Elastic Beanstalk
Spring Boot Docker container
  |
  +----------------------+
  |                      |
  v                      v
AWS RDS PostgreSQL      AWS S3
Private database        Private file storage
```

### Production responsibilities

| Component | Production platform |
|---|---|
| Next.js frontend | Vercel |
| Spring Boot backend | AWS Elastic Beanstalk |
| Backend runtime | Docker |
| PostgreSQL | AWS RDS |
| File/image storage | AWS S3 |
| Secrets | AWS Secrets Manager / SSM Parameter Store |
| Application permissions | IAM roles |
| Logs/health | CloudWatch + Elastic Beanstalk health |
| DNS / HTTPS | Custom domain + AWS-managed HTTPS where applicable |

### Important architectural rule

Do **not** deploy the current local Docker Compose architecture unchanged.

Local development may continue using:

```text
frontend container
backend container
postgres container
```

Production must instead use:

```text
frontend -> Vercel
backend Docker -> Elastic Beanstalk
PostgreSQL -> RDS
files -> S3
```

The production PostgreSQL database must **not** run inside Docker.

---

# 2. Productionize Spring Boot Configuration

The backend must obtain infrastructure-specific configuration through environment variables.

Do not hard-code production URLs, credentials, AWS keys, API keys, or database passwords.

Recommended production configuration:

```yaml
spring:
  datasource:
    url: ${DB_URL}
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}

  jpa:
    hibernate:
      ddl-auto: validate

  flyway:
    enabled: true

server:
  port: ${PORT:8080}
```

Use a dedicated production Spring profile if one does not already exist:

```text
application-prod.yml
```

Launch production with:

```text
SPRING_PROFILES_ACTIVE=prod
```

## Required production environment variables

At minimum:

```text
SPRING_PROFILES_ACTIVE=prod

DB_URL=
DB_USERNAME=
DB_PASSWORD=

JWT_SECRET=
OPENAI_API_KEY=

AWS_REGION=ca-central-1
S3_BUCKET=
FRONTEND_URL=
```

Additional variables should follow the same pattern.

## Rules

- Never commit production secrets.
- Never put production credentials inside Docker images.
- Never hard-code the RDS endpoint into source code.
- Never commit a production `.env` file.
- `.env` may still be used for local development if ignored by Git.
- Prefer AWS Secrets Manager for sensitive production values.
- Non-sensitive configuration may use Elastic Beanstalk environment properties.

---

# 3. Production Dockerfile

The backend should use a multi-stage Docker build.

Recommended baseline:

```dockerfile
FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /app

COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
COPY src src

RUN chmod +x mvnw
RUN ./mvnw clean package -DskipTests


FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
```

Adjust the Java version only if the current project uses a different supported version.

## Before AWS deployment

The backend must successfully build locally:

```bash
docker build -t campusvibe-backend .
```

Then run it locally using environment variables.

Example:

```bash
docker run --rm \
  -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e DB_URL="..." \
  -e DB_USERNAME="..." \
  -e DB_PASSWORD="..." \
  campusvibe-backend
```

Do not proceed with AWS deployment if the production Docker image cannot start successfully.

---

# 4. Add a Backend Health Endpoint

Use Spring Boot Actuator.

Dependency:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

Expose:

```text
GET /actuator/health
```

Expected healthy response:

```text
HTTP 200
```

Do not expose unnecessary Actuator endpoints publicly.

The production health check should use `/actuator/health`.

---

# 5. Create AWS RDS PostgreSQL

Create the production database separately from Elastic Beanstalk.

Do **not** create RDS as a resource tied to the Elastic Beanstalk environment lifecycle.

Recommended initial configuration:

```text
Engine: PostgreSQL
Region: ca-central-1
Deployment: Single-AZ
Instance class: smallest appropriate burstable instance
Storage: General Purpose SSD
Storage autoscaling: enabled with conservative maximum
Public access: No
Encryption: enabled
Automated backups: enabled
Multi-AZ: disabled initially
```

Use a dedicated production database name:

```text
campusvibe
```

Use a dedicated database application user rather than PostgreSQL superuser access for normal application operation where practical.

---

# 6. RDS Network Security

RDS must not be publicly accessible.

Create two security groups:

```text
campusvibe-backend-sg
campusvibe-database-sg
```

The database security group should allow:

```text
Protocol: TCP
Port: 5432
Source: campusvibe-backend-sg
```

Never configure:

```text
5432 -> 0.0.0.0/0
```

The backend and RDS should be inside the same AWS VPC.

## Security requirement

The intended network path is:

```text
Internet
   |
   X
   |
RDS
```

RDS must only receive database traffic from resources explicitly authorized through the backend security group.

---

# 7. Configure Flyway for Production

Production schema management must use Flyway.

Use:

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: validate

  flyway:
    enabled: true
```

Do not use:

```text
ddl-auto=update
ddl-auto=create
ddl-auto=create-drop
```

in production.

## Production migration rule

Production Flyway migrations should contain:

- schema changes
- indexes
- constraints
- required stable reference data

Production migrations should not contain:

- mock users
- fake clubs
- fake events
- temporary test data
- plaintext credentials
- development-only bootstrap data

Mock data belongs in development/test seeders or development-only mechanisms.

---

# 8. Create the Production S3 Bucket

Create one private production media bucket.

Example:

```text
campusvibe-prod-media
```

Use:

```text
Region: ca-central-1
Block all public access: enabled
Encryption: enabled/default S3 encryption
Versioning: optional initially
```

Do not disable public access blocking simply to make images easier to display.

Suggested object organization:

```text
clubs/
  {clubId}/
    logo.webp

events/
  {eventId}/
    banner.webp

users/
  {userId}/
    profile.webp
```

Do not depend on object names alone for authorization.

---

# 9. Use IAM Roles Instead of AWS Access Keys

The Spring Boot application must access S3 using an IAM role assigned to the Elastic Beanstalk EC2 instances.

Do not add these to the application:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

The backend should allow the AWS SDK credential provider chain to retrieve temporary credentials from the instance role.

## Minimum S3 IAM permissions

Use least privilege.

Example baseline:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::campusvibe-prod-media/*"
    }
  ]
}
```

Add bucket-level permissions only when the application actually requires them.

Do not use:

```json
"Action": "s3:*"
```

unless explicitly justified.

Do not use:

```json
"Resource": "*"
```

for routine application access.

---

# 10. S3 Upload Strategy

Preferred production upload architecture:

```text
Browser
   |
   | request upload permission
   v
Spring Boot
   |
   | returns short-lived presigned URL
   v
Browser --------------------> S3
          direct upload
```

Use short-lived presigned URLs for uploads where practical.

The backend should:

1. authenticate the user,
2. authorize whether that user may upload,
3. validate intended file metadata,
4. generate a short-lived S3 presigned URL,
5. save resulting object metadata to PostgreSQL when appropriate.

## Upload restrictions

Validate at minimum:

- allowed MIME types
- allowed extensions
- maximum file size
- expected ownership/resource relationship

Prefer image processing and validation controls appropriate for user-generated media.

Do not trust client-provided MIME type alone.

---

# 11. Store Secrets Correctly

Sensitive production values should be stored in AWS Secrets Manager where practical.

Examples:

```text
/campusvibe/prod/database/password
/campusvibe/prod/jwt-secret
/campusvibe/prod/openai-api-key
```

Non-secret configuration can remain ordinary environment configuration:

```text
SPRING_PROFILES_ACTIVE=prod
AWS_REGION=ca-central-1
S3_BUCKET=campusvibe-prod-media
FRONTEND_URL=https://...
```

## Secret rules

Never:

- commit secrets,
- print secrets into logs,
- bake secrets into Docker layers,
- expose backend secrets through `NEXT_PUBLIC_*`,
- send database credentials to the frontend.

---

# 12. Create the Elastic Beanstalk Environment

Create:

```text
Application:
campusvibe-backend

Environment:
campusvibe-production
```

Platform:

```text
Docker running on Amazon Linux 2023
```

Initial environment type:

```text
Single instance
```

Do not add a load balancer initially unless required.

A single-instance environment is intentionally chosen to minimize cost during early deployment.

Do not introduce ECS, Fargate, Kubernetes, or EKS for the first release.

---

# 13. Elastic Beanstalk Networking

Elastic Beanstalk and RDS must use the same VPC.

The intended relationship:

```text
VPC
|
+-- Elastic Beanstalk EC2
|      SG: campusvibe-backend-sg
|
+-- RDS PostgreSQL
       SG: campusvibe-database-sg
       Allows TCP 5432 only from campusvibe-backend-sg
```

The backend must be able to connect to the private RDS endpoint.

---

# 14. Configure the RDS Connection

RDS provides an endpoint similar to:

```text
campusvibe-db.xxxxxxxxx.ca-central-1.rds.amazonaws.com
```

Configure the Spring Boot datasource using:

```text
DB_URL=jdbc:postgresql://<RDS_ENDPOINT>:5432/campusvibe
DB_USERNAME=<application-user>
DB_PASSWORD=<secret>
```

Use TLS/SSL for the production RDS connection.

Do not store this configuration in source control.

---

# 15. Manual Deployment Before CI/CD

Complete one successful manual deployment before automating AWS deployment through GitHub Actions.

Required sequence:

```text
local tests
   |
Docker build
   |
manual Elastic Beanstalk deployment
   |
Spring Boot starts
   |
Flyway runs
   |
RDS connection succeeds
   |
S3 connection succeeds
```

Do not introduce CI/CD changes before this path works.

This isolates infrastructure problems from CI problems.

---

# 16. Production Backend Verification

After deployment, verify the backend directly before connecting Vercel.

Test:

```text
GET /actuator/health
GET /api/events
GET /api/clubs
authentication/login
authenticated endpoint
database read
database write
Flyway migration state
S3 upload
S3 read/display
semantic search
OpenAI-powered feature
```

Confirm:

- application starts without migration errors,
- RDS tables exist,
- database writes persist,
- no mock data unexpectedly appears,
- secrets do not appear in logs,
- health endpoint returns HTTP 200,
- S3 uploads use the expected bucket,
- unauthorized uploads are denied.

---

# 17. Connect the Vercel Frontend

Keep Next.js deployed on Vercel.

Production frontend should receive an API URL through Vercel environment configuration.

Example:

```text
NEXT_PUBLIC_API_URL=https://api.<domain>
```

Do not commit production URLs unnecessarily where environment configuration is appropriate.

Configure Spring Security/CORS to permit only expected frontend origins.

Example production origins:

```text
https://www.<domain>
https://<production-vercel-domain>
```

Do not use unrestricted:

```text
Access-Control-Allow-Origin: *
```

for authenticated production APIs.

---

# 18. Domain and HTTPS

Target domain pattern:

```text
www.<domain> -> Vercel
api.<domain> -> AWS backend
```

Production browser-to-backend traffic must use HTTPS.

Do not operate the production application permanently using HTTP-only Elastic Beanstalk URLs.

Keep TLS certificate renewal managed where possible rather than manually rotating certificates.

---

# 19. Logging and Monitoring

Enable sufficient monitoring without creating unnecessary cost.

Recommended initial setup:

```text
Elastic Beanstalk Enhanced Health: enabled
CloudWatch logs: enabled
Log retention: approximately 7-14 days initially
RDS automated backups: enabled
AWS budget alerts: already configured
```

Application logs must not contain:

- passwords
- JWT secrets
- OpenAI API keys
- AWS credentials
- authorization headers
- sensitive user data unnecessarily

Use structured application logging where practical.

---

# 20. Cost-Control Rules

For the initial production release:

Use:

```text
1 Elastic Beanstalk EC2 instance
Single-AZ RDS
small burstable instance classes
S3 pay-per-use storage
short CloudWatch retention
Vercel frontend
```

Avoid initially:

```text
Multi-AZ RDS
multiple backend EC2 instances
Application Load Balancer unless required
NAT Gateway unless architecture requires it
ElastiCache / Redis
ECS / Fargate
EKS / Kubernetes
OpenSearch
unnecessary CloudWatch log retention
oversized EC2/RDS instances
```

Scale only after measurements show the need.

---

# 21. CI/CD — Only After Manual Production Deployment Works

Once manual AWS deployment has been verified, extend GitHub Actions.

Target workflow:

```text
Pull Request
   |
   +-- frontend tests
   |
   +-- backend tests
   |
   +-- Docker build validation

Merge to main
   |
   +-----------------------------+
   |                             |
   v                             v
Vercel                       AWS backend
frontend                     deployment
                                  |
                                  v
                          Elastic Beanstalk
                                  |
                           +------+------+
                           |             |
                           v             v
                          RDS           S3
```

Later, ECR may be introduced so production deploys immutable, versioned backend images.

---

# 22. GitHub-to-AWS Authentication

When deployment automation is added, use GitHub Actions OIDC with an AWS IAM role.

Do not store long-lived deployment credentials in GitHub when OIDC is available.

Avoid:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

as long-lived repository secrets.

Use:

```text
GitHub OIDC
     |
     v
AWS IAM deployment role
     |
temporary credentials
```

The deployment role must use least privilege.

---

# 23. Deployment Order

Claude Code should follow this order.

## Phase 1 — Backend production readiness

- [ ] Review current Spring Boot configuration.
- [ ] Create/verify `application-prod.yml`.
- [ ] Replace hard-coded production configuration with environment variables.
- [ ] Verify Flyway production configuration.
- [ ] Ensure mock-data initialization cannot run in production.
- [ ] Add/verify Spring Boot Actuator health endpoint.
- [ ] Review the backend Dockerfile.
- [ ] Build the Docker image locally.
- [ ] Run the backend container successfully locally.

## Phase 2 — RDS

AWS Console/manual infrastructure work:

- [ ] Create private PostgreSQL RDS instance.
- [ ] Enable encryption.
- [ ] Enable automated backups.
- [ ] Use Single-AZ initially.
- [ ] Disable public access.
- [ ] Create/verify database security group.
- [ ] Allow port 5432 only from the backend security group.
- [ ] Record the RDS endpoint.
- [ ] Configure production DB environment variables.
- [ ] Verify Flyway against production RDS.

## Phase 3 — S3

- [ ] Create private production S3 bucket.
- [ ] Keep Block Public Access enabled.
- [ ] Create least-privilege IAM policy.
- [ ] Attach policy through the Elastic Beanstalk EC2 IAM role.
- [ ] Update backend S3 integration to use the default AWS credential provider chain.
- [ ] Remove any dependence on static AWS access keys.
- [ ] Implement/verify presigned uploads.
- [ ] Validate upload authorization and file constraints.

## Phase 4 — Elastic Beanstalk

- [ ] Create `campusvibe-backend` application.
- [ ] Create `campusvibe-production` environment.
- [ ] Choose Docker on Amazon Linux 2023.
- [ ] Use Single Instance initially.
- [ ] Configure the correct VPC.
- [ ] Configure backend security group.
- [ ] Add non-secret production environment variables.
- [ ] Configure secret references.
- [ ] Deploy backend manually.
- [ ] Verify `/actuator/health`.
- [ ] Verify DB connectivity.
- [ ] Verify S3 connectivity.
- [ ] Review CloudWatch logs.

## Phase 5 — Frontend integration

- [ ] Configure production API URL in Vercel.
- [ ] Configure Spring CORS for production frontend origins.
- [ ] Verify authentication from Vercel to AWS backend.
- [ ] Verify all critical frontend/backend flows.
- [ ] Configure custom API domain.
- [ ] Enforce HTTPS.

## Phase 6 — CI/CD

Only after all previous phases work:

- [ ] Add AWS deployment job to GitHub Actions.
- [ ] Configure GitHub OIDC.
- [ ] Create least-privilege AWS deployment role.
- [ ] Avoid long-lived AWS credentials.
- [ ] Consider ECR for immutable Docker images.
- [ ] Deploy only after backend tests and image build succeed.

---

# 24. Production Security Checklist

Before public launch:

- [ ] AWS root MFA enabled.
- [ ] No root access keys exist.
- [ ] Billing alerts configured.
- [ ] RDS is not public.
- [ ] RDS port 5432 is not open to the internet.
- [ ] RDS encryption enabled.
- [ ] RDS backups enabled.
- [ ] S3 Block Public Access enabled.
- [ ] S3 access uses IAM roles.
- [ ] Backend has no static AWS access keys.
- [ ] Database password is not committed.
- [ ] JWT secret is not committed.
- [ ] OpenAI API key is not committed.
- [ ] Secrets are not embedded in Docker images.
- [ ] Production logs contain no secrets.
- [ ] HTTPS used for frontend/backend communication.
- [ ] CORS is restricted to approved frontend origins.
- [ ] Actuator does not expose sensitive management endpoints.
- [ ] Flyway is used for production schema evolution.
- [ ] Hibernate does not automatically modify production schema.
- [ ] Mock data cannot execute in production.
- [ ] File uploads enforce authentication/authorization.
- [ ] IAM policies follow least privilege.
- [ ] GitHub deployment eventually uses OIDC.

---

# 25. Things Claude Code Must Not Introduce Without Approval

Do not introduce any of the following unless explicitly requested:

```text
Kubernetes
AWS EKS
AWS ECS
AWS Fargate
Terraform
Pulumi
CloudFormation
Redis
ElastiCache
OpenSearch
Kafka
multiple backend services
microservices
NAT Gateway
Multi-AZ RDS
multiple EC2 instances
Application Load Balancer
```

These technologies may become appropriate later, but they should not be added merely because the application is moving to AWS.

---

# 26. Implementation Principles

1. Keep the architecture simple.
2. Complete one deployment phase at a time.
3. Prefer AWS managed services for stateful infrastructure.
4. Keep application containers stateless.
5. Never store important production data inside an EC2/container filesystem.
6. Keep PostgreSQL in RDS.
7. Keep uploaded media in S3.
8. Keep secrets outside source control and Docker images.
9. Use IAM roles instead of permanent AWS credentials.
10. Follow least privilege.
11. Keep RDS private.
12. Keep S3 private by default.
13. Validate each infrastructure dependency independently.
14. Complete one successful manual deployment before automating it.
15. Optimize for reliability and clarity before scalability.
16. Scale only in response to measured demand.
17. Preserve the existing Vercel frontend deployment unless there is a concrete reason to move it.

---

# 27. Definition of Done

The initial AWS production deployment is complete when:

```text
Vercel Next.js frontend
        |
        | HTTPS
        v
AWS Elastic Beanstalk
Spring Boot Docker
        |
        +---------------------+
        |                     |
        v                     v
Private RDS PostgreSQL      Private S3
```

and all of the following are true:

- the backend Docker container starts successfully,
- `/actuator/health` reports healthy,
- Flyway successfully validates/migrates RDS,
- production data persists in RDS,
- mock data does not execute,
- file uploads work through S3,
- S3 is not publicly exposed,
- the backend uses IAM roles rather than static AWS credentials,
- sensitive values are managed outside the repository,
- the Vercel frontend communicates with the backend over HTTPS,
- CORS only permits approved origins,
- RDS is inaccessible directly from the public internet,
- production logs are available,
- application secrets do not appear in logs,
- basic cost monitoring remains enabled,
- no unnecessary AWS infrastructure has been introduced.

After this state is stable, CI/CD automation and infrastructure improvements may be implemented incrementally.
