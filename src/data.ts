import type { Node, Edge } from '@xyflow/react';

/* ── Color palette ── */
export const C = {
  indigo: '#818cf8',
  blue: '#60a5fa',
  cyan: '#22d3ee',
  emerald: '#34d399',
  amber: '#fbbf24',
  orange: '#fb923c',
  rose: '#fb7185',
  purple: '#a78bfa',
  pink: '#f472b6',
  lime: '#a3e635',
  teal: '#2dd4bf',
  sky: '#38bdf8',
  red: '#f87171',
  slate: '#94a3b8',
};

/* ── Shared node props ── */
const locked = { draggable: false, connectable: false };

/* ══════════════════════════════════════════════════════════
   ZONE NODES
   Wide canvas (1700px), generous vertical spacing
   ══════════════════════════════════════════════════════════ */

const W = 1700;

const zones: Node[] = [
  {
    id: 'zone-auth',
    type: 'zone',
    position: { x: 0, y: 0 },
    style: { width: W, height: 200 },
    data: { label: 'Users & Authentication', color: C.rose, icon: '🔐' },
    ...locked, selectable: false,
  },
  {
    id: 'zone-api',
    type: 'zone',
    position: { x: 0, y: 240 },
    style: { width: W, height: 210 },
    data: { label: 'API Gateway Layer', color: C.blue, icon: '🔀' },
    ...locked, selectable: false,
  },
  {
    id: 'zone-bus',
    type: 'zone',
    position: { x: 0, y: 490 },
    style: { width: W, height: 180 },
    data: { label: 'Event Bus', color: C.emerald, icon: '📨' },
    ...locked, selectable: false,
  },
  {
    id: 'zone-engine',
    type: 'zone',
    position: { x: 0, y: 710 },
    style: { width: W, height: 370 },
    data: { label: 'Agent Engine', color: C.emerald, icon: '🤖' },
    ...locked, selectable: false,
  },
  {
    id: 'zone-features',
    type: 'zone',
    position: { x: 0, y: 1120 },
    style: { width: W, height: 440 },
    data: { label: 'Platform Features', color: C.purple, icon: '✨' },
    ...locked, selectable: false,
  },
  {
    id: 'zone-marketplace',
    type: 'zone',
    position: { x: 0, y: 1600 },
    style: { width: 820, height: 320 },
    data: { label: 'Marketplace & Extensibility', color: C.amber, icon: '🏪' },
    ...locked, selectable: false,
  },
  {
    id: 'zone-integrations',
    type: 'zone',
    position: { x: 860, y: 1600 },
    style: { width: 840, height: 320 },
    data: { label: 'MCP Integrations (20+)', color: C.teal, icon: '🔌' },
    ...locked, selectable: false,
  },
  {
    id: 'zone-infra',
    type: 'zone',
    position: { x: 0, y: 1960 },
    style: { width: W, height: 195 },
    data: { label: 'Infrastructure & CI/CD', color: C.slate, icon: '☁️' },
    ...locked, selectable: false,
  },
];

/* ══════════════════════════════════════════════════════════
   AUTH & CLIENT LAYER
   4 items spread across 1700px
   ══════════════════════════════════════════════════════════ */

