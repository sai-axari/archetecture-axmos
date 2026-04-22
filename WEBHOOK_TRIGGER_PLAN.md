# Webhook Triggers for Outcomes — Implementation Plan

## Overview

Currently, outcomes (both employee and channel) only support **cron-based triggers** — a schedule field stores a cron expression, and a scheduler service polls every 60 seconds to fire due outcomes. This plan adds **webhook-based triggers** as an alternative trigger type. When an outcome uses a webhook trigger, a unique URL is generated that external systems can POST to in order to trigger the outcome on demand.

---

## Current Architecture Summary

### How cron triggers work today

1. User creates an outcome with a `schedule` (cron expression like `"0 8 * * *"`)
2. `compute_next_run()` in `agent/scheduler.py` calculates `next_run_at` in UTC
3. `run_scheduler()` loops every 60s, queries outcomes where `enabled=True AND next_run_at <= now`
4. For matches, publishes a NATS message to `employee.{id}.outcome.trigger` or `channel.{id}.outcome.trigger`
5. Agent service subscribes, executes the outcome, records an `OutcomeRun` / `ChannelOutcomeRun`

### Key files

| Layer | Employee Outcomes | Channel Outcomes |
|-------|-------------------|------------------|
| **Model** | `shared/models/outcome.py` — `Outcome`, `OutcomeRun` | `shared/models/channel_outcome.py` — `ChannelOutcome`, `ChannelOutcomeRun` |
| **Schema** | `shared/schemas/outcome.py` — `OutcomeCreate`, `OutcomeUpdate`, `OutcomeResponse` | `shared/schemas/channel_outcome.py` — `ChannelOutcomeCreate`, etc. |
| **API Routes** | `api/routers/outcomes.py` — CRUD + `/trigger` | `api/routers/channel_outcomes.py` — CRUD + `/trigger` |
| **Scheduler** | `agent/scheduler.py` — `run_scheduler()` lines 74-121 | Same file, lines 123-167 |
| **Runner** | `agent/outcome_runner.py` — `handle_outcome()` | `agent/channel_outcome_runner.py` — `handle_channel_outcome()` |
| **NATS subjects** | `shared/constants.py` — `outcome_trigger_subject()` | Same — `channel_outcome_trigger_subject()` |
| **Frontend Form** | `ui/src/components/outcomes/OutcomeForm.tsx` | `ui/src/components/channel-outcomes/ChannelOutcomeForm.tsx` |
| **Frontend Card** | `ui/src/components/outcomes/OutcomeCard.tsx` | `ui/src/components/channel-outcomes/ChannelOutcomeCard.tsx` |
| **Frontend Types** | `ui/src/lib/types.ts` — `Outcome`, `OutcomeCreate` (line 246) | Same — `ChannelOutcome`, `ChannelOutcomeCreate` (line 507) |
| **API Client** | `ui/src/lib/api.ts` — `api.outcomes.*` | Same — `api.channels.outcomes.*` |
| **Migrations** | `db/alembic/versions/` | Same |

---

## Design

### Trigger type model

Add a `trigger_type` column to both `outcomes` and `channel_outcomes` tables. This is an enum with two values: `"cron"` (default) and `"webhook"`.

- When `trigger_type = "cron"`: behavior is exactly as today — `schedule` is required, `next_run_at` is computed, scheduler picks it up.
- When `trigger_type = "webhook"`: `schedule` is nullable/ignored, `next_run_at` is null. A unique `webhook_token` (UUID) is generated and stored. External systems POST to `/api/webhooks/trigger/{webhook_token}` to fire the outcome.

### Webhook token

Each webhook-triggered outcome gets a unique `webhook_token` (UUID4). This token is the **only authentication** for the webhook — it acts as a bearer secret embedded in the URL. The full webhook URL is:

```
{BASE_URL}/api/webhooks/trigger/{webhook_token}
```

This is a public endpoint (no tenant auth required) — the token itself is the auth. The token is unique per outcome, not per employee/channel.

### Webhook payload passthrough

