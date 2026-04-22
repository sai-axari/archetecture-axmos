# Channel-Owned Outcomes — Beta Branch Implementation Plan

## Overview

Add scheduled outcomes to channels so the full agent team (orchestrator + delegated agents) can execute recurring tasks. Today outcomes are employee-owned (single-agent, DM-style). Channel outcomes leverage the existing multi-agent channel infrastructure.

**Core insight:** `handle_channel_thread()` already handles everything — agent teams, streaming, stop signals, cost tracking, message persistence. The channel outcome runner is a thin wrapper that creates scaffolding (Thread, ThreadMessage, run record) and delegates to the existing channel thread handler.

---

## Architecture

```
Scheduler (every 60s)
  │  queries ChannelOutcome where enabled + next_run_at <= now
  │  overlap check: skip if active ChannelOutcomeRun exists
  ▼
NATS publish ──► tenant.{tid}.channel.{cid}.outcome.trigger
  │
  ▼
Agent Processor (new consumer)
  │  creates Thread + ThreadMessage + ChannelOutcomeRun
  │  delegates to handle_channel_thread()
  ▼
Channel Orchestrator (existing)
  │  builds agent team, runs Claude SDK
  │  streams events to tenant.{tid}.channel.{cid}.thread.{tid}.stream
  ▼
Run finalization
  │  reads thread status + orchestrator message
  │  updates ChannelOutcomeRun with status, cost, result
```

**Manual trigger (API):** Creates Thread + ChannelOutcomeRun synchronously in the trigger endpoint, then publishes to `channel.{id}.thread.incoming` (same JetStream path as user-initiated threads). This avoids a separate NATS consumer for triggers and gives immediate UI feedback.

---

## Files to Create (7 new files)

### 1. `backend/channel_outcomes/models.py` — Database Models

**ChannelOutcome** table:
```python
class ChannelOutcome(TenantMixin, SoftDeleteMixin, Base):
    __tablename__ = "channel_outcomes"

    id: UUID PK
    channel_id: UUID FK → channels.id CASCADE
    description: Text, not null
    expected_output: Text, nullable
    schedule: String(100), not null  # cron expression
    enabled: Boolean, default True
    last_run_at: DateTime, nullable
    next_run_at: DateTime, nullable
    created_at, updated_at: timestamps
```

**ChannelOutcomeRun** table (immutable, no soft delete):
```python
class ChannelOutcomeRun(Base):
    __tablename__ = "channel_outcome_runs"

    id: UUID PK
    channel_outcome_id: UUID FK → channel_outcomes.id CASCADE
    channel_id: UUID FK → channels.id CASCADE  # denormalized for queries
    thread_id: UUID FK → threads.id SET NULL, nullable  # links to execution thread
    status: String(50)  # running, success, error, stopped
    result: Text, nullable  # orchestrator's final response
    cost_usd: Numeric(10,4), nullable
    duration_seconds: Integer, nullable
    extra_data: JSONB, nullable
    started_at, completed_at: timestamps
```

**Notes:**
- No `employee_id` — cost attribution is per-member inside channel_runner
- No `budget_per_run_usd` — budget system is disabled
- `thread_id` links each run to its channel thread for viewing execution details
- Follow existing model patterns: `TenantMixin` on ChannelOutcome, not on Run

### 2. `backend/channel_outcomes/schemas.py` — Pydantic Schemas

```python
class ChannelOutcomeCreate(BaseModel):
    description: str
    expected_output: str | None = None
    schedule: str  # cron expression
    enabled: bool = True

class ChannelOutcomeUpdate(BaseModel):
    description: str | None = None
    expected_output: str | None = None
    schedule: str | None = None
    enabled: bool | None = None

class ChannelOutcomeResponse(BaseModel):
    id, channel_id, description, expected_output, schedule
    enabled, last_run_at, next_run_at, created_at, updated_at

class ChannelOutcomeRunResponse(BaseModel):
    id, channel_outcome_id, channel_id, thread_id
    status, result, cost_usd, duration_seconds
    extra_data, started_at, completed_at
```

### 3. `backend/channel_outcomes/service.py` — Business Logic

