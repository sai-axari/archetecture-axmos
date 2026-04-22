# Axari — AWS Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              AWS Account (us-west-2)                                │
│                                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                         VPC: 10.0.0.0/16                                     │   │
│  │                                                                              │   │
│  │   ┌─── Public Subnets (10.0.1-3.0/24) ────────────────────────────────┐     │   │
│  │   │                                                                    │     │   │
│  │   │   ┌──────────┐    ┌──────────┐    ┌──────────┐                    │     │   │
│  │   │   │ NAT GW   │    │ ALB      │    │ ALB      │                    │     │   │
│  │   │   │ (shared) │    │ (prod)   │    │ (pr-42)  │   ... per PR       │     │   │
│  │   │   └──────────┘    └─────┬────┘    └─────┬────┘                    │     │   │
│  │   │                         │               │                          │     │   │
│  │   └─────────────────────────┼───────────────┼──────────────────────────┘     │   │
│  │                             │               │                                │   │
│  │   ┌─── Private Subnets (10.0.11-13.0/24) ──┼──────────────────────────┐     │   │
│  │   │                         │               │                          │     │   │
│  │   │   ┌─────────────────────┴───────────────┴───────────────────────┐  │     │   │
│  │   │   │              EKS Cluster (axari-cluster)        │  │     │   │
│  │   │   │                                                             │  │     │   │
│  │   │   │  ┌─ NS: coa-production ──────────────────────────────────┐  │  │     │   │
│  │   │   │  │  API (2) ── Agent/Dispatcher (1) ── UI (2) ── NATS   │  │  │     │   │
│  │   │   │  │                                         │             │  │  │     │   │
│  │   │   │  │                                    NLB (4222)         │  │  │     │   │
│  │   │   │  │                                    → Modal access     │  │  │     │   │
│  │   │   │  └───────────────────────────────────────────────────────┘  │  │     │   │
│  │   │   │                                                             │  │     │   │
│  │   │   │  ┌─ NS: coa-pr-42 ──────────────────────────────────────┐  │  │     │   │
│  │   │   │  │  API (1) ── Agent/Local (1) ── UI (1) ── NATS       │  │  │     │   │
│  │   │   │  └───────────────────────────────────────────────────────┘  │  │     │   │
│  │   │   │                                                             │  │     │   │
│  │   │   │  Managed Node Group: 2-6x t3.large                         │  │     │   │
│  │   │   │  Add-ons: CoreDNS, vpc-cni, kube-proxy, ebs-csi            │  │     │   │
│  │   │   │  AWS LB Controller (Helm)                                   │  │     │   │
│  │   │   └─────────────────────────────────────────────────────────────┘  │     │   │
│  │   │                                                                    │     │   │
│  │   └────────────────────────────────────────────────────────────────────┘     │   │
│  │                                                                              │   │
│  │   ┌─── Database Subnets (10.0.21-23.0/24) ────────────────────────────┐     │   │
│  │   │                                                                    │     │   │
│  │   │   ┌─────────────────────────────────────────────────────────────┐  │     │   │
│  │   │   │  RDS PostgreSQL 16 (db.t4g.medium, Multi-AZ)               │  │     │   │
│  │   │   │                                                             │  │     │   │
│  │   │   │  DB: axari     ← production                      │  │     │   │
│  │   │   │  DB: coa_pr_42           ← per PR (created by Jenkins)     │  │     │   │
│  │   │   │  DB: coa_pr_55           ← per PR                          │  │     │   │
│  │   │   │                                                             │  │     │   │
│  │   │   │  SG: Allow 5432 from EKS nodes + Modal IPs                 │  │     │   │
│  │   │   └─────────────────────────────────────────────────────────────┘  │     │   │
│  │   │                                                                    │     │   │
│  │   └────────────────────────────────────────────────────────────────────┘     │   │
│  │                                                                              │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  ┌─────────────┐   ┌─────────────────────┐   ┌──────────────────────────────────┐  │
│  │ ECR         │   │ Secrets Manager      │   │ S3: coa-terraform-state-yskew   │  │
│  │  coa/api    │   │  rds-master-password │   │  aws-infra/terraform.tfstate    │  │
│  │  coa/ui     │   │                      │   │                                  │  │
│  └─────────────┘   └─────────────────────┘   └──────────────────────────────────┘  │
│                                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │  Jenkins EC2                                                                 │   │
│  │  Jenkinsfile       → builds, pushes, deploys (PRs + main)                   │   │
│  │  Jenkinsfile.infra → terraform plan/apply/destroy (one-time)                │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

                              External
              ┌──────────────────────────────────────┐
              │  Modal (serverless)                   │
              │  Runs Claude Agent SDK sandboxes      │
              │  Connects back to:                    │
              │    → NLB:4222 (NATS)                  │
              │    → RDS:5432 (PostgreSQL)            │
              └──────────────────────────────────────┘
