# Pause and resume production — checklist

**Checked against the account:** 2026-11-17 (Auto Scaling group, re-stop schedule,
port 80 rule and CloudFront origin all match).

The copy-paste version of [`pausing-production.md`](pausing-production.md). That
runbook is the source of truth: why each step exists, what it costs, and what to
do when something fails. If the two disagree, the runbook wins; fix this file.

Run every command in Git Bash from the repo root, as Arpan. A Claude session
cannot run the write commands (`scripts/hooks/guard-aws.mjs` refuses them), so
type them in the prompt with a leading `!`.

Paused costs ~$6 a month, running ~$35 (`pausing-production.md:29-36`).

## 0. Sign in

```bash
aws sso login --profile campusvibe-admin
export AWS_PROFILE=campusvibe-admin
aws sts get-caller-identity          # want account 172644092604
```

- [ ] `sts` prints account `172644092604`. Never use the `default` profile.

## Pause

- [ ] **Nothing is deploying.** Want `Ready`; wait if it says `Updating`.

  ```bash
  aws elasticbeanstalk describe-environments --region ca-central-1 \
    --environment-names CampusVibe-Backend-Prod \
    --query "Environments[0].[Status,Health]" --output text
  ```

- [ ] **1. Backend instance to zero.** Change the group directly, never through
  Elastic Beanstalk settings: an environment update can reopen port 80 to the
  world (`pausing-production.md:100-103`).

  ```bash
  aws autoscaling update-auto-scaling-group --region ca-central-1 \
    --auto-scaling-group-name awseb-e-ep7prttpws-stack-AWSEBAutoScalingGroup-ammKwECv66cf \
    --min-size 0 --max-size 0 --desired-capacity 0
  ```

- [ ] **2. Stop the database.** Data, password and backups stay.

  ```bash
  aws rds stop-db-instance --region ca-central-1 \
    --db-instance-identifier campusvibe-prod-db
  ```

- [ ] **3. Turn the daily re-stop schedule on.** AWS restarts a stopped database
  by itself after 7 days; this stops it again at 03:00 Toronto every day.

  ```bash
  aws scheduler update-schedule --region ca-central-1 \
    --name campusvibe-stop-rds-daily \
    --schedule-expression "cron(0 3 * * ? *)" \
    --schedule-expression-timezone America/Toronto \
    --flexible-time-window Mode=OFF \
    --target '{"Arn":"arn:aws:scheduler:::aws-sdk:rds:stopDBInstance","RoleArn":"arn:aws:iam::172644092604:role/CampusVibe-Scheduler-StopRDS","Input":"{\"DbInstanceIdentifier\":\"campusvibe-prod-db\"}","RetryPolicy":{"MaximumRetryAttempts":0}}' \
    --state ENABLED
  ```

- [ ] **Leave alone:** the Elastic IP `3.97.216.208`, the environment, CloudFront
  `E2T616L10NJZG8`. Nothing gets deleted or released.

**Expected while paused:** the environment shows Grey, and the API hangs about
30 s and then returns a CloudFront 504. The Vercel frontend loads but its backend
calls fail. **Do not deploy while paused**: a deploy has no instance to land on.

## Resume

Order matters: **schedule off → database → instance.** The backend runs Flyway
on startup and fails if the database is not up yet.

- [ ] **1. Turn the re-stop schedule off first**, or it stops the live database
  at the next 03:00. Same command as pause step 3, with the last line changed:

  ```bash
  aws scheduler update-schedule --region ca-central-1 \
    --name campusvibe-stop-rds-daily \
    --schedule-expression "cron(0 3 * * ? *)" \
    --schedule-expression-timezone America/Toronto \
    --flexible-time-window Mode=OFF \
    --target '{"Arn":"arn:aws:scheduler:::aws-sdk:rds:stopDBInstance","RoleArn":"arn:aws:iam::172644092604:role/CampusVibe-Scheduler-StopRDS","Input":"{\"DbInstanceIdentifier\":\"campusvibe-prod-db\"}","RetryPolicy":{"MaximumRetryAttempts":0}}' \
    --state DISABLED
  ```

- [ ] **2. Start the database and wait until it is ready** (a few minutes). If the
  start command says the database is already running, it woke up by itself;
  go straight to the wait.

  ```bash
  aws rds start-db-instance --region ca-central-1 \
    --db-instance-identifier campusvibe-prod-db
  aws rds wait db-instance-available --region ca-central-1 \
    --db-instance-identifier campusvibe-prod-db
  ```

- [ ] **3. Backend instance back to one.** It takes about 2 to 10 minutes to boot
  and start the container.

  ```bash
  aws autoscaling update-auto-scaling-group --region ca-central-1 \
    --auto-scaling-group-name awseb-e-ep7prttpws-stack-AWSEBAutoScalingGroup-ammKwECv66cf \
    --min-size 1 --max-size 1 --desired-capacity 1
  ```

## Check it came back

- [ ] Environment is `Ready` and `Green`:

  ```bash
  aws elasticbeanstalk describe-environments --region ca-central-1 \
    --environment-names CampusVibe-Backend-Prod \
    --query "Environments[0].[Status,Health]" --output text
  ```

- [ ] The new instance holds the Elastic IP `3.97.216.208`:

  ```bash
  aws ec2 describe-addresses --region ca-central-1 \
    --query "Addresses[].[PublicIp,InstanceId]" --output text
  ```

- [ ] Port 80 still lets in **only** CloudFront: you want `pl-38a64351` and no
  `0.0.0.0/0`.

  ```bash
  aws ec2 describe-security-groups --region ca-central-1 \
    --group-ids sg-0e9453ad8fbde508e --query "SecurityGroups[0].IpPermissions"
  ```

- [ ] The re-stop schedule reads `DISABLED`:

  ```bash
  aws scheduler get-schedule --region ca-central-1 \
    --name campusvibe-stop-rds-daily --query State --output text
  ```

- [ ] End to end through CloudFront — want `{"status":"UP"}`:

  ```bash
  curl -s https://api.campusvibe-mcgill.com/actuator/health
  ```

If any check fails (a 502 or 504, a container that exits on start, a browser that
says Failed to fetch while `curl` works), go to
[`pausing-production.md` → If it does not come back](pausing-production.md#if-it-does-not-come-back).

## If a name stops matching

The Auto Scaling group name is generated by Elastic Beanstalk and changes if the
environment is ever rebuilt. Look it up again, then update both files:

```bash
aws autoscaling describe-auto-scaling-groups --region ca-central-1 \
  --query "AutoScalingGroups[].AutoScalingGroupName" --output text
```

## Change log

- 2026-11-17 — Created as the short companion to the runbook; names checked
  against the live account the same day.