const authNodes: Node[] = [
  {
    id: 'auth-service',
    type: 'component',
    position: { x: 30, y: 45 },
    parentId: 'zone-auth',
    extent: 'parent' as const,
    data: {
      label: 'Auth Service',
      description: 'External auth microservice: sign-in, JWT issuance, tenant & user lookup',
      icon: '🔐', tech: 'Axari Auth Service', color: C.rose,
      tags: ['JWT', 'Split httpOnly cookies', 'Multi-tenant', 'Service key'],
    },
    ...locked,
  },
  {
    id: 'nextjs-ui',
    type: 'component',
    position: { x: 350, y: 45 },
    parentId: 'zone-auth',
    extent: 'parent' as const,
    data: {
      label: 'Next.js UI',
      description: '14+ pages, App Router, real-time streaming',
      icon: '⚛️', tech: 'Next.js 16', port: '3000', color: C.indigo,
      tags: ['React 19', 'Tailwind', 'App Router'],
    },
    ...locked,
  },
  {
    id: 'ui-pages',
    type: 'feature',
    position: { x: 670, y: 45 },
    parentId: 'zone-auth',
    extent: 'parent' as const,
    data: {
      label: 'UI Pages',
      description: '14+ routes for all platform features',
      icon: '📄', color: C.indigo,
      bullets: ['Dashboard, Today, COS', 'Employee DMs & Sessions', 'Channels & Threads', 'Outcomes & Tasks', 'Plugins, Skills, MCP', 'Storage, Search, Traces'],
    },
    ...locked, selectable: false,
  },
  {
    id: 'webhooks',
    type: 'component',
    position: { x: 930, y: 45 },
    parentId: 'zone-auth',
    extent: 'parent' as const,
    data: {
      label: 'Webhook Triggers',
      description: 'External systems trigger outcomes via UUID tokens',
      icon: '🪝', tech: 'HTTP POST', color: C.orange,
      tags: ['UUID tokens', 'Payload passthrough'],
    },
    ...locked,
  },
];

/* ══════════════════════════════════════════════════════════
   API GATEWAY LAYER
   ══════════════════════════════════════════════════════════ */

const apiNodes: Node[] = [
  {
    id: 'fastapi',
    type: 'component',
    position: { x: 30, y: 48 },
    parentId: 'zone-api',
    extent: 'parent' as const,
    data: {
      label: 'FastAPI Server',
      description: '19 REST routers, 80+ endpoints, Auth Service JWT middleware',
      icon: '🚀', tech: 'Python 3.11+ / FastAPI', port: '8000', color: C.blue,
      tags: ['19 routers', 'Async', 'CORS', 'Fernet'],
    },
    ...locked,
  },
  {
    id: 'api-routers',
    type: 'feature',
    position: { x: 350, y: 48 },
    parentId: 'zone-api',
    extent: 'parent' as const,
    data: {
      label: 'API Routers',
      description: '19 endpoint modules',
      icon: '🗂️', color: C.blue,
      bullets: ['/employees, /sessions, /messages', '/channels, /threads', '/outcomes, /channel-outcomes', '/tools, /plugins, /skills', '/integrations, /search, /cos', '/human-todos, /auto-tasks, /traces'],
    },
    ...locked, selectable: false,
  },
  {
    id: 'ws-gateway',
    type: 'component',
    position: { x: 610, y: 48 },
    parentId: 'zone-api',
    extent: 'parent' as const,
    data: {
      label: 'WebSocket Gateway',
      description: 'Bridges NATS events to browser clients in real-time',
      icon: '⚡', tech: 'FastAPI WebSocket', color: C.cyan,
      tags: ['thinking', 'text', 'tool_call', 'tool_result'],
    },
    ...locked,
  },
  {
    id: 'search-engine',
    type: 'feature',
    position: { x: 930, y: 48 },
    parentId: 'zone-api',
    extent: 'parent' as const,
    data: {
      label: 'Full-Text Search',
      description: 'Cross-entity search',
      icon: '🔎', color: C.blue,
      bullets: ['Employees & sessions', 'Messages & auto-tasks', 'Channels & threads'],
    },
    ...locked, selectable: false,
  },
  {
    id: 'encryption',
    type: 'feature',
    position: { x: 1190, y: 48 },
    parentId: 'zone-api',
    extent: 'parent' as const,
    data: {
      label: 'Security',
      description: 'Encryption & tenant isolation',
      icon: '🔒', color: C.rose,
      bullets: ['Fernet encryption at rest', 'Tenant-scoped queries', 'CORS configuration'],
    },
    ...locked, selectable: false,
  },
];

/* ══════════════════════════════════════════════════════════
   EVENT BUS
   ══════════════════════════════════════════════════════════ */