```

---

## Resource Sharing Model

Understanding what is shared vs. isolated is critical to how this architecture works and what it costs.

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHARED ACROSS ALL ENVIRONMENTS               │
│                                                                 │
│  VPC + Subnets           One VPC, all envs share it             │
│  EKS Cluster             One cluster, envs are namespaces       │
│  EKS Node Group          Same EC2 pool runs all pods            │
│  RDS Instance            One Postgres instance, separate DBs    │
│  ECR Repositories        Same repos, different image tags       │
│  NAT Gateway             Single NAT for all outbound traffic    │
│  Secrets Manager         Shared RDS password secret             │
│  S3 (Terraform state)    Single state file for all infra        │
│  Jenkins EC2             Single CI/CD server                    │
│  AWS LB Controller       One controller manages all ALBs/NLBs  │
│  CoreDNS / vpc-cni       Cluster-wide add-ons                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    UNIQUE PER ENVIRONMENT                       │
│                    (production OR each PR)                      │
│                                                                 │
│  Kubernetes Namespace    coa-production / coa-pr-{N}            │
│  ALB (Ingress)           Each env gets its own ALB + URL        │
│  NATS Instance           Each env runs its own NATS pod         │
│  PostgreSQL Database     axari / coa_pr_{N}           │
│  API Deployment          Own pods, own config, own secrets      │
│  Agent Deployment        Own pods (Modal in prod, local in PR)  │
│  UI Deployment           Own pods (baked with env-specific URL) │
│  ConfigMap               CORS_ORIGINS, NATS_URL, OAuth URIs    │
│  Kubernetes Secret       DATABASE_URL points to env's database  │
│  Docker Image Tags       pr-50-3 vs main-7 (same repo)         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION ONLY                              │
│                                                                 │
│  NLB (NATS external)     Public NATS access for Modal           │
│  Modal integration       USE_MODAL_AGENT=true                   │
│  Multiple replicas       API=2, UI=2 (HA)                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    PR PREVIEW ONLY                              │
│                                                                 │
│  DB init pod             kubectl run to CREATE DATABASE         │
│  Local agent mode        USE_MODAL_AGENT=false (inline SDK)    │
│  Single replicas         API=1, UI=1, Agent=1 (cost saving)    │
│  Ephemeral lifecycle     Created on PR open, destroyed on close │
└─────────────────────────────────────────────────────────────────┘
```

**Why this matters:**
- Opening a PR costs ~$16/month (one ALB) + marginal compute. No new RDS instances, no new clusters, no new VPCs.
- Closing a PR reclaims everything unique (namespace, ALB, database, pods). Shared resources are unaffected.
- Production and PR environments are fully isolated at the application layer (separate databases, separate NATS, separate pods) but share infrastructure costs.

---

## How a Deployment Works End-to-End

### PR Preview Deployment (what happens when you push to a PR branch)

