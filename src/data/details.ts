import type { Node, Edge } from '@xyflow/react';

export interface ComponentDetail {
  nodes: Node[];
  edges: Edge[];
  panelInfo: {
    title: string;
    description: string;
    technology: string[];
    features: string[];
    stats?: Record<string, string>;
  };
}

// ──────────────────────────────────────────────────────────────
// Helper: create a detail node
// ──────────────────────────────────────────────────────────────
function dn(
  id: string,
  label: string,
  x: number,
  y: number,
  group?: string,
): Node {
  return {
    id,
    type: 'detail',
    position: { x, y },
    data: { label, group: group ?? '' },
  };
}

function de(
  id: string,
  source: string,
  target: string,
  label?: string,
): Edge {
  return {
    id,
    source,
    target,
    type: 'animated',
    animated: false,
    data: { label: label ?? '' },
  };
}

// ──────────────────────────────────────────────────────────────
// 1. Browser / UI
// ──────────────────────────────────────────────────────────────
const browserUiNodes: Node[] = [
  // Group: Pages (x=0)
  dn('ui-pages-header', 'Pages', 0, 0, 'Pages'),
  dn('ui-employees', 'Employees', 0, 80, 'Pages'),
  dn('ui-channels', 'Channels', 0, 200, 'Pages'),
  dn('ui-tasks', 'Tasks', 0, 320, 'Pages'),
  dn('ui-tools', 'Tools', 0, 440, 'Pages'),
  dn('ui-skills', 'Skills', 0, 560, 'Pages'),
  dn('ui-storage', 'Storage', 0, 680, 'Pages'),

  // Group: Components (x=300)
  dn('ui-comp-header', 'Components', 300, 0, 'Components'),
  dn('ui-chat-container', 'ChatContainer', 300, 80, 'Components'),
  dn('ui-message-bubble', 'MessageBubble', 300, 200, 'Components'),
  dn('ui-streaming-msg', 'StreamingMessage', 300, 320, 'Components'),
  dn('ui-mention-panel', 'MentionPanel', 300, 440, 'Components'),
  dn('ui-tool-graph', 'ToolGraph', 300, 560, 'Components'),
  dn('ui-artifact', 'ArtifactRenderer', 300, 680, 'Components'),
  dn('ui-chat-input', 'ChatInput', 300, 800, 'Components'),

  // Group: State & Auth (x=600)
  dn('ui-state-header', 'State & Auth', 600, 0, 'State & Auth'),
  dn('ui-use-ws', 'useWebSocket', 600, 80, 'State & Auth'),
  dn('ui-use-stream', 'useStreamState', 600, 200, 'State & Auth'),
  dn('ui-use-channel', 'useChannelStreamState', 600, 320, 'State & Auth'),
  dn('ui-clerk-provider', 'ClerkProvider', 600, 440, 'State & Auth'),
];

const browserUiEdges: Edge[] = [
  de('ui-e1', 'ui-employees', 'ui-chat-container', 'renders'),
  de('ui-e2', 'ui-channels', 'ui-chat-container', 'renders'),
  de('ui-e3', 'ui-chat-container', 'ui-message-bubble', 'contains'),
  de('ui-e4', 'ui-chat-container', 'ui-streaming-msg', 'contains'),
  de('ui-e5', 'ui-chat-container', 'ui-chat-input', 'contains'),
  de('ui-e6', 'ui-chat-container', 'ui-mention-panel', 'triggers'),
  de('ui-e7', 'ui-message-bubble', 'ui-artifact', 'renders'),
  de('ui-e8', 'ui-tools', 'ui-tool-graph', 'renders'),
  de('ui-e9', 'ui-use-ws', 'ui-streaming-msg', 'drives'),
  de('ui-e10', 'ui-use-stream', 'ui-chat-container', 'state'),
  de('ui-e11', 'ui-use-channel', 'ui-chat-container', 'state'),
  de('ui-e12', 'ui-clerk-provider', 'ui-use-ws', 'auth token'),
];