const busNodes: Node[] = [
  {
    id: 'nats',
    type: 'component',
    position: { x: 30, y: 44 },
    parentId: 'zone-bus',
    extent: 'parent' as const,
    data: {
      label: 'NATS JetStream',
      description: 'Durable pub/sub message broker with KV store',
      icon: '📨', tech: 'NATS 2', port: '4222', color: C.emerald,
      tags: ['JetStream', 'KV Store', 'Durable consumers'],
    },
    ...locked,
  },
  {
    id: 'nats-streams',
    type: 'feature',
    position: { x: 350, y: 44 },
    parentId: 'zone-bus',
    extent: 'parent' as const,
    data: {
      label: 'Streams & Subjects',
      description: 'Message routing architecture',
      icon: '📡', color: C.emerald,
      bullets: ['Stream: EMPLOYEES', 'Stream: CHANNELS', 'employee.{id}.dm.incoming', 'channel.{id}.thread.{id}', 'outcome.{id}.trigger'],
    },
    ...locked, selectable: false,
  },
  {
    id: 'nats-kv',
    type: 'feature',
    position: { x: 610, y: 44 },
    parentId: 'zone-bus',
    extent: 'parent' as const,
    data: {
      label: 'KV Buckets',
      description: 'Real-time state tracking',
      icon: '🗄️', color: C.emerald,
      bullets: ['employee-status (idle/working)', 'Stream state per session', 'Channel stream state'],
    },
    ...locked, selectable: false,
  },
];

/* ══════════════════════════════════════════════════════════
   AGENT ENGINE — 2 rows, well spaced
   ══════════════════════════════════════════════════════════ */

const engineNodes: Node[] = [
  {
    id: 'agent-worker',
    type: 'component',
    position: { x: 30, y: 48 },
    parentId: 'zone-engine',
    extent: 'parent' as const,
    data: {
      label: 'Agent Worker',
      description: 'NATS consumer routing to specialized runners',
      icon: '🤖', tech: 'Claude Agent SDK', color: C.emerald,
      tags: ['NATS consumer', 'SDK CLI', 'Async'],
    },
    ...locked,
  },
  {
    id: 'runners',
    type: 'feature',
    position: { x: 350, y: 48 },
    parentId: 'zone-engine',
    extent: 'parent' as const,
    data: {
      label: 'Execution Runners',
      description: 'Specialized runner per task type',
      icon: '⚙️', color: C.emerald,
      bullets: ['DM Runner — 1:1 chat', 'Channel Runner — multi-agent', 'Outcome Runner — scheduled', 'Channel Outcome Runner', 'AutoTask Runner'],
    },
    ...locked, selectable: false,
  },
  {
    id: 'scheduler',
    type: 'component',
    position: { x: 610, y: 48 },
    parentId: 'zone-engine',
    extent: 'parent' as const,
    data: {
      label: 'Cron Scheduler',
      description: 'Polls 60s, evaluates cron, triggers via NATS',
      icon: '⏰', tech: 'croniter', color: C.amber,
      tags: ['60s tick', 'next_run_at', 'Budget gate'],
    },
    ...locked,
  },
  {
    id: 'budget-engine',
    type: 'component',
    position: { x: 930, y: 48 },
    parentId: 'zone-engine',
    extent: 'parent' as const,
    data: {
      label: 'Budget Engine',
      description: 'Spend tracking, daily & lifetime budget enforcement',
      icon: '💰', tech: 'Spend Ledger', color: C.amber,
      tags: ['Daily limits', 'Lifetime limits', 'Per-model'],
    },
    ...locked,
  },
  // Row 2
  {
    id: 'modal',
    type: 'component',
    position: { x: 30, y: 200 },
    parentId: 'zone-engine',
    extent: 'parent' as const,
    data: {
      label: 'Modal Sandboxes',
      description: 'Isolated per-tenant containers for production',
      icon: '📦', tech: 'Modal (Serverless)', color: C.purple,
      tags: ['gVisor', 'Per-tenant', 'Auto-scale'],
    },
    ...locked,
  },
  {
    id: 'memory-builder',
    type: 'feature',
    position: { x: 350, y: 200 },
    parentId: 'zone-engine',
    extent: 'parent' as const,
    data: {
      label: 'Memory Builder',
      description: 'Generates CLAUDE.md agent context',
      icon: '🧠', color: C.purple,
      bullets: ['System prompt injection', 'Tool/skill/plugin config', 'Workspace files', 'Session resume (.jsonl)'],
    },
    ...locked, selectable: false,
  },
  {
    id: 'stream-translator',
    type: 'feature',
    position: { x: 610, y: 200 },
    parentId: 'zone-engine',
    extent: 'parent' as const,
    data: {
      label: 'Stream Translator',
      description: 'SDK events → NATS → WebSocket',
      icon: '🔄', color: C.cyan,
      bullets: ['thinking → text → tool_call', 'tool_result → human_todo', 'Token counting', 'Trace persistence'],
    },
    ...locked, selectable: false,
  },
  {
    id: 'autotask-extractor',
    type: 'feature',
    position: { x: 930, y: 200 },
    parentId: 'zone-engine',
    extent: 'parent' as const,
    data: {
      label: 'AutoTask Extractor',
      description: 'Extracts action items from agent output',
      icon: '📋', color: C.lime,
      bullets: ['Post-run extraction', 'Priority & confidence', '[HUMAN_TODO] detection'],
    },
    ...locked, selectable: false,
  },
];

