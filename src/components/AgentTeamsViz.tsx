import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BuildingConfig {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  color: string;
  glowColor: string;
  icon: string;
  description: string;
  techDetails: string[];
  category: 'orchestrator' | 'agent' | 'infrastructure' | 'user';
}

interface DataPacket {
  id: string;
  fromId: string;
  toId: string;
  color: string;
  progress: number;
  label: string;
}

interface SimulationPhase {
  id: string;
  title: string;
  description: string;
  activeBuildings: string[];
  packets: Omit<DataPacket, 'id' | 'progress'>[];
  highlight: string | null;
  duration: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const COLORS = {
  orchestrator: '#6366f1',
  agent1: '#10b981',
  agent2: '#f59e0b',
  agent3: '#f43f5e',
  nats: '#06b6d4',
  sdk: '#a855f7',
  ui: '#3b82f6',
  user: '#e5e5e5',
};

const BUILDINGS: BuildingConfig[] = [
  {
    id: 'user',
    label: 'User',
    sublabel: 'Sends message',
    x: 60,
    y: 340,
    w: 100,
    h: 50,
    depth: 30,
    color: '#1a1a2e',
    glowColor: COLORS.user,
    icon: '\u{1F464}',
    description: 'A user posts a message in a channel thread',
    techDetails: ['POST /api/channels/{id}/threads', 'Message persisted to PostgreSQL', 'Published to NATS JetStream'],
    category: 'user',
  },
  {
    id: 'api',
    label: 'FastAPI',
    sublabel: 'REST + WebSocket',
    x: 230,
    y: 300,
    w: 110,
    h: 70,
    depth: 40,
    color: '#0f172a',
    glowColor: COLORS.ui,
    icon: '\u{26A1}',
    description: 'API layer receives the request, persists the message, and publishes to NATS',
    techDetails: ['Validates tenant ownership', 'Creates Thread + ThreadMessage', 'Publishes to channel.{id}.thread.incoming'],
    category: 'infrastructure',
  },
  {
    id: 'nats',
    label: 'NATS',
    sublabel: 'Message Bus',
    x: 420,
    y: 260,
    w: 100,
    h: 60,
    depth: 35,
    color: '#0c1222',
    glowColor: COLORS.nats,
    icon: '\u{1F4E1}',
    description: 'NATS JetStream routes messages between API and agent workers with durable subscriptions',
    techDetails: ['JetStream durable: agent-runner-channel', 'KV store for agent status + stream state', 'Subject: channel.*.thread.incoming'],
    category: 'infrastructure',
  },
  {
    id: 'sdk',
    label: 'Agent SDK',
    sublabel: 'Teams Mode',
    x: 400,
    y: 120,
    w: 130,
    h: 80,
    depth: 45,
    color: '#1a0f2e',
    glowColor: COLORS.sdk,
    icon: '\u{1F9E0}',
    description: 'Claude Agent SDK spawns the CLI with AGENT_TEAMS=1, sends agent definitions via initialize control request',
    techDetails: [
      'ClaudeAgentOptions(agents={...})',
      'env: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1',
      'Agents sent via stdin initialize request',
      'parent_tool_use_id routes messages per-agent',
    ],
    category: 'orchestrator',
  },
  {
    id: 'orchestrator',
    label: 'Orchestrator',
    sublabel: 'Lead Agent',
    x: 200,
    y: 80,
    w: 120,
    h: 75,
    depth: 45,
    color: '#1a1033',
    glowColor: COLORS.orchestrator,
    icon: '\u{1F451}',
    description:
      'The lead agent coordinates the team. It NEVER does work itself \u2014 only delegates by calling agent tools in parallel',
    techDetails: [
      'System prompt: "NEVER do the work yourself"',
      'Calls agent tools simultaneously',
      'Synthesizes final summary from results',
      'model: configurable per-channel',
    ],
    category: 'orchestrator',
  },
  {
    id: 'alice',
    label: 'Alice',
    sublabel: 'Designer \u{1F3A8}',
    x: 40,
    y: 30,
    w: 100,
    h: 110,
    depth: 50,
    color: '#0a1f1a',
    glowColor: COLORS.agent1,
    icon: '\u{1F3A8}',
    description:
      'Agent with own system prompt, model (sonnet), and tools (Read, Write, Edit). Runs in parallel with other agents.',
    techDetails: [
      'AgentDefinition(model="sonnet")',
      'tools: ["Read", "Write", "Edit"]',
      'Own system_prompt from DB',
      'Budget tracked independently',
    ],
    category: 'agent',
  },
  {
    id: 'bob',
    label: 'Bob',
    sublabel: 'Engineer \u{1F528}',
    x: 40,
    y: 170,
    w: 100,
    h: 100,
    depth: 50,
    color: '#1f1a0a',
    glowColor: COLORS.agent2,
    icon: '\u{1F528}',
    description:
      'Agent with own system prompt, model (opus), and tools (Bash, Grep, Read). Executes simultaneously with Alice and Carol.',
    techDetails: [
      'AgentDefinition(model="opus")',
      'tools: ["Read", "Bash", "Grep", "Edit"]',
      'Heavier model for complex reasoning',
      'Separate budget allocation',
    ],
    category: 'agent',
  },
  {
    id: 'carol',
    label: 'Carol',
    sublabel: 'Writer \u{270D}\u{FE0F}',
    x: 580,
    y: 60,
    w: 100,
    h: 90,
    depth: 50,
    color: '#1f0a0f',
    glowColor: COLORS.agent3,
    icon: '\u{270D}\u{FE0F}',
    description:
      'Agent with own system prompt, model (haiku), and tools (Read, Write). Cost-efficient for straightforward tasks.',
    techDetails: [
      'AgentDefinition(model="haiku")',
      'tools: ["Read", "Write"]',
      'Cheap model for simple work',
      'Independent tool isolation',
    ],
    category: 'agent',
  },
  {
    id: 'ws',
    label: 'WebSocket',
    sublabel: 'Real-time Stream',
    x: 600,
    y: 220,
    w: 110,
    h: 55,
    depth: 30,
    color: '#0f172a',
    glowColor: COLORS.ui,
    icon: '\u{1F4F1}',
    description:
      'WebSocket gateway bridges NATS events to browser. Each agent gets its own event stream with agent_name + parent_tool_use_id.',
    techDetails: [
      'subject: channel.{id}.thread.{id}.stream',
      'Events: agent_start, agent_text_delta, agent_done',
      'ChannelTranslatorState routes per-agent',
      'KV state for mid-stream recovery',
    ],
    category: 'infrastructure',
  },
];

// ─── Simulation phases ──────────────────────────────────────────────────────

const SIMULATION_PHASES: SimulationPhase[] = [
  {
    id: 'idle',
    title: 'Idle State',
    description: 'Channel is ready. Three AI employees are members: Alice (Designer), Bob (Engineer), Carol (Writer).',
    activeBuildings: ['alice', 'bob', 'carol'],
    packets: [],
    highlight: null,
    duration: 3000,
  },
  {
    id: 'user-sends',
    title: '1. User Sends Message',
    description: 'User posts "Build me a landing page with copy" in the #product channel.',
    activeBuildings: ['user', 'api'],
    packets: [{ fromId: 'user', toId: 'api', color: COLORS.user, label: 'POST /threads' }],
    highlight: 'user',
    duration: 2500,
  },
  {
    id: 'nats-route',
    title: '2. NATS Routes to Agent Worker',
    description: 'API persists message, publishes to NATS JetStream. Agent runner picks it up from durable subscription.',
    activeBuildings: ['api', 'nats'],
    packets: [{ fromId: 'api', toId: 'nats', color: COLORS.nats, label: 'thread.incoming' }],
    highlight: 'nats',
    duration: 2500,
  },
  {
    id: 'sdk-init',
    title: '3. Agent Teams SDK Initializes',
    description:
      'handle_channel_thread() builds AgentDefinitions for each member, sets AGENT_TEAMS=1, sends agents via initialize control request.',
    activeBuildings: ['nats', 'sdk'],
    packets: [{ fromId: 'nats', toId: 'sdk', color: COLORS.sdk, label: 'initialize + agents{}' }],
    highlight: 'sdk',
    duration: 3000,
  },
  {
    id: 'orchestrator-plan',
    title: '4. Orchestrator Plans Delegation',
    description:
      'The lead agent sees tools named `alice`, `bob`, `carol`. It analyzes the request and plans parallel delegation.',
    activeBuildings: ['sdk', 'orchestrator'],
    packets: [{ fromId: 'sdk', toId: 'orchestrator', color: COLORS.orchestrator, label: 'system_prompt + team' }],
    highlight: 'orchestrator',
    duration: 3000,
  },
  {
    id: 'parallel-dispatch',
    title: '5. Parallel Agent Dispatch',
    description:
      'Orchestrator calls all three agent tools IN ONE TURN. The SDK executes them simultaneously \u2014 this is what makes Agent Teams different from subagents.',
    activeBuildings: ['orchestrator', 'alice', 'bob', 'carol'],
    packets: [
      { fromId: 'orchestrator', toId: 'alice', color: COLORS.agent1, label: 'tool: alice("design UI")' },
      { fromId: 'orchestrator', toId: 'bob', color: COLORS.agent2, label: 'tool: bob("build API")' },
      { fromId: 'orchestrator', toId: 'carol', color: COLORS.agent3, label: 'tool: carol("write copy")' },
    ],
    highlight: 'orchestrator',
    duration: 4000,
  },
  {
    id: 'agents-working',
    title: '6. Agents Execute in Parallel',
    description:
      'Each agent works independently with its own model, tools, and system prompt. Text streams back via parent_tool_use_id.',
    activeBuildings: ['alice', 'bob', 'carol', 'ws'],
    packets: [
      { fromId: 'alice', toId: 'ws', color: COLORS.agent1, label: 'agent_text_delta' },
      { fromId: 'bob', toId: 'ws', color: COLORS.agent2, label: 'agent_tool_start' },
      { fromId: 'carol', toId: 'ws', color: COLORS.agent3, label: 'agent_text_delta' },
    ],
    highlight: null,
    duration: 4000,
  },
  {
    id: 'results-return',
    title: '7. Results Return to Orchestrator',
    description: 'All agents complete. Results come back as ToolResultBlocks. ChannelTranslatorState emits agent_done for each.',
    activeBuildings: ['alice', 'bob', 'carol', 'orchestrator'],
    packets: [
      { fromId: 'alice', toId: 'orchestrator', color: COLORS.agent1, label: 'agent_done' },
      { fromId: 'bob', toId: 'orchestrator', color: COLORS.agent2, label: 'agent_done' },
      { fromId: 'carol', toId: 'orchestrator', color: COLORS.agent3, label: 'agent_done' },
    ],
    highlight: 'orchestrator',
    duration: 3000,
  },
  {
    id: 'synthesize',
    title: '8. Orchestrator Synthesizes',
    description:
      'Orchestrator writes a final summary combining all agents\' outputs. Result streams to UI via WebSocket.',
    activeBuildings: ['orchestrator', 'ws', 'sdk'],
    packets: [
      { fromId: 'orchestrator', toId: 'ws', color: COLORS.orchestrator, label: 'orchestrator_text_delta' },
      { fromId: 'sdk', toId: 'ws', color: COLORS.sdk, label: 'thread_complete' },
    ],
    highlight: 'ws',
    duration: 3000,
  },
];

// ─── Subagent comparison phases ─────────────────────────────────────────────

const SUBAGENT_PHASES: SimulationPhase[] = [
  {
    id: 'sub-1',
    title: 'Subagent: Step 1',
    description: 'Parent calls Agent(subagent_type="alice"). Waits for alice to finish.',
    activeBuildings: ['orchestrator', 'alice'],
    packets: [{ fromId: 'orchestrator', toId: 'alice', color: COLORS.agent1, label: 'Agent(alice)' }],
    highlight: 'alice',
    duration: 2500,
  },
  {
    id: 'sub-2',
    title: 'Subagent: Step 2',
    description: 'Alice done. Now parent calls Agent(subagent_type="bob"). Sequential \u2014 bob waits for alice.',
    activeBuildings: ['orchestrator', 'bob'],
    packets: [
      { fromId: 'alice', toId: 'orchestrator', color: COLORS.agent1, label: 'result' },
      { fromId: 'orchestrator', toId: 'bob', color: COLORS.agent2, label: 'Agent(bob)' },
    ],
    highlight: 'bob',
    duration: 2500,
  },
  {
    id: 'sub-3',
    title: 'Subagent: Step 3',
    description: 'Bob done. Now parent calls Agent(subagent_type="carol"). 3x slower than Agent Teams.',
    activeBuildings: ['orchestrator', 'carol'],
    packets: [
      { fromId: 'bob', toId: 'orchestrator', color: COLORS.agent2, label: 'result' },
      { fromId: 'orchestrator', toId: 'carol', color: COLORS.agent3, label: 'Agent(carol)' },
    ],
    highlight: 'carol',
    duration: 2500,
  },
];

// ─── Helper: get building center ────────────────────────────────────────────

function getBuildingCenter(b: BuildingConfig) {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

// ─── 3D Isometric Building ──────────────────────────────────────────────────

function Building({
  config,
  isActive,
  isHighlighted,
  onClick,
}: {
  config: BuildingConfig;
  isActive: boolean;
  isHighlighted: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const lit = isActive || isHighlighted || hovered;

  const topColor = lit ? config.glowColor + '30' : config.color;
  const rightColor = lit ? config.glowColor + '20' : '#060c18';
  const frontColor = lit ? config.glowColor + '18' : '#080e1c';
  const borderColor = lit ? config.glowColor + '80' : '#1a1a2e';
  const glowShadow = lit
    ? `0 0 20px ${config.glowColor}30, 0 0 40px ${config.glowColor}15, inset 0 0 15px ${config.glowColor}10`
    : 'none';

  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Glow underneath */}
      {lit && (
        <ellipse
          cx={config.x + config.w / 2}
          cy={config.y + config.h + 5}
          rx={config.w / 2 + 10}
          ry={12}
          fill={config.glowColor}
          opacity={0.1}
        >
          <animate attributeName="opacity" values="0.05;0.15;0.05" dur="2s" repeatCount="indefinite" />
        </ellipse>
      )}

      {/* Main building body (front face) */}
      <rect
        x={config.x}
        y={config.y}
        width={config.w}
        height={config.h}
        fill={frontColor}
        stroke={borderColor}
        strokeWidth={1}
        style={{ filter: lit ? `drop-shadow(0 0 8px ${config.glowColor}40)` : 'none' }}
      />

      {/* Top face (3D effect) */}
      <polygon
        points={`
          ${config.x},${config.y}
          ${config.x + config.depth * 0.5},${config.y - config.depth * 0.4}
          ${config.x + config.w + config.depth * 0.5},${config.y - config.depth * 0.4}
          ${config.x + config.w},${config.y}
        `}
        fill={topColor}
        stroke={borderColor}
        strokeWidth={1}
      />

      {/* Right face (3D effect) */}
      <polygon
        points={`
          ${config.x + config.w},${config.y}
          ${config.x + config.w + config.depth * 0.5},${config.y - config.depth * 0.4}
          ${config.x + config.w + config.depth * 0.5},${config.y + config.h - config.depth * 0.4}
          ${config.x + config.w},${config.y + config.h}
        `}
        fill={rightColor}
        stroke={borderColor}
        strokeWidth={1}
      />

      {/* Window grid on front face */}
      {lit &&
        Array.from({ length: Math.floor(config.w / 20) }).map((_, col) =>
          Array.from({ length: Math.floor(config.h / 18) }).map((_, row) => (
            <rect
              key={`${col}-${row}`}
              x={config.x + 8 + col * 20}
              y={config.y + 8 + row * 18}
              width={10}
              height={8}
              fill={config.glowColor}
              opacity={Math.random() > 0.3 ? 0.3 : 0.08}
            />
          ))
        )}

      {/* Icon */}
      <text
        x={config.x + config.w / 2}
        y={config.y + config.h / 2 - 8}
        textAnchor="middle"
        fontSize={20}
        style={{ pointerEvents: 'none' }}
      >
        {config.icon}
      </text>

      {/* Label */}
      <text
        x={config.x + config.w / 2}
        y={config.y + config.h / 2 + 12}
        textAnchor="middle"
        fill={lit ? '#fff' : '#a3a3a3'}
        fontSize={11}
        fontWeight={700}
        fontFamily="'JetBrains Mono', monospace"
        style={{ pointerEvents: 'none' }}
      >
        {config.label}
      </text>

      {/* Sublabel */}
      <text
        x={config.x + config.w / 2}
        y={config.y + config.h / 2 + 26}
        textAnchor="middle"
        fill={lit ? config.glowColor : '#525252'}
        fontSize={9}
        fontFamily="'JetBrains Mono', monospace"
        style={{ pointerEvents: 'none' }}
      >
        {config.sublabel}
      </text>

      {/* Active pulse ring */}
      {isActive && (
        <rect
          x={config.x - 3}
          y={config.y - 3}
          width={config.w + 6}
          height={config.h + 6}
          fill="none"
          stroke={config.glowColor}
          strokeWidth={1.5}
          opacity={0.5}
        >
          <animate attributeName="opacity" values="0.5;0.15;0.5" dur="1.5s" repeatCount="indefinite" />
        </rect>
      )}
    </g>
  );
}

// ─── Animated data packet ───────────────────────────────────────────────────

function Packet({
  fromBuilding,
  toBuilding,
  color,
  label,
  delay,
}: {
  fromBuilding: BuildingConfig;
  toBuilding: BuildingConfig;
  color: string;
  label: string;
  delay: number;
}) {
  const from = getBuildingCenter(fromBuilding);
  const to = getBuildingCenter(toBuilding);
  const id = `packet-${fromBuilding.id}-${toBuilding.id}-${delay}`;

  return (
    <g>
      {/* Connection line */}
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={1} opacity={0.15} strokeDasharray="4 4" />

      {/* Animated dot */}
      <circle r={4} fill={color} opacity={0.9}>
        <animateMotion
          dur="1.8s"
          begin={`${delay}s`}
          repeatCount="indefinite"
          path={`M${from.x},${from.y} L${to.x},${to.y}`}
        />
        <animate attributeName="r" values="3;5;3" dur="1.8s" begin={`${delay}s`} repeatCount="indefinite" />
      </circle>

      {/* Glow trail */}
      <circle r={8} fill={color} opacity={0.15}>
        <animateMotion
          dur="1.8s"
          begin={`${delay}s`}
          repeatCount="indefinite"
          path={`M${from.x},${from.y} L${to.x},${to.y}`}
        />
      </circle>

      {/* Label at midpoint */}
      <text
        x={(from.x + to.x) / 2}
        y={(from.y + to.y) / 2 - 10}
        textAnchor="middle"
        fill={color}
        fontSize={8}
        fontFamily="'JetBrains Mono', monospace"
        fontWeight={600}
        opacity={0.7}
      >
        {label}
      </text>
    </g>
  );
}

// ─── Info Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  building,
  onClose,
}: {
  building: BuildingConfig | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {building && (
        <motion.div
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          style={{
            position: 'absolute',
            top: 60,
            right: 0,
            width: 300,
            background: 'rgba(10,15,26,0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid #262626',
            borderRight: 'none',
            zIndex: 15,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 16px 12px',
              borderBottom: `2px solid ${building.glowColor}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>{building.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{building.label}</div>
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: building.glowColor,
                  }}
                >
                  {building.sublabel}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: '1px solid #262626',
                color: '#525252',
                width: 24,
                height: 24,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              \u00D7
            </button>
          </div>

          {/* Description */}
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 12, color: '#a3a3a3', lineHeight: '18px', marginBottom: 16 }}>
              {building.description}
            </div>

            {/* Technical details */}
            <div
              style={{
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#525252',
                marginBottom: 8,
              }}
            >
              Implementation
            </div>
            <div
              style={{
                background: '#030810',
                border: '1px solid #1a1a2e',
                padding: '8px 10px',
              }}
            >
              {building.techDetails.map((line, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 6,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    lineHeight: '18px',
                    color: building.glowColor,
                  }}
                >
                  <span style={{ color: '#4b5563', userSelect: 'none' }}>{'\u25B8'}</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>

            {/* Category badge */}
            <div style={{ marginTop: 12 }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  fontSize: 9,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                  color: building.glowColor,
                  background: `${building.glowColor}15`,
                  border: `1px solid ${building.glowColor}40`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {building.category}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Phase timeline ─────────────────────────────────────────────────────────

function PhaseTimeline({
  phases,
  currentPhase,
  onSelect,
}: {
  phases: SimulationPhase[];
  currentPhase: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        alignItems: 'center',
        overflow: 'auto',
        padding: '0 4px',
      }}
    >
      {phases.map((phase, i) => {
        const isCurrent = i === currentPhase;
        const isPast = i < currentPhase;
        return (
          <button
            key={phase.id}
            onClick={() => onSelect(i)}
            title={phase.title}
            style={{
              width: 32,
              minWidth: 32,
              height: 6,
              background: isCurrent ? '#6366f1' : isPast ? '#6366f150' : '#1a1a2e',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              outline: 'none',
              position: 'relative',
            }}
          >
            {isCurrent && (
              <div
                style={{
                  position: 'absolute',
                  inset: -2,
                  border: '1px solid #6366f1',
                  boxShadow: '0 0 8px rgba(99,102,241,0.3)',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Comparison toggle ──────────────────────────────────────────────────────

function ModeToggle({
  mode,
  onChange,
}: {
  mode: 'teams' | 'subagents';
  onChange: (m: 'teams' | 'subagents') => void;
}) {
  return (
    <div style={{ display: 'flex', border: '1px solid #262626' }}>
      {(['teams', 'subagents'] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          style={{
            padding: '4px 12px',
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: mode === m ? 'rgba(99,102,241,0.15)' : 'transparent',
            border: 'none',
            borderBottom: mode === m ? '2px solid #6366f1' : '2px solid transparent',
            color: mode === m ? '#e5e5e5' : '#525252',
            cursor: 'pointer',
            transition: 'all 0.15s',
            outline: 'none',
          }}
        >
          {m === 'teams' ? 'Agent Teams' : 'Subagents'}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function AgentTeamsViz() {
  const [mode, setMode] = useState<'teams' | 'subagents'>('teams');
  const [currentPhase, setCurrentPhase] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingConfig | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const phases = mode === 'teams' ? SIMULATION_PHASES : SUBAGENT_PHASES;
  const phase = phases[currentPhase] || phases[0];

  const buildingMap = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

  // Auto-advance phases
  const advancePhase = useCallback(() => {
    setCurrentPhase((prev) => {
      const next = prev + 1;
      if (next >= phases.length) {
        return 0; // loop
      }
      return next;
    });
  }, [phases.length]);

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    timerRef.current = setTimeout(advancePhase, phase.duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentPhase, phase.duration, advancePhase]);

  // Reset phase on mode change
  useEffect(() => {
    setCurrentPhase(0);
  }, [mode]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#030810',
        position: 'relative',
      }}
    >
      {/* ── Top bar ──────────────────────────────────────────── */}
      <div
        style={{
          padding: '60px 24px 12px',
          borderBottom: '1px solid #1a1a2e',
          background: 'rgba(10,15,26,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <div
              style={{
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: '#818cf8',
                marginBottom: 2,
              }}
            >
              Agent Teams Visualizer
            </div>
            <div style={{ fontSize: 10, color: '#525252' }}>
              Interactive simulation of multi-agent orchestration
            </div>
          </div>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PhaseTimeline phases={phases} currentPhase={currentPhase} onSelect={(i) => { setCurrentPhase(i); setIsPlaying(false); }} />
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              padding: '4px 10px',
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: isPlaying ? 'rgba(99,102,241,0.15)' : 'transparent',
              border: `1px solid ${isPlaying ? '#6366f1' : '#262626'}`,
              color: isPlaying ? '#818cf8' : '#525252',
              cursor: 'pointer',
              transition: 'all 0.2s',
              outline: 'none',
            }}
          >
            {isPlaying ? '\u23F8 Pause' : '\u25B6 Play'}
          </button>
        </div>
      </div>

      {/* ── Main viewport ────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {/* SVG city */}
        <div style={{ flex: 1, position: 'relative' }}>
          <svg
            viewBox="0 0 750 420"
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
            }}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Grid pattern */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0a0f1a" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Ground plane lines */}
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <line
                key={`hline-${i}`}
                x1={0}
                y1={i * 55 + 20}
                x2={750}
                y2={i * 55 + 20}
                stroke="#0a0f1a"
                strokeWidth={0.3}
              />
            ))}

            {/* Data packets */}
            {phase.packets.map((p, i) => {
              const from = buildingMap[p.fromId];
              const to = buildingMap[p.toId];
              if (!from || !to) return null;
              return (
                <Packet
                  key={`${phase.id}-${p.fromId}-${p.toId}-${i}`}
                  fromBuilding={from}
                  toBuilding={to}
                  color={p.color}
                  label={p.label}
                  delay={i * 0.3}
                />
              );
            })}

            {/* Buildings */}
            {BUILDINGS.map((b) => (
              <Building
                key={b.id}
                config={b}
                isActive={phase.activeBuildings.includes(b.id)}
                isHighlighted={phase.highlight === b.id}
                onClick={() => setSelectedBuilding(selectedBuilding?.id === b.id ? null : b)}
              />
            ))}

            {/* "PARALLEL" badge when in parallel dispatch phase */}
            {phase.id === 'parallel-dispatch' && (
              <g>
                <rect x={280} y={10} width={180} height={28} fill="#6366f120" stroke="#6366f1" strokeWidth={1} />
                <text
                  x={370}
                  y={28}
                  textAnchor="middle"
                  fill="#6366f1"
                  fontSize={11}
                  fontWeight={700}
                  fontFamily="'JetBrains Mono', monospace"
                >
                  PARALLEL EXECUTION
                </text>
              </g>
            )}

            {/* Sequential badge for subagent mode */}
            {mode === 'subagents' && (
              <g>
                <rect x={280} y={10} width={180} height={28} fill="#f43f5e20" stroke="#f43f5e" strokeWidth={1} />
                <text
                  x={370}
                  y={28}
                  textAnchor="middle"
                  fill="#f43f5e"
                  fontSize={11}
                  fontWeight={700}
                  fontFamily="'JetBrains Mono', monospace"
                >
                  SEQUENTIAL EXECUTION
                </text>
              </g>
            )}
          </svg>

          {/* Phase description overlay */}
          <AnimatePresence mode="wait">
            <motion.div
              key={phase.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              style={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                right: 16,
                background: 'rgba(3,8,16,0.92)',
                backdropFilter: 'blur(12px)',
                border: '1px solid #262626',
                padding: '12px 16px',
                zIndex: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#fff',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {phase.title}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#525252',
                    textTransform: 'uppercase',
                  }}
                >
                  {currentPhase + 1}/{phases.length}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#a3a3a3', lineHeight: '18px' }}>{phase.description}</div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Detail panel */}
        <DetailPanel building={selectedBuilding} onClose={() => setSelectedBuilding(null)} />
      </div>
    </div>
  );
}