// ──────────────────────────────────────────────────────────────
// 2. API Server
// ──────────────────────────────────────────────────────────────
const apiServerNodes: Node[] = [
  // Group: Routers (x=0)
  dn('api-routers-header', 'Routers', 0, 0, 'Routers'),
  dn('api-employees', '/employees', 0, 80, 'Routers'),
  dn('api-sessions', '/sessions', 0, 200, 'Routers'),
  dn('api-channels', '/channels', 0, 320, 'Routers'),
  dn('api-tools', '/tools', 0, 440, 'Routers'),
  dn('api-skills', '/skills', 0, 560, 'Routers'),
  dn('api-outcomes', '/outcomes', 0, 680, 'Routers'),
  dn('api-human-todos', '/human_todos', 0, 800, 'Routers'),
  dn('api-storage', '/storage', 0, 920, 'Routers'),
  dn('api-workspace', '/workspace', 0, 1040, 'Routers'),
  dn('api-integrations', '/integrations', 0, 1160, 'Routers'),
  dn('api-search', '/search', 0, 1280, 'Routers'),
  dn('api-traces', '/traces', 0, 1400, 'Routers'),

  // Group: Dependencies (x=300)
  dn('api-deps-header', 'Dependencies', 300, 0, 'Dependencies'),
  dn('api-get-tenant', 'get_current_tenant', 300, 80, 'Dependencies'),
  dn('api-get-db', 'get_db', 300, 200, 'Dependencies'),
  dn('api-get-nats', 'get_nats', 300, 320, 'Dependencies'),
  dn('api-get-js', 'get_js', 300, 440, 'Dependencies'),
  dn('api-get-kv', 'get_kv', 300, 560, 'Dependencies'),

  // Group: WebSocket (x=600)
  dn('api-ws-header', 'WebSocket', 600, 0, 'WebSocket'),
  dn('api-ws-auth', 'Auth', 600, 80, 'WebSocket'),
  dn('api-ws-subscribe', 'Subscribe', 600, 200, 'WebSocket'),
  dn('api-ws-bridge', 'NATS Bridge', 600, 320, 'WebSocket'),
];

const apiServerEdges: Edge[] = [
  de('api-e1', 'api-employees', 'api-get-tenant', 'depends'),
  de('api-e2', 'api-employees', 'api-get-db', 'depends'),
  de('api-e3', 'api-sessions', 'api-get-db', 'depends'),
  de('api-e4', 'api-sessions', 'api-get-nats', 'publishes'),
  de('api-e5', 'api-channels', 'api-get-db', 'depends'),
  de('api-e6', 'api-channels', 'api-get-nats', 'publishes'),
  de('api-e7', 'api-ws-auth', 'api-get-tenant', 'validates'),
  de('api-e8', 'api-ws-subscribe', 'api-get-nats', 'subscribes'),
  de('api-e9', 'api-ws-bridge', 'api-ws-subscribe', 'bridges'),
  de('api-e10', 'api-outcomes', 'api-get-db', 'depends'),
  de('api-e11', 'api-integrations', 'api-get-db', 'depends'),
  de('api-e12', 'api-get-nats', 'api-get-js', 'provides'),
  de('api-e13', 'api-get-nats', 'api-get-kv', 'provides'),
];

// ──────────────────────────────────────────────────────────────
// 3. NATS JetStream
// ──────────────────────────────────────────────────────────────
const natsNodes: Node[] = [
  // Group: Streams (x=0)
  dn('nats-streams-header', 'Streams', 0, 0, 'Streams'),
  dn('nats-agent-stream', 'AGENT_EVENTS', 0, 80, 'Streams'),
  dn('nats-outcome-stream', 'OUTCOME_EVENTS', 0, 200, 'Streams'),

  // Group: Subjects (x=300)
  dn('nats-subjects-header', 'Subjects', 300, 0, 'Subjects'),
  dn('nats-sub-dm-req', 'agent.{id}.dm.request', 300, 80, 'Subjects'),
  dn('nats-sub-dm-stream', 'agent.{id}.dm.stream', 300, 200, 'Subjects'),
  dn('nats-sub-ch-req', 'channel.{id}.request', 300, 320, 'Subjects'),
  dn('nats-sub-ch-stream', 'channel.{id}.stream', 300, 440, 'Subjects'),
  dn('nats-sub-mention', 'agent.{id}.mention', 300, 560, 'Subjects'),
  dn('nats-sub-outcome-req', 'outcome.{id}.request', 300, 680, 'Subjects'),
  dn('nats-sub-outcome-stream', 'outcome.{id}.stream', 300, 800, 'Subjects'),
  dn('nats-sub-status', 'agent.{id}.status', 300, 920, 'Subjects'),

  // Group: KV Store (x=600)
  dn('nats-kv-header', 'KV Store', 600, 0, 'KV Store'),
  dn('nats-kv-status', 'employee_status', 600, 80, 'KV Store'),
  dn('nats-kv-stream', 'stream_state', 600, 200, 'KV Store'),
  dn('nats-kv-channel', 'channel_stream_state', 600, 320, 'KV Store'),
];