```
Developer pushes code to PR branch
         │
         ▼
GitHub webhook → Jenkins Multibranch Pipeline detects PR
         │
         ▼
┌─ Stage: Context ─────────────────────────────────────────────┐
│  • Detect PR number (e.g., 50)                               │
│  • Set NAMESPACE=coa-pr-50, IMAGE_TAG=pr-50-3                │
│  • Set DB_NAME=coa_pr_50                                     │
│  • Fetch RDS password from AWS Secrets Manager                │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Stage: Build (parallel) ────────────────────────────────────┐
│  API Image:                                                   │
│  • docker build . → Python 3.12 + UV + app code              │
│  • Tagged: 893918474881.dkr.ecr...amazonaws.com/              │
│            axari/api:pr-50-3                      │
│                                                               │
│  UI Image (pass 1 — placeholder URL):                        │
│  • docker build ./ui                                          │
│    --build-arg NEXT_PUBLIC_API_URL=http://placeholder          │
│    --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...  │
│  • Tagged: .../axari/ui:pr-50-3                   │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Stage: Push ────────────────────────────────────────────────┐
│  • aws ecr get-login-password → docker login                  │
│  • docker push api:pr-50-3                                    │
│  • docker push ui:pr-50-3                                     │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Stage: Deploy ──────────────────────────────────────────────┐
│  1. kubectl create namespace coa-pr-50                        │
│                                                               │
│  2. Run db-init pod inside EKS:                               │
│     • Spins up postgres:16-alpine in coa-pr-50 namespace     │
│     • Connects to RDS via private network (10.0.21.x)        │
│     • CREATE DATABASE coa_pr_50 (if not exists)               │
│     • Pod completes and is deleted                            │
│                                                               │
│  3. helm upgrade --install coa helm/axari/        │
│     • Creates: API deployment, Agent deployment, UI deploy   │
│     • Creates: NATS StatefulSet (with JetStream enabled)     │
│     • Creates: Services (ClusterIP for api, ui, nats)         │
│     • Creates: Ingress → ALB controller provisions ALB       │
│     • Creates: ConfigMap + Secret with env-specific values    │
│                                                               │
│  Pod startup order (natural, not enforced):                    │
│     NATS starts → JetStream initializes                       │
│     API starts → alembic upgrade → seed → uvicorn             │
│       → connects to NATS (retries until JetStream ready)     │
│     Agent starts → subscribes to NATS JetStream consumers    │
│     UI starts → node server.js (instant)                      │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Stage: UI Rebuild (two-pass) ───────────────────────────────┐
│  • Wait for ALB hostname to appear on Ingress                │
│    (polls kubectl get ingress every 10s, up to 5 min)        │
│  • ALB URL: http://k8s-coapr50-coaingre-xxx.us-west-2...    │
│  • Rebuild UI with real URL:                                  │
│    docker build --build-arg NEXT_PUBLIC_API_URL=http://k8s... │
│  • Push new UI image (same tag, overwritten)                  │
│  • kubectl rollout restart deployment/coa-ui                  │
│  • Update ConfigMap: CORS_ORIGINS + OAuth redirect URIs      │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Stage: PR Comment ──────────────────────────────────────────┐
│  • GitHub API: post comment on PR with preview URLs          │
│    UI:    http://k8s-coapr50-coaingre-xxx...                 │
│    API:   http://k8s-coapr50-coaingre-xxx.../docs            │
│    WS:    ws://k8s-coapr50-coaingre-xxx.../ws                │
└──────────────────────────────────────────────────────────────┘
```

### PR Cleanup (what happens when you close/merge a PR)

```
PR closed on GitHub
         │
         ▼
Jenkins detects PR_ACTION=closed
         │
         ▼
1. Run db-drop pod inside EKS (default namespace)
   → DROP DATABASE coa_pr_50
         │
         ▼
2. helm uninstall coa -n coa-pr-50
   → Deletes all K8s resources (pods, services, ingress, NATS)
   → ALB controller deletes the ALB
         │
         ▼
3. kubectl delete namespace coa-pr-50
   → Final cleanup of any orphaned resources
```

### Production Deployment (what happens when you merge to main)

Same as PR deployment except:
- Namespace: `coa-production` (stable, never deleted)
- Database: `axari` (pre-existing, not created per deploy)
- `USE_MODAL_AGENT=true` — Agent dispatches to Modal, doesn't run SDK locally
- NLB created for NATS external access (Modal connects back)
- 2 replicas for API and UI (high availability)
- Rolling update strategy — zero downtime

---

## How Services Talk to Each Other

### Within a Single Environment (namespace)

All services within a namespace communicate via Kubernetes DNS:

```
┌──────────────────────────────────────────────────────────────┐
│                    Namespace: coa-pr-50                       │
│                                                              │
│  ┌─────────┐   HTTP :8000    ┌─────────┐                    │
│  │   UI    │ ◄──────────────► │   API   │                    │
│  │  :3000  │   (via ALB)      │  :8000  │                    │
│  └─────────┘                  └────┬────┘                    │
│                                    │                          │
│                          NATS :4222│  PostgreSQL :5432        │
│                          (publish) │  (asyncpg)              │
│                                    │                          │
│                               ┌────▼────┐                    │
│                               │  NATS   │                    │
│                               │  :4222  │                    │
│                               └────┬────┘                    │
│                                    │                          │
│                          NATS :4222│  (subscribe)             │
│                                    │                          │
│                               ┌────▼────┐                    │
│                               │  Agent  │                    │
│                               │ (no port│                    │
│                               └─────────┘                    │
└──────────────────────────────────────────────────────────────┘
                                     │
                                     │ asyncpg :5432
                                     ▼
                        ┌─────────────────────┐
                        │   RDS PostgreSQL     │
                        │   (outside cluster,  │
                        │    private subnets)   │
                        └─────────────────────┘
```

**Connection strings:**

