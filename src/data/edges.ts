import type { Edge } from '@xyflow/react';

export interface AnimatedEdgeData {
  flows: string[];
  label: string;
  direction: 'forward' | 'backward' | 'bidirectional';
  [key: string]: unknown;
}

export const overviewEdges: Edge<AnimatedEdgeData>[] = [
  // 1. Clerk -> Browser UI
  {
    id: 'clerk-browser',
    source: 'clerk',
    target: 'browser-ui',
    type: 'animated',
    animated: false,
    data: {
      flows: ['dm', 'channel'],
      label: 'JWT Auth',
      direction: 'forward',
    },
  },

  // 2. Browser UI -> API Server
  {
    id: 'browser-api',
    source: 'browser-ui',
    target: 'api-server',
    type: 'animated',
    animated: false,
    data: {
      flows: ['dm', 'channel', 'mention', 'oauth'],
      label: 'REST + WebSocket',
      direction: 'forward',
    },
  },

  // 3. API Server -> NATS
  {
    id: 'api-nats',
    source: 'api-server',
    target: 'nats',
    type: 'animated',
    animated: false,
    data: {
      flows: ['dm', 'channel', 'mention'],
      label: 'Publish Messages',
      direction: 'forward',
    },
  },

  // 4. API Server -> PostgreSQL
  {
    id: 'api-postgres',
    source: 'api-server',
    target: 'postgres',
    type: 'animated',
    animated: false,
    data: {
      flows: ['dm', 'channel', 'outcome'],
      label: 'CRUD Operations',
      direction: 'forward',
    },
  },

  // 5. NATS -> API Server
  {
    id: 'nats-api',
    source: 'nats',
    target: 'api-server',
    type: 'animated',
    animated: false,
    data: {
      flows: ['dm', 'channel'],
      label: 'Stream Events \u2192 WS',
      direction: 'forward',
    },
  },

  // 6. NATS -> Dispatcher
  {
    id: 'nats-dispatcher',
    source: 'nats',
    target: 'dispatcher',
    type: 'animated',
    animated: false,
    data: {
      flows: ['dm', 'channel', 'outcome'],
      label: 'JetStream Subscribe',
      direction: 'forward',
    },
  },

  // 7. Dispatcher -> Modal Sandboxes
  {
    id: 'dispatcher-modal',
    source: 'dispatcher',
    target: 'modal-sandboxes',
    type: 'animated',
    animated: false,
    data: {
      flows: ['dm', 'channel', 'outcome'],
      label: 'Sandbox.create()',
      direction: 'forward',
    },
  },

  // 8. Modal Sandboxes -> NATS
  {
    id: 'modal-nats',
    source: 'modal-sandboxes',
    target: 'nats',
    type: 'animated',
    animated: false,
    data: {
      flows: ['dm', 'channel', 'outcome'],
      label: 'Publish Stream Events',
      direction: 'forward',
    },
  },

  // 9. Modal Sandboxes -> PostgreSQL
  {
    id: 'modal-postgres',
    source: 'modal-sandboxes',
    target: 'postgres',
    type: 'animated',
    animated: false,
    data: {
      flows: ['dm', 'channel', 'outcome'],
      label: 'Persist Results',
      direction: 'forward',
    },
  },

  // 10. Modal Sandboxes -> OpenRouter
  {
    id: 'modal-openrouter',
    source: 'modal-sandboxes',
    target: 'openrouter',
    type: 'animated',
    animated: false,
    data: {
      flows: ['dm', 'channel', 'outcome'],
      label: 'Claude SDK query()',
      direction: 'forward',
    },
  },

  // 11. Google OAuth -> API Server
  {
    id: 'google-api',
    source: 'google-oauth',
    target: 'api-server',
    type: 'animated',
    animated: false,
    data: {
      flows: ['oauth'],
      label: 'OAuth Callback',
      direction: 'forward',
    },
  },

  // 12. Modal Sandboxes -> Google OAuth
  {
    id: 'modal-google',
    source: 'modal-sandboxes',
    target: 'google-oauth',
    type: 'animated',
    animated: false,
    data: {
      flows: ['oauth'],
      label: 'MCP Server Tokens',
      direction: 'forward',
    },
  },

  // 13. Dispatcher -> NATS (Scheduler Triggers)
  {
    id: 'dispatcher-nats',
    source: 'dispatcher',
    target: 'nats',
    type: 'animated',
    animated: false,
    sourceHandle: 'right',
    targetHandle: 'left',
    data: {
      flows: ['outcome'],
      label: 'Scheduler Triggers',
      direction: 'forward',
    },
  },

  // 14. API Server -> Browser UI (WebSocket Stream)
  {
    id: 'api-browser',
    source: 'api-server',
    target: 'browser-ui',
    type: 'animated',
    animated: false,
    data: {
      flows: ['dm', 'channel'],
      label: 'WebSocket Stream',
      direction: 'forward',
    },
  },
];