const natsEdges: Edge[] = [
  de('nats-e1', 'nats-agent-stream', 'nats-sub-dm-req', 'routes'),
  de('nats-e2', 'nats-agent-stream', 'nats-sub-dm-stream', 'routes'),
  de('nats-e3', 'nats-agent-stream', 'nats-sub-ch-req', 'routes'),
  de('nats-e4', 'nats-agent-stream', 'nats-sub-ch-stream', 'routes'),
  de('nats-e5', 'nats-agent-stream', 'nats-sub-mention', 'routes'),
  de('nats-e6', 'nats-agent-stream', 'nats-sub-status', 'routes'),
  de('nats-e7', 'nats-outcome-stream', 'nats-sub-outcome-req', 'routes'),
  de('nats-e8', 'nats-outcome-stream', 'nats-sub-outcome-stream', 'routes'),
  de('nats-e9', 'nats-sub-status', 'nats-kv-status', 'updates'),
  de('nats-e10', 'nats-sub-dm-stream', 'nats-kv-stream', 'updates'),
  de('nats-e11', 'nats-sub-ch-stream', 'nats-kv-channel', 'updates'),
];

// ──────────────────────────────────────────────────────────────
// 4. Modal Sandboxes
// ──────────────────────────────────────────────────────────────
const modalNodes: Node[] = [
  // Group: Lifecycle (x=0)
  dn('modal-lifecycle-header', 'Lifecycle', 0, 0, 'Lifecycle'),
  dn('modal-spawn', 'Sandbox.create()', 0, 80, 'Lifecycle'),
  dn('modal-init', 'Init Environment', 0, 200, 'Lifecycle'),
  dn('modal-execute', 'Run Claude CLI', 0, 320, 'Lifecycle'),
  dn('modal-teardown', 'Cleanup & Exit', 0, 440, 'Lifecycle'),

  // Group: Storage (x=300)
  dn('modal-storage-header', 'Storage', 300, 0, 'Storage'),
  dn('modal-volume', 'Tenant Volume', 300, 80, 'Storage'),
  dn('modal-session-files', 'Session .jsonl Files', 300, 200, 'Storage'),
  dn('modal-artifacts', 'Artifact Output', 300, 320, 'Storage'),

  // Group: Claude SDK (x=600)
  dn('modal-sdk-header', 'Claude SDK', 600, 0, 'Claude SDK'),
  dn('modal-agent-sdk', 'Claude Agent SDK', 600, 80, 'Claude SDK'),
  dn('modal-tool-use', 'Tool Use', 600, 200, 'Claude SDK'),
  dn('modal-streaming', 'Streaming Output', 600, 320, 'Claude SDK'),

  // Group: MCP Servers (x=900)
  dn('modal-mcp-header', 'MCP Servers', 900, 0, 'MCP Servers'),
  dn('modal-mcp-gmail', 'Gmail MCP', 900, 80, 'MCP Servers'),
  dn('modal-mcp-calendar', 'Calendar MCP', 900, 200, 'MCP Servers'),
  dn('modal-mcp-custom', 'Custom MCP', 900, 320, 'MCP Servers'),
];

const modalEdges: Edge[] = [
  de('modal-e1', 'modal-spawn', 'modal-init', 'creates'),
  de('modal-e2', 'modal-init', 'modal-execute', 'starts'),
  de('modal-e3', 'modal-execute', 'modal-teardown', 'completes'),
  de('modal-e4', 'modal-init', 'modal-volume', 'mounts'),
  de('modal-e5', 'modal-volume', 'modal-session-files', 'contains'),
  de('modal-e6', 'modal-execute', 'modal-artifacts', 'writes'),
  de('modal-e7', 'modal-execute', 'modal-agent-sdk', 'invokes'),
  de('modal-e8', 'modal-agent-sdk', 'modal-tool-use', 'executes'),
  de('modal-e9', 'modal-agent-sdk', 'modal-streaming', 'emits'),
  de('modal-e10', 'modal-tool-use', 'modal-mcp-gmail', 'calls'),
  de('modal-e11', 'modal-tool-use', 'modal-mcp-calendar', 'calls'),
  de('modal-e12', 'modal-tool-use', 'modal-mcp-custom', 'calls'),
  de('modal-e13', 'modal-session-files', 'modal-execute', 'resumes'),
];

