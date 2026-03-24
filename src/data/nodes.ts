import type { Node } from '@xyflow/react';

export interface SystemNodeData {
  label: string;
  description: string;
  icon: string;
  tags: string[];
  category: string;
  [key: string]: unknown;
}

export const overviewNodes: Node<SystemNodeData>[] = [
  // Row 0: Authentication & Frontend
  {
    id: 'clerk',
    type: 'system',
    position: { x: -400, y: 0 },
    data: {
      label: 'Clerk Auth',
      description: 'User authentication & JWT session management',
      icon: '\uD83D\uDD10',
      tags: ['OAuth 2.0', 'JWT', 'JWKS'],
      category: 'auth',
    },
  },
  {
    id: 'browser-ui',
    type: 'system',
    position: { x: 0, y: 0 },
    data: {
      label: 'Browser / UI',
      description: 'Next.js 16 frontend with real-time streaming',
      icon: '\uD83D\uDDA5\uFE0F',
      tags: ['Next.js 16', 'React 18', 'WebSocket'],
      category: 'frontend',
    },
  },
  {
    id: 'google-oauth',
    type: 'system',
    position: { x: 400, y: 0 },
    data: {
      label: 'Google OAuth',
      description: 'Gmail & Calendar API integration',
      icon: '\uD83D\uDD11',
      tags: ['OAuth 2.0', 'Gmail', 'Calendar'],
      category: 'auth',
    },
  },

  // Row 1: API Layer
  {
    id: 'api-server',
    type: 'system',
    position: { x: 0, y: 280 },
    data: {
      label: 'API Server',
      description: 'FastAPI backend with 12 REST routers + WebSocket gateway',
      icon: '\u26A1',
      tags: ['FastAPI', 'Railway', 'Python 3.12'],
      category: 'backend',
    },
  },

  // Row 2: Data Layer
  {
    id: 'nats',
    type: 'system',
    position: { x: -250, y: 560 },
    data: {
      label: 'NATS JetStream',
      description: 'Message broker with durable consumers & KV store',
      icon: '\uD83D\uDCE8',
      tags: ['JetStream', 'KV Store', 'Pub/Sub'],
      category: 'infrastructure',
    },
  },
  {
    id: 'postgres',
    type: 'system',
    position: { x: 250, y: 560 },
    data: {
      label: 'PostgreSQL',
      description: 'Multi-tenant persistent storage with 15+ models',
      icon: '\uD83D\uDDC4\uFE0F',
      tags: ['PostgreSQL 16', 'AsyncPG', 'SQLAlchemy'],
      category: 'database',
    },
  },

  // Row 3: Processing Layer
  {
    id: 'dispatcher',
    type: 'system',
    position: { x: -250, y: 840 },
    data: {
      label: 'Agent Dispatcher',
      description: 'Thin NATS listener that spawns Modal sandboxes',
      icon: '\uD83D\uDCE1',
      tags: ['Railway', 'Python', 'JetStream'],
      category: 'backend',
    },
  },
  {
    id: 'openrouter',
    type: 'system',
    position: { x: 250, y: 840 },
    data: {
      label: 'OpenRouter',
      description: 'LLM routing to Claude, GPT, and other models',
      icon: '\uD83E\uDDE0',
      tags: ['Claude', 'GPT', 'LLM API'],
      category: 'ai',
    },
  },

  // Row 4: Execution Layer
  {
    id: 'modal-sandboxes',
    type: 'system',
    position: { x: 0, y: 1120 },
    data: {
      label: 'Modal Sandboxes',
      description: 'Isolated per-tenant containers running Claude Agent SDK',
      icon: '\uD83D\uDCE6',
      tags: ['Modal', 'gVisor', 'Per-Tenant'],
      category: 'compute',
    },
  },
];