When an external system POSTs to the webhook, it can optionally include a JSON body. This body is passed through to the outcome execution as `webhook_payload` in the NATS message, making it available to the agent as context. This is useful for scenarios like "GitHub pushes event data to trigger a code review outcome."

---

## Implementation Steps

### Step 1: Database Migration

**File to create**: `db/alembic/versions/026_add_webhook_triggers.py`

Add to `outcomes` table:
```python
op.add_column('outcomes', sa.Column('trigger_type', sa.String(20), nullable=False, server_default='cron'))
op.add_column('outcomes', sa.Column('webhook_token', sa.String(36), nullable=True, unique=True))
op.alter_column('outcomes', 'schedule', nullable=True)  # schedule is now optional for webhook triggers
```

Add to `channel_outcomes` table:
```python
op.add_column('channel_outcomes', sa.Column('trigger_type', sa.String(20), nullable=False, server_default='cron'))
op.add_column('channel_outcomes', sa.Column('webhook_token', sa.String(36), nullable=True, unique=True))
op.alter_column('channel_outcomes', 'schedule', nullable=True)
```

Add an index on `webhook_token` for fast lookups:
```python
op.create_index('ix_outcomes_webhook_token', 'outcomes', ['webhook_token'], unique=True)
op.create_index('ix_channel_outcomes_webhook_token', 'channel_outcomes', ['webhook_token'], unique=True)
```

### Step 2: Update SQLAlchemy Models

**File**: `shared/models/outcome.py`

Update the `Outcome` model:
```python
class Outcome(Base):
    __tablename__ = "outcomes"
    # ... existing columns ...
    trigger_type: Mapped[str] = mapped_column(String(20), nullable=False, default="cron")  # "cron" or "webhook"
    webhook_token: Mapped[str | None] = mapped_column(String(36), nullable=True, unique=True, index=True)
    schedule: Mapped[str | None] = mapped_column(String(100), nullable=True)  # NOW NULLABLE — required only for cron
```

**File**: `shared/models/channel_outcome.py`

Same changes to `ChannelOutcome`:
```python
class ChannelOutcome(Base):
    __tablename__ = "channel_outcomes"
    # ... existing columns ...
    trigger_type: Mapped[str] = mapped_column(String(20), nullable=False, default="cron")
    webhook_token: Mapped[str | None] = mapped_column(String(36), nullable=True, unique=True, index=True)
    schedule: Mapped[str | None] = mapped_column(String(100), nullable=True)  # NOW NULLABLE
```

### Step 3: Update Pydantic Schemas

**File**: `shared/schemas/outcome.py`

```python
class OutcomeCreate(BaseModel):
    description: str
    expected_output: str | None = None
    trigger_type: str = "cron"  # "cron" or "webhook"
    schedule: str | None = None  # required if trigger_type == "cron"
    budget_per_run_usd: Decimal | None = None
    enabled: bool = True

class OutcomeUpdate(BaseModel):
    description: str | None = None
    expected_output: str | None = None
    trigger_type: str | None = None
    schedule: str | None = None
    budget_per_run_usd: Decimal | None = None
    enabled: bool | None = None

class OutcomeResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    description: str
    expected_output: str | None
    trigger_type: str
    schedule: str | None          # null for webhook triggers
    webhook_token: str | None     # only present for webhook triggers
    webhook_url: str | None = None  # computed field — full URL
    budget_per_run_usd: Decimal | None
    enabled: bool
    last_run_at: datetime | None
    next_run_at: datetime | None  # null for webhook triggers
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

Apply the same pattern to `shared/schemas/channel_outcome.py` for `ChannelOutcomeCreate`, `ChannelOutcomeUpdate`, `ChannelOutcomeResponse`.

**Note on `webhook_url`**: This is a computed field not stored in the DB. The API route should populate it when returning the response:
```python
response.webhook_url = f"{settings.base_url}/api/webhooks/trigger/{outcome.webhook_token}"
```

### Step 4: Update API Routes — Outcome CRUD

**File**: `api/routers/outcomes.py`

#### Create endpoint (POST /api/employees/{employee_id}/outcomes)

Update validation logic:
```python
@router.post("/api/employees/{employee_id}/outcomes", response_model=OutcomeResponse)
async def create_outcome(...):
    # Validate trigger_type
    if body.trigger_type not in ("cron", "webhook"):
        raise HTTPException(400, "trigger_type must be 'cron' or 'webhook'")

    if body.trigger_type == "cron":
        if not body.schedule:
            raise HTTPException(400, "schedule is required for cron triggers")
        if not croniter.is_valid(body.schedule):
            raise HTTPException(400, "Invalid cron expression")
        next_run = compute_next_run(body.schedule, tenant.timezone)
        webhook_token = None
    else:  # webhook
        next_run = None
        webhook_token = str(uuid.uuid4())

    outcome = Outcome(
        employee_id=employee_id,
        description=body.description,
        expected_output=body.expected_output,
        trigger_type=body.trigger_type,
        schedule=body.schedule if body.trigger_type == "cron" else None,
        webhook_token=webhook_token,
        budget_per_run_usd=body.budget_per_run_usd,
        enabled=body.enabled,
        next_run_at=next_run,
    )
    # ... save and return with webhook_url populated ...
