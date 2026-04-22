# Today + AutoTask — Implementation Plan

## Status: DRAFT / Brainstorming

---

## Overview

"Today" is a new top-level feature in Axari that gives users a centralised view of actionable tasks extracted from all agent sessions and outcomes. A background worker (AutoTask) periodically scans recent sessions/threads, uses an LLM to extract discrete actionable items, and writes them to the database. The frontend renders these in a dedicated "Today" page with list and kanban views, task detail panels, comments, and a "Send to Agent" action that dispatches work back into the existing session/channel system.

---

## Architecture Decisions & Pushback on the AutoTask Doc

Before diving into implementation, several design choices in the original AutoTask concept doc conflict with the existing codebase patterns. This plan diverges where alignment with the codebase matters more than conceptual purity.

### 1. No Separate Service

**Doc says:** Build a standalone extractor in `extractor/` with its own CLI entry point and SDK fork pattern.

**This plan says:** No. The codebase already has an `agent/` worker with NATS subscriptions and a scheduler (`agent/scheduler.py`). AutoTask extraction should be a new scheduled job within the existing agent worker, triggered by the same scheduler infrastructure that runs outcomes. This avoids a new deployment target, a new process to monitor, and duplicated DB connection logic.

**Implementation:** Add an `agent/autotask_runner.py` module and register it in the scheduler tick loop.

### 2. No Separate Session Registry

**Doc says:** Create a `sessions` table to register sessions known to the system, with an `external_id` and `source` column.

**This plan says:** Sessions already exist as `session` and `thread` tables with full message history. We don't need a shadow registry. The extraction state tracker just needs to reference existing session/thread IDs directly.

### 3. No YAML Config for Task Types (v1)

**Doc says:** Task types live in a YAML config that gets loaded at startup.

**This plan says:** The codebase uses Pydantic Settings (`shared/config.py`) for configuration and Python dataclasses/enums for structured data. For v1, task types should be defined as a Python module (`shared/autotask_types.py`) with dataclasses. This keeps type safety, IDE autocomplete, and avoids adding a YAML parser dependency. If we want user-configurable task types later (v2), we can move them to a DB table with a UI editor — which is far more useful than a YAML file nobody touches after initial setup.

### 4. No Embedding-Based Semantic Dedupe (v1)

**Doc says:** Embed candidate task titles and cosine-similarity match against existing tasks (pgvector, threshold 0.85).

**This plan says:** Defer to v2. For v1, dedupe via exact match on `(type, normalized_title_hash)` plus an LLM-assisted merge check in the extraction prompt itself — instruct the model to check existing open tasks before creating new ones. Adding pgvector changes the deployment requirements (PostgreSQL extension) and the embedding pipeline is a separate cost center. Not worth it until we see real duplicate volume.

### 5. No Resolution Pass (v1)

**Doc says:** Run a second LLM pass to detect task completions from conversation content.

**This plan says:** Defer to v2. For v1, status transitions are manual — the user marks tasks done when they're satisfied. Automatic resolution detection is a nice-to-have but doubles LLM cost per extraction run and introduces false-positive risk.

### 6. No Filesystem Lock — Use PostgreSQL Advisory Locks

**Doc says:** `extraction_lock` table with hostname/pid.

**This plan says:** Use PostgreSQL `pg_advisory_xact_lock()` which is transactional, automatic, and doesn't require cleanup after crashes. One line of SQL vs. a whole lock management subsystem.

### 7. Simplified Chunking

**Doc says:** Split unprocessed turns into chunks by conversation boundaries (user-agent-user triads, or every ~8 turns).

**This plan says:** For v1, send the full relevant message window per session (messages from last 24h, capped at ~100 messages). Most sessions won't hit this limit. If a session has 500 messages in 24h, that's an edge case we can handle in v2 with proper chunking. The prompt already includes task type definitions — we don't need to multiply LLM calls per session.

### 8. Task Types — Adjusted for This Platform

The original doc's task types are generic. For Axari (a platform where AI employees do work), the types should reflect the actual work patterns:

- **Follow-up**: Something from a session that needs human attention later
- **Investigation**: An unresolved question or unexplained behavior
- **Action Item**: A concrete task the user or agent committed to but didn't finish
- **Decision Pending**: A choice raised but not resolved
- **Escalation**: Something an agent flagged as needing human judgment

We drop `code_todo` (too narrow for a general agent platform) and `communication` (better handled by the agent itself). We add `escalation` which maps to the agent-human handoff pattern this platform naturally produces.

---

## Part 1: Database Schema

### New Tables

All new tables follow existing conventions: UUID primary keys, `created_at`/`updated_at` timestamps, `tenant_id` where applicable, cascade deletes.

#### `auto_task` — The core task record