```python
class ChannelOutcomeService:
    def __init__(self, uow: UnitOfWork):
        ...

    async def create(self, channel_id, data, user_ctx) -> ChannelOutcome
        # Validate channel exists + belongs to tenant
        # Validate cron expression with croniter.is_valid()
        # Compute next_run_at if enabled
        # Create and return ChannelOutcome

    async def list(self, channel_id, user_ctx) -> list[ChannelOutcome]
    async def get(self, channel_id, outcome_id, user_ctx) -> ChannelOutcome
    async def update(self, channel_id, outcome_id, data, user_ctx) -> ChannelOutcome
        # Recompute next_run_at on schedule/enabled change
    async def delete(self, channel_id, outcome_id, user_ctx) -> None
    async def list_runs(self, channel_id, outcome_id, limit, user_ctx) -> list[ChannelOutcomeRun]
        # Sync run status from thread status for any "running" runs
        # (see "Run Status Sync" section below)
```

### 4. `backend/channel_outcomes/routes.py` — API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/channels/{channel_id}/outcomes` | Create outcome |
| GET | `/api/channels/{channel_id}/outcomes` | List outcomes |
| GET | `/api/channels/{channel_id}/outcomes/{id}` | Get single |
| PUT | `/api/channels/{channel_id}/outcomes/{id}` | Update |
| DELETE | `/api/channels/{channel_id}/outcomes/{id}` | Delete |
| GET | `/api/channels/{channel_id}/outcomes/{id}/runs` | List runs |
| POST | `/api/channels/{channel_id}/outcomes/{id}/trigger` | Manual trigger |

**Trigger endpoint (critical — this is the path that makes execution work):**
```python
async def trigger_channel_outcome(...):
    # 1. Validate channel + outcome
    # 2. Create ChannelOutcomeRun (status="running")
    # 3. Create Thread (title="[Outcome] {description[:60]}", status=THREAD_ACTIVE)
    # 4. Create ThreadMessage (sender_type="system", content=prompt)
    # 5. Link run.thread_id = thread.id
    # 6. Publish to channel_thread_incoming_subject (JetStream)
    #    - Same path as user-initiated threads
    #    - Picked up by existing channel processor
    # 7. Return {status: "triggered", thread_id, run_id}
```

**Why this approach:** Publishing to `channel.incoming` (JetStream) reuses the existing channel processor. No need for a separate NATS consumer for manual triggers. The scheduler uses its own NATS subject for automated triggers.

### 5. `backend/channel_outcomes/__init__.py` — Module init

Register the router in the main app.

### 6. `backend/agent/orchestration/channel_outcome.py` — Runner

```python
async def handle_channel_outcome(
    channel_outcome_id: uuid.UUID,
    channel_id: uuid.UUID,
    description: str,
    expected_output: str | None,
    nc: NATSClient,
    kv: KeyValue,
    tenant_id: str | None = None,
) -> None:
```

**Flow:**
1. Validate channel + tenant (via internal sandbox ops)
2. Create `ChannelOutcomeRun` (status="running")
3. Create `Thread` (title=`[Outcome] {description[:60]}`, status=THREAD_ACTIVE)
4. Create `ThreadMessage` (sender_type="system", content=scheduled task prompt)
5. Link run to thread
6. Build prompt: "You have a scheduled task.\n\nGoal: {description}\n\nExpected output: {expected_output}\n\nWork through this task using your team."
7. Call `handle_channel_thread(channel_id, thread_id, prompt, message_id, nc, kv, tenant_id=tenant_id)`
8. After return: query Thread.status + orchestrator ThreadMessage
9. Map thread status to run status (completed→success, stopped→stopped, else→error)
10. If thread still "active" after return (early exit from 0-member/error), mark run as "error"
11. Update ChannelOutcomeRun (status, cost, duration, result)

### 7. Alembic Migration

```python
# Create channel_outcomes table
# Create channel_outcome_runs table
# Add indexes on channel_id, channel_outcome_id
```

Follow the existing migration pattern in `backend/alembic/versions/`.

---

## Files to Modify (6 files)

### 8. `backend/shared/constants.py` — NATS Subjects

Add after existing outcome constants:
```python
SPEND_CHANNEL_OUTCOME = "channel_outcome"

def channel_outcome_trigger_subject(tenant_id: str, channel_id: str) -> str:
    return f"tenant.{tenant_id}.channel.{channel_id}.outcome.trigger"
```

