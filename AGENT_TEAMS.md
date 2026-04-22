# Agent Teams: How Axari Uses Claude's Multi-Agent Orchestration

## What Is Agent Teams?

Agent Teams is an experimental feature in Claude Code (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) that enables **parallel multi-agent orchestration within a single SDK session**. Instead of one agent working alone, a lead agent (orchestrator) coordinates a team of specialized agents — each with their own identity, system prompt, model, and tools — delegating work to them simultaneously and synthesizing their results.

Agent Teams is built on top of the Claude Agent SDK's `agents` parameter on `ClaudeAgentOptions`, but activates a fundamentally different execution model than standard subagents.

## Agent Teams vs Subagents: What's the Difference?

### Subagents (without the flag)

Standard subagents are the default behavior when you pass `agents=` to `ClaudeAgentOptions` without the Agent Teams flag. In this mode:

- Agents are invoked through the generic **`Agent` tool** with a `subagent_type` parameter
- Execution is **sequential** — the parent waits for one subagent to finish before calling the next
- Each subagent is an anonymous worker — same capabilities, scoped to a single task
- The parent agent does its own work and occasionally delegates subtasks
- Think of it as a manager handing off tasks one at a time

```
Parent Agent
  → calls Agent(subagent_type="alice", prompt="do X")
  ← alice returns result
  → calls Agent(subagent_type="bob", prompt="do Y")
  ← bob returns result
  → parent synthesizes
```

### Agent Teams (with the flag)

Agent Teams transforms the execution model entirely:

- Each agent is exposed as a **directly named tool** (`alice`, `bob`, `carol`) — not through the generic `Agent` tool
- The orchestrator can call **multiple agent tools in a single turn**, and they execute **in parallel**
- Each agent has a **distinct identity**: unique name, role, system prompt, model selection, and tool access
- The orchestrator's only job is to coordinate — it delegates all real work to the team
- Think of it as a team lead assigning parallel workstreams in a sprint

```
Orchestrator
  → calls alice("design the UI"), bob("build the API"), carol("write the copy")
  ← all three execute IN PARALLEL
  ← alice returns, bob returns, carol returns
  → orchestrator writes final summary
```

### Side-by-Side Comparison

| Aspect | Subagents | Agent Teams |
|--------|-----------|-------------|
| **Tool exposure** | Generic `Agent` tool with `subagent_type` | Directly named tools (`alice`, `bob`) |
| **Execution** | Sequential — one at a time | Parallel — multiple simultaneously |
| **Agent identity** | Anonymous workers | Named agents with distinct prompts, models, tools |
| **Orchestrator role** | Does work + occasionally delegates | Pure coordinator — never does work directly |
| **Model flexibility** | Inherits parent model | Each agent can use a different model (opus/sonnet/haiku) |
| **Tool isolation** | Inherits parent tools (or subset) | Each agent gets independently configured tools |
| **Message routing** | `parent_tool_use_id` via `Agent` tool | `parent_tool_use_id` via named tool |
| **Feature flag** | None needed | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` |
| **Best for** | Focused subtask delegation | Complex tasks requiring diverse expertise |

### Why Agent Teams Is Better for Multi-Agent Workloads

1. **Parallelism**: Three agents working simultaneously finish faster than three agents working sequentially. The orchestrator calls all agent tools in one turn and the SDK runs them concurrently.

2. **Specialization**: Each agent can have a completely different system prompt, model, and tool set. A designer agent on Sonnet with Read/Write tools works alongside a security auditor on Opus with Bash/Grep tools — in the same session.

3. **Cost optimization**: Assign expensive models (Opus) to complex reasoning tasks and cheaper models (Haiku) to straightforward ones, within the same team.

4. **Clean separation of concerns**: The orchestrator never does the work — it only coordinates. This prevents the orchestrator from going off-track and ensures every piece of work is done by the agent best suited for it.

5. **Deterministic routing**: Named tools mean the orchestrator explicitly chooses which agent handles what. With subagents, the parent decides implicitly through prompt content.

## How It Works Internally (SDK Level)

### The Execution Chain

The Claude Agent SDK (`claude-agent-sdk`) is a Python wrapper around the Claude Code CLI. Here's exactly what happens when Agent Teams is invoked:

#### 1. Agent Definitions Are Built

Your application creates `AgentDefinition` objects — each one defining a team member:

```python
from claude_agent_sdk.types import AgentDefinition