```sql
CREATE TABLE auto_task (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,

    -- Task identity
    type VARCHAR(50) NOT NULL,           -- 'follow_up', 'investigation', 'action_item', 'decision_pending', 'escalation'
    title VARCHAR(255) NOT NULL,
    title_hash VARCHAR(64) NOT NULL,     -- SHA-256 of normalized title, for exact-match dedupe

    -- Task detail
    description TEXT,                     -- Longer explanation from the LLM
    fields JSONB DEFAULT '{}',           -- Per-type structured data (matches type schema)
    source_quote TEXT,                    -- Verbatim span from transcript that justified extraction

    -- Classification
    status VARCHAR(50) NOT NULL DEFAULT 'open',     -- 'open', 'in_progress', 'done', 'dropped'
    priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'
    confidence VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'

    -- Dates
    due_date TIMESTAMP WITH TIME ZONE,    -- Optional deadline
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Agent linkage (for "Send to Agent" feature)
    assigned_employee_id UUID REFERENCES employee(id) ON DELETE SET NULL,
    assigned_session_id UUID REFERENCES session(id) ON DELETE SET NULL,
    assigned_channel_id UUID REFERENCES channel(id) ON DELETE SET NULL,
    assigned_thread_id UUID REFERENCES thread(id) ON DELETE SET NULL
);

CREATE INDEX idx_auto_task_tenant ON auto_task(tenant_id);
CREATE INDEX idx_auto_task_status ON auto_task(tenant_id, status);
CREATE INDEX idx_auto_task_type ON auto_task(tenant_id, type);
CREATE INDEX idx_auto_task_dedupe ON auto_task(tenant_id, type, title_hash) WHERE status IN ('open', 'in_progress');
CREATE INDEX idx_auto_task_due ON auto_task(tenant_id, due_date) WHERE due_date IS NOT NULL;
```

#### `auto_task_source` — Links tasks back to their origin sessions/threads

```sql
CREATE TABLE auto_task_source (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES auto_task(id) ON DELETE CASCADE,

    -- Polymorphic source: either a DM session or a channel thread
    session_id UUID REFERENCES session(id) ON DELETE SET NULL,
    thread_id UUID REFERENCES thread(id) ON DELETE SET NULL,

    -- Context
    employee_id UUID REFERENCES employee(id) ON DELETE SET NULL,
    source_quote TEXT,                    -- The quote from this specific source
    turn_range_start INTEGER,
    turn_range_end INTEGER,

    first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_source_type CHECK (
        (session_id IS NOT NULL AND thread_id IS NULL) OR
        (session_id IS NULL AND thread_id IS NOT NULL)
    )
);

CREATE INDEX idx_auto_task_source_task ON auto_task_source(task_id);
CREATE INDEX idx_auto_task_source_session ON auto_task_source(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_auto_task_source_thread ON auto_task_source(thread_id) WHERE thread_id IS NOT NULL;
```

#### `auto_task_comment` — Comments on tasks (user notes, status change log)

```sql
CREATE TABLE auto_task_comment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES auto_task(id) ON DELETE CASCADE,
    author_type VARCHAR(20) NOT NULL,    -- 'user', 'system', 'agent'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auto_task_comment_task ON auto_task_comment(task_id);
```

#### `extraction_run` — Audit log for extraction runs

```sql
CREATE TABLE extraction_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    trigger VARCHAR(50) NOT NULL,         -- 'scheduled', 'manual'
    status VARCHAR(50) NOT NULL DEFAULT 'running',  -- 'running', 'completed', 'failed'
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    sessions_scanned INTEGER DEFAULT 0,
    threads_scanned INTEGER DEFAULT 0,
    tasks_created INTEGER DEFAULT 0,
    tasks_merged INTEGER DEFAULT 0,
    tasks_skipped INTEGER DEFAULT 0,
    error TEXT,
    config JSONB                           -- Snapshot of extraction config used
);

CREATE INDEX idx_extraction_run_tenant ON extraction_run(tenant_id);
```

#### `extraction_bookmark` — Tracks what has been processed per session/thread

```sql
CREATE TABLE extraction_bookmark (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,

    -- Polymorphic: tracks either session or thread
    session_id UUID REFERENCES session(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES thread(id) ON DELETE CASCADE,

    last_extracted_message_id UUID,        -- ID of last message processed
    last_extracted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    task_count INTEGER DEFAULT 0,

    CONSTRAINT chk_bookmark_type CHECK (
        (session_id IS NOT NULL AND thread_id IS NULL) OR
        (session_id IS NULL AND thread_id IS NOT NULL)
    ),
    CONSTRAINT uq_bookmark_session UNIQUE (session_id),
    CONSTRAINT uq_bookmark_thread UNIQUE (thread_id)
);
```

### Migration

Create a new Alembic migration `019_add_autotask.py` that:
1. Creates all four tables above
2. Adds the indexes
3. Adds the constraints

**Files to create:**
- `db/alembic/versions/019_add_autotask.py`

**Files to modify:**
- None (pure additive schema change)

---

## Part 2: Shared Models & Schemas

### SQLAlchemy Models

Create `shared/models/auto_task.py` containing:
- `AutoTask` model
- `AutoTaskSource` model
- `AutoTaskComment` model
- `ExtractionRun` model
- `ExtractionBookmark` model