// ──────────────────────────────────────────────────────────────
// 5. PostgreSQL
// ──────────────────────────────────────────────────────────────
const postgresNodes: Node[] = [
  // Group: Core Models (x=0)
  dn('pg-core-header', 'Core Models', 0, 0, 'Core Models'),
  dn('pg-tenant', 'Tenant', 0, 80, 'Core Models'),
  dn('pg-employee', 'Employee', 0, 200, 'Core Models'),
  dn('pg-session', 'Session', 0, 320, 'Core Models'),
  dn('pg-message', 'Message', 0, 440, 'Core Models'),
  dn('pg-channel', 'Channel', 0, 560, 'Core Models'),
  dn('pg-channel-msg', 'ChannelMessage', 0, 680, 'Core Models'),

  // Group: Tool System (x=300)
  dn('pg-tool-header', 'Tool System', 300, 0, 'Tool System'),
  dn('pg-tool', 'Tool', 300, 80, 'Tool System'),
  dn('pg-skill', 'Skill', 300, 200, 'Tool System'),
  dn('pg-integration', 'Integration', 300, 320, 'Tool System'),

  // Group: Operations (x=600)
  dn('pg-ops-header', 'Operations', 600, 0, 'Operations'),
  dn('pg-outcome', 'Outcome', 600, 80, 'Operations'),
  dn('pg-human-todo', 'HumanTodo', 600, 200, 'Operations'),
  dn('pg-storage', 'StorageFile', 600, 320, 'Operations'),
  dn('pg-trace', 'Trace', 600, 440, 'Operations'),
];

const postgresEdges: Edge[] = [
  de('pg-e1', 'pg-tenant', 'pg-employee', 'has many'),
  de('pg-e2', 'pg-employee', 'pg-session', 'has many'),
  de('pg-e3', 'pg-session', 'pg-message', 'has many'),
  de('pg-e4', 'pg-tenant', 'pg-channel', 'has many'),
  de('pg-e5', 'pg-channel', 'pg-channel-msg', 'has many'),
  de('pg-e6', 'pg-employee', 'pg-tool', 'has many'),
  de('pg-e7', 'pg-employee', 'pg-skill', 'has many'),
  de('pg-e8', 'pg-tenant', 'pg-integration', 'has many'),
  de('pg-e9', 'pg-employee', 'pg-outcome', 'has many'),
  de('pg-e10', 'pg-outcome', 'pg-human-todo', 'creates'),
  de('pg-e11', 'pg-tenant', 'pg-storage', 'has many'),
  de('pg-e12', 'pg-session', 'pg-trace', 'has many'),
];

// ──────────────────────────────────────────────────────────────
// 6. Agent Dispatcher
// ──────────────────────────────────────────────────────────────
const dispatcherNodes: Node[] = [
  // Group: Consumers (x=0)
  dn('disp-consumers-header', 'Consumers', 0, 0, 'Consumers'),
  dn('disp-dm-consumer', 'DM Consumer', 0, 80, 'Consumers'),
  dn('disp-channel-consumer', 'Channel Consumer', 0, 200, 'Consumers'),
  dn('disp-outcome-consumer', 'Outcome Consumer', 0, 320, 'Consumers'),

  // Group: Scheduling (x=300)
  dn('disp-sched-header', 'Scheduling', 300, 0, 'Scheduling'),
  dn('disp-ticker', '60s Ticker', 300, 80, 'Scheduling'),
  dn('disp-cron-eval', 'Cron Evaluator', 300, 200, 'Scheduling'),
];

const dispatcherEdges: Edge[] = [
  de('disp-e1', 'disp-dm-consumer', 'disp-channel-consumer', 'parallel'),
  de('disp-e2', 'disp-channel-consumer', 'disp-outcome-consumer', 'parallel'),
  de('disp-e3', 'disp-ticker', 'disp-cron-eval', 'triggers'),
  de('disp-e4', 'disp-cron-eval', 'disp-outcome-consumer', 'publishes'),
];