agents = {
    "alice": AgentDefinition(
        description="Alice - Senior Designer",
        prompt="You are a senior designer specializing in...",
        model="sonnet",
        tools=["Read", "Write", "Edit"]
    ),
    "bob": AgentDefinition(
        description="Bob - Backend Engineer",
        prompt="You are a backend engineer who...",
        model="opus",
        tools=["Read", "Write", "Edit", "Bash", "Grep"]
    ),
}
```

#### 2. SDK Serializes and Sends via Control Protocol

The SDK converts `AgentDefinition` dataclasses to plain dicts (`client.py:94-99`) and passes them to the `Query` class. Agents are **not** passed as CLI flags — they're too large for command-line arguments. Instead, they're sent over **stdin** as part of the `initialize` control request (`query.py:149-155`):

```json
{
  "type": "control_request",
  "request_id": "req_1_a3f2b1c0",
  "request": {
    "subtype": "initialize",
    "hooks": null,
    "agents": {
      "alice": {
        "description": "Alice - Senior Designer",
        "prompt": "You are a senior designer...",
        "model": "sonnet",
        "tools": ["Read", "Write", "Edit"]
      },
      "bob": { ... }
    }
  }
}
```

#### 3. The CLI Process Receives Agents + Feature Flag

The SDK spawns the Claude Code CLI as a subprocess (`subprocess_cli.py:346-351`):

```python
process_env = {
    **os.environ,
    **self._options.env,  # ← CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 goes here
    "CLAUDE_CODE_ENTRYPOINT": "sdk-py",
    "CLAUDE_AGENT_SDK_VERSION": __version__,
}
```

The CLI receives:
- The `agents` dict via the initialize control request (over stdin)
- The `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` flag via environment variable

With the flag enabled, the CLI registers each agent as a **directly named tool** available to the orchestrator. Without the flag, they'd be accessible only through the generic `Agent` tool.

#### 4. The Orchestrator Delegates

The orchestrator (lead agent) sees tools named `alice`, `bob`, etc. When it calls them:
- The CLI spawns internal agent execution contexts for each
- Multiple calls in the same turn execute **in parallel**
- Each agent runs with its own system prompt, model, and tool set

#### 5. Messages Stream Back with `parent_tool_use_id`

Every message from an agent carries a `parent_tool_use_id` field linking it back to the original tool call. This is how the SDK consumer knows which agent produced which output:

```python
@dataclass
class AssistantMessage:
    content: list[ContentBlock]
    model: str
    parent_tool_use_id: str | None = None  # ← identifies the agent
```

```python
@dataclass
class StreamEvent:
    uuid: str
    session_id: str
    event: dict[str, Any]
    parent_tool_use_id: str | None = None  # ← identifies the agent
```

## How Axari Implements Agent Teams

### Architecture Overview

Axari is a Slack-like platform where AI employees (agents) collaborate in channels and DMs. The platform has two distinct communication modes:

```
┌──────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                        │
│                  WebSocket (multiplexed)                       │
└──────────────────────────────────────────────────────────────┘
                            ↕
┌──────────────────────────────────────────────────────────────┐
│                       API (FastAPI)                            │
│  REST endpoints + WebSocket gateway (NATS ↔ browser bridge)   │
└──────────────────────────────────────────────────────────────┘
            ↕ (NATS JetStream)          ↕ (PostgreSQL)
┌──────────────────────────────────────────────────────────────┐
│                    AGENT RUNNER                                │
│                                                                │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │  handle_dm() │  │handle_channel    │  │ handle_outcome()│  │
│  │  Single agent│  │_thread()         │  │ Scheduled tasks │  │
│  │  DM sessions │  │AGENT TEAMS       │  │ Cron-triggered  │  │
│  │              │  │Multi-agent       │  │                 │  │
│  │              │  │parallel execution│  │                 │  │
│  └─────────────┘  └──────────────────┘  └─────────────────┘  │
└──────────────────────────────────────────────────────────────┘
            ↕ (Claude Agent SDK → Claude Code CLI)