/* ══════════════════════════════════════════════════════════
   PLATFORM FEATURES — 2 rows × 6 columns, generous gaps
   ══════════════════════════════════════════════════════════ */

const FX = [30, 300, 570, 840, 1110, 1380];
const FY1 = 48;
const FY2 = 245;

const featureNodes: Node[] = [
  {
    id: 'feat-employees', type: 'feature',
    position: { x: FX[0], y: FY1 }, parentId: 'zone-features', extent: 'parent' as const,
    data: { label: 'AI Employees', description: 'Autonomous AI workers with personas', icon: '👤', color: C.indigo,
      bullets: ['System prompt & role', 'Status (idle/working)', 'Budget controls', 'Tool/plugin/skill assign'] },
    ...locked,
  },
  {
    id: 'feat-sessions', type: 'feature',
    position: { x: FX[1], y: FY1 }, parentId: 'zone-features', extent: 'parent' as const,
    data: { label: 'DM Sessions', description: '1:1 conversations with employees', icon: '💬', color: C.blue,
      bullets: ['Real-time streaming', 'Thinking traces', 'Tool call viz', 'Message history'] },
    ...locked, selectable: false,
  },
  {
    id: 'feat-channels', type: 'feature',
    position: { x: FX[2], y: FY1 }, parentId: 'zone-features', extent: 'parent' as const,
    data: { label: 'Channels', description: 'Multi-agent collaboration', icon: '#️⃣', color: C.purple,
      bullets: ['Multiple AI members', 'Threaded discussions', 'Task budget', 'Channel outcomes'] },
    ...locked, selectable: false,
  },
  {
    id: 'feat-outcomes', type: 'feature',
    position: { x: FX[3], y: FY1 }, parentId: 'zone-features', extent: 'parent' as const,
    data: { label: 'Outcomes', description: 'Scheduled & triggered tasks', icon: '🎯', color: C.emerald,
      bullets: ['Cron scheduling', 'Manual triggers', 'Webhook triggers', 'Run history & logs'] },
    ...locked, selectable: false,
  },
  {
    id: 'feat-cos', type: 'feature',
    position: { x: FX[4], y: FY1 }, parentId: 'zone-features', extent: 'parent' as const,
    data: { label: 'Chief of Staff', description: 'Live feedback loops', icon: '⭐', color: C.pink,
      bullets: ['COS sessions', 'Expected output tracking', 'Persistent context'] },
    ...locked, selectable: false,
  },
  {
    id: 'feat-today', type: 'feature',
    position: { x: FX[5], y: FY1 }, parentId: 'zone-features', extent: 'parent' as const,
    data: { label: 'Today View', description: 'Daily summary & tasks', icon: '📅', color: C.sky,
      bullets: ['Outcome run summaries', 'Pending human todos', 'Active auto-tasks'] },
    ...locked, selectable: false,
  },
  // Row 2
  {
    id: 'feat-autotasks', type: 'feature',
    position: { x: FX[0], y: FY2 }, parentId: 'zone-features', extent: 'parent' as const,
    data: { label: 'Auto-Tasks', description: 'AI-extracted action items', icon: '📋', color: C.lime,
      bullets: ['Auto-extraction', 'Priority & confidence', 'Status workflow', 'Comments & assignment'] },
    ...locked, selectable: false,
  },
  {
    id: 'feat-humantodos', type: 'feature',
    position: { x: FX[1], y: FY2 }, parentId: 'zone-features', extent: 'parent' as const,
    data: { label: 'Human Todos', description: 'Agent-generated tasks for humans', icon: '✅', color: C.teal,
      bullets: ['[HUMAN_TODO] extraction', 'Assignment to users', 'Completion tracking'] },
    ...locked, selectable: false,
  },
  {
    id: 'feat-traces', type: 'feature',
    position: { x: FX[2], y: FY2 }, parentId: 'zone-features', extent: 'parent' as const,
    data: { label: 'Execution Traces', description: 'Full agent observability', icon: '🔍', color: C.sky,
      bullets: ['Thinking & reasoning', 'Tool call traces', 'Token usage & cost', 'Error tracking'] },
    ...locked, selectable: false,
  },
  {
    id: 'feat-storage', type: 'feature',
    position: { x: FX[3], y: FY2 }, parentId: 'zone-features', extent: 'parent' as const,
    data: { label: 'Shared Storage', description: 'Workspace files for agents', icon: '📁', color: C.slate,
      bullets: ['Shared workspace', 'Agent file access', 'File snapshots'] },
    ...locked, selectable: false,
  },
  {
    id: 'feat-spend', type: 'feature',
    position: { x: FX[4], y: FY2 }, parentId: 'zone-features', extent: 'parent' as const,
    data: { label: 'Spend & Analytics', description: 'Cost tracking & usage', icon: '📊', color: C.amber,
      bullets: ['Spend ledger', 'Model-level costs', 'Token analytics', 'Dashboard metrics'] },
    ...locked, selectable: false,
  },
  {
    id: 'feat-dashboard', type: 'feature',
    position: { x: FX[5], y: FY2 }, parentId: 'zone-features', extent: 'parent' as const,
    data: { label: 'Dashboard', description: 'Platform overview & metrics', icon: '📈', color: C.indigo,
      bullets: ['Active employees', 'Total spend', 'Recent activity'] },
    ...locked, selectable: false,
  },
];