// ──────────────────────────────────────────────────────────────
// 7. OpenRouter
// ──────────────────────────────────────────────────────────────
const openrouterNodes: Node[] = [
  // Group: Configuration (x=0)
  dn('or-config-header', 'Configuration', 0, 0, 'Configuration'),
  dn('or-endpoint', 'API Endpoint', 0, 80, 'Configuration'),
  dn('or-auth', 'Authentication', 0, 200, 'Configuration'),
  dn('or-model', 'Model Selection', 0, 320, 'Configuration'),
];

const openrouterEdges: Edge[] = [
  de('or-e1', 'or-endpoint', 'or-auth', 'requires'),
  de('or-e2', 'or-auth', 'or-model', 'selects'),
];

// ──────────────────────────────────────────────────────────────
// 8. Clerk Auth
// ──────────────────────────────────────────────────────────────
const clerkNodes: Node[] = [
  // Group: Auth Flow (x=0)
  dn('clerk-flow-header', 'Auth Flow', 0, 0, 'Auth Flow'),
  dn('clerk-jwt', 'JWT Verification', 0, 80, 'Auth Flow'),
  dn('clerk-tenant', 'Tenant Resolution', 0, 200, 'Auth Flow'),
  dn('clerk-route', 'Route Protection', 0, 320, 'Auth Flow'),
];

const clerkEdges: Edge[] = [
  de('clerk-e1', 'clerk-jwt', 'clerk-tenant', 'resolves'),
  de('clerk-e2', 'clerk-tenant', 'clerk-route', 'authorizes'),
];

// ──────────────────────────────────────────────────────────────
// 9. Google OAuth
// ──────────────────────────────────────────────────────────────
const googleOauthNodes: Node[] = [
  // Group: OAuth Flow (x=0)
  dn('goauth-flow-header', 'OAuth Flow', 0, 0, 'OAuth Flow'),
  dn('goauth-connect', 'Connect', 0, 80, 'OAuth Flow'),
  dn('goauth-consent', 'Google Consent', 0, 200, 'OAuth Flow'),
  dn('goauth-callback', 'Callback', 0, 320, 'OAuth Flow'),
  dn('goauth-token', 'Token Storage', 0, 440, 'OAuth Flow'),
];

const googleOauthEdges: Edge[] = [
  de('goauth-e1', 'goauth-connect', 'goauth-consent', 'redirects'),
  de('goauth-e2', 'goauth-consent', 'goauth-callback', 'returns'),
  de('goauth-e3', 'goauth-callback', 'goauth-token', 'stores'),
];