**Note:** Beta uses tenant-scoped NATS subjects (`tenant.{tid}.channel.{cid}...`), unlike main which uses flat subjects. Follow the beta pattern.

### 9. `backend/agent/scheduler.py` — Add Channel Outcome Scheduling

After the existing employee outcome loop, add:
```python
# --- Channel Outcomes ---
# Query ChannelOutcome joined with Channel for tenant_id
# WHERE enabled=True AND next_run_at <= now
# For each:
#   Overlap check: skip if ChannelOutcomeRun with status="running" exists
#   Publish to channel_outcome_trigger_subject(tenant_id, channel_id)
#   Advance last_run_at and next_run_at
```

**No employee busy check** — channels don't have a single-employee busy concept.
**No budget gate** — budget system is disabled.

### 10. `backend/agent/main.py` — Add NATS Consumer

Add a new consumer for channel outcome triggers:
```python
# In CONSUMERS list or as a plain NATS subscription:
# Subject: "tenant.*.channel.*.outcome.trigger"
# Handler: calls handle_channel_outcome()
```

**Decision point:** Use plain NATS subscription (like employee outcome triggers on beta) or add to JetStream CONSUMERS list. Recommend plain NATS for consistency with how employee outcome triggers work.

### 11. `backend/agent/processors/channel_outcome_processor.py` — New Processor (optional)

If using the processor pattern (like `channel_processor.py`):
```python
async def process_channel_outcome_triggers(msg, nc, kv):
    payload = json.loads(msg.data.decode())
    await handle_channel_outcome(
        channel_outcome_id=payload["channel_outcome_id"],
        channel_id=payload["channel_id"],
        ...
    )
```

### 12. Register Router in App

In the main FastAPI app file, add:
```python
from backend.channel_outcomes.routes import router as channel_outcomes_router
app.include_router(channel_outcomes_router)
```

---

## Frontend Changes (5 files)

### 13. `ui/src/types/channel_outcome.ts` — TypeScript Types

```typescript
export interface ChannelOutcome {
  id: string;
  channel_id: string;
  description: string;
  expected_output: string | null;
  schedule: string;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChannelOutcomeCreate {
  description: string;
  expected_output?: string;
  schedule: string;
  enabled?: boolean;
}

export interface ChannelOutcomeRun {
  id: string;
  channel_outcome_id: string;
  channel_id: string;
  thread_id: string | null;
  status: string;
  result: string | null;
  cost_usd: string | null;
  duration_seconds: number | null;
  extra_data: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
}
```

### 14. `ui/src/services/channelOutcomeService.ts` — RTK Query Endpoints

Follow the pattern from `outcomeService.ts`:
```typescript
// Endpoints:
getChannelOutcomes(channelId)
createChannelOutcome(channelId, data)
updateChannelOutcome(channelId, outcomeId, data)
deleteChannelOutcome(channelId, outcomeId)
getChannelOutcomeRuns(channelId, outcomeId)
triggerChannelOutcome(channelId, outcomeId)
  // Returns { status, thread_id, run_id }
  // On success: navigate to /channels/{channelId}/threads/{thread_id}
```

### 15. Channel Detail Page — Add Outcomes Tab

The channel detail page needs three tabs: **Threads | Outcomes | Settings**

**Outcomes tab** has two sub-tabs:
- **Runs** (default): Lists all outcome runs across all outcomes, sorted by most recent. Each run is a clickable row that links to `/channels/{channelId}/threads/{run.thread_id}`. Shows: outcome description, status icon, duration, cost, 2-line result preview.
- **Configure**: Manage outcome definitions. Create new, edit, enable/disable, run now, delete. Each outcome shown as a compact card with inline actions.