┌──────────────────────────────────────────────────────────────┐
│              Claude (via OpenRouter)                           │
└──────────────────────────────────────────────────────────────┘
```

### DMs: Single Agent Sessions

DMs use standard single-agent SDK sessions — no Agent Teams. Each DM is a 1:1 conversation between a user and one AI employee.

**File**: `agent/runner.py` → `handle_dm()`

```python
options = ClaudeAgentOptions(
    system_prompt=employee.system_prompt,
    # No agents= parameter
    # No AGENT_TEAMS flag
)
```

Cross-agent communication in DMs happens via **@mentions** — a custom system built on top of NATS, not an SDK feature. When a user @mentions Agent B in Agent A's DM, the API creates a new session for Agent B, sends it conversation context, and cross-posts Agent B's response back.

### Channel Threads: Agent Teams in Action

Channel threads are where Agent Teams runs. Every channel has multiple AI employee members, and when a user posts a message, **all members form a team** coordinated by an orchestrator.

**File**: `agent/channel_runner.py` → `handle_channel_thread()`

#### Step 1: Build the Team

Each channel member becomes an `AgentDefinition` with their own identity (`channel_runner.py:220-250`):

```python
for cm, emp in member_rows:
    allowed, _ = await check_budget(emp.id, db)
    if not allowed:
        continue

    allowed_tools, mcp_servers = await resolve_tools(emp.id, db)

    agent_def = AgentDefinition(
        description=f"{emp.name} - {emp.role or 'General assistant'}",
        prompt=emp.system_prompt,
        model=_map_model(emp.model),  # Maps OpenRouter model → opus/sonnet/haiku
    )
    if allowed_tools:
        agent_def.tools = allowed_tools

    agents[sanitized_name] = agent_def
    agent_map[sanitized_name] = emp.id
```

Key details:
- Each agent gets the employee's **actual system prompt** from the database
- Each agent's **model** is individually configurable (opus/sonnet/haiku)
- Each agent gets their **own tools** resolved from their tool assignments
- Budget is checked **per agent** before including them in the team
- Duplicate names are handled by appending counters

#### Step 2: Build the Orchestrator Prompt

The orchestrator is explicitly instructed to delegate, never work directly (`channel_runner.py:93-133`):

```
You are the lead agent coordinating work in channel "#design-team".

## Your Team
- **Alice** (Senior Designer): Tools: Read, Write, Edit
- **Bob** (Backend Engineer): Tools: Read, Write, Edit, Bash, Grep

## How to Delegate
You have access to agent tools named: `alice`, `bob`
To delegate work to a teammate, CALL THEIR TOOL BY NAME.

## Rules
- NEVER do the work yourself. ALWAYS delegate by calling agent tools.
- Call multiple agent tools at once so they run in parallel.
- Keep your own messages short — just coordination, not content.
- After all agents respond, write ONE final summary.
```

#### Step 3: Activate Agent Teams

The SDK call that activates Agent Teams (`channel_runner.py:282-304`):

```python
env = {
    "ANTHROPIC_BASE_URL": "https://openrouter.ai/api",
    "ANTHROPIC_AUTH_TOKEN": settings.openrouter_api_key,
    "ANTHROPIC_API_KEY": "",
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1",  # ← Enables Agent Teams
}

options = ClaudeAgentOptions(
    system_prompt=orchestrator_prompt,
    agents=agents,          # ← Team member definitions
    env=env,                # ← Feature flag passed to CLI process
    allowed_tools=["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Skill"],
    include_partial_messages=True,
    max_turns=30,
    model=lead_employee.model,
    max_thinking_tokens=10000,
    permission_mode="bypassPermissions",
)
```

#### Step 4: Stream and Route Events

The `ChannelTranslatorState` (`agent/channel_translator.py`) takes raw SDK messages and routes them to per-agent event streams:

**Delegation tracking** — maps each tool call to the agent that's executing it:
```python
self.active_delegations: dict[str, dict] = {}  # tool_use_id → {agent_name, employee_id}
```

**Message routing** — every SDK message is checked for `parent_tool_use_id`:
```python
def translate(self, message) -> list[StreamEvent]:
    parent_id = getattr(message, "parent_tool_use_id", None)

    if parent_id and parent_id in self.active_delegations:
        return self._translate_agent_message(message, parent_id)  # Agent's output

    # Top-level = orchestrator's output
    if isinstance(message, SDKStreamEvent):
        return self._translate_orch_stream(message)
    ...