| Connection | DNS Name | Port |
|-----------|----------|------|
| API → NATS | `coa-nats:4222` (ConfigMap: `NATS_URL`) | TCP 4222 |
| Agent → NATS | `coa-nats:4222` (ConfigMap: `NATS_URL`) | TCP 4222 |
| API → RDS | `axari-postgres.xxx.rds.amazonaws.com` (Secret: `DATABASE_URL`) | TCP 5432 |
| Agent → RDS | Same RDS endpoint (Secret: `DATABASE_URL`) | TCP 5432 |
| Browser → UI | ALB hostname (resolved by DNS) | HTTP 80 |
| Browser → API | Same ALB hostname, path `/api/*` | HTTP 80 |
| Browser → WS | Same ALB hostname, path `/ws` | WS 80 |

### Cross-Environment Isolation

Environments CANNOT talk to each other:

- Each namespace has its own NATS instance. `coa-nats` in `coa-pr-50` resolves to a different pod than `coa-nats` in `coa-production`.
- Each namespace has its own `DATABASE_URL` pointing to a different database on the same RDS instance.
- Each namespace has its own ALB with a unique URL.
- There are no NetworkPolicies (optional hardening), but services only reference their own namespace's DNS names.

### External Access (Modal → AWS)

Production only. Modal sandboxes run outside AWS and need to reach back:

```
Modal Sandbox (external)
    │
    ├── NATS_URL → NLB public DNS:4222 → coa-nats pod in coa-production
    │              (internet → NLB → private subnet → pod)
    │
    └── DATABASE_URL → RDS public endpoint:5432 → RDS in database subnet
                       (internet → RDS public IP → database subnet)
```

Both connections are authenticated (NATS user/pass, PostgreSQL user/pass) and restricted by security groups.

---

## Infrastructure Layers Explained

### Layer 1: AWS Resources (Terraform)

These are provisioned once and shared by all environments:

```
Terraform (infra/aws/)
    │
    ├── VPC Module
    │   └── VPC, 9 subnets (3 public, 3 private, 3 database), IGW, NAT GW, route tables
    │
    ├── EKS Module
    │   └── EKS cluster, managed node group (EC2 instances), OIDC provider
    │   └── AWS Load Balancer Controller (Helm release in kube-system)
    │   └── EBS CSI Driver (for NATS persistent volumes)
    │
    ├── RDS Module
    │   └── PostgreSQL instance, subnet group, security group, parameter group
    │   └── Random password → Secrets Manager
    │
    ├── ECR Module
    │   └── 2 repositories (api, ui) with lifecycle policies
    │
    └── IAM Module
        └── Jenkins policy (ECR, EKS, Secrets Manager, S3)
        └── EKS access entry for Jenkins
```

Managed by `Jenkinsfile.infra` — run `plan`/`apply` manually.

### Layer 2: Kubernetes Resources (Helm)

These are created per-environment by the Helm chart:

```
Helm Chart (helm/axari/)
    │
    ├── Deployments
    │   ├── coa-api      → FastAPI server
    │   ├── coa-agent    → NATS consumer / agent dispatcher
    │   └── coa-ui       → Next.js server
    │
    ├── Services
    │   ├── coa-api      → ClusterIP :8000
    │   ├── coa-ui       → ClusterIP :3000
    │   └── coa-nats     → ClusterIP :4222 (from sub-chart)
    │
    ├── Ingress
    │   └── coa-ingress  → ALB with path-based routing
    │
    ├── NATS (sub-chart)
    │   └── StatefulSet with JetStream + EBS volume
    │
    ├── ConfigMap
    │   └── Non-sensitive env vars (NATS_URL, CORS, OAuth URIs)
    │
    ├── Secret
    │   └── Sensitive env vars (DATABASE_URL, API keys, OAuth secrets)
    │
    └── (Optional) NLB Service
        └── coa-nats-external :4222 (production only, for Modal)
```

Managed by `Jenkinsfile` — runs automatically on every PR push and main merge.

### Layer 3: Application (Docker Images)

The application code runs inside the Kubernetes pods:

```
Docker Images (built by Jenkins)
    │
    ├── axari/api (Python 3.12 + UV)
    │   ├── Used by: coa-api deployment
    │   │   └── CMD: alembic upgrade head → db.seed → uvicorn :8000
    │   └── Used by: coa-agent deployment
    │       └── CMD: python -m agent.main (NATS consumer loop)
    │
    └── axari/ui (Node 22 + Next.js standalone)
        └── Used by: coa-ui deployment
            └── CMD: node server.js :3000
            └── Build-time args: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL
```

---

## Component Details

### 1. VPC (Virtual Private Cloud)

