# Connecting SES

**Code as of:** 806a1d0 · **Account read:** 2026-09-12, read-only
**Order:** 4 of 4 to wire up — but **start §1 and §5 on day one**: DNS verification and the production-access review are the slow parts.
**Decision:** send over SMTP with SES SMTP credentials — [ADR-013](../decisions/ADR-013-ses-mail-over-smtp-credentials.md) (Proposed)
**Related:** the SES item in [`todo.md`](../../TODO/todo.md) · [ADR-006](../decisions/ADR-006-official-email-verified-only-by-round-trip.md), whose round trip waits on this

**Legend.** **Arpan · console** — an AWS or DNS change, *ask first* under
[`rules/aws-handling.md`](../../rules/aws-handling.md) · **Code unit** — a repo
change, started with `/start` · **Check** — read-only.

Every command assumes `export AWS_PROFILE=campusvibe-admin AWS_REGION=ca-central-1`.

---

## Where it stands

| | 2026-09-12 | |
|---|---|---|
| Account | **Sandbox**: 200 messages a day, 1 a second, delivery to verified addresses only | ⚠ §5 |
| Identities | **None** | ⚠ §1 |
| DNS | `campusvibe-mcgill.com` is on **Namecheap**. The root MX and SPF belong to Namecheap Private Email, and **`mail.` is already taken by it** | Leave all three alone |
| DMARC | No `_dmarc` record | §3 |
| Application | `spring.mail.host` unset, so `LoggingMailSender` writes messages to the log instead of sending | §8 |

## Already done

- [x] SMTP delivery with authentication and STARTTLS is already supported — `MailConfig` switches to `SmtpMailSender` when `spring.mail.host` is set (`application.yml`, `spring.mail.properties`)
- [x] The mail health indicator is off, so an SES outage cannot fail `/actuator/health` and pull the instance out of the load balancer

---

## 0. Code gates before production mail — Code unit

Already queued in [`todo.md`](../../TODO/todo.md); listed here because the order matters.

- [ ] **Rate-limit `/api/v1/auth/forgot-password`.** It is public and sends one
  message per call. **Do not set `SPRING_MAIL_HOST` in production until this has
  shipped** — otherwise anyone can spend the sending quota, and the domain's
  reputation, on addresses of their choosing.
- [ ] Send mail after the transaction commits, not inside it.
- [ ] Make a failed send visible beyond one log line — during the sandbox every
  send to an unverified address fails that way.

## 1. Domain identity and DKIM — Arpan · console and Namecheap

- [ ] **SES (ca-central-1) → Configuration → Identities → Create identity →
  Domain → `campusvibe-mcgill.com` → Easy DKIM, RSA_2048_BIT → Create identity.**
  SES shows three CNAME records.
- [ ] **Namecheap → Domain List → campusvibe-mcgill.com → Advanced DNS → Add New
  Record → CNAME**, three times. Host is the name SES shows *without*
  `.campusvibe-mcgill.com` — for example `abcd1234._domainkey`. Value is
  `abcd1234.dkim.amazonses.com`.
- [ ] Do not touch the root MX or SPF records; they carry Private Email.

**Verify** — minutes to a few hours:
```bash
aws sesv2 get-email-identity --email-identity campusvibe-mcgill.com \
  --query '{Sending:VerifiedForSendingStatus,Dkim:DkimAttributes.Status}'   # true, SUCCESS
```

## 2. Custom MAIL FROM on `bounce.` — Arpan · console and Namecheap

Recommended, not required. It makes SPF align with your own domain instead of
`amazonses.com`. **Use `bounce.`, not `mail.`** — `mail.campusvibe-mcgill.com`
already resolves to Private Email.

- [ ] **SES → Identities → `campusvibe-mcgill.com` → Custom MAIL FROM domain →
  Edit → `bounce`**, behaviour on MX failure **Use default MAIL FROM domain** →
  Save.
- [ ] **Namecheap → Advanced DNS:**
  - MX record, Host `bounce`, Value `feedback-smtp.ca-central-1.amazonses.com`, priority 10
  - TXT record, Host `bounce`, Value `v=spf1 include:amazonses.com ~all`

**If Namecheap will not accept the MX row** — while the domain's Mail Settings
is set to Private Email the dashboard may restrict custom MX records — skip this
step. Mail still sends; SPF then aligns to `amazonses.com`, and DMARC passes on
DKIM alignment alone.

## 3. DMARC — Arpan · Namecheap

- [ ] TXT record, Host `_dmarc`, Value
  `v=DMARC1; p=none; rua=mailto:<a mailbox you actually read>`

Start at `p=none`: it only reports, so it cannot block Private Email mail while
you learn what the reports say. Tighten to `quarantine` once they are clean.