```

#### Update endpoint (PUT)

Handle trigger_type changes:
- If changing from cron to webhook: clear `schedule`, `next_run_at`; generate `webhook_token`
- If changing from webhook to cron: require `schedule`; clear `webhook_token`; compute `next_run_at`
- If staying cron and schedule changed: recompute `next_run_at`

#### Response helper

Create a helper to populate `webhook_url` before returning:
```python
def _enrich_outcome_response(outcome: Outcome) -> dict:
    data = OutcomeResponse.model_validate(outcome).model_dump()
    if outcome.webhook_token:
        data["webhook_url"] = f"{settings.base_url}/api/webhooks/trigger/{outcome.webhook_token}"
    return data
```

**File**: `api/routers/channel_outcomes.py` — apply identical changes.

### Step 5: Create Webhook Trigger Endpoint

**File to create**: `api/routers/webhooks.py`

This is the **public endpoint** that external systems call to fire a webhook-triggered outcome.

```python
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from nats.aio.client import Client as NATSClient
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_db, get_nats
from shared.constants import outcome_trigger_subject, channel_outcome_trigger_subject
from shared.models.outcome import Outcome
from shared.models.channel_outcome import ChannelOutcome
from shared.models.employee import Employee
from shared.models.channel import Channel
from shared.models.tenant import Tenant

router = APIRouter(tags=["webhooks"])


@router.post("/api/webhooks/trigger/{webhook_token}")
async def webhook_trigger(
    webhook_token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    nc: NATSClient = Depends(get_nats),
):
    """
    Public endpoint — no tenant auth required.
    The webhook_token itself is the authentication.
    Accepts optional JSON body as payload passthrough.
    """
    # Try to find the outcome by webhook_token — check both tables
    outcome = await db.scalar(
        select(Outcome).where(
            Outcome.webhook_token == webhook_token,
            Outcome.trigger_type == "webhook",
        )
    )

    if outcome:
        return await _trigger_employee_outcome(outcome, request, db, nc)

    channel_outcome = await db.scalar(
        select(ChannelOutcome).where(
            ChannelOutcome.webhook_token == webhook_token,
            ChannelOutcome.trigger_type == "webhook",
        )
    )

    if channel_outcome:
        return await _trigger_channel_outcome(channel_outcome, request, db, nc)

    raise HTTPException(status_code=404, detail="Webhook not found")


async def _trigger_employee_outcome(outcome, request, db, nc):
    if not outcome.enabled:
        raise HTTPException(status_code=409, detail="Outcome is disabled")

    # Resolve tenant for timezone
    employee = await db.get(Employee, outcome.employee_id)
    tenant = await db.get(Tenant, employee.tenant_id)

    # Parse optional webhook payload
    webhook_payload = None
    try:
        body = await request.json()
        if body:
            webhook_payload = body
    except Exception:
        pass  # No body or not JSON — that's fine

    payload = {
        "outcome_id": str(outcome.id),
        "employee_id": str(outcome.employee_id),
        "tenant_id": str(tenant.id),
        "description": outcome.description,
        "expected_output": outcome.expected_output,
        "budget_cap": float(outcome.budget_per_run_usd) if outcome.budget_per_run_usd else None,
        "user_timezone": tenant.timezone,
        "triggered_by": "webhook",
        "webhook_payload": webhook_payload,
    }

    await nc.publish(
        outcome_trigger_subject(str(outcome.employee_id)),
        json.dumps(payload).encode(),
    )
    await nc.flush()

    # Update last_run_at (no next_run_at for webhooks)
    outcome.last_run_at = func.now()
    await db.commit()

    return {"status": "triggered", "outcome_id": str(outcome.id)}