| Property | Value |
|----------|-------|
| CIDR | `10.0.0.0/16` (65,536 IPs) |
| Availability Zones | `us-west-2a`, `us-west-2b`, `us-west-2c` |
| NAT Gateway | Single (cost optimization, ~$32/mo) |
| DNS | Hostnames + resolution enabled |

**Subnet Layout:**

| Tier | Subnets | Purpose | Internet Access |
|------|---------|---------|-----------------|
| Public | `10.0.1.0/24`, `10.0.2.0/24`, `10.0.3.0/24` | ALB, NAT Gateway | Direct (IGW) |
| Private | `10.0.11.0/24`, `10.0.12.0/24`, `10.0.13.0/24` | EKS worker nodes | Outbound via NAT |
| Database | `10.0.21.0/24`, `10.0.22.0/24`, `10.0.23.0/24` | RDS only | None (isolated) |

Public subnets are tagged with `kubernetes.io/role/elb = 1` so the AWS Load Balancer Controller knows to place ALBs there. Private subnets are tagged with `kubernetes.io/role/internal-elb = 1`.

---

### 2. EKS Cluster

| Property | Value |
|----------|-------|
| Name | `axari-cluster` |
| K8s Version | 1.29 |
| Endpoint | Public + Private (public for Jenkins access) |
| Node Group | `general`: 2-6x `t3.large` (2 vCPU, 8 GB each) |

**Add-ons:**
- **CoreDNS** — in-cluster DNS for service discovery (`coa-api.coa-production.svc.cluster.local`)
- **vpc-cni** — AWS VPC networking for pods (pods get real VPC IPs)
- **kube-proxy** — Kubernetes network proxy
- **aws-ebs-csi-driver** — EBS volume provisioning (for NATS JetStream persistent storage)

**AWS Load Balancer Controller** (Helm chart in `kube-system`):
- Watches for `Ingress` resources and creates ALBs
- Watches for `Service type: LoadBalancer` and creates NLBs
- Uses IRSA (IAM Role for Service Account) for AWS permissions

---

### 3. RDS PostgreSQL

| Property | Value |
|----------|-------|
| Engine | PostgreSQL 16 |
| Instance | `db.t4g.medium` (2 vCPU, 4 GB) |
| Storage | 50 GB gp3, autoscale to 200 GB |
| Multi-AZ | Yes (automatic failover) |
| Backup | 7-day retention, daily at 03:00 UTC |
| Publicly Accessible | Yes (restricted by Security Group) |
| Master User | `coa_admin` |
| Password | Random 32-char, stored in AWS Secrets Manager |

**Database-per-environment strategy:**

```
RDS Instance
├── axari      ← production (main branch)
├── coa_pr_42            ← PR #42 preview
├── coa_pr_55            ← PR #55 preview
└── coa_pr_63            ← PR #63 preview
```

Jenkins creates databases on PR open, drops them on PR close. All share the same RDS instance — no extra cost per PR.

**Security Group:**
- Inbound 5432 from EKS node security group (for API + Agent pods)
- Inbound 5432 from Modal CIDR blocks (for Modal sandboxes, configurable)
- All outbound allowed

---

### 4. ECR (Container Registry)

Two repositories:

| Repository | Contents | Used by |
|-----------|----------|---------|
| `axari/api` | Python 3.12 image (FastAPI + Agent worker) | API deployment, Agent deployment |
| `axari/ui` | Node 22 image (Next.js standalone) | UI deployment |

API and Agent share the same Docker image — they differ only in the start command:
- API: `uv run alembic upgrade head && uv run uvicorn api.main:app`
- Agent: `uv run python -u -m agent.main`

**Image tagging:**
- PR builds: `pr-{number}-{build}` (e.g., `pr-42-7`)
- Main builds: `main-{build}` (e.g., `main-15`)

**Lifecycle policy:** Untagged images expire after 7 days, max 30 tagged images kept.

---

### 5. Kubernetes Namespaces & Workloads

#### Production Namespace: `coa-production`