## 4. A test recipient for the sandbox — Arpan · console

- [ ] **SES → Identities → Create identity → Email address** → your own address
  → open the verification link. Until §5 is approved, SES delivers only to
  verified addresses.

## 5. Request production access — Arpan · console · start early

- [ ] **SES → Account dashboard → Request production access**: mail type
  **Transactional**; website `https://www.campusvibe-mcgill.com`; use case, in
  your own words — account verification and password-reset mail for a student
  event platform, sent only to addresses users registered with, with bounces and
  complaints suppressed at the account level.
- [ ] Expect about a day, and possibly a follow-up question.

**Verify:**
```bash
aws sesv2 get-account --query ProductionAccessEnabled      # true
```

## 6. Bounces and complaints — Check

- [ ] Account-level suppression covers both bounces and complaints:
  ```bash
  aws sesv2 get-account --query SuppressionAttributes.SuppressedReasons   # BOUNCE, COMPLAINT
  ```
  If either is missing: **SES → Configuration → Suppression list → Edit**. SES
  pauses an account whose bounce or complaint rate climbs, and reset mail to
  mistyped addresses bounces.

## 7. SMTP credentials — Arpan · console only

**Why only Arpan.** SES SMTP credentials are an IAM user access key.
[ADR-013](../decisions/ADR-013-ses-mail-over-smtp-credentials.md) makes this one
narrow exception to the no-access-keys rule, and a session never creates them —
the guard hook refuses `iam create-access-key` anyway.

- [ ] **SES → SMTP settings → Create SMTP credentials** → keep the suggested
  user name → **Create user** → download the credentials once. They cannot be
  shown again.
- [ ] Narrow the user. **IAM → Users → that user → Permissions** → remove
  `AmazonSesSendingAccess` → **Add permissions → Create inline policy → JSON**:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": "ses:SendRawEmail",
        "Resource": "arn:aws:ses:ca-central-1:<account-id>:identity/campusvibe-mcgill.com"
      }
    ]
  }
  ```
  If a sandbox test send fails with an access-denied error, add the verified
  test address's identity ARN to `Resource` until production access lands.
- [ ] Store the credentials in a password manager and in two Elastic Beanstalk
  properties. Nowhere else — not a file, not a chat, not `.claude/`.

**Rotation:** create new SMTP credentials, update the two properties, then
delete the old access key from the IAM user.

## 8. Properties — Arpan · console

Only after §0's rate limit has shipped and §1 is verified.

| Property | Value | Notes |
|---|---|---|
| `SPRING_MAIL_HOST` | `email-smtp.ca-central-1.amazonaws.com` | Setting it is what switches the app from logging mail to sending it |
| `SPRING_MAIL_PORT` | `587` | STARTTLS, already enabled in `application.yml` |
| `SPRING_MAIL_USERNAME` | the SMTP user name | From §7 |
| `SPRING_MAIL_PASSWORD` | **secret** — the SMTP password | From §7 |
| `MAIL_FROM` | `no-reply@campusvibe-mcgill.com` | Must be at the verified domain; the default `campusvibe.local` sends nothing |
| `APP_BASE_URL` | `https://www.campusvibe-mcgill.com` | Set in the Elastic Beanstalk pass; links in mail point here |

## 9. Verify — Check

- [ ] The container log shows `Mail: SMTP delivery enabled, from no-reply@campusvibe-mcgill.com`
- [ ] Forgot password for the verified test address → the message arrives, and its link opens `APP_BASE_URL`
- [ ] Its headers show DKIM `pass`, DMARC `pass`, and SPF `pass` if §2 was done
- [ ] The send is counted:
  ```bash
  aws sesv2 get-account --query SendQuota.SentLast24Hours
  ```
- [ ] `/actuator/health` still reports `UP`

---

## Later — not needed to connect

- [ ] Bounce and complaint notifications to SNS, when someone will read them
- [ ] Decide on `AUTH_REQUIRE_VERIFIED_EMAIL` — only after production access, or new users are locked out
- [ ] The club official-email verification round trip — [ADR-006](../decisions/ADR-006-official-email-verified-only-by-round-trip.md)'s trigger is SES landing
- [ ] Reconsider the SES API through the instance role — ADR-013's revisit triggers

## Appendix — how this was read

```bash
aws sesv2 get-account
aws sesv2 list-email-identities
aws sesv2 list-configuration-sets
nslookup -type=NS campusvibe-mcgill.com
nslookup -type=MX campusvibe-mcgill.com
nslookup -type=TXT campusvibe-mcgill.com
nslookup -type=TXT _dmarc.campusvibe-mcgill.com
nslookup mail.campusvibe-mcgill.com
```