async def _trigger_channel_outcome(channel_outcome, request, db, nc):
    if not channel_outcome.enabled:
        raise HTTPException(status_code=409, detail="Outcome is disabled")

    channel = await db.get(Channel, channel_outcome.channel_id)
    tenant = await db.get(Tenant, channel.tenant_id)

    webhook_payload = None
    try:
        body = await request.json()
        if body:
            webhook_payload = body
    except Exception:
        pass

    payload = {
        "channel_outcome_id": str(channel_outcome.id),
        "channel_id": str(channel_outcome.channel_id),
        "tenant_id": str(tenant.id),
        "description": channel_outcome.description,
        "expected_output": channel_outcome.expected_output,
        "user_timezone": tenant.timezone,
        "triggered_by": "webhook",
        "webhook_payload": webhook_payload,
    }

    await nc.publish(
        channel_outcome_trigger_subject(str(channel_outcome.channel_id)),
        json.dumps(payload).encode(),
    )
    await nc.flush()

    channel_outcome.last_run_at = func.now()
    await db.commit()

    return {"status": "triggered", "channel_outcome_id": str(channel_outcome.id)}
```

**Register the router** in `api/main.py` (or wherever routers are mounted):
```python
from api.routers.webhooks import router as webhooks_router
app.include_router(webhooks_router)
```

### Step 6: Update Scheduler to Skip Webhook Outcomes

**File**: `agent/scheduler.py` — `run_scheduler()`

Add a filter to the queries so webhook outcomes are never picked up by the scheduler:

For employee outcomes (~line 80):
```python
# Add this filter:
Outcome.trigger_type == "cron",
```

For channel outcomes (~line 130):
```python
# Add this filter:
ChannelOutcome.trigger_type == "cron",
```

This is a **critical** change — without it, webhook outcomes with `next_run_at = None` won't match the `<= now` check anyway, but being explicit is safer and clearer.

### Step 7: Update CoS MCP Server

**File**: `agent/cos/mcp_server.py`

This is the MCP tool interface that AI agents use to manage outcomes. Multiple functions assume schedule is always present.

#### `_list_outcomes()` (~line 849) and `_list_channel_outcomes()` (~line 882)

These serialize `outcome.schedule` directly into the response dict. Must handle null:

```python
# In _list_outcomes:
"schedule": r[0].schedule or "(webhook)",
"trigger_type": r[0].trigger_type,
"webhook_token": r[0].webhook_token,

# Same for _list_channel_outcomes
```

#### `create_outcome` tool (~lines 402-415, impl ~1251-1283)

Currently defines `schedule` as a required parameter and validates with croniter unconditionally. Must:
- Add `trigger_type` parameter (default "cron")
- Make `schedule` required only when `trigger_type == "cron"`
- Generate `webhook_token` when `trigger_type == "webhook"`
- Skip croniter validation and `compute_next_run` for webhook triggers

#### `update_outcome` tool (~lines 418-431, impl ~1286-1322)

Currently recalculates `next_run_at` unconditionally when schedule changes. Must:
- Handle `trigger_type` changes (cron <-> webhook)
- Only call `compute_next_run` for cron triggers
- Generate/clear `webhook_token` on type switch

### Step 8: Update Channel Detail Page

**File**: `ui/src/app/channels/[id]/page.tsx`

This page has its **own copy** of `cronToHuman()` (lines 58-72) and calls it at line 170. Must:
- Guard against null schedule: `outcome.schedule ? cronToHuman(outcome.schedule) : "Webhook"`
- Or better: show a "Webhook" badge for webhook-triggered outcomes

### Step 9: Webhook Token Regeneration Endpoint (was Step 7)

**File**: `api/routers/outcomes.py`

Add an endpoint to regenerate the webhook token (for security — if a token is leaked):

```python
@router.post("/api/employees/{employee_id}/outcomes/{outcome_id}/regenerate-webhook")
async def regenerate_webhook_token(
    employee_id: uuid.UUID,
    outcome_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
):
    # ... validate employee + outcome ownership ...
    if outcome.trigger_type != "webhook":
        raise HTTPException(400, "Outcome is not webhook-triggered")

    outcome.webhook_token = str(uuid.uuid4())
    await db.commit()
    await db.refresh(outcome)

    return {
        "webhook_token": outcome.webhook_token,
        "webhook_url": f"{settings.base_url}/api/webhooks/trigger/{outcome.webhook_token}",
    }