```
coa-production/
├── Deployment: coa-api        (2 replicas)
│   ├── Container: api image, port 8000
│   ├── Command: alembic upgrade + uvicorn
│   ├── Probes: /docs (readiness + liveness)
│   └── Resources: 250m-1000m CPU, 512Mi-1Gi RAM
│
├── Deployment: coa-agent      (1 replica)
│   ├── Container: api image (same), no port
│   ├── Command: python -m agent.main
│   ├── USE_MODAL_AGENT=true (dispatches to Modal)
│   └── Resources: 100m-500m CPU, 256Mi-512Mi RAM (lightweight dispatcher)
│
├── Deployment: coa-ui         (2 replicas)
│   ├── Container: ui image, port 3000
│   ├── Command: node server.js
│   ├── Probes: / (readiness + liveness)
│   └── Resources: 100m-500m CPU, 256Mi-512Mi RAM
│
├── StatefulSet: coa-nats      (1 replica, via Helm sub-chart)
│   ├── JetStream enabled (1Gi mem, 5Gi disk on gp2 EBS)
│   ├── Streams: EMPLOYEES, CHANNELS
│   └── KV Bucket: employee-status
│
├── Service: coa-api           (ClusterIP:8000)
├── Service: coa-ui            (ClusterIP:3000)
├── Service: coa-nats          (ClusterIP:4222) — auto-created by NATS chart
├── Service: coa-nats-external (NLB:4222) — public, for Modal access
│
├── Ingress: coa-ingress       (creates ALB)
│   ├── /api/*  → coa-api:8000
│   ├── /ws     → coa-api:8000
│   ├── /docs   → coa-api:8000
│   └── /*      → coa-ui:3000
│
├── ConfigMap: coa-config
│   ├── NATS_URL=nats://coa-nats:4222
│   ├── DATA_DIR=/app/data
│   ├── CORS_ORIGINS=<ALB URL>
│   ├── USE_MODAL_AGENT=true
│   └── *_REDIRECT_URI=<ALB URL>/api/integrations/oauth/*/callback
│
└── Secret: coa-secrets
    ├── DATABASE_URL=postgresql+asyncpg://coa_admin:...@<RDS>:5432/axari
    ├── OPENROUTER_API_KEY=sk-or-v1-...
    ├── ENCRYPTION_KEY=...
    ├── CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY
    ├── GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
    ├── MODAL_TOKEN_ID, MODAL_TOKEN_SECRET
    └── (all other OAuth secrets)
```

#### PR Preview Namespace: `coa-pr-{N}`

Same structure, but:
- **1 replica** per service (no HA needed)
- **`USE_MODAL_AGENT=false`** — Agent runs Claude SDK inline (no Modal)
- **Agent gets more resources** (500m-2000m CPU, 1-2Gi RAM) since it runs SDK locally
- **No NLB** for NATS (Modal not used)
- **Own database** on shared RDS (`coa_pr_{N}`) — created by a `kubectl run` pod before Helm deploy
- **Own ALB** with unique URL (auto-generated by AWS, e.g., `k8s-coapr50-coaingre-xxx.us-west-2.elb.amazonaws.com`)
- **Ephemeral** — entire namespace + database destroyed when PR is closed

---

### 6. Networking & Traffic Flow

#### User Request Flow

```
User Browser
    │
    ▼
ALB (internet-facing, public subnets)
    │
    ├── GET /              → coa-ui:3000 (Next.js SSR)
    ├── GET /api/employees → coa-api:8000 (FastAPI)
    ├── GET /docs          → coa-api:8000 (Swagger UI)
    └── WS  /ws            → coa-api:8000 (WebSocket upgrade)
```

#### Message Processing Flow (Production)

```
1. User sends DM via UI
    │
    ▼
2. UI → POST /api/sessions/{id}/messages (via ALB → API pod)
    │
    ▼
3. API saves message to RDS, publishes to NATS
   Subject: employee.{uuid}.dm.incoming
    │
    ▼
4. Agent pod (NATS consumer) picks up message
   USE_MODAL_AGENT=true → calls modal.Sandbox.create.aio()
    │
    ▼
5. Modal Sandbox starts (external to AWS)
   Connects back to:
   - NATS via NLB:4222 (public endpoint)
   - RDS via public endpoint:5432
    │
    ▼
6. Modal runs Claude Agent SDK → streams events to NATS
   Subject: employee.{uuid}.dm.stream
    │
    ▼
7. API WebSocket relay picks up NATS stream → pushes to UI
   /ws → client receives real-time thinking/text/tool events
    │
    ▼
8. Modal saves final assistant message to RDS, exits
```

#### Message Processing Flow (PR Preview)

Same as above, except step 4-6 happen **inline in the Agent pod** (no Modal). The Agent pod runs Claude SDK directly and streams events to NATS locally.

#### Service Discovery (within EKS)

| From | To | DNS | Protocol |
|------|----|-----|----------|
| API pod | NATS | `coa-nats.{namespace}.svc.cluster.local:4222` | TCP |
| API pod | RDS | `axari-postgres.xxxxx.us-west-2.rds.amazonaws.com:5432` | TCP |
| Agent pod | NATS | `coa-nats.{namespace}.svc.cluster.local:4222` | TCP |
| Agent pod | RDS | (same RDS endpoint) | TCP |
| Modal sandbox | NATS | NLB public DNS:4222 | TCP |
| Modal sandbox | RDS | RDS public endpoint:5432 | TCP |