/* ══════════════════════════════════════════════════════════
   MARKETPLACE
   ══════════════════════════════════════════════════════════ */

const marketplaceNodes: Node[] = [
  {
    id: 'plugins', type: 'feature',
    position: { x: 30, y: 48 }, parentId: 'zone-marketplace', extent: 'parent' as const,
    data: { label: 'Plugin Marketplace', description: 'Installable capability bundles', icon: '🧩', color: C.amber,
      bullets: ['Git-based repos', 'Version tracking', 'Plugin accounts', 'Per-employee assign', 'Bundles: skills+MCP+agents'] },
    ...locked, selectable: false,
  },
  {
    id: 'skills', type: 'feature',
    position: { x: 280, y: 48 }, parentId: 'zone-marketplace', extent: 'parent' as const,
    data: { label: 'Skills', description: 'Reusable SKILL.md prompts', icon: '✨', color: C.purple,
      bullets: ['Global (Anthropic) scope', 'Custom (tenant) scope', 'SKILL.md format', 'Employee assignment'] },
    ...locked, selectable: false,
  },
  {
    id: 'tools-mcp', type: 'feature',
    position: { x: 530, y: 48 }, parentId: 'zone-marketplace', extent: 'parent' as const,
    data: { label: 'Tools & MCP Servers', description: 'MCP server management', icon: '🔧', color: C.orange,
      bullets: ['MCP server config', 'Tool accounts (creds)', 'Employee assignment', 'Category subscriptions'] },
    ...locked, selectable: false,
  },
];