```

Add the same for channel outcomes in `api/routers/channel_outcomes.py`.

### Step 8: Update Frontend Types

**File**: `ui/src/lib/types.ts`

```typescript
// Update Outcome interface (~line 246)
export interface Outcome {
  id: string;
  employee_id: string;
  description: string;
  expected_output: string | null;
  trigger_type: "cron" | "webhook";     // NEW
  schedule: string | null;               // NOW NULLABLE
  webhook_token: string | null;          // NEW
  webhook_url: string | null;            // NEW
  budget_per_run_usd: string | null;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

// Update OutcomeCreate interface (~line 260)
export interface OutcomeCreate {
  description: string;
  expected_output?: string;
  trigger_type?: "cron" | "webhook";    // NEW, default "cron"
  schedule?: string;                     // NOW OPTIONAL
  budget_per_run_usd?: number;
  enabled?: boolean;
}

// Apply same changes to ChannelOutcome and ChannelOutcomeCreate (~line 507)
```

### Step 9: Update Frontend — OutcomeForm

**File**: `ui/src/components/outcomes/OutcomeForm.tsx`

Add a trigger type selector at the top of the form, before the schedule section:

```tsx
// Add to form state:
const [form, setForm] = useState({
  description: outcome?.description || "",
  expected_output: outcome?.expected_output || "",
  trigger_type: outcome?.trigger_type || "cron",
  schedule: outcome?.schedule || "0 8 * * *",
  enabled: outcome?.enabled ?? true,
});

// Add trigger type selector (render before the schedule section):
<div>
  <label className="block text-xs text-neutral-500 mb-1 uppercase tracking-wider">
    Trigger Type
  </label>
  <div className="flex gap-2">
    <button
      type="button"
      onClick={() => setForm({ ...form, trigger_type: "cron" })}
      className={`flex-1 px-3 py-2 text-sm border transition-colors ${
        form.trigger_type === "cron"
          ? "border-white text-white bg-neutral-800"
          : "border-neutral-700 text-neutral-500 hover:text-neutral-300"
      }`}
    >
      Scheduled (Cron)
    </button>
    <button
      type="button"
      onClick={() => setForm({ ...form, trigger_type: "webhook" })}
      className={`flex-1 px-3 py-2 text-sm border transition-colors ${
        form.trigger_type === "webhook"
          ? "border-white text-white bg-neutral-800"
          : "border-neutral-700 text-neutral-500 hover:text-neutral-300"
      }`}
    >
      Webhook
    </button>
  </div>
</div>

// Conditionally render schedule section:
{form.trigger_type === "cron" && (
  <div>
    {/* ... existing schedule preset + cron input UI ... */}
  </div>
)}

// For webhook type, show a message:
{form.trigger_type === "webhook" && (
  <div className="text-xs text-neutral-400 bg-neutral-900 border border-neutral-800 p-3">
    A unique webhook URL will be generated after saving. External systems can POST to this URL to trigger this outcome.
  </div>
)}

// Update handleSubmit to pass trigger_type and conditionally include schedule:
const data: OutcomeCreate = {
  description: form.description,
  trigger_type: form.trigger_type,
  enabled: form.enabled,
};
if (form.trigger_type === "cron") {
  data.schedule = form.schedule;
}
if (form.expected_output) data.expected_output = form.expected_output;
```

Apply the same changes to `ui/src/components/channel-outcomes/ChannelOutcomeForm.tsx`.

### Step 10: Update Frontend — OutcomeCard

**File**: `ui/src/components/outcomes/OutcomeCard.tsx`

In the card display, show trigger type and webhook URL:

```tsx
// Where schedule is displayed, conditionally show:
{outcome.trigger_type === "cron" ? (
  <span className="text-xs text-neutral-400">{cronToHuman(outcome.schedule!)}</span>
) : (
  <span className="text-xs text-blue-400">Webhook</span>
)}

// When trigger_type is "webhook" and webhook_url exists, show a copyable URL section:
{outcome.trigger_type === "webhook" && outcome.webhook_url && (
  <div className="mt-2 p-2 bg-neutral-900 border border-neutral-800">
    <div className="flex items-center justify-between gap-2">
      <code className="text-xs text-neutral-300 break-all">{outcome.webhook_url}</code>
      <button
        onClick={() => navigator.clipboard.writeText(outcome.webhook_url!)}
        className="shrink-0 text-xs text-neutral-500 hover:text-white"
      >
        Copy
      </button>
    </div>
    <p className="text-[10px] text-neutral-600 mt-1">
      POST to this URL to trigger. Accepts optional JSON body as context.
    </p>
  </div>
)}

// Add a "Regenerate URL" button for webhook outcomes:
{outcome.trigger_type === "webhook" && (
  <button
    onClick={handleRegenerateWebhook}
    className="text-xs text-orange-400 hover:text-orange-300"
  >
    Regenerate URL
  </button>
)}
```

Apply the same to `ui/src/components/channel-outcomes/ChannelOutcomeCard.tsx`.

### Step 11: Update Frontend API Client

**File**: `ui/src/lib/api.ts`

Add the regenerate-webhook method:

```typescript
// Under outcomes:
regenerateWebhook: async (employeeId: string, outcomeId: string) => {
  const res = await fetch(`${BASE}/api/employees/${employeeId}/outcomes/${outcomeId}/regenerate-webhook`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ webhook_token: string; webhook_url: string }>;
},

// Under channel outcomes:
regenerateWebhook: async (channelId: string, outcomeId: string) => {
  const res = await fetch(`${BASE}/api/channels/${channelId}/outcomes/${outcomeId}/regenerate-webhook`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ webhook_token: string; webhook_url: string }>;
},
```

### Step 12: Pass Webhook Payload to Agent (Optional Enhancement)

**File**: `agent/outcome_runner.py` — `handle_outcome()`

If `webhook_payload` is present in the NATS message, append it to the prompt so the agent has context about what triggered it:

```python
# After building the base prompt (~line 130):
webhook_payload = data.get("webhook_payload")
if webhook_payload:
    prompt += f"\n\n---\nThis outcome was triggered via webhook. The triggering system provided this context:\n```json\n{json.dumps(webhook_payload, indent=2)}\n```"
```

Apply the same in `agent/channel_outcome_runner.py`.

---

## File Change Summary

| File | Action | What Changes |
|------|--------|--------------|
| `db/alembic/versions/026_add_webhook_triggers.py` | **CREATE** | Migration: add `trigger_type`, `webhook_token` columns; make `schedule` nullable |
| `shared/models/outcome.py` | **EDIT** | Add `trigger_type`, `webhook_token` columns; make `schedule` nullable |
| `shared/models/channel_outcome.py` | **EDIT** | Same as above |
| `shared/schemas/outcome.py` | **EDIT** | Add `trigger_type`, `webhook_token`, `webhook_url` to schemas; make `schedule` optional |
| `shared/schemas/channel_outcome.py` | **EDIT** | Same as above |
| `api/routers/outcomes.py` | **EDIT** | Update create/update validation; add `regenerate-webhook` endpoint; add response enrichment |
| `api/routers/channel_outcomes.py` | **EDIT** | Same as above |
| `api/routers/webhooks.py` | **CREATE** | New public webhook trigger endpoint |
| `api/main.py` (or router mount file) | **EDIT** | Register webhooks router |
| `agent/scheduler.py` | **EDIT** | Add `trigger_type == "cron"` filter to scheduler queries |
| `agent/cos/mcp_server.py` | **EDIT** | Update list/create/update outcome tools to handle webhook trigger type and null schedule |
| `agent/outcome_runner.py` | **EDIT** | Pass webhook_payload to agent prompt |
| `agent/channel_outcome_runner.py` | **EDIT** | Same as above |
| `ui/src/app/channels/[id]/page.tsx` | **EDIT** | Guard `cronToHuman()` against null schedule; show webhook badge |
| `ui/src/lib/types.ts` | **EDIT** | Add `trigger_type`, `webhook_token`, `webhook_url` to interfaces |
| `ui/src/lib/api.ts` | **EDIT** | Add `regenerateWebhook` methods |
| `ui/src/components/outcomes/OutcomeForm.tsx` | **EDIT** | Add trigger type toggle; conditionally show schedule vs webhook info |
| `ui/src/components/outcomes/OutcomeCard.tsx` | **EDIT** | Show webhook URL with copy; show regenerate button |
| `ui/src/components/channel-outcomes/ChannelOutcomeForm.tsx` | **EDIT** | Same as OutcomeForm |
| `ui/src/components/channel-outcomes/ChannelOutcomeCard.tsx` | **EDIT** | Same as OutcomeCard |

---

## Security Considerations

1. **Webhook token as auth**: The UUID4 token (122 bits of entropy) is the sole authentication for webhook triggers. This is standard practice (GitHub, Stripe, etc. all use similar URL-based secrets).

2. **No tenant auth on webhook endpoint**: The `/api/webhooks/trigger/{token}` endpoint does NOT require tenant authentication. This is intentional — external systems won't have tenant credentials. The token itself proves authorization.

3. **Rate limiting**: Consider adding rate limiting to the webhook endpoint to prevent abuse. This can be done at the reverse proxy level (nginx/Cloudflare) or via a FastAPI middleware. Not in scope for v1 but recommended.

4. **Token regeneration**: The regenerate endpoint allows users to rotate tokens if one is compromised. The old URL immediately stops working.

5. **HTTPS only**: Webhook URLs should only be served over HTTPS in production to prevent token interception.

---

## Testing Checklist

- [ ] Create employee outcome with `trigger_type: "cron"` — works exactly as before
- [ ] Create employee outcome with `trigger_type: "webhook"` — returns `webhook_url`, no `schedule` or `next_run_at`
- [ ] POST to webhook URL — triggers the outcome, creates a run
- [ ] POST to webhook URL with JSON body — payload is passed to agent as context
- [ ] POST to webhook URL when outcome is disabled — returns 409
- [ ] POST to invalid webhook token — returns 404
- [ ] Regenerate webhook token — old URL stops working, new URL works
- [ ] Update outcome from cron to webhook — clears schedule, generates token
- [ ] Update outcome from webhook to cron — requires schedule, clears token
- [ ] Scheduler ignores webhook outcomes (never picks them up)
- [ ] All of the above for channel outcomes
- [ ] Frontend: trigger type toggle works, schedule hidden for webhook
- [ ] Frontend: webhook URL displayed with copy button
- [ ] Frontend: regenerate URL button works

---

## Implementation Order

Recommended sequence for the coding agent:

1. **Migration + Models** (Steps 1-2) — database first
2. **Schemas** (Step 3) — data contracts
3. **Webhook endpoint** (Step 5) — core new functionality
4. **Update CRUD routes** (Step 4) — create/update logic
5. **Regenerate endpoint** (Step 9) — security feature
6. **Scheduler filter** (Step 6) — prevent double-triggers
7. **CoS MCP Server** (Step 7) — agent-facing tools
8. **Agent payload passthrough** (Step 14) — enhancement
9. **Frontend types** (Step 10) — UI data contracts
10. **Frontend forms** (Step 11) — input UI
11. **Frontend cards + detail pages** (Steps 8, 12) — display UI
12. **Frontend API client** (Step 13) — wire it up