---

### 7. Security

#### Network Security Groups

| SG | Inbound Rules |
|----|---------------|
| EKS Cluster | 443 from VPC CIDR (API server) |
| EKS Nodes | All traffic from self + cluster SG |
| RDS | 5432 from EKS nodes SG + Modal CIDRs |
| ALB | 80 from 0.0.0.0/0 (HTTP — add HTTPS when domain is ready) |

#### IAM Roles

| Role | Purpose | Permissions |
|------|---------|-------------|
| EKS Node Role | Worker node operations | EKSWorkerNodePolicy, ECR ReadOnly, EBS CSI, VPC CNI |
| EBS CSI IRSA | EBS volume provisioning | AmazonEBSCSIDriverPolicy |
| LB Controller IRSA | ALB/NLB creation | LoadBalancerControllerPolicy |
| Jenkins Role | CI/CD pipeline | ECR push/pull, EKS describe, Secrets Manager read, S3 (tfstate) |

#### Secrets Management

- **RDS master password** → AWS Secrets Manager (auto-generated, never in code)
- **App secrets** (API keys, OAuth) → Jenkins Credentials → injected via `helm --set-string`
- **Kubernetes Secrets** → created by Helm from Jenkins-injected values
- **Modal secrets** → separate `coa-secrets` in Modal (updated manually after NLB is provisioned)

---

### 8. Jenkins CI/CD Pipeline

#### Jenkinsfile (app deployments)

```
PR opened/updated                          Push to main
       │                                         │
       ▼                                         ▼
┌──────────────┐                         ┌──────────────┐
│ Context      │ ns=coa-pr-{N}           │ Context      │ ns=coa-production
│ Build (║)    │ api + ui images         │ Build (║)    │ api + ui images
│ Push ECR     │                         │ Push ECR     │
│ Create PR DB │ CREATE DATABASE         │ Deploy       │ helm upgrade
│ Deploy       │ helm upgrade --install  │ UI Rebuild   │ with real ALB URL
│ UI Rebuild   │ with real ALB URL       └──────────────┘
│ PR Comment   │ posts preview URL
└──────────────┘

PR closed
       │
       ▼
┌──────────────┐
│ Drop PR DB   │ DROP DATABASE
│ Helm delete  │ helm uninstall
│ Delete NS    │ kubectl delete namespace
└──────────────┘
```

#### Jenkinsfile.infra (infrastructure)

Parameterized pipeline: `plan` / `apply` / `destroy`
- Run `plan` first to review
- Run `apply` to provision (one-time, ~15-20 min)
- Run `destroy` to tear down everything (if needed)

#### UI Two-Pass Deploy

Next.js bakes `NEXT_PUBLIC_*` env vars at build time. Since the ALB URL isn't known until after the first deploy:

1. **Pass 1**: Build UI with placeholder URL → deploy → ALB provisions
2. **Pass 2**: Get ALB hostname → rebuild UI with real URL → push → rollout restart

---

### 9. Cost Breakdown

| Resource | Monthly Cost | Notes |
|----------|-------------|-------|
| EKS Control Plane | $73 | Fixed |
| EC2 Nodes (3x t3.large) | ~$180 | Autoscales 2-6 |
| RDS (db.t4g.medium, Multi-AZ) | ~$130 | Shared across all envs |
| NAT Gateway | ~$32 | Single (upgrade for HA) |
| ALB (production) | ~$16 | + LCU charges |
| NLB (NATS external) | ~$16 | Production only |
| ECR Storage | ~$5 | Lifecycle policy keeps it small |
| Secrets Manager | ~$1 | 1 secret |
| **Base Total** | **~$453/mo** | |

**Per active PR:** +$16 (ALB) + marginal compute on existing nodes

**Not included:** Modal costs (unchanged from Railway), data transfer

---

### 10. Operational Procedures

#### First-Time Setup

```bash
# 1. Provision AWS infrastructure (one-time, ~15-20 min)
#    Jenkins UI → coa-infra job → Build with Parameters → ACTION=apply

# 2. Add Jenkins credentials (Manage Jenkins → Credentials → Global):
#    openrouter-api-key, encryption-key, clerk-secret-key,
#    clerk-publishable-key, google-client-id, google-client-secret

# 3. Open a PR → Jenkins auto-deploys to coa-pr-{N}
# 4. Merge to main → Jenkins deploys to coa-production
```

#### Viewing Logs