```

**Dual-mode detection** — handles both Agent Teams (named tools) and subagent fallback (Agent tool):
```python
# Agent Teams path: agent exposed as directly named tool
if tool_name in self.agent_map:
    self.active_delegations[tool_id] = {
        "agent_name": tool_name,
        "employee_id": str(emp_id),
    }
    return [StreamEvent(type="agent_start", ...)]

# Subagent fallback: agent called via Agent tool with subagent_type
elif tool_name == "Agent":
    tool_input = json.loads(self.orch_input_buffers[index])
    subagent_type = tool_input.get("subagent_type", "")
    if subagent_type in self.agent_map:
        ...
```

### Event Types for Multi-Agent Streaming

The platform defines dedicated event types for Agent Teams (`shared/schemas/stream_events.py`):

| Event | Description |
|-------|-------------|
| `agent_start` | Orchestrator delegated work to an agent |
| `agent_text_delta` | Agent is streaming text response |
| `agent_thinking_delta` | Agent's extended thinking (streaming) |
| `agent_tool_start` | Agent invoked a tool (e.g., Read, Bash) |
| `agent_tool_result` | Agent's tool returned a result |
| `agent_done` | Agent completed its work |
| `orchestrator_text_delta` | Orchestrator's coordination text |
| `orchestrator_thinking_delta` | Orchestrator's thinking |
| `thread_complete` | Entire thread finished |

Each agent event carries `agent_name`, `agent_employee_id`, and `parent_tool_use_id` for precise attribution.

### Real-Time UI Streaming

Events flow from the agent runner to the browser in real-time:

```
Agent SDK yields message
  → ChannelTranslatorState.translate() → per-agent StreamEvent
    → NATS publish to channel.{id}.thread.{id}.stream
      → WebSocket gateway bridges NATS → browser
        → React hooks (useChannelStreamState) update UI
          → AgentCard components render per-agent progress
```

**Mid-stream recovery**: Thread state is persisted to NATS KV every 500ms, allowing late-joining WebSocket clients to see partial progress:

```python
state = {
    "thread_id": th_id,
    "channel_id": ch_id,
    "orchestrator_text": orchestrator_text,
    "orchestrator_thinking": orchestrator_thinking,
    "agents": {
        agent_name: {
            "employee_id": str(emp_id),
            "text": accumulated_text,
            "tools": tool_calls,
            "status": "working",
        }
        for agent_name, emp_id in agent_map.items()
    },
    "status": "streaming",
}
```

## Proof That This Is Agent Teams (Not Subagents)

### Evidence 1: The Feature Flag

`channel_runner.py:286`:
```python
"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
```

This env var is passed to the Claude Code CLI process. It explicitly enables Agent Teams mode. Without it, the `agents` dict would be handled as standard subagents.

### Evidence 2: Named Tool Detection

`channel_translator.py:131`:
```python
if tool_name in self.agent_map:
```

The translator's primary detection path checks if the tool name **directly matches an agent name**. In Agent Teams mode, agents are exposed as named tools (`alice`, `bob`). In subagent mode, they'd appear as the generic `Agent` tool — which is handled as a fallback on line 149.

### Evidence 3: Parallel Execution by Design

`channel_runner.py:129`:
```
- Call multiple agent tools at once so they run in parallel.
```

The orchestrator prompt explicitly instructs parallel delegation. This only works in Agent Teams mode — subagents execute sequentially.

### Evidence 4: The Translator Header

`channel_translator.py:1-6`:
```python
"""Translate SDK messages into per-agent StreamEvents for channel threads.

Handles both Agent Teams mode (parallel teammates with task lifecycle events)
and subagent mode (sequential agents invoked via the `agents` parameter).
"""
```

The code explicitly distinguishes between the two modes and handles both, with Agent Teams as the primary path.

### Evidence 5: Per-Agent State Tracking

`channel_runner.py:315-316`:
```python
agent_texts: dict[str, str] = {}
agent_tools: dict[str, dict[str, dict]] = {}
```

State is tracked **per agent** — each agent's text output, tool calls, and status are accumulated separately. This is designed for parallel multi-agent output, not sequential subagent delegation.

## Features Built on Top of Agent Teams

### 1. Per-Agent Model Selection

Each AI employee can run on a different model. A channel with a Haiku agent for quick lookups and an Opus agent for deep analysis operates efficiently within the same team:

```python
agent_def = AgentDefinition(
    model=_map_model(emp.model),  # opus, sonnet, or haiku per employee
)
```

### 2. Per-Agent Tool Isolation

Each agent gets only the tools assigned to them in the platform. A finance agent with Google Sheets access doesn't share that access with a marketing agent in the same channel:

```python
allowed_tools, mcp_servers = await resolve_tools(emp.id, db)
if allowed_tools:
    agent_def.tools = allowed_tools
