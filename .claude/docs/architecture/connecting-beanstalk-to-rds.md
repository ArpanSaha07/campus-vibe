No — **do not create a separate EC2 instance manually just for this.**

Your Elastic Beanstalk environment already manages EC2 compute instances for your application. The RDS **“Set up EC2 connection”** button is a generic RDS convenience feature; if it isn't detecting your Beanstalk instance, AWS offers to create a new EC2 instance. That's not what we want. ([AWS Documentation][1])

For CampusVibe, we'll connect **RDS → Elastic Beanstalk using security groups manually**, which AWS explicitly supports. ([AWS Documentation][2])

### 1. Find your Elastic Beanstalk EC2 security group

Go to:

**AWS Console → Elastic Beanstalk → Environments → your production environment**

Then go to:

**Configuration → Instance traffic and scaling**

Look for the EC2 security group associated with the environment. It will have an ID similar to:

```text
sg-0abc123456789def
```

Elastic Beanstalk automatically assigns a security group to the EC2 instances it launches. ([AWS Documentation][3])

Alternatively, you can find it very reliably through:

**EC2 → Instances → select the instance belonging to your Elastic Beanstalk environment → Security → Security groups**

Copy the `sg-...` ID.

### 2. Find the security group attached to RDS

Now go to:

**RDS → Databases → CampusVibe PostgreSQL → Connectivity & security**

Scroll to the **Security** section.

You should see something like:

```text
VPC security groups

campusvibe-rds-sg (sg-xxxxxxxx)
Active
```

**Click the security-group name/ID itself.**

This takes you out of RDS and into:

**EC2 → Security Groups → [your RDS security group]**

That's why you weren't seeing an **Edit inbound rules** button directly on the RDS page.

### 3. Add the PostgreSQL rule

On the RDS security group's page:

**Inbound rules → Edit inbound rules → Add rule**

Configure:

```text
Type:        PostgreSQL
Protocol:    TCP
Port:        5432
Source:      Custom
Source value: <Elastic Beanstalk EC2 security group>
```

For example:

```text
PostgreSQL | TCP | 5432 | sg-0123456789abcdef
```

For **Source**, don't enter an IP address. Start typing/pasting the Beanstalk `sg-...` security-group ID and select it from the dropdown.

Then click:

**Save rules**

AWS specifically recommends this pattern: the RDS security group allows inbound database traffic from the application's EC2 security group. ([AWS Documentation][4])

### What we're creating

Your architecture becomes:

```text
Internet
   │
   ▼
Elastic Beanstalk
   │
   │ EC2 security group
   │
   │ PostgreSQL :5432
   ▼
RDS security group
   │
   ▼
Private PostgreSQL RDS
```

The important security rule is:

```text
RDS inbound
    PostgreSQL / TCP / 5432
              ↑
    Source = Beanstalk EC2 SG
```

**Not:**

```text
0.0.0.0/0       ❌
Your public IP  ❌
```

This means only resources carrying the Beanstalk application's security group can initiate PostgreSQL connections to RDS. AWS documents this as the normal way to connect an Elastic Beanstalk environment to an external RDS database. ([AWS Documentation][2])

### One thing to verify first

Before saving the rule, check that **Elastic Beanstalk and RDS are in the same VPC**. For your setup, that's the cleanest architecture and avoids additional VPC routing complexity. ([AWS Documentation][5])

So **cancel the “Create EC2 instance” flow** you currently have open. You don't need another EC2 instance.

[AWS: Using Elastic Beanstalk with Amazon RDS](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/AWSHowTo.RDS.html?utm_source=chatgpt.com)

Once you've found the **Elastic Beanstalk EC2 security group**, you can tell me its **name** (not any passwords/secrets), and I can tell you exactly which security group to select for the RDS inbound rule.