```bash
# Configure kubectl (run once per session)
aws eks update-kubeconfig --name axari-cluster --region us-west-2

# List all pods in an environment
kubectl get pods -n coa-pr-50
kubectl get pods -n coa-production

# View live logs
kubectl logs -f deployment/coa-api -n coa-pr-50
kubectl logs -f deployment/coa-agent -n coa-pr-50
kubectl logs -f deployment/coa-ui -n coa-pr-50
kubectl logs -f coa-nats-0 -n coa-pr-50 -c nats

# View previous crash logs
kubectl logs deployment/coa-api -n coa-pr-50 --previous

# Describe a pod (events, status, reason for failure)
kubectl describe pod -l app.kubernetes.io/name=coa-api -n coa-pr-50
```

#### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| API crash: `NoRespondersError` / `ServiceUnavailableError` | NATS JetStream not ready yet | Wait — API retries 10 times (30s). If persistent, check NATS pod logs |
| 503 Service Unavailable | No healthy backend pods | Check `kubectl get pods` — API may be starting up or crash-looping |
| UI shows "Failed to fetch" | API not reachable or CORS mismatch | Check `kubectl get configmap coa-config -o yaml` — CORS_ORIGINS should match ALB URL |
| Helm: StatefulSet update forbidden | PVC spec changed | Delete NATS StatefulSet + PVC, then redeploy |
| Helm: context deadline exceeded | Auth token expired during long deploy | Re-run the build — `--timeout` handles this |
| `psql: connection timed out` from Jenkins | Jenkins can't reach RDS directly | DB operations run inside EKS via `kubectl run`, not from Jenkins |

#### Scaling

```bash
# Scale API replicas
kubectl scale deployment coa-api -n coa-production --replicas=3

# Scale EKS node group (via Terraform)
# Edit infra/aws/variables.tf → eks_node_desired_size
# Run coa-infra → apply
```

#### Destroying a PR Environment Manually

```bash
# If auto-cleanup didn't trigger
kubectl run db-drop --namespace default --image=postgres:16-alpine \
    --restart=Never --rm -i \
    --env="PGPASSWORD=<rds-password>" \
    --env="PGSSLMODE=require" \
    --command -- psql -h <rds-address> -U coa_admin -d postgres \
    -c "DROP DATABASE IF EXISTS coa_pr_50;"

helm uninstall coa -n coa-pr-50
kubectl delete namespace coa-pr-50
```

#### Destroying All AWS Infrastructure

```bash
# Jenkins UI → coa-infra job → Build with Parameters → ACTION=destroy
# WARNING: This deletes VPC, EKS, RDS, ECR, everything. Data is lost.
```

---

### 11. File Reference

| File | Purpose |
|------|---------|
| `infra/aws/main.tf` | Root Terraform — wires all modules together |
| `infra/aws/modules/vpc/` | VPC, subnets, NAT gateway, route tables |
| `infra/aws/modules/eks/` | EKS cluster, node group, LB controller |
| `infra/aws/modules/rds/` | RDS PostgreSQL, security group, Secrets Manager |
| `infra/aws/modules/ecr/` | Container image repositories |
| `infra/aws/modules/iam/` | Jenkins IAM policy, EKS access |
| `helm/axari/Chart.yaml` | Helm chart with NATS dependency |
| `helm/axari/values.yaml` | Production defaults |
| `helm/axari/values-preview.yaml` | PR preview overrides |
| `helm/axari/templates/` | K8s manifests (deployments, services, ingress) |
| `Jenkinsfile` | App CI/CD pipeline (build, push, deploy) |
| `Jenkinsfile.infra` | Infrastructure provisioning pipeline |
| `shared/nats_client.py` | NATS connection + JetStream setup with retries |

---

### 12. Future Enhancements

| Enhancement | When | Effort |
|-------------|------|--------|
| CloudFront + custom domain | When domain is connected | Add `cloudfront` Terraform module, ACM cert, Route53 records |
| HTTPS on ALB | With domain | ACM certificate + listener rule |
| External Secrets Operator | When secrets management scales | Replace `helm --set-string` with ESO + Secrets Manager sync |
| NATS HA (3-node cluster) | When production traffic grows | Enable `cluster.enabled: true` in NATS Helm values |
| Horizontal Pod Autoscaler | When load patterns are known | HPA on API deployment based on CPU/requests |
| Multi-NAT Gateway | For production HA | One NAT per AZ (~$96/mo instead of $32) |
| Shared ALB for PRs | When domain is available | Host-based routing: `pr-42.preview.domain.com` |
| Runtime env for Next.js | To eliminate two-pass deploy | Add `/api/config` endpoint, modify UI to read at runtime |