// ──────────────────────────────────────────────────────────────
// Export all details
// ──────────────────────────────────────────────────────────────
export const componentDetails: Record<string, ComponentDetail> = {
  'browser-ui': {
    nodes: browserUiNodes,
    edges: browserUiEdges,
    panelInfo: {
      title: 'Browser / UI',
      description:
        'Next.js 16 frontend application providing the Slack-like interface for interacting with AI employees. Features real-time WebSocket streaming, rich artifact rendering, and @mention workflows.',
      technology: [
        'Next.js 16',
        'React 18',
        'TypeScript',
        'Tailwind CSS',
        'Clerk',
      ],
      features: [
        'Real-time WebSocket streaming',
        'Artifact rendering (HTML/React/CSV/SVG/Mermaid)',
        '@mention with split-view panel',
        '3D agent/channel configurators',
        'Unread message tracking',
      ],
    },
  },

  'api-server': {
    nodes: apiServerNodes,
    edges: apiServerEdges,
    panelInfo: {
      title: 'API Server',
      description:
        'FastAPI backend serving as the central orchestration layer. Handles REST API requests, manages WebSocket connections for real-time streaming, and bridges NATS events to the browser.',
      technology: ['FastAPI', 'Python 3.12', 'Uvicorn', 'SQLAlchemy'],
      features: [
        '12 REST routers with 60+ endpoints',
        'WebSocket gateway bridging NATS \u2192 browser',
        'Clerk JWT middleware',
        'Multi-tenant isolation on all queries',
        'VolumeClient for Modal volume access',
      ],
    },
  },

  nats: {
    nodes: natsNodes,
    edges: natsEdges,
    panelInfo: {
      title: 'NATS JetStream',
      description:
        'High-performance message broker providing durable pub/sub messaging and key-value storage. Ensures reliable message delivery between the API server, dispatcher, and Modal sandboxes.',
      technology: ['NATS 2', 'JetStream', 'KV Store'],
      features: [
        'Durable consumers for reliable delivery',
        '1-hour message retention',
        'Real-time pub/sub for streaming',
        'KV for employee status + stream state',
      ],
    },
  },

  'modal-sandboxes': {
    nodes: modalNodes,
    edges: modalEdges,
    panelInfo: {
      title: 'Modal Sandboxes',
      description:
        'Isolated per-tenant containers running the Claude Agent SDK. Each sandbox has its own gVisor-isolated environment, dedicated volume storage, and MCP server access.',
      technology: [
        'Modal',
        'gVisor',
        'Claude Agent SDK',
        'Python 3.12',
      ],
      features: [
        'Per-tenant volume isolation',
        'Infinite horizontal scaling',
        'Claude CLI binary execution as non-root',
        'OAuth token refresh for integrations',
        'Session resume via SDK .jsonl files',
      ],
      stats: {
        Container: '2 CPU / 2GB RAM',
        Timeout: '10 minutes',
        Isolation: 'gVisor sandbox',
      },
    },
  },

  postgres: {
    nodes: postgresNodes,
    edges: postgresEdges,
    panelInfo: {
      title: 'PostgreSQL',
      description:
        'Multi-tenant persistent storage layer with 15+ SQLAlchemy models. All data is scoped by tenant_id and credentials are Fernet-encrypted at rest.',
      technology: ['PostgreSQL 16', 'AsyncPG', 'SQLAlchemy', 'Alembic'],
      features: [
        '15+ models with UUID primary keys',
        'Multi-tenant via tenant_id FK',
        'Fernet-encrypted credentials',
        'Async connection pool (20+10)',
        '13 Alembic migrations',
      ],
    },
  },

  dispatcher: {
    nodes: dispatcherNodes,
    edges: dispatcherEdges,
    panelInfo: {
      title: 'Agent Dispatcher',
      description:
        'Lightweight service that listens to NATS JetStream subjects and spawns Modal sandboxes for each incoming request. Also runs a 60-second scheduler for cron-based outcome tasks.',
      technology: ['Python 3.12', 'NATS-py', 'Modal SDK'],
      features: [
        'JetStream durable consumers',
        'Immediate ack + fire-and-forget spawn',
        '60-second scheduler tick',
        'Cron expression evaluation',
        'Budget gate before outcome trigger',
      ],
    },
  },

  openrouter: {
    nodes: openrouterNodes,
    edges: openrouterEdges,
    panelInfo: {
      title: 'OpenRouter',
      description:
        'LLM routing service used as ANTHROPIC_BASE_URL so that all Claude Agent SDK requests are proxied through OpenRouter, enabling per-employee model selection and cost tracking.',
      technology: ['OpenRouter API', 'Claude Agent SDK'],
      features: [
        'Set as ANTHROPIC_BASE_URL',
        'Per-employee model selection',
        'Cost tracking per request',
      ],
      stats: {
        Endpoint: 'https://openrouter.ai/api',
        'Default Model': 'anthropic/claude-sonnet-4',
      },
    },
  },

  clerk: {
    nodes: clerkNodes,
    edges: clerkEdges,
    panelInfo: {
      title: 'Clerk Auth',
      description:
        'Authentication provider handling user login, JWT issuance, and tenant resolution. Integrates with both the Next.js frontend (via ClerkProvider) and the FastAPI backend (via JWT middleware).',
      technology: ['Clerk', 'JWT RS256', 'JWKS'],
      features: [
        'Automatic tenant creation on first login',
        'WebSocket token validation',
        'Next.js proxy middleware',
      ],
    },
  },

  'google-oauth': {
    nodes: googleOauthNodes,
    edges: googleOauthEdges,
    panelInfo: {
      title: 'Google OAuth',
      description:
        'Google OAuth 2.0 integration enabling Gmail and Calendar API access. Tokens are Fernet-encrypted and automatically refreshed within a 5-minute window before expiry.',
      technology: ['Google OAuth 2.0', 'Fernet Encryption'],
      features: [
        'Signed state parameter (CSRF protection)',
        'Automatic token refresh (5-min window)',
        'Multi-account support per integration',
        'Gmail + Calendar MCP servers',
      ],
    },
  },
};