Follow existing conventions:
- UUID primary keys via `Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)`
- Timestamps with `server_default=func.now()`
- Relationships defined with `relationship()` and `back_populates`
- Consistent with `shared/models/outcome.py` and `shared/models/human_todo.py` patterns

Register models in `shared/models/__init__.py`.

### Pydantic Schemas

Create `shared/schemas/auto_task.py` containing:
- `AutoTaskCreate` — for manual task creation (title, type, description, priority, due_date)
- `AutoTaskUpdate` — for status changes, priority changes, assignment changes (all fields optional)
- `AutoTaskResponse` — full response including sources, employee name, session/channel info
- `AutoTaskCommentCreate` — content only
- `AutoTaskCommentResponse` — full comment with author
- `AutoTaskListResponse` — paginated list with summary counts per status
- `ExtractionRunResponse` — audit log entry

### Task Type Definitions

Create `shared/autotask_types.py`:
- A Python dataclass `TaskTypeDefinition` with: `id`, `name`, `description`, `extraction_hints: list[str]`, `field_schema: dict`, `default_priority`, `target`
- A `TASK_TYPES` dict mapping type ID to `TaskTypeDefinition`
- A function `get_extraction_prompt_section()` that renders all task types into a prompt-ready string
- The five types: `follow_up`, `investigation`, `action_item`, `decision_pending`, `escalation`

Why a Python module and not YAML: the codebase has zero YAML parsing dependencies. Adding one for a config file that changes once a quarter is over-engineering. If we want runtime-configurable types later, a DB table with admin UI is strictly better than YAML anyway.

**Files to create:**
- `shared/models/auto_task.py`
- `shared/schemas/auto_task.py`
- `shared/autotask_types.py`

**Files to modify:**
- `shared/models/__init__.py` (register new models)

---

## Part 3: AutoTask Extraction Worker

This is the background job that reads sessions/threads, extracts tasks, and writes them to the DB.

### Integration Point: `agent/scheduler.py`

The existing scheduler runs every 60 seconds and checks for due outcomes. We add a new check in the same tick loop for AutoTask extraction.

**Trigger logic:**
- Check if enough time has passed since last successful extraction run for this tenant (configurable, default: 6 hours, but start with a manual trigger + a configurable cron-like schedule per tenant)
- For v1: The extraction runs on a simple schedule (e.g., every morning at 8am, or every 6 hours). The scheduler checks `extraction_run` for the latest completed run per tenant and triggers if the interval has elapsed.
- The scheduler publishes a trigger message to a new NATS subject: `tenant.{tenant_id}.autotask.trigger`

### New Module: `agent/autotask_runner.py`

This is the main extraction pipeline. Here's the step-by-step flow:

#### Step 1: Acquire Lock

```python
# Use PostgreSQL advisory lock based on tenant_id hash
await db.execute(text("SELECT pg_advisory_xact_lock(:lock_id)"), {"lock_id": hash(tenant_id) % (2**31)})
```

If another extraction is already running for this tenant, the `SELECT` blocks until it finishes (or we use `pg_try_advisory_xact_lock` to skip if busy).

#### Step 2: Create Extraction Run Record

Insert into `extraction_run` with status='running'. This gives us an audit trail.

#### Step 3: Find Sessions/Threads with Recent Activity

Query the database for:

**DM Sessions:**
```sql
SELECT s.id, s.employee_id, e.name as employee_name, e.tenant_id
FROM session s
JOIN employee e ON s.employee_id = e.id
WHERE e.tenant_id = :tenant_id
AND s.id IN (
    SELECT DISTINCT session_id FROM message
    WHERE created_at > NOW() - INTERVAL ':hours hours'
)
```

**Channel Threads:**
```sql
SELECT t.id, t.channel_id, c.name as channel_name, c.tenant_id
FROM thread t
JOIN channel c ON t.channel_id = c.id
WHERE c.tenant_id = :tenant_id
AND t.id IN (
    SELECT DISTINCT thread_id FROM thread_message
    WHERE created_at > NOW() - INTERVAL ':hours hours'
)
```

The lookback window is configurable (default: 24 hours). This captures both new sessions and ongoing ones.

#### Step 4: For Each Session/Thread, Fetch Unprocessed Messages

Check `extraction_bookmark` for each session/thread:
- If bookmark exists: fetch messages after `last_extracted_message_id`
- If no bookmark: fetch all messages from the lookback window

Cap at 100 messages per session to keep prompt size manageable. If more than 100, take the most recent 100 — the older ones will have been processed in a previous run (or will be caught by the bookmark next time).

#### Step 5: Build Extraction Prompt

For each session/thread with unprocessed messages, construct a prompt that includes:

1. **System context:** "You are a task extraction system. Your job is to identify discrete, actionable, unresolved items from conversation transcripts."
2. **Task type definitions:** Rendered from `shared/autotask_types.py` — each type with its description, extraction hints, and field schema
3. **Existing open tasks:** Query current open/in-progress tasks for this tenant, so the LLM can avoid duplicates
4. **The transcript:** Messages formatted as `[timestamp] sender_type: content`
5. **Output format:** Structured JSON schema for the response

