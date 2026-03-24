// ──────────────────────────────────────────────────────────────
// User lifecycle flows — step-by-step backend walkthroughs
// ──────────────────────────────────────────────────────────────

export type SystemBadge =
  | 'UI'
  | 'API'
  | 'NATS'
  | 'Dispatcher'
  | 'Modal'
  | 'Database'
  | 'OpenRouter'
  | 'Clerk'
  | 'Google';

export interface FlowStep {
  id: string;
  label: string;
  detail: string;
  system: SystemBadge;
  technical?: string[];
}

export interface UserFlow {
  id: string;
  title: string;
  description: string;
  icon: string;
  steps: FlowStep[];
}

export const SYSTEM_COLORS: Record<SystemBadge, string> = {
  UI: '#3b82f6',
  API: '#6366f1',
  NATS: '#10b981',
  Dispatcher: '#f59e0b',
  Modal: '#f43f5e',
  Database: '#06b6d4',
  OpenRouter: '#a855f7',
  Clerk: '#ec4899',
  Google: '#eab308',
};

export const userFlows: UserFlow[] = [
  // ── 1. First Login & Workspace Setup ──────────────────────
  {
    id: 'signup',
    title: 'First Login & Workspace Setup',
    description:
      'What happens when a brand-new user signs in for the first time — from Clerk auth through automatic tenant provisioning.',
    icon: '🔑',
    steps: [
      {
        id: 'signup-1',
        label: 'User visits the app',
        detail:
          'Browser navigates to the Company of Agents URL. Next.js serves the landing page with ClerkProvider wrapping the component tree.',
        system: 'UI',
        technical: ['ClerkProvider initializes', 'Redirect to /sign-in if unauthenticated'],
      },
      {
        id: 'signup-2',
        label: 'Clerk sign-in flow',
        detail:
          'User authenticates via Clerk (email/password or OAuth). Clerk handles the entire auth UI and session creation.',
        system: 'Clerk',
        technical: ['<SignIn /> component', 'Clerk session cookie set'],
      },
      {
        id: 'signup-3',
        label: 'JWT issued',
        detail:
          'Clerk issues a short-lived RS256 JWT containing the user\'s org_id (used as tenant identifier). The frontend stores this for API calls.',
        system: 'Clerk',
        technical: ['RS256 JWT with org_id claim', 'Token attached to all API requests via Authorization header'],
      },
      {
        id: 'signup-4',
        label: 'First API request hits backend',
        detail:
          'The frontend calls GET /api/employees to load the sidebar. The request passes through FastAPI middleware which verifies the JWT against Clerk\'s JWKS endpoint.',
        system: 'API',
        technical: ['GET /api/employees', 'verify_clerk_token() validates JWT via JWKS'],
      },
      {
        id: 'signup-5',
        label: 'Auto-create Tenant',
        detail:
          'The get_current_tenant() dependency extracts org_id from the JWT. If no Tenant row exists for this org_id, it creates one automatically — zero-friction onboarding.',
        system: 'Database',
        technical: [
          'get_current_tenant(token, db)',
          'INSERT INTO tenants (id, clerk_org_id) VALUES (...)',
          'Tenant UUID generated server-side',
        ],
      },
      {
        id: 'signup-6',
        label: 'Redirect to dashboard',
        detail:
          'Auth completes and the user lands on the main dashboard. Next.js middleware checks auth state and redirects to / (the employees page).',
        system: 'UI',
        technical: ['middleware.ts route protection', 'Redirect to / on successful auth'],
      },
      {
        id: 'signup-7',
        label: 'Sidebar loads (empty)',
        detail:
          'The sidebar component fetches employees for this tenant. Since the tenant is brand new, the list is empty — showing the "Create your first employee" prompt.',
        system: 'UI',
        technical: ['GET /api/employees → []', 'Empty state UI rendered'],
      },
    ],
  },

  // ── 2. Create an AI Employee ──────────────────────────────
  {
    id: 'create-employee',
    title: 'Create an AI Employee',
    description:
      'Setting up a new AI employee — from form submission through Modal volume provisioning and CLAUDE.md configuration.',
    icon: '🤖',
    steps: [
      {
        id: 'create-1',
        label: 'User fills the employee form',
        detail:
          'User provides a name, role description, selects an LLM model (via OpenRouter), and writes a system prompt defining the employee\'s personality and capabilities.',
        system: 'UI',
        technical: ['EmployeeCreateForm component', 'Model selector backed by OpenRouter models'],
      },
      {
        id: 'create-2',
        label: 'POST /api/employees',
        detail:
          'The frontend submits the form data to the API. The request is authenticated and tenant-scoped via get_current_tenant().',
        system: 'API',
        technical: [
          'POST /api/employees',
          'Body: { name, role, model, system_prompt, avatar_emoji }',
          'get_current_tenant() injects tenant_id',
        ],
      },
      {
        id: 'create-3',
        label: 'Employee record persisted',
        detail:
          'A new Employee row is inserted into PostgreSQL with the tenant_id foreign key. The employee gets a UUID, default budget limits, and "idle" status.',
        system: 'Database',
        technical: [
          'INSERT INTO employees (id, tenant_id, name, role, model, system_prompt, ...)',
          'Default daily_budget=5.00, lifetime_budget=100.00',
          'status defaults to "idle"',
        ],
      },
      {
        id: 'create-4',
        label: 'First message triggers Modal sandbox',
        detail:
          'When the user sends the first message, a Modal sandbox is created. This is the first time compute is actually provisioned for this employee.',
        system: 'Modal',
        technical: [
          'modal.Sandbox.create(image, volumes={...})',
          'Volume: modal.Volume.from_name(f"tenant-{tenant_id}")',
        ],
      },
      {
        id: 'create-5',
        label: 'setup_employee_workspace() creates directories',
        detail:
          'Inside the sandbox, the workspace initializer creates the employee\'s directory structure on the per-tenant Modal volume.',
        system: 'Modal',
        technical: [
          'setup_employee_workspace(employee_id)',
          '/data/employees/{employee_id}/',
          '/data/employees/{employee_id}/memory/',
          '/data/employees/{employee_id}/sessions/',
        ],
      },
      {
        id: 'create-6',
        label: 'CLAUDE.md written with system prompt',
        detail:
          'The employee\'s system prompt is written to CLAUDE.md in their workspace root. The Claude Agent SDK reads this file automatically to configure the agent\'s behavior.',
        system: 'Modal',
        technical: [
          'write /data/employees/{employee_id}/CLAUDE.md',
          'Contains: role, personality, tool instructions',
          'Claude SDK auto-loads CLAUDE.md at startup',
        ],
      },
      {
        id: 'create-7',
        label: 'Memory directory bootstrapped',
        detail:
          'A memory/ subdirectory is created for the employee to persist knowledge across sessions. The agent can read/write files here for long-term context.',
        system: 'Modal',
        technical: [
          'mkdir /data/employees/{employee_id}/memory/',
          'Agent has Read/Write tool access to this directory',
        ],
      },
      {
        id: 'create-8',
        label: 'Employee ready',
        detail:
          'The employee appears in the sidebar as active. Users can now start conversations, assign tools, and configure scheduled tasks.',
        system: 'UI',
        technical: ['Employee list re-fetched', 'Status: idle, ready for messages'],
      },
    ],
  },

  // ── 3. Send a Direct Message ──────────────────────────────
  {
    id: 'send-dm',
    title: 'Send a Direct Message',
    description:
      'The complete lifecycle of a user message — from typing in the chat input through Modal sandbox execution to streaming the response back.',
    icon: '💬',
    steps: [
      {
        id: 'dm-1',
        label: 'User types a message',
        detail:
          'User types in the ChatInput component and hits Enter (or clicks Send). The message text is captured along with the active session ID.',
        system: 'UI',
        technical: ['ChatInput component', 'onSubmit handler fires'],
      },
      {
        id: 'dm-2',
        label: 'POST /api/sessions/{id}/messages',
        detail:
          'The frontend sends the message to the API. If no session exists, one is created first via POST /api/sessions.',
        system: 'API',
        technical: [
          'POST /api/sessions/{session_id}/messages',
          'Body: { content: "..." }',
          'Returns: Message object with UUID',
        ],
      },
      {
        id: 'dm-3',
        label: 'Message persisted to database',
        detail:
          'The user message is stored in PostgreSQL as a Message row linked to the Session and Employee, with role="user".',
        system: 'Database',
        technical: [
          'INSERT INTO messages (id, session_id, role, content)',
          'role="user", tenant_id scoped',
        ],
      },
      {
        id: 'dm-4',
        label: 'Published to NATS JetStream',
        detail:
          'The API publishes the message payload to the employee\'s DM incoming subject on NATS JetStream, ensuring durable delivery.',
        system: 'NATS',
        technical: [
          'js.publish("employee.{employee_id}.dm.incoming", payload)',
          'Payload: { session_id, message_id, content, employee_id, tenant_id }',
          'Stream: AGENT_EVENTS',
        ],
      },
      {
        id: 'dm-5',
        label: 'Dispatcher receives from JetStream',
        detail:
          'The Railway-hosted dispatcher service has a durable consumer subscribed to employee.*.dm.incoming. It picks up the message and acks immediately.',
        system: 'Dispatcher',
        technical: [
          'Durable consumer: dm_consumer',
          'Subject filter: employee.*.dm.incoming',
          'msg.ack() immediately (fire-and-forget)',
        ],
      },
      {
        id: 'dm-6',
        label: 'Modal sandbox created',
        detail:
          'The dispatcher calls modal.Sandbox.create() to spin up an isolated container with the tenant\'s volume mounted. The sandbox has 2 CPU, 2GB RAM, and 10-minute timeout.',
        system: 'Dispatcher',
        technical: [
          'modal.Sandbox.create(app=app, image=image)',
          'volumes={{ "/data": tenant_volume }}',
          'timeout=600, cpu=2.0, memory=2048',
        ],
      },
      {
        id: 'dm-7',
        label: 'Sandbox environment initialized',
        detail:
          'Inside the container: chmod 777 /data for volume access, switch to appuser (non-root), set environment variables for NATS, Postgres, and OpenRouter.',
        system: 'Modal',
        technical: [
          'chmod 777 /data',
          'su appuser (UID 1000)',
          'ENV: NATS_URL, DATABASE_URL, OPENROUTER_API_KEY',
        ],
      },
      {
        id: 'dm-8',
        label: 'modal_entry.py connects to services',
        detail:
          'The sandbox entry point establishes connections to NATS (for streaming events back) and PostgreSQL (for persisting results).',
        system: 'Modal',
        technical: [
          'nats.connect(NATS_URL)',
          'asyncpg.connect(DATABASE_URL)',
          'Connections kept alive for sandbox lifetime',
        ],
      },
      {
        id: 'dm-9',
        label: 'Budget check',
        detail:
          'Before invoking the LLM, the handler checks the employee\'s daily and lifetime spend against their budget limits. If over budget, the request is rejected.',
        system: 'Modal',
        technical: [
          'handle_dm(payload)',
          'check_budget(employee_id) → daily_spent, lifetime_spent',
          'Reject if daily_spent >= daily_budget or lifetime_spent >= lifetime_budget',
        ],
      },
      {
        id: 'dm-10',
        label: 'Workspace setup & tool resolution',
        detail:
          'setup_employee_workspace() ensures dirs exist. resolve_tools() loads the employee\'s assigned tools from Postgres and builds MCP server configs.',
        system: 'Modal',
        technical: [
          'setup_employee_workspace(employee_id)',
          'resolve_tools(employee_id, db) → List[McpServerConfig]',
          'Each tool: { command, args, env }',
        ],
      },
      {
        id: 'dm-11',
        label: 'Claude SDK query()',
        detail:
          'The Claude Agent SDK is invoked with the user\'s message, system prompt, conversation history, and MCP server configurations. ANTHROPIC_BASE_URL is set to OpenRouter.',
        system: 'Modal',
        technical: [
          'claude_agent.query(message, options)',
          'ClaudeAgentOptions: { model, system_prompt, mcp_servers, max_turns }',
          'sdk_session_id for conversation resume',
        ],
      },
      {
        id: 'dm-12',
        label: 'OpenRouter API call',
        detail:
          'The Claude SDK sends the request to OpenRouter (acting as ANTHROPIC_BASE_URL), which routes to the selected model (e.g., claude-sonnet-4).',
        system: 'OpenRouter',
        technical: [
          'ANTHROPIC_BASE_URL=https://openrouter.ai/api',
          'Model: employee.model (e.g., anthropic/claude-sonnet-4)',
          'Streaming response',
        ],
      },
      {
        id: 'dm-13',
        label: 'Stream thinking events to NATS',
        detail:
          'As the LLM generates its thinking/reasoning, thinking_delta events are published to NATS in real-time for the UI to display.',
        system: 'NATS',
        technical: [
          'nc.publish("employee.{id}.dm.stream", event)',
          'Event type: thinking_delta',
          'Payload: { text: "..." }',
        ],
      },
      {
        id: 'dm-14',
        label: 'Stream text events to NATS',
        detail:
          'The actual response text is streamed as text_delta events through NATS, allowing the UI to render the response character-by-character.',
        system: 'NATS',
        technical: [
          'nc.publish("employee.{id}.dm.stream", event)',
          'Event type: text_delta',
          'Payload: { text: "..." }',
        ],
      },
      {
        id: 'dm-15',
        label: 'Result event published',
        detail:
          'When generation completes, a result event is published containing the full response, cost data, and session metadata.',
        system: 'NATS',
        technical: [
          'Event type: result',
          'Payload: { content, cost_usd, input_tokens, output_tokens, sdk_session_id }',
        ],
      },
      {
        id: 'dm-16',
        label: 'Assistant message persisted',
        detail:
          'The complete assistant response is stored in PostgreSQL as a Message with role="assistant", along with token counts and cost.',
        system: 'Database',
        technical: [
          'INSERT INTO messages (session_id, role, content, cost_usd, ...)',
          'role="assistant"',
          'Update employee.total_spent',
        ],
      },
      {
        id: 'dm-17',
        label: 'Session SDK ID saved for resume',
        detail:
          'The sdk_session_id from the Claude SDK is stored on the Session row so the next message can resume the conversation (preserving context and tool state).',
        system: 'Database',
        technical: [
          'UPDATE sessions SET sdk_session_id = :id WHERE id = :session_id',
          'Enables conversation resume via --resume flag',
        ],
      },
      {
        id: 'dm-18',
        label: 'WebSocket gateway forwards to browser',
        detail:
          'The API server\'s WebSocket handler is subscribed to the employee\'s NATS stream subject. It bridges each event as a WebSocket frame to the connected browser.',
        system: 'API',
        technical: [
          'ws_subscribe("employee.{id}.dm.stream")',
          'NATS msg → JSON → ws.send_text()',
          'Per-tenant WebSocket isolation',
        ],
      },
      {
        id: 'dm-19',
        label: 'UI renders streaming response',
        detail:
          'The StreamingMessage component receives text deltas via useWebSocket and renders them in real-time with a typing indicator, completing the full round trip.',
        system: 'UI',
        technical: [
          'useStreamState() processes events',
          'StreamingMessage renders partial text',
          'MessageBubble renders final message on result',
        ],
      },
    ],
  },

  // ── 4. @Mention Another Agent ─────────────────────────────
  {
    id: 'mention-agent',
    title: '@Mention Another Agent',
    description:
      'How cross-agent communication works — mentioning Agent B from Agent A\'s chat triggers a separate processing pipeline with context sharing.',
    icon: '📣',
    steps: [
      {
        id: 'mention-1',
        label: 'User types @AgentB in Agent A\'s chat',
        detail:
          'In Agent A\'s conversation, the user types a message containing @AgentB. The ChatInput component shows an autocomplete dropdown for available employees.',
        system: 'UI',
        technical: ['@mention autocomplete in ChatInput', 'Word boundary matching for agent names'],
      },
      {
        id: 'mention-2',
        label: 'API detects @mention pattern',
        detail:
          'The message API endpoint parses the message text for @mention patterns using word boundary regex matching. It identifies AgentB by name lookup.',
        system: 'API',
        technical: [
          'POST /api/sessions/{id}/messages',
          'detect_mentions(content) → List[Employee]',
          'Regex: word boundary matching against employee names',
        ],
      },
      {
        id: 'mention-3',
        label: 'Agent A is NOT triggered',
        detail:
          'Important: the @mention does NOT trigger Agent A. Only the mentioned agent (Agent B) processes the message. Agent A\'s chat just shows the user\'s message.',
        system: 'API',
        technical: [
          'No NATS publish to employee.{agent_a_id}.dm.incoming',
          'User message stored in Agent A\'s session for context',
        ],
      },
      {
        id: 'mention-4',
        label: 'Mention session created for Agent B',
        detail:
          'The API creates (or reuses) a mention session linking Agent A\'s session to Agent B. This gives Agent B its own conversation context.',
        system: 'API',
        technical: [
          'Create Session for Agent B with type="mention"',
          'source_session_id = Agent A\'s session ID',
          'source_employee_id = Agent A\'s employee ID',
        ],
      },
      {
        id: 'mention-5',
        label: 'Conversation history loaded',
        detail:
          'The last 20 messages from Agent A\'s session are loaded to give Agent B context about the conversation it\'s being mentioned in.',
        system: 'Database',
        technical: [
          'SELECT * FROM messages WHERE session_id = :source_session_id ORDER BY created_at DESC LIMIT 20',
          'Context injected into Agent B\'s prompt',
        ],
      },
      {
        id: 'mention-6',
        label: 'Published to NATS for Agent B',
        detail:
          'The mention payload is published to Agent B\'s NATS subject with the source session context and conversation history.',
        system: 'NATS',
        technical: [
          'js.publish("employee.{agent_b_id}.dm.incoming", payload)',
          'Payload includes: source_session_id, conversation_context, mention_text',
        ],
      },
      {
        id: 'mention-7',
        label: 'Agent B processes with full context',
        detail:
          'Agent B\'s Modal sandbox spins up and processes the mention. It sees the conversation context and responds within its own expertise and system prompt.',
        system: 'Modal',
        technical: [
          'handle_dm(payload) with mention context',
          'Agent B\'s CLAUDE.md + conversation history',
          'Response scoped to Agent B\'s capabilities',
        ],
      },
      {
        id: 'mention-8',
        label: 'Response cross-posted to Agent A\'s session',
        detail:
          'Agent B\'s response is inserted into Agent A\'s session as a mention_response message, so it appears inline in Agent A\'s chat.',
        system: 'Database',
        technical: [
          'INSERT INTO messages (session_id, role, content, message_type)',
          'session_id = Agent A\'s session',
          'message_type = "mention_response", source_employee_id = Agent B',
        ],
      },
      {
        id: 'mention-9',
        label: 'NATS notifies Agent A\'s stream',
        detail:
          'A stream event is published on Agent A\'s channel so the UI knows to display Agent B\'s response in Agent A\'s chat.',
        system: 'NATS',
        technical: [
          'nc.publish("employee.{agent_a_id}.dm.stream", mention_result_event)',
          'Event type: mention_response',
        ],
      },
      {
        id: 'mention-10',
        label: 'UI shows indigo mention card',
        detail:
          'Agent B\'s response appears in Agent A\'s chat as a visually distinct mention card with an indigo border and Agent B\'s avatar.',
        system: 'UI',
        technical: [
          'MessageBubble renders mention_response type',
          'Indigo left border + Agent B avatar',
          'Clickable to expand',
        ],
      },
      {
        id: 'mention-11',
        label: 'Click opens split-view MentionPanel',
        detail:
          'Clicking the mention card opens the MentionPanel — a side panel showing Agent B\'s full conversation context with the ability to continue chatting.',
        system: 'UI',
        technical: [
          'MentionPanel component opens in split view',
          'Shows Agent B\'s mention session messages',
          'Allows follow-up messages directly to Agent B',
        ],
      },
      {
        id: 'mention-12',
        label: 'Agent A\'s next message includes context',
        detail:
          'When the user sends the next message to Agent A, Agent B\'s mention response is included in the conversation history, enabling informed follow-up.',
        system: 'Modal',
        technical: [
          'Conversation resume includes mention_response messages',
          'Agent A sees Agent B\'s input as context',
          'Enables multi-agent collaboration chains',
        ],
      },
    ],
  },

  // ── 5. Multi-Agent Channel Collaboration ──────────────────
  {
    id: 'channel-thread',
    title: 'Multi-Agent Channel Collaboration',
    description:
      'How channels enable multi-agent teamwork — the orchestrator delegates to specialist agents who each contribute to the thread.',
    icon: '🏢',
    steps: [
      {
        id: 'channel-1',
        label: 'User creates a channel',
        detail:
          'User creates a new channel with a name, description, and purpose. Channels are the workspace for multi-agent collaboration.',
        system: 'UI',
        technical: ['POST /api/channels', 'Body: { name, description }'],
      },
      {
        id: 'channel-2',
        label: 'Add employee members',
        detail:
          'User adds AI employees to the channel as members. Each member will participate in thread discussions according to their role and expertise.',
        system: 'API',
        technical: [
          'POST /api/channels/{id}/members',
          'Body: { employee_ids: [...] }',
          'ChannelMember rows created',
        ],
      },
      {
        id: 'channel-3',
        label: 'Post a thread message',
        detail:
          'User posts a message in the channel to start a thread. This is the prompt that will be processed by the channel\'s agent team.',
        system: 'UI',
        technical: [
          'POST /api/channels/{id}/threads',
          'Body: { content: "..." }',
          'ThreadMessage created with role="user"',
        ],
      },
      {
        id: 'channel-4',
        label: 'Published to NATS',
        detail:
          'The thread message is published to the channel\'s NATS subject for the dispatcher to pick up and process.',
        system: 'NATS',
        technical: [
          'js.publish("channel.{channel_id}.thread.incoming", payload)',
          'Payload: { thread_id, content, member_ids, channel_id }',
          'Stream: AGENT_EVENTS',
        ],
      },
      {
        id: 'channel-5',
        label: 'Dispatcher spawns Modal sandbox',
        detail:
          'The channel consumer in the dispatcher picks up the message and creates a Modal sandbox for the channel orchestrator.',
        system: 'Dispatcher',
        technical: [
          'Channel consumer: channel_consumer',
          'modal.Sandbox.create() with tenant volume',
          'All member employee data passed in payload',
        ],
      },
      {
        id: 'channel-6',
        label: 'Orchestrator prompt built',
        detail:
          'The sandbox builds an orchestrator prompt containing the team roster — each member\'s name, role, system prompt, and capabilities.',
        system: 'Modal',
        technical: [
          'build_orchestrator_prompt(members)',
          'Team roster with roles and capabilities',
          'Orchestrator instructions for delegation',
        ],
      },
      {
        id: 'channel-7',
        label: 'Claude Agent Teams mode',
        detail:
          'The Claude Agent SDK is invoked in teams mode, where the orchestrator can delegate to specialist sub-agents — each representing a channel member.',
        system: 'Modal',
        technical: [
          'Claude Agent Teams mode enabled',
          'Each member → sub-agent with own system prompt',
          'Orchestrator coordinates delegation',
        ],
      },
      {
        id: 'channel-8',
        label: 'Orchestrator delegates to specialists',
        detail:
          'The orchestrator analyzes the user\'s request and delegates sub-tasks to the appropriate specialist agents based on their expertise.',
        system: 'OpenRouter',
        technical: [
          'Orchestrator LLM call via OpenRouter',
          'Delegation decisions based on member roles',
          'Each delegate gets focused sub-task',
        ],
      },
      {
        id: 'channel-9',
        label: 'Specialist agents process',
        detail:
          'Each delegated agent processes its sub-task with its own tools, system prompt, and MCP servers. They work independently within the sandbox.',
        system: 'Modal',
        technical: [
          'Per-agent tool resolution',
          'Per-agent MCP server configs',
          'Independent processing with own CLAUDE.md context',
        ],
      },
      {
        id: 'channel-10',
        label: 'Per-agent streaming events',
        detail:
          'Each agent\'s output is streamed as separate events on NATS, tagged with the agent\'s employee ID so the UI can attribute responses correctly.',
        system: 'NATS',
        technical: [
          'nc.publish("channel.{id}.thread.stream", event)',
          'Events tagged with employee_id',
          'UI shows which agent is "typing"',
        ],
      },
      {
        id: 'channel-11',
        label: 'Thread artifacts compiled',
        detail:
          'The orchestrator compiles the final thread response from all specialist contributions, creating a cohesive output.',
        system: 'Modal',
        technical: [
          'Orchestrator synthesizes specialist outputs',
          'Artifacts (code, docs, etc.) collected',
          'Final thread response assembled',
        ],
      },
      {
        id: 'channel-12',
        label: 'ThreadMessages persisted',
        detail:
          'All messages — orchestrator and specialist responses — are persisted as ThreadMessage rows in PostgreSQL.',
        system: 'Database',
        technical: [
          'INSERT INTO thread_messages (thread_id, employee_id, content, role)',
          'One row per agent contribution',
          'Cost tracked per agent',
        ],
      },
      {
        id: 'channel-13',
        label: 'Cost split across agents',
        detail:
          'Each participating agent\'s LLM cost is tracked individually and debited from their own budget, ensuring fair cost attribution.',
        system: 'Database',
        technical: [
          'UPDATE employees SET total_spent = total_spent + :cost',
          'Per-agent cost tracking',
          'Channel-level cost aggregation available',
        ],
      },
    ],
  },

  // ── 6. Install & Use a Tool ───────────────────────────────
  {
    id: 'install-tool',
    title: 'Install & Use a Tool',
    description:
      'The full tool lifecycle — from marketplace browsing through MCP server injection and OAuth integration for connected services.',
    icon: '🔧',
    steps: [
      {
        id: 'tool-1',
        label: 'Browse the Tool Marketplace',
        detail:
          'User visits the Tools page which shows a marketplace of available MCP servers. Each tool shows its name, description, and installation method (npm/pip/HTTP).',
        system: 'UI',
        technical: ['GET /api/tools/marketplace', 'Displays: name, description, install_type'],
      },
      {
        id: 'tool-2',
        label: 'Install MCP server',
        detail:
          'User clicks "Install" on a tool. The API creates a Tool record with the MCP server\'s configuration — command, args, and environment variables.',
        system: 'API',
        technical: [
          'POST /api/tools',
          'Body: { name, install_type, command, args, env_vars }',
          'install_type: "npm" | "pip" | "http"',
        ],
      },
      {
        id: 'tool-3',
        label: 'Tool record created in DB',
        detail:
          'The Tool is persisted with its MCP server configuration. It\'s now available for assignment to any employee in the tenant.',
        system: 'Database',
        technical: [
          'INSERT INTO tools (id, tenant_id, name, command, args, env_vars)',
          'Tool scoped to tenant',
        ],
      },
      {
        id: 'tool-4',
        label: 'Assign tool to employee',
        detail:
          'User assigns the installed tool to a specific employee via the employee\'s tool management panel.',
        system: 'API',
        technical: [
          'POST /api/employees/{id}/tools',
          'Creates EmployeeTool junction record',
          'Body: { tool_id }',
        ],
      },
      {
        id: 'tool-5',
        label: 'Skill synced to filesystem',
        detail:
          '_sync_skill_to_filesystem() writes the tool configuration to the employee\'s workspace on the Modal volume so the sandbox can load it.',
        system: 'API',
        technical: [
          '_sync_skill_to_filesystem(employee_id, tool)',
          'Writes to /data/employees/{id}/tools/{tool_name}.json',
          'Modal volume write via VolumeClient',
        ],
      },
      {
        id: 'tool-6',
        label: 'Next invocation: resolve_tools()',
        detail:
          'When the agent is next invoked, resolve_tools() loads all EmployeeTool records and their associated Tool configs from Postgres.',
        system: 'Modal',
        technical: [
          'resolve_tools(employee_id, db)',
          'SELECT tools.* FROM employee_tools JOIN tools',
          'Returns List[McpServerConfig]',
        ],
      },
      {
        id: 'tool-7',
        label: 'MCP server config injected',
        detail:
          'Each tool\'s MCP server configuration is injected into the ClaudeAgentOptions, telling the Claude SDK how to spawn and connect to each MCP server.',
        system: 'Modal',
        technical: [
          'ClaudeAgentOptions.mcp_servers = [...]',
          'Config: { command: "npx", args: ["-y", "@tool/server"], env: {...} }',
        ],
      },
      {
        id: 'tool-8',
        label: 'Claude SDK spawns MCP servers',
        detail:
          'The Claude SDK spawns each MCP server as a child process within the sandbox. The agent can now call any functions exposed by these servers.',
        system: 'Modal',
        technical: [
          'Claude SDK: child_process.spawn(command, args)',
          'JSON-RPC 2.0 protocol over stdio',
          'Agent sees tool functions in its capabilities',
        ],
      },
      {
        id: 'tool-9',
        label: 'Agent calls tool functions',
        detail:
          'During conversation, the agent can invoke tool functions (e.g., search emails, read calendar). The Claude SDK handles the tool_use → tool_result round-trip.',
        system: 'OpenRouter',
        technical: [
          'LLM generates tool_use blocks',
          'SDK executes tool via MCP server',
          'tool_result sent back to LLM for synthesis',
        ],
      },
      {
        id: 'tool-10',
        label: 'For OAuth tools: connect integration',
        detail:
          'Tools requiring OAuth (Gmail, Calendar) need an integration connection first. User clicks "Connect" which initiates the OAuth flow.',
        system: 'UI',
        technical: [
          'POST /api/integrations/{tool_id}/connect',
          'Returns: { auth_url }',
          'Browser redirects to auth_url',
        ],
      },
      {
        id: 'tool-11',
        label: 'Google OAuth consent flow',
        detail:
          'User authenticates with Google and grants access to the requested scopes (Gmail read/send, Calendar read/write). Google redirects back with an auth code.',
        system: 'Google',
        technical: [
          'Google OAuth 2.0 authorization_code flow',
          'Scopes: gmail.readonly, gmail.send, calendar.events',
          'State parameter signed with HMAC for CSRF protection',
        ],
      },
      {
        id: 'tool-12',
        label: 'Tokens encrypted and stored',
        detail:
          'The callback endpoint exchanges the auth code for access/refresh tokens. Tokens are Fernet-encrypted and stored in the ToolAccount table.',
        system: 'Database',
        technical: [
          'GET /api/integrations/callback?code=...&state=...',
          'Fernet.encrypt(access_token), Fernet.encrypt(refresh_token)',
          'INSERT INTO tool_accounts (tool_id, encrypted_access_token, ...)',
        ],
      },
      {
        id: 'tool-13',
        label: 'Agent runner refreshes tokens',
        detail:
          'When the agent runs, the sandbox checks if OAuth tokens are near expiry (within 5 minutes) and automatically refreshes them before starting.',
        system: 'Modal',
        technical: [
          'check_token_expiry(tool_account)',
          'If expires_at - now < 300s: refresh_google_token()',
          'Updated tokens re-encrypted and saved',
        ],
      },
    ],
  },

  // ── 7. Schedule a Recurring Task ──────────────────────────
  {
    id: 'schedule-outcome',
    title: 'Schedule a Recurring Task',
    description:
      'How Outcomes work — user-defined recurring tasks with cron schedules, budget guards, and the 60-second scheduler tick.',
    icon: '⏰',
    steps: [
      {
        id: 'outcome-1',
        label: 'User creates an Outcome',
        detail:
          'User defines a recurring task for an employee with a description (the prompt), a cron schedule, and a per-run budget limit.',
        system: 'UI',
        technical: [
          'POST /api/outcomes',
          'Body: { employee_id, description, cron_expression, budget_per_run }',
          'Cron: e.g., "0 9 * * 1-5" for weekdays at 9am',
        ],
      },
      {
        id: 'outcome-2',
        label: 'Outcome persisted with next_run_at',
        detail:
          'The Outcome record is stored in PostgreSQL with the cron expression and a computed next_run_at timestamp based on the cron schedule.',
        system: 'Database',
        technical: [
          'INSERT INTO outcomes (id, employee_id, description, cron_expression, next_run_at)',
          'next_run_at computed from croniter(cron_expression).get_next()',
          'status = "active"',
        ],
      },
      {
        id: 'outcome-3',
        label: 'Scheduler ticks every 60 seconds',
        detail:
          'The dispatcher service runs a scheduler loop on Railway that ticks every 60 seconds, checking for outcomes that are due to run.',
        system: 'Dispatcher',
        technical: [
          'asyncio.sleep(60) loop',
          'scheduler_tick() fires every 60s',
          'Runs on Railway alongside NATS consumers',
        ],
      },
      {
        id: 'outcome-4',
        label: 'Find due outcomes',
        detail:
          'The scheduler queries PostgreSQL for all outcomes where next_run_at <= now and status is active.',
        system: 'Dispatcher',
        technical: [
          'SELECT * FROM outcomes WHERE next_run_at <= NOW() AND status = "active"',
          'Batch processing of multiple due outcomes',
        ],
      },
      {
        id: 'outcome-5',
        label: 'Check employee budget',
        detail:
          'For each due outcome, the scheduler checks the employee\'s daily and lifetime budget. If the employee is over budget, the outcome is skipped until the next cycle.',
        system: 'Dispatcher',
        technical: [
          'check_budget(employee_id) → { daily_spent, lifetime_spent }',
          'Skip if daily_spent >= daily_budget',
          'Skip if lifetime_spent >= lifetime_budget',
        ],
      },
      {
        id: 'outcome-6',
        label: 'Check employee not already working',
        detail:
          'The scheduler checks the employee\'s status in NATS KV store. If the employee is already processing another request, the outcome waits.',
        system: 'NATS',
        technical: [
          'kv.get("employee_status.{employee_id}")',
          'Skip if status == "working"',
          'Prevents concurrent sandbox executions',
        ],
      },
      {
        id: 'outcome-7',
        label: 'Published to NATS',
        detail:
          'The scheduler publishes the outcome trigger to the employee\'s outcome NATS subject for the dispatcher to create a sandbox.',
        system: 'NATS',
        technical: [
          'js.publish("employee.{id}.outcome.trigger", payload)',
          'Payload: { outcome_id, employee_id, description, tenant_id }',
        ],
      },
      {
        id: 'outcome-8',
        label: 'Modal sandbox spawned',
        detail:
          'The dispatcher\'s outcome consumer picks up the trigger and spawns a Modal sandbox, identical to the DM flow but with outcome-specific handling.',
        system: 'Dispatcher',
        technical: [
          'Outcome consumer: outcome_consumer',
          'modal.Sandbox.create() with tenant volume',
          'Timeout: 600s',
        ],
      },
      {
        id: 'outcome-9',
        label: 'Session and message created',
        detail:
          'handle_outcome creates a fresh Session and a user Message containing the outcome description. Each run gets its own session for clean history.',
        system: 'Modal',
        technical: [
          'handle_outcome(payload)',
          'INSERT INTO sessions (employee_id, type) → "outcome"',
          'INSERT INTO messages (content) → outcome.description',
        ],
      },
      {
        id: 'outcome-10',
        label: 'Agent runs fresh (no resume)',
        detail:
          'Unlike DMs, outcome runs always start fresh — no sdk_session_id resume. The agent processes the task from scratch with a clean context.',
        system: 'Modal',
        technical: [
          'claude_agent.query(description, options)',
          'No --resume flag',
          'Clean context: only CLAUDE.md + outcome description',
        ],
      },
      {
        id: 'outcome-11',
        label: 'OutcomeRun persisted',
        detail:
          'When the agent completes, an OutcomeRun record is stored with the status, cost, duration, and the session ID for the user to review.',
        system: 'Database',
        technical: [
          'INSERT INTO outcome_runs (outcome_id, session_id, status, cost_usd, duration_s)',
          'status: "completed" | "failed" | "budget_exceeded"',
        ],
      },
      {
        id: 'outcome-12',
        label: 'next_run_at updated',
        detail:
          'The outcome\'s next_run_at is advanced to the next occurrence based on the cron expression, ready for the next scheduler tick.',
        system: 'Database',
        technical: [
          'UPDATE outcomes SET next_run_at = croniter(cron).get_next()',
          'Outcome remains active for future runs',
        ],
      },
      {
        id: 'outcome-13',
        label: 'User can review and follow up',
        detail:
          'The user can see outcome run history in the Tasks page. Each run links to its session, where the user can read the output and send follow-up messages.',
        system: 'UI',
        technical: [
          'GET /api/outcomes/{id}/runs',
          'Click run → opens session chat',
          'Follow-up messages trigger normal DM flow',
        ],
      },
    ],
  },

  // ── 8. Stop an Agent Mid-Stream ───────────────────────────
  {
    id: 'stop-agent',
    title: 'Stop an Agent Mid-Stream',
    description:
      'What happens when a user clicks Stop while an agent is generating — cancellation propagates through NATS to the sandbox, preserving partial output.',
    icon: '🛑',
    steps: [
      {
        id: 'stop-1',
        label: 'User clicks Stop button',
        detail:
          'While the agent is streaming a response, the user clicks the Stop button in the chat interface to cancel generation.',
        system: 'UI',
        technical: ['Stop button visible during streaming', 'onClick triggers stop API call'],
      },
      {
        id: 'stop-2',
        label: 'POST /api/employees/{id}/stop',
        detail:
          'The frontend calls the stop endpoint, which initiates the cancellation pipeline by publishing a stop signal to NATS.',
        system: 'API',
        technical: [
          'POST /api/employees/{employee_id}/stop',
          'No request body needed',
          'Returns 200 immediately',
        ],
      },
      {
        id: 'stop-3',
        label: 'Stop signal published to NATS',
        detail:
          'The API publishes a stop signal to the employee\'s NATS stop subject. This is a fire-and-forget publish — the sandbox is responsible for handling it.',
        system: 'NATS',
        technical: [
          'nc.publish("employee.{id}.dm.stop", b"")',
          'Fire-and-forget (no JetStream, just core NATS)',
          'Low-latency delivery',
        ],
      },
      {
        id: 'stop-4',
        label: 'Sandbox receives stop signal',
        detail:
          'The Modal sandbox has a NATS subscription listening for stop signals. When received, it sets the stop_event asyncio.Event.',
        system: 'Modal',
        technical: [
          'nc.subscribe("employee.{id}.dm.stop")',
          'Callback: stop_event.set()',
          'asyncio.Event used for clean cancellation',
        ],
      },
      {
        id: 'stop-5',
        label: 'stop_event.set() fires',
        detail:
          'The asyncio.Event triggers, which the main processing loop is waiting on alongside the Claude SDK query task.',
        system: 'Modal',
        technical: [
          'stop_event.set()',
          'asyncio.wait([query_task, stop_task], return_when=FIRST_COMPLETED)',
        ],
      },
      {
        id: 'stop-6',
        label: 'Query task cancelled',
        detail:
          'The Claude SDK query task is cancelled. Any in-progress LLM generation is aborted, and the SDK cleans up its child processes (MCP servers).',
        system: 'Modal',
        technical: [
          'query_task.cancel()',
          'Claude SDK gracefully terminates',
          'MCP server child processes cleaned up',
        ],
      },
      {
        id: 'stop-7',
        label: 'Partial response text preserved',
        detail:
          'Whatever text was streamed before the stop signal is preserved. The NATS event translator has been accumulating text_delta events into a full text buffer.',
        system: 'Modal',
        technical: [
          'translator.accumulated_text → partial response',
          'May be empty if stopped very early',
          'Includes any completed paragraphs/sentences',
        ],
      },
      {
        id: 'stop-8',
        label: 'SDK session ID saved from translator',
        detail:
          'The sdk_session_id is extracted from the translator (not the result, since there is no result). This allows the next message to resume the conversation.',
        system: 'Modal',
        technical: [
          'sdk_session_id = translator.sdk_session_id',
          'Captured from init event before stop',
          'Critical: NOT from result_message (which is null)',
        ],
      },
      {
        id: 'stop-9',
        label: 'Assistant message persisted',
        detail:
          'The partial response (or "(stopped)" if empty) is stored as the assistant message. The conversation history is preserved for resume.',
        system: 'Database',
        technical: [
          'INSERT INTO messages (session_id, role, content)',
          'content = partial_text or "(stopped)"',
          'role = "assistant"',
        ],
      },
      {
        id: 'stop-10',
        label: 'Employee status set to idle',
        detail:
          'The employee\'s status in NATS KV is updated back to "idle", freeing them for new requests.',
        system: 'NATS',
        technical: [
          'kv.put("employee_status.{id}", "idle")',
          'Status change propagated to UI via WebSocket',
        ],
      },
      {
        id: 'stop-11',
        label: 'Stream state cleared',
        detail:
          'The stream state in NATS KV is cleared, removing any partial streaming data and resetting the employee\'s streaming context.',
        system: 'NATS',
        technical: [
          'kv.delete("stream_state.{session_id}")',
          'Clean state for next interaction',
        ],
      },
      {
        id: 'stop-12',
        label: 'Result event with stopped subtype',
        detail:
          'A result event with subtype="stopped" is published to NATS, signaling the UI that generation was intentionally stopped (not an error).',
        system: 'NATS',
        technical: [
          'nc.publish("employee.{id}.dm.stream", result_event)',
          'Event: { type: "result", subtype: "stopped" }',
          'Payload: { content: partial_text, stopped: true }',
        ],
      },
      {
        id: 'stop-13',
        label: 'UI shows stopped state',
        detail:
          'The StreamingMessage component transitions to the stopped state — showing the partial response with a "Generation stopped" indicator.',
        system: 'UI',
        technical: [
          'useStreamState processes stopped result',
          'Streaming indicator removed',
          '"Stopped" badge shown on message',
        ],
      },
      {
        id: 'stop-14',
        label: 'Next message resumes with context',
        detail:
          'When the user sends a new message, the agent resumes the conversation using the saved sdk_session_id, with full knowledge of the stopped interaction.',
        system: 'Modal',
        technical: [
          'claude_agent.query(message, resume=sdk_session_id)',
          'Agent sees prior partial response in context',
          'Conversation continuity preserved',
        ],
      },
    ],
  },
];