/* ══════════════════════════════════════════════════════════
   INTEGRATIONS
   ══════════════════════════════════════════════════════════ */

const integrationNodes: Node[] = [
  {
    id: 'integ-productivity', type: 'integrationGrid',
    position: { x: 30, y: 48 }, parentId: 'zone-integrations', extent: 'parent' as const,
    data: { label: 'Productivity & Collaboration', icon: '💼', color: C.teal,
      items: [
        { name: 'Gmail', icon: '📧' }, { name: 'Calendar', icon: '📅' },
        { name: 'Drive', icon: '📂' }, { name: 'Slack', icon: '💬' },
        { name: 'Notion', icon: '📝' }, { name: 'Jira', icon: '🎫' },
        { name: 'Confluence', icon: '📚' }, { name: 'GitHub', icon: '🐙' },
        { name: 'Outlook', icon: '📨' }, { name: 'Teams', icon: '👥' },
        { name: 'Zoom', icon: '📹' }, { name: 'Fireflies', icon: '🔥' },
      ] },
    ...locked, selectable: false,
  },
  {
    id: 'integ-security', type: 'integrationGrid',
    position: { x: 380, y: 48 }, parentId: 'zone-integrations', extent: 'parent' as const,
    data: { label: 'Security & Infrastructure', icon: '🛡️', color: C.red,
      items: [
        { name: 'AWS', icon: '☁️' }, { name: 'Cloudflare', icon: '🌐' },
        { name: 'CrowdStrike', icon: '🦅' }, { name: 'Defender', icon: '🛡️' },
        { name: 'Qualys', icon: '🔍' }, { name: 'Rapid7', icon: '⚡' },
        { name: 'Aikido', icon: '🥋' }, { name: 'TrendMicro', icon: '🔬' },
        { name: 'SonarQube', icon: '📊' }, { name: 'Vanta', icon: '✅' },
        { name: 'Dex', icon: '🆔' }, { name: 'Granola', icon: '🧠' },
      ] },
    ...locked, selectable: false,
  },
];

/* ══════════════════════════════════════════════════════════
   INFRASTRUCTURE — 6 columns
   ══════════════════════════════════════════════════════════ */

const IX = [40, 310, 580, 850, 1120, 1390];

const infraNodes: Node[] = [
  { id: 'postgres', type: 'infra', position: { x: IX[0], y: 45 }, parentId: 'zone-infra', extent: 'parent' as const,
    data: { label: 'PostgreSQL', tech: 'PostgreSQL 16', icon: '🐘', color: C.blue, details: ['25+ models', 'Multi-tenant', 'RDS Multi-AZ'] }, ...locked, selectable: false },
  { id: 'eks', type: 'infra', position: { x: IX[1], y: 45 }, parentId: 'zone-infra', extent: 'parent' as const,
    data: { label: 'AWS EKS', tech: 'Kubernetes', icon: '☸️', color: C.orange, details: ['Helm charts', 'PR previews', '2-6x t3.large'] }, ...locked, selectable: false },
  { id: 'docker', type: 'infra', position: { x: IX[2], y: 45 }, parentId: 'zone-infra', extent: 'parent' as const,
    data: { label: 'Docker / ECR', tech: 'Containers', icon: '🐳', color: C.sky, details: ['axari/api', 'axari/ui', 'Compose (dev)'] }, ...locked, selectable: false },
  { id: 'jenkins', type: 'infra', position: { x: IX[3], y: 45 }, parentId: 'zone-infra', extent: 'parent' as const,
    data: { label: 'Jenkins CI/CD', tech: 'Pipeline', icon: '🔨', color: C.slate, details: ['Build→Push→Deploy', 'PR auto-deploy', 'Terraform'] }, ...locked, selectable: false },
  { id: 'k8s-namespaces', type: 'infra', position: { x: IX[4], y: 45 }, parentId: 'zone-infra', extent: 'parent' as const,
    data: { label: 'K8s Namespaces', tech: 'Env Isolation', icon: '📦', color: C.purple, details: ['coa-production', 'coa-pr-{N}', 'Zero-downtime'] }, ...locked, selectable: false },
  { id: 'networking', type: 'infra', position: { x: IX[5], y: 45 }, parentId: 'zone-infra', extent: 'parent' as const,
    data: { label: 'Networking', tech: 'VPC / ALB / NLB', icon: '🌐', color: C.emerald, details: ['VPC 10.0.0.0/16', 'ALB per env', 'NLB NATS'] }, ...locked, selectable: false },
];