The prompt explicitly instructs:
- Do NOT extract items that were resolved in the same conversation
- Do NOT extract vague topics — only discrete actionable items
- Check the existing open tasks list before creating duplicates
- Include the source_quote (verbatim text that justifies extraction)
- Assign confidence: high (explicit commitment), medium (implied action), low (speculative)

#### Step 6: Call LLM for Extraction

Use the Anthropic API directly (not the Claude Agent SDK — we don't need tool use here, just structured output).

```python
response = await anthropic_client.messages.create(
    model="claude-sonnet-4-20250514",  # Use Sonnet for cost efficiency on extraction
    max_tokens=4096,
    messages=[{"role": "user", "content": extraction_prompt}],
    # Use response_format or tool_use for structured output
)
```

Parse the response into a list of candidate tasks.

#### Step 7: Deduplicate & Insert

For each candidate task:
1. Compute `title_hash = sha256(normalize(title))` where normalize = lowercase + strip whitespace + remove punctuation
2. Check if an open task with same `(tenant_id, type, title_hash)` exists
3. If yes: add a new `auto_task_source` row linking to this session/thread, skip task creation, increment `tasks_merged`
4. If no: insert new `auto_task` row + `auto_task_source` row, increment `tasks_created`
5. All tasks are inserted with status='open' regardless of confidence. Confidence is stored as a display-only field (shown as a badge in the UI).

#### Step 8: Update Bookmarks

For each processed session/thread:
- Upsert `extraction_bookmark` with `last_extracted_message_id` = ID of the last message we processed
- Set `last_extracted_at = now()`

#### Step 9: Finalize Extraction Run

Update the `extraction_run` record:
- `status = 'completed'` (or 'failed' if error)
- `ended_at = now()`
- `sessions_scanned`, `threads_scanned`, `tasks_created`, `tasks_merged`, `tasks_skipped` counts

### Cost Considerations

Each extraction run calls the LLM once per session/thread with unprocessed messages. For a tenant with 20 active sessions, that's 20 API calls per run. At Sonnet pricing, this is very affordable (~$0.01-0.05 per session depending on message volume). Running every 6 hours = ~$1-5/day per active tenant. We should log costs in the extraction run record and surface them in the UI.

### Error Handling

- If LLM call fails for one session, log the error and continue to the next. Don't abort the whole run.
- If the whole run fails, set `extraction_run.status = 'failed'` and `extraction_run.error = traceback`.
- Bookmark is only updated for sessions that were successfully processed.
- Advisory lock is released automatically when the transaction commits or rolls back.

**Files to create:**
- `agent/autotask_runner.py`
- `agent/autotask_prompt.py` (prompt construction, kept separate for readability)

**Files to modify:**
- `agent/scheduler.py` (add autotask trigger check to the tick loop)
- `agent/main.py` (add NATS subscription for `tenant.*.autotask.trigger`, add handler)
- `shared/constants.py` (add new NATS subjects, status constants)
- `shared/config.py` (add autotask config: `AUTOTASK_LOOKBACK_HOURS`, `AUTOTASK_INTERVAL_HOURS`, `AUTOTASK_EXTRACTION_MODEL`)

---

## Part 4: API Endpoints

Create `api/routers/auto_tasks.py` with the following endpoints:

### Task CRUD

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tasks/today` | List all tasks for the authenticated tenant. Query params: `status`, `type`, `priority`, `employee_id`, `search`, `sort_by`, `sort_order`. Returns `AutoTaskListResponse` with tasks + summary counts. |
| `GET` | `/api/tasks/today/{task_id}` | Get a single task with its sources and comments. |
| `POST` | `/api/tasks/today` | Create a task manually (user-created, not from extraction). |
| `PUT` | `/api/tasks/today/{task_id}` | Update task fields: status, priority, due_date, title, description. |
| `DELETE` | `/api/tasks/today/{task_id}` | Delete a task. |

### Status Transitions

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/tasks/today/{task_id}/status` | Change task status. Body: `{ status: "in_progress" | "done" | "dropped" }`. Auto-sets `completed_at` when moving to `done`. Creates a system comment logging the transition. |

### Comments

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tasks/today/{task_id}/comments` | List comments for a task. |
| `POST` | `/api/tasks/today/{task_id}/comments` | Add a comment. Body: `{ content: string }`. |

### Send to Agent

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/tasks/today/{task_id}/send-to-agent` | Dispatch this task to an agent for processing. Body: `{ employee_id: UUID, channel_id?: UUID }`. |

**Send to Agent flow:**

"Send to Agent" is pure message dispatch — take the task title/description, create a session or thread, send it as a message, and give the user a link. No completion tracking, no callbacks. The user marks the task done manually whenever they're satisfied.

1. Validate the task exists and belongs to the tenant
2. Validate the employee exists and belongs to the tenant
3. **If `channel_id` is provided (channel mode):**
   - Create a new thread in the channel with title = task title
   - Create a ThreadMessage with the task description + any additional context the user provided
   - Publish to `channel.{channel_id}.thread.incoming` via NATS JetStream
   - Store `auto_task.assigned_channel_id` and `auto_task.assigned_thread_id` so the UI can link back
4. **If no `channel_id` (DM mode):**
   - Create a new session for the employee with title = task title
   - Create a Message with the task description + any additional context
   - Publish to `employee.{employee_id}.dm.incoming` via NATS JetStream
   - Store `auto_task.assigned_employee_id` and `auto_task.assigned_session_id` so the UI can link back
5. Create a system comment: "Sent to agent {employee_name}" or "Sent to channel {channel_name}"
6. Return the session/thread ID for the UI to render a clickable link

This reuses the exact same NATS publish pattern as `api/routers/sessions.py` (line 185+) — no new infrastructure needed. The task status does NOT auto-change to "in_progress" — the user controls that.

### Extraction Control

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/tasks/today/extract` | Trigger a manual extraction run. Returns the extraction_run ID. |
| `GET` | `/api/tasks/today/extract/history` | List past extraction runs (audit log). |

### Summary / Stats

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tasks/today/summary` | Returns counts by status, type, and priority. Used for dashboard badges and sidebar count. |

**Files to create:**
- `api/routers/auto_tasks.py`

**Files to modify:**
- `api/main.py` (register new router)

---

## Part 5: Frontend — Today Page

### 5A: Sidebar Entry

**File to modify:** `ui/src/components/layout/Sidebar.tsx`

Add a new link **above** the Channels section, after the Create buttons:

```tsx
{/* Today - above channels */}
<Link
  href="/today"
  className={`flex items-center gap-2 px-2 py-1.5 mx-3 text-sm transition-colors ${
    pathname === "/today" || pathname.startsWith("/today/")
      ? "bg-neutral-800 text-white"
      : "text-neutral-400 hover:text-white hover:bg-neutral-900"
  }`}
>
  <CalendarDays className="w-3.5 h-3.5" />
  Today
  {taskCount > 0 && (
    <span className="ml-auto text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 min-w-[18px] text-center">
      {taskCount}
    </span>
  )}
</Link>
```

The `taskCount` comes from a lightweight API call (`/api/tasks/today/summary`) that returns the count of open tasks. This should be fetched on sidebar mount and refreshed periodically (every 60s or on navigation).

Position: Between the Create buttons (New Employee / New Channel) and the Channels section. This gives "Today" prime real estate as the daily starting point.

### 5B: Today Page — Main View

**File to create:** `ui/src/app/today/page.tsx`

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Header                                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ "Today" title        [+ New Task]  [Run Extraction]     │ │
│ │ Summary: 5 open · 3 in progress · 12 done              │ │
│ │                                                         │ │
│ │ Filters: [Type ▼] [Priority ▼] [Status ▼] [Search...] │ │
│ │                                                         │ │
│ │ View: [List | Kanban]                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ Content (scrollable)                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                                                         │ │
│ │  (List View or Kanban View based on toggle)             │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Header bar features:**
- Title: "Today" with CalendarDays icon
- "New Task" button: opens a modal to create a task manually
- "Run Extraction" button: triggers `/api/tasks/today/extract`, shows spinner while running
- Summary counts: open, in_progress, done (fetched from `/api/tasks/today/summary`)
- Filter row: dropdowns for type, priority, status + text search input (debounced 250ms)
- View toggle: List | Kanban (persisted in localStorage)

### 5C: List View

**Component:** `ui/src/components/today/TaskListView.tsx`

A table/list showing all tasks matching current filters. Each row:

```
┌──────────────────────────────────────────────────────────────────┐
│ ○ Follow-up · High                                   2h ago     │
│ Review the SNS subscription configuration for prod   Due: Apr 20│
│ Source: @SecurityBot · Session: "AWS audit findings"             │
│ Status: open                        [Send to Agent] [···]       │
└──────────────────────────────────────────────────────────────────┘
```

Each row shows:
- Type badge (colored pill)
- Priority indicator (icon or color)
- Title (clickable — opens detail panel)
- Created time (relative: "2h ago")
- Due date (if set)
- Source employee name + session/thread link
- Status badge
- Quick actions: "Send to Agent" button, overflow menu (change priority, delete)

Clicking a row navigates to `/today/{task_id}` or opens a slide-over panel (recommended: slide-over panel to keep context).

### 5D: Kanban View

**Component:** `ui/src/components/today/TaskKanbanView.tsx`

Three columns corresponding to statuses:

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Open (5)   │ │ In Progress  │ │   Done (12)  │
│              │ │    (3)       │ │              │
│ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │
│ │ Task Card│ │ │ │ Task Card│ │ │ │ Task Card│ │
│ │          │ │ │ │          │ │ │ │          │ │
│ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │
│ ┌──────────┐ │ │ ┌──────────┐ │ │              │
│ │ Task Card│ │ │ │ Task Card│ │ │              │
│ └──────────┘ │ │ └──────────┘ │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Task Card:**
```
┌─────────────────────────────────┐
│ [Follow-up]           · High    │
│                                 │
│ Review SNS subscription config  │
│ for production environment      │
│                                 │
│ @SecurityBot · 2h ago           │
│ Due: Apr 20                     │
│                                 │
│ [Send to Agent]                 │
└─────────────────────────────────┘
```

**Drag-and-drop (v2):** For v1, clicking a card opens the detail panel. Status changes happen via buttons in the detail panel. Drag-and-drop between columns is a v2 feature (requires a DnD library like @hello-pangea/dnd or native HTML5 drag).

**No "Dropped" column:** Tasks with status "dropped" are hidden by default (can be shown via the status filter).

### 5E: Task Detail Panel

**Component:** `ui/src/components/today/TaskDetailPanel.tsx`

This is a slide-over panel (from the right side) or a dedicated page at `/today/{task_id}`. Slide-over is recommended for quick interactions while keeping the list visible.

```
┌────────────────────────────────────────────┐
│ ← Back                          [···] [×] │
│                                            │
│ Follow-up · High                           │
│ ─────────────────────────────────────────  │
│ Review the SNS subscription               │
│ configuration for prod                     │
│                                            │
│ Status: [Open ▼]     Priority: [High ▼]   │
│ Due: [Apr 20 📅]                           │
│                                            │
│ Description                                │
│ The agent identified that the SNS          │
│ subscription in us-east-1 is using...      │
│                                            │
│ Source Quote                               │
│ ┌────────────────────────────────────────┐ │
│ │ "I noticed the SNS subscription for   │ │
│ │ prod alerts is still pointing to the  │ │
│ │ old endpoint. We should update this   │ │
│ │ before the migration."                │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ Sources                                    │
│ 📎 Session: "AWS audit findings"           │
│    with @SecurityBot · Apr 17              │
│                                            │
│ Assigned Session                           │
│ 🔗 Session: "Fix SNS config"              │
│    with @SecurityBot · In Progress         │
│                                            │
│ ─────────── Actions ───────────            │
│ [Send to Agent]  [Mark Done]  [Drop]       │
│                                            │
│ ─────────── Comments ──────────            │
│                                            │
│ System · 2h ago                            │
│ Task extracted from session "AWS audit"    │
│                                            │
│ You · 1h ago                               │
│ Checking with the infra team first         │
│                                            │
│ System · 30m ago                           │
│ Sent to agent @SecurityBot                 │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │ Add a comment...                [Post] │ │
│ └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

**Features:**
- Editable status via dropdown (triggers PUT + creates system comment)
- Editable priority via dropdown
- Editable due date via date input
- Source links: clicking navigates to the source session/thread
- Assigned session/thread link: clicking navigates to the agent session handling this task
- "Send to Agent" button: opens a modal to select employee (and optionally channel)
- Comments section: chronological list + input to add new comment
- "Mark Done" and "Drop" quick action buttons

### 5F: Send to Agent Modal

**Component:** `ui/src/components/today/SendToAgentModal.tsx`

```
┌────────────────────────────────────────────┐
│ ⚡ Send to Agent                           │
│                                            │
│ Select an employee to handle this task:    │
│                                            │
│ Employee: [Select employee ▼]              │
│                                            │
│ ☐ Send to channel instead                 │
│   Channel: [Select channel ▼]  (if checked)│
│                                            │
│ Additional context (optional):             │
│ ┌────────────────────────────────────────┐ │
│ │                                        │ │
│ └────────────────────────────────────────┘ │
│                                            │
│              [Cancel]  [Send]              │
└────────────────────────────────────────────┘
```

On submit:
1. Calls `POST /api/tasks/today/{task_id}/send-to-agent`
2. Shows success toast with clickable link to the created session/thread
3. Task card updates to show the assigned session/thread link (status does NOT auto-change — user controls that)

### 5G: New Task Modal

**Component:** `ui/src/components/today/NewTaskModal.tsx`

For manually creating tasks (not from extraction):

```
┌────────────────────────────────────────────┐
│ + New Task                                 │
│                                            │
│ Title *                                    │
│ ┌────────────────────────────────────────┐ │
│ │                                        │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ Type: [Action Item ▼]                      │
│ Priority: [Medium ▼]                       │
│ Due date: [Optional 📅]                    │
│                                            │
│ Description (optional)                     │
│ ┌────────────────────────────────────────┐ │
│ │                                        │ │
│ │                                        │ │
│ └────────────────────────────────────────┘ │
│                                            │
│              [Cancel]  [Create]            │
└────────────────────────────────────────────┘
```

**Files to create:**
- `ui/src/app/today/page.tsx` (main page)
- `ui/src/components/today/TaskListView.tsx`
- `ui/src/components/today/TaskKanbanView.tsx`
- `ui/src/components/today/TaskCard.tsx` (shared between list and kanban)
- `ui/src/components/today/TaskDetailPanel.tsx`
- `ui/src/components/today/SendToAgentModal.tsx`
- `ui/src/components/today/NewTaskModal.tsx`
- `ui/src/components/today/TaskFilters.tsx`

**Files to modify:**
- `ui/src/components/layout/Sidebar.tsx` (add Today link)
- `ui/src/lib/api.ts` (add autoTasks API methods)
- `ui/src/lib/types.ts` (add AutoTask, AutoTaskSource, AutoTaskComment types)

---

## Part 6: API Client & Types (Frontend)

### TypeScript Types

Add to `ui/src/lib/types.ts`:

```typescript
export interface AutoTask {
  id: string;
  tenant_id: string;
  type: 'follow_up' | 'investigation' | 'action_item' | 'decision_pending' | 'escalation';
  title: string;
  description: string | null;
  fields: Record<string, unknown>;
  source_quote: string | null;
  status: 'open' | 'in_progress' | 'done' | 'dropped';
  priority: 'low' | 'medium' | 'high';
  confidence: 'low' | 'medium' | 'high';
  due_date: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  assigned_employee_id: string | null;
  assigned_session_id: string | null;
  assigned_channel_id: string | null;
  assigned_thread_id: string | null;
  // Populated by API joins:
  sources: AutoTaskSource[];
  assigned_employee_name?: string;
}

export interface AutoTaskSource {
  id: string;
  task_id: string;
  session_id: string | null;
  thread_id: string | null;
  employee_id: string | null;
  employee_name?: string;
  session_title?: string;
  thread_title?: string;
  channel_name?: string;
  source_quote: string | null;
  first_seen_at: string;
}

export interface AutoTaskComment {
  id: string;
  task_id: string;
  author_type: 'user' | 'system' | 'agent';
  content: string;
  created_at: string;
}

export interface AutoTaskSummary {
  total: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
}

export interface ExtractionRun {
  id: string;
  trigger: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  sessions_scanned: number;
  threads_scanned: number;
  tasks_created: number;
  tasks_merged: number;
  tasks_skipped: number;
  error: string | null;
}
```

### API Client Methods

Add to `ui/src/lib/api.ts`:

```typescript
autoTasks: {
  list: (params?: {
    status?: string;
    type?: string;
    priority?: string;
    search?: string;
    sort_by?: string;
    sort_order?: string;
  }) => request<AutoTask[]>(`/api/tasks/today?${new URLSearchParams(params)}`),

  get: (id: string) => request<AutoTask>(`/api/tasks/today/${id}`),

  create: (data: {
    title: string;
    type: string;
    description?: string;
    priority?: string;
    due_date?: string;
  }) => request<AutoTask>('/api/tasks/today', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<AutoTask>) =>
    request<AutoTask>(`/api/tasks/today/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<void>(`/api/tasks/today/${id}`, { method: 'DELETE' }),

  updateStatus: (id: string, status: string) =>
    request<AutoTask>(`/api/tasks/today/${id}/status`, {
      method: 'POST', body: JSON.stringify({ status })
    }),

  sendToAgent: (id: string, data: {
    employee_id: string;
    channel_id?: string;
    additional_context?: string;
  }) => request<{ session_id?: string; thread_id?: string }>(`/api/tasks/today/${id}/send-to-agent`, {
    method: 'POST', body: JSON.stringify(data)
  }),

  comments: {
    list: (taskId: string) => request<AutoTaskComment[]>(`/api/tasks/today/${taskId}/comments`),
    create: (taskId: string, content: string) =>
      request<AutoTaskComment>(`/api/tasks/today/${taskId}/comments`, {
        method: 'POST', body: JSON.stringify({ content })
      }),
  },

  summary: () => request<AutoTaskSummary>('/api/tasks/today/summary'),

  triggerExtraction: () =>
    request<{ extraction_run_id: string }>('/api/tasks/today/extract', { method: 'POST' }),

  extractionHistory: () =>
    request<ExtractionRun[]>('/api/tasks/today/extract/history'),
}
```

---

## Part 7: Implementation Order

The work should be done in this order, as each part builds on the previous:

### Phase 1: Foundation (Backend)
1. **Database schema** — Create migration, models, schemas (`Part 1 + Part 2`)
2. **Task type definitions** — `shared/autotask_types.py` (`Part 2`)
3. **API endpoints** — CRUD, status, comments, summary (`Part 4`, excluding "Send to Agent")
4. **Test the API** — Manually create tasks, list them, update status, add comments

### Phase 2: Extraction Worker (Backend)
5. **Extraction prompt** — `agent/autotask_prompt.py` (`Part 3`)
6. **Extraction runner** — `agent/autotask_runner.py` (`Part 3`)
7. **Scheduler integration** — Wire into `agent/scheduler.py` and `agent/main.py` (`Part 3`)
8. **Test extraction** — Trigger manually, verify tasks appear in DB
9. **Manual trigger API** — `POST /api/tasks/today/extract` (`Part 4`)

### Phase 3: Frontend — Core UI
10. **Types and API client** — Add to `types.ts` and `api.ts` (`Part 6`)
11. **Sidebar entry** — Add Today link with badge (`Part 5A`)
12. **Today page shell** — Header, filters, view toggle (`Part 5B`)
13. **List view** — Task rows with basic info (`Part 5C`)
14. **Kanban view** — Three columns with task cards (`Part 5D`)
15. **Task detail panel** — Slide-over with full task info (`Part 5E`)

### Phase 4: Frontend — Interactive Features
16. **Comments** — Comment list + input in detail panel (`Part 5E`)
17. **Status transitions** — Dropdown in detail panel, creates system comment (`Part 5E`)
18. **New task modal** — Manual task creation (`Part 5G`)
19. **Send to Agent** — Modal + API endpoint + session/thread creation (`Part 5F + Part 4`)

### Phase 5: Polish & Integration
20. **Sidebar badge count** — Fetch open task count, update on navigation
21. **Source links** — Navigate to source sessions/threads from task detail
22. **Assigned session links** — Navigate to agent session from task detail
23. **Empty states** — No tasks yet, first extraction prompt
24. **Loading states** — Skeleton loaders, extraction spinner
25. **Error handling** — API errors, extraction failures

---

## Resolved Design Decisions

### Extraction Trigger
Daily scheduled extraction + a manual "Run Extraction" button in the UI header. The button triggers `POST /api/tasks/today/extract` and shows a spinner until the run completes. No more frequent automatic runs for v1.

### "Send to Agent" Semantics
Pure message dispatch. Take the task title/description, create a session/thread, send it as a normal message via NATS. The task gets a link to the created session/thread stored in its `assigned_*` fields so the user can click through. The task status does NOT auto-change — the user moves it to done/dropped manually whenever they're satisfied. No completion callbacks, no auto-resolution.

### Relationship to `human_todo`
Completely separate systems. AutoTask does not read, write, reference, or interact with the existing `human_todo` table. They serve different purposes: `human_todo` is an in-session inline action item system; `auto_task` is a cross-session extraction layer. Do not merge, migrate, or create bridges between them.

### Confidence Display
Show confidence as a visual badge on the task card (e.g., faded/muted styling for low confidence). No separate "review" status or review queue column in the kanban. Users can drop tasks they disagree with.

### Multi-Tenant Extraction
The advisory lock is keyed per tenant (`pg_advisory_xact_lock(hash(tenant_id))`), so concurrent extraction for different tenants is fine. The scheduler iterates over all tenants and triggers extraction per tenant independently. LLM costs are logged per extraction run, attributable to a tenant.

---

## File Inventory (All Changes)

### New Files (15)
| File | Purpose |
|------|---------|
| `db/alembic/versions/019_add_autotask.py` | Migration |
| `shared/models/auto_task.py` | SQLAlchemy models |
| `shared/schemas/auto_task.py` | Pydantic schemas |
| `shared/autotask_types.py` | Task type definitions |
| `agent/autotask_runner.py` | Extraction pipeline |
| `agent/autotask_prompt.py` | Prompt construction |
| `api/routers/auto_tasks.py` | API endpoints |
| `ui/src/app/today/page.tsx` | Main page |
| `ui/src/components/today/TaskListView.tsx` | List view |
| `ui/src/components/today/TaskKanbanView.tsx` | Kanban view |
| `ui/src/components/today/TaskCard.tsx` | Card component |
| `ui/src/components/today/TaskDetailPanel.tsx` | Detail panel |
| `ui/src/components/today/SendToAgentModal.tsx` | Agent dispatch modal |
| `ui/src/components/today/NewTaskModal.tsx` | Manual task creation |
| `ui/src/components/today/TaskFilters.tsx` | Filter bar |

### Modified Files (8)
| File | Change |
|------|--------|
| `shared/models/__init__.py` | Register new models |
| `shared/constants.py` | New NATS subjects, status constants |
| `shared/config.py` | AutoTask config vars |
| `agent/scheduler.py` | AutoTask trigger in tick loop |
| `agent/main.py` | NATS subscription for autotask trigger |
| `api/main.py` | Register auto_tasks router |
| `ui/src/components/layout/Sidebar.tsx` | Today link + badge |
| `ui/src/lib/api.ts` | autoTasks API methods |
| `ui/src/lib/types.ts` | AutoTask TypeScript interfaces |

---

## v2 Roadmap (Out of Scope for This Plan)

- Drag-and-drop kanban columns
- Embedding-based semantic dedupe (pgvector)
- Automatic resolution detection (reverse pass — detect task completion from conversation content)
- Configurable task types via UI (DB-backed, not Python file)
- Notifications (in-app, email, Slack) for new tasks
- Task assignment to multiple agents
- Recurring task templates
- Export to Jira/Linear/Notion
- Cost tracking per extraction run surfaced in the UI
- Task archival and retention policies
- Chunking for very large sessions (500+ messages in a window)