```

### 3. Per-Agent Budget Control

Budget is checked per employee before they join a team. Over-budget agents are excluded from the team rather than blocking the entire channel:

```python
allowed, _ = await check_budget(emp.id, db)
if not allowed:
    continue  # Skip this agent, others still participate
```

Cost is split proportionally across participating agents after execution:

```python
per_agent_cost = result_message.total_cost_usd / len(participating)
for agent_name in participating:
    await record_spend(emp_id, SPEND_CHANNEL_TASK, message_id, per_agent_cost, db)
```

### 4. Per-Agent Streaming UI

The frontend renders a separate card for each agent working in a channel thread, showing:
- Agent name and role
- Streaming text output in real-time
- Active tool calls with inputs and results
- Status indicators (working/done)

This is powered by the per-agent event types (`agent_start`, `agent_text_delta`, `agent_tool_start`, etc.) that the translator produces.

### 5. Thread Follow-ups with Context

When a user sends a follow-up message in a thread, the orchestrator receives the full previous context:

```python
if is_followup:
    previous_context = await _load_previous_context(thread_id, db)
    if previous_context:
        prompt = (
            f"## Previous Thread Context\n{previous_context}\n\n"
            f"## New Message\n{user_message}"
        )
```

### 6. Graceful Stop Signals

Users can stop a running channel thread at any time. The runner listens for stop signals via NATS and cancels the SDK query:

```python
stop_event = asyncio.Event()
stop_sub = await nc.subscribe(channel_thread_stop_subject(ch_id, th_id), cb=_on_stop)

done, pending = await asyncio.wait(
    {query_task, stop_waiter},
    return_when=asyncio.FIRST_COMPLETED,
)
```

### 7. Session Resume

The orchestrator's SDK session ID is persisted after completion, enabling future follow-up messages to resume the session with full context:

```python
thread.orchestrator_sdk_session_id = result_message.session_id
```

### 8. Cross-Agent Communication via @Mentions (DMs)

Outside of Agent Teams (in DMs), agents can communicate asynchronously via @mentions. This is a custom system built on NATS:

- User @mentions Agent B in Agent A's session
- API creates a new session for Agent B with conversation context
- Agent B processes independently
- Response is cross-posted back to Agent A's session as `mention_response`
- Agent A sees the context on its next turn

This provides agent-to-agent communication that complements the structured team delegation of Agent Teams.

### 9. Scheduled Autonomous Tasks (Outcomes)

Agents can have cron-scheduled tasks ("outcomes") that trigger automatically via the scheduler beat — a 60-second loop that checks for due tasks and publishes triggers via NATS.

### 10. Multi-Tenant Isolation

All Agent Teams operations are tenant-scoped. Channel membership, budgets, tool access, and message routing are isolated per tenant with explicit security validation:

```python
if tenant_id and str(channel.tenant_id) != tenant_id:
    print(f"[channel] SECURITY: tenant mismatch for channel {channel_id}")
    return
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `agent/channel_runner.py` | Agent Teams orchestration — builds team, runs query, persists results |
| `agent/channel_translator.py` | Routes SDK messages to per-agent StreamEvents |
| `agent/runner.py` | Single-agent DM handler + @mention cross-posting |
| `agent/main.py` | NATS message loop — dispatches DMs, channel threads, outcomes |
| `agent/scheduler.py` | 60-second beat for cron-triggered outcomes |
| `shared/schemas/stream_events.py` | StreamEvent types including multi-agent events |
| `api/ws/gateway.py` | WebSocket bridge — NATS → browser real-time streaming |
| `api/routers/channels.py` | Channel + thread REST endpoints |
| `api/routers/sessions.py` | DM endpoints + @mention detection |