/* ══════════════════════════════════════════════════════════
   ALL NODES
   ══════════════════════════════════════════════════════════ */

export const nodes: Node[] = [
  ...zones,
  ...authNodes,
  ...apiNodes,
  ...busNodes,
  ...engineNodes,
  ...featureNodes,
  ...marketplaceNodes,
  ...integrationNodes,
  ...infraNodes,
];

/* ══════════════════════════════════════════════════════════
   EDGES
   Each edge stores its color in data so the App can
   highlight/dim dynamically based on selection.
   ══════════════════════════════════════════════════════════ */

export interface EdgeData {
  color: string;
  kind: 'flow' | 'dep' | 'link';
  [key: string]: unknown;
}

const baseLabel = {
  labelStyle: { fill: '#888', fontSize: 10, fontWeight: 500, fontFamily: "'JetBrains Mono', monospace" },
  labelBgStyle: { fill: '#0a0a0a', fillOpacity: 0.95 },
  labelBgPadding: [6, 3] as [number, number],
  labelBgBorderRadius: 4,
};

function flow(id: string, source: string, target: string, label: string, color: string, sh?: string, th?: string): Edge {
  return {
    id, source, target, label, type: 'smoothstep', animated: true,
    style: { stroke: color, strokeWidth: 2 },
    data: { color, kind: 'flow' } satisfies EdgeData,
    ...baseLabel,
    ...(sh ? { sourceHandle: sh } : {}),
    ...(th ? { targetHandle: th } : {}),
  };
}

function dep(id: string, source: string, target: string, label: string, color: string, sh?: string, th?: string): Edge {
  return {
    id, source, target, label, type: 'smoothstep',
    style: { stroke: color, strokeWidth: 1.5, strokeDasharray: '6 4' },
    data: { color, kind: 'dep' } satisfies EdgeData,
    ...baseLabel,
    ...(sh ? { sourceHandle: sh } : {}),
    ...(th ? { targetHandle: th } : {}),
  };
}

function link(id: string, source: string, target: string, sh?: string, th?: string): Edge {
  return {
    id, source, target, type: 'smoothstep',
    style: { stroke: '#222', strokeWidth: 1 },
    data: { color: '#444', kind: 'link' } satisfies EdgeData,
    ...(sh ? { sourceHandle: sh } : {}),
    ...(th ? { targetHandle: th } : {}),
  };
}