**Thread filtering:** The Threads tab should filter out `[Outcome]` prefixed threads (they're visible from the Outcomes → Runs tab instead).

### 16. `ChannelOutcomeForm` Component

Same fields as existing `OutcomeForm.tsx`:
- Description (textarea, required)
- Expected Output (text input, optional)
- Schedule (dropdown with presets + custom cron input)
- Enabled toggle

### 17. Thread View — Back Button

Add an `ArrowLeft` back button in the thread header that calls `router.back()`. This way, navigating from Outcomes → Thread → Back returns to the Outcomes tab.

---

## Run Status Sync

**Problem:** The trigger API creates the run with `status="running"`. The channel runner executes the thread but doesn't know about `ChannelOutcomeRun`. After the thread completes, the run stays "running" forever.

**Solution:** Lazy sync in the `list_runs` endpoint:
```python
for run in runs:
    if run.status == "running" and run.thread_id:
        thread = await db.get(Thread, run.thread_id)
        if thread and thread.status != "active":
            run.status = {"completed": "success", "stopped": "stopped"}.get(thread.status, "error")
            run.completed_at = thread.updated_at
            # Extract result from orchestrator ThreadMessage
            orch_msg = query ThreadMessage where thread_id and sender_type="orchestrator"
            if orch_msg:
                run.result = orch_msg.content
                run.cost_usd = orch_msg.extra_data.get("cost_usd")
            await db.commit()
```

This approach avoids coupling the channel runner to outcome knowledge.

---

## Edge Cases

| Case | Handling |
|------|----------|
| Channel has 0 members when outcome fires | channel_runner publishes error event, returns early. Runner detects thread still "active" → marks run as "error" |
| Cron fires while previous run still active | Scheduler overlap check skips (ChannelOutcomeRun status="running") |
| Channel membership changes between runs | channel_runner dynamically loads members each time — works naturally |
| Channel deleted while outcome exists | CASCADE delete on channel_outcomes FK removes outcomes + runs |
| Manual trigger (Run Now) | Creates thread synchronously via API, publishes to channel.incoming JetStream. User navigated to live thread view immediately |

---

## Implementation Order

```
Phase 1: Data Layer
  ├── models.py (ChannelOutcome + ChannelOutcomeRun)
  ├── schemas.py (Create, Update, Response)
  ├── migration (create tables + indexes)
  └── constants.py (NATS subjects)

Phase 2: Backend Logic
  ├── service.py (CRUD + run status sync)
  ├── routes.py (API endpoints + trigger)
  ├── channel_outcome.py (orchestration runner)
  └── Register router in app

Phase 3: Wiring
  ├── scheduler.py (add channel outcome query)
  ├── main.py (add NATS consumer)
  └── processors/ (if needed)

Phase 4: Frontend
  ├── types (ChannelOutcome, ChannelOutcomeRun)
  ├── service (RTK Query endpoints)
  ├── Channel page (Outcomes tab with Runs + Configure)
  ├── ChannelOutcomeForm component
  └── Thread view back button
```

---

## Lessons Learned from Main Implementation

These issues were encountered during the main branch implementation and should be avoided:

1. **Import errors:** When removing fields (e.g., `budget_per_run_usd`), ensure all type references (`Decimal`, `Numeric`) are still imported if other fields use them (e.g., `cost_usd`).

2. **NATS subject mismatch:** The trigger must use the same path that the consumer listens on. For manual triggers, publishing to `channel.incoming` (JetStream) is more reliable than a separate core NATS subject, because JetStream has guaranteed delivery.

3. **Run status never updates:** The channel runner doesn't know about `ChannelOutcomeRun`, so it can't update the status. Use lazy sync in the list endpoint (check thread status when listing runs).

4. **Page loading blocks:** If the outcomes API fails (e.g., migration not run), `Promise.all` in the page load rejects and the page shows an infinite spinner. Always add `.catch(() => [])` to the outcomes fetch.

5. **File state conflicts:** When cherry-picking across branches, verify all files match the target branch's patterns (imports, function signatures, middleware).

6. **Agent tools:** Don't explicitly set `agent_def.tools` on channel sub-agents. Leaving it unset lets the SDK give agents access to all available tools including MCP integrations. Setting it explicitly restricts them and MCP server keys aren't valid individual tool names.

---

## Verification Checklist

- [ ] Migration runs cleanly (`alembic upgrade head`)
- [ ] All models import without errors (`from backend.channel_outcomes.models import *`)
- [ ] All API routes register (`grep outcome app.routes`)
- [ ] Create outcome via API/UI — appears in list
- [ ] Manual trigger — creates thread, navigates to it, agents execute
- [ ] Scheduler triggers — run appears in Runs tab within 60s
- [ ] Run status syncs — shows "success" after thread completes
- [ ] Overlap guard — scheduler skips if run is active
- [ ] Back button — returns to previous page (Outcomes tab)
- [ ] `[Outcome]` threads hidden from Threads tab
- [ ] Channel deletion cascades to outcomes + runs