export const edges: Edge[] = [
  // ── Primary data flows (solid, animated, colored) ──
  flow('f-auth-ui',        'auth-service','nextjs-ui',     'authenticates',  C.rose),
  flow('f-ui-api',         'nextjs-ui',   'fastapi',       'REST API',       C.indigo),
  flow('f-ui-ws',          'nextjs-ui',   'ws-gateway',    'WebSocket',      C.cyan),
  flow('f-api-nats',       'fastapi',     'nats',          'publishes',      C.blue),
  flow('f-ws-nats',        'ws-gateway',  'nats',          'subscribes',     C.cyan),
  flow('f-nats-agent',     'nats',        'agent-worker',  'consumes',       C.emerald),
  flow('f-agent-modal',    'agent-worker','modal',         'dispatches',     C.purple),
  flow('f-scheduler-nats', 'scheduler',   'nats',          'triggers',       C.amber),
  flow('f-modal-nats',     'modal',       'nats',          'streams events', C.emerald),
  flow('f-webhooks-api',   'webhooks',    'fastapi',       'POST trigger',   C.orange),

  // ── Dependencies (dashed, colored) ──
  dep('d-auth-api',     'auth-service',   'fastapi',       'validates JWT',     C.rose),
  dep('d-api-pg',       'fastapi',       'postgres',       'queries',           C.blue),
  dep('d-agent-pg',     'agent-worker',  'postgres',       'persists',          C.emerald),
  dep('d-budget-agent', 'budget-engine', 'agent-worker',   'enforces budget',   C.amber,   undefined, 'right'),
  dep('d-plugins-agent','plugins',       'agent-worker',   'loads at runtime',  C.amber),
  dep('d-skills-agent', 'skills',        'agent-worker',   'injects prompts',   C.purple),
  dep('d-tools-agent',  'tools-mcp',     'agent-worker',   'provides MCP',      C.orange),
  dep('d-integ-tools',  'integ-productivity','tools-mcp',  'OAuth / API keys',  C.teal),
  dep('d-integ-sec',    'integ-security','tools-mcp',      'credentials',       C.red),

  // ── Feature relationships (dashed, show how features connect) ──
  dep('r-employees-sessions',  'feat-employees',  'feat-sessions',    'creates sessions', C.indigo,  'right', 'left'),
  dep('r-employees-outcomes',  'feat-employees',  'feat-outcomes',    'owns outcomes',    C.indigo),
  dep('r-channels-outcomes',   'feat-channels',   'feat-outcomes',    'schedules',        C.purple,  'right', 'left'),
  dep('r-sessions-humantodos', 'feat-sessions',   'feat-humantodos',  'extracts todos',   C.blue),
  dep('r-sessions-autotasks',  'feat-sessions',   'feat-autotasks',   'extracts tasks',   C.blue),
  dep('r-outcomes-traces',     'feat-outcomes',   'feat-traces',      'logs execution',   C.emerald),
  dep('r-spend-employees',     'feat-spend',      'feat-employees',   'enforces budgets', C.amber),
  dep('r-cos-sessions',        'feat-cos',        'feat-sessions',    'creates sessions', C.pink,    undefined, 'right'),
  dep('r-webhooks-outcomes',   'webhooks',        'feat-outcomes',    'triggers',         C.orange),
  dep('r-today-outcomes',      'feat-today',      'feat-outcomes',    'shows runs',       C.sky,     undefined, 'right'),
  dep('r-today-humantodos',    'feat-today',      'feat-humantodos',  'shows pending',    C.sky),
  dep('r-dashboard-spend',     'feat-dashboard',  'feat-spend',       'displays metrics', C.indigo,  undefined, 'right'),

  // ── Internal links (subtle, no label) ──
  link('l-ui-pages',       'nextjs-ui',        'ui-pages',           'right',  'left'),
  link('l-api-routers',    'fastapi',          'api-routers',        'right',  'left'),
  link('l-nats-streams',   'nats',             'nats-streams',       'right',  'left'),
  link('l-nats-kv',        'nats-streams',     'nats-kv',            'right',  'left'),
  link('l-agent-runners',  'agent-worker',     'runners',            'right',  'left'),
  link('l-modal-memory',   'modal',            'memory-builder',     'right',  'left'),
  link('l-memory-stream',  'memory-builder',   'stream-translator',  'right',  'left'),
  link('l-stream-autotask','stream-translator','autotask-extractor', 'right',  'left'),
];
