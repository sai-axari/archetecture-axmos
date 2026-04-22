import React, { useState } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';

/* ═══════════════════════════════════════════════════════
   Zone Node — background group container
   ═══════════════════════════════════════════════════════ */

export type ZoneNodeData = {
  label: string;
  color: string;
  icon?: string;
};

function ZoneNodeComponent({ data }: NodeProps<Node<ZoneNodeData>>) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 16,
        border: `1.5px solid ${data.color}18`,
        background: `${data.color}06`,
        position: 'relative',
        transition: 'opacity 0.3s',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {data.icon && <span style={{ fontSize: 13 }}>{data.icon}</span>}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: `${data.color}99`,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {data.label}
        </span>
      </div>
    </div>
  );
}

export const ZoneNode = React.memo(ZoneNodeComponent);

/* ═══════════════════════════════════════════════════════
   Component Node — core services
   Supports _highlighted and _dimmed for selection mode
   ═══════════════════════════════════════════════════════ */

export type ComponentNodeData = {
  label: string;
  description: string;
  icon: string;
  tech: string;
  color: string;
  tags?: string[];
  port?: string;
  _highlighted?: boolean;
  _dimmed?: boolean;
};

function ComponentNodeComponent({ data }: NodeProps<Node<ComponentNodeData>>) {
  const [hovered, setHovered] = useState(false);
  const highlighted = data._highlighted;
  const dimmed = data._dimmed;
  const active = highlighted || hovered;

  const borderColor = highlighted
    ? data.color
    : dimmed
      ? '#161616'
      : active ? `${data.color}80` : '#1f1f1f';

  const shadow = highlighted
    ? `0 0 0 2px ${data.color}30, 0 4px 24px ${data.color}15`
    : 'none';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 260,
        background: dimmed ? '#0d0d0d' : '#141414',
        border: `1.5px solid ${borderColor}`,
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        boxShadow: shadow,
        opacity: dimmed ? 0.35 : 1,
        filter: dimmed ? 'grayscale(0.5)' : 'none',
      }}
    >
      {/* Color accent bar */}
      <div
        style={{
          height: 3,
          background: data.color,
          opacity: highlighted ? 1 : dimmed ? 0.15 : active ? 0.8 : 0.4,
          transition: 'opacity 0.25s',
        }}
      />

      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 8,
              background: `${data.color}12`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}
          >
            {data.icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: dimmed ? '#666' : '#fff', lineHeight: 1.2 }}>
              {data.label}
            </div>
            <div
              style={{
                fontSize: 10, color: dimmed ? '#444' : data.color,
                fontFamily: "'JetBrains Mono', monospace",
                opacity: 0.8, marginTop: 1,
              }}
            >
              {data.tech}
              {data.port && <span style={{ opacity: 0.6 }}> :{data.port}</span>}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: dimmed ? '#444' : '#888', lineHeight: 1.45, marginBottom: data.tags ? 8 : 0 }}>
          {data.description}
        </div>

        {data.tags && data.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {data.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 9, fontFamily: "'JetBrains Mono', monospace",
                  padding: '2px 6px', borderRadius: 4,
                  background: dimmed ? '#111' : `${data.color}10`,
                  color: dimmed ? '#333' : `${data.color}bb`,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Top} style={handleStyle(data.color)} />
      <Handle type="source" position={Position.Bottom} style={handleStyle(data.color)} />
      <Handle type="target" position={Position.Left} id="left" style={handleStyle(data.color)} />
      <Handle type="source" position={Position.Right} id="right" style={handleStyle(data.color)} />
    </div>
  );
}

export const ComponentNode = React.memo(ComponentNodeComponent);

/* ═══════════════════════════════════════════════════════
   Feature Card — smaller platform feature nodes
   ═══════════════════════════════════════════════════════ */

export type FeatureCardData = {
  label: string;
  description: string;
  icon: string;
  color: string;
  bullets?: string[];
  _highlighted?: boolean;
  _dimmed?: boolean;
};

function FeatureCardComponent({ data }: NodeProps<Node<FeatureCardData>>) {
  const dimmed = data._dimmed;

  return (
    <div
      style={{
        width: 210,
        background: dimmed ? '#0c0c0c' : '#111',
        border: `1px solid ${dimmed ? '#141414' : '#1a1a1a'}`,
        borderRadius: 10,
        padding: '10px 12px',
        transition: 'all 0.25s ease',
        opacity: dimmed ? 0.3 : 1,
        filter: dimmed ? 'grayscale(0.5)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
        <span style={{ fontSize: 15 }}>{data.icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: dimmed ? '#555' : '#ddd' }}>{data.label}</span>
      </div>
      <div style={{ fontSize: 10, color: dimmed ? '#444' : '#666', lineHeight: 1.4, marginBottom: data.bullets ? 6 : 0 }}>
        {data.description}
      </div>
      {data.bullets && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {data.bullets.map((b) => (
            <div key={b} style={{ fontSize: 9, color: dimmed ? '#333' : '#555', display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ color: dimmed ? '#222' : data.color, fontSize: 6, lineHeight: 1 }}>●</span>
              {b}
            </div>
          ))}
        </div>
      )}

      <Handle type="target" position={Position.Top} style={handleStyleSmall} />
      <Handle type="source" position={Position.Bottom} style={handleStyleSmall} />
      <Handle type="target" position={Position.Left} id="left" style={handleStyleSmall} />
      <Handle type="source" position={Position.Right} id="right" style={handleStyleSmall} />
    </div>
  );
}

export const FeatureCard = React.memo(FeatureCardComponent);

/* ═══════════════════════════════════════════════════════
   Integration Grid
   ═══════════════════════════════════════════════════════ */

export type IntegrationGridData = {
  label: string;
  icon: string;
  color: string;
  items: { name: string; icon: string }[];
  _dimmed?: boolean;
};

function IntegrationGridComponent({ data }: NodeProps<Node<IntegrationGridData>>) {
  const dimmed = data._dimmed;
  return (
    <div
      style={{
        width: 290,
        background: dimmed ? '#0c0c0c' : '#111',
        border: `1px solid ${dimmed ? '#141414' : '#1a1a1a'}`,
        borderRadius: 10,
        padding: '10px 12px',
        transition: 'all 0.25s ease',
        opacity: dimmed ? 0.3 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>{data.icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: dimmed ? '#555' : '#ddd' }}>{data.label}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {data.items.map((item) => (
          <div
            key={item.name}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 2, padding: '4px 2px', borderRadius: 6, background: '#161616',
            }}
          >
            <span style={{ fontSize: 13 }}>{item.icon}</span>
            <span style={{ fontSize: 7, color: '#555', textAlign: 'center', lineHeight: 1.2 }}>{item.name}</span>
          </div>
        ))}
      </div>

      <Handle type="target" position={Position.Top} style={handleStyleSmall} />
      <Handle type="source" position={Position.Bottom} style={handleStyleSmall} />
      <Handle type="target" position={Position.Left} id="left" style={handleStyleSmall} />
      <Handle type="source" position={Position.Right} id="right" style={handleStyleSmall} />
    </div>
  );
}

export const IntegrationGrid = React.memo(IntegrationGridComponent);

/* ═══════════════════════════════════════════════════════
   Infra Node
   ═══════════════════════════════════════════════════════ */

export type InfraNodeData = {
  label: string;
  tech: string;
  icon: string;
  color: string;
  details?: string[];
  _dimmed?: boolean;
};

function InfraNodeComponent({ data }: NodeProps<Node<InfraNodeData>>) {
  const dimmed = data._dimmed;
  return (
    <div
      style={{
        width: 165,
        background: dimmed ? '#0c0c0c' : '#0e0e0e',
        border: `1.5px dashed ${dimmed ? '#161616' : `${data.color}30`}`,
        borderRadius: 10,
        padding: '10px 12px',
        textAlign: 'center',
        transition: 'all 0.25s ease',
        opacity: dimmed ? 0.3 : 1,
      }}
    >
      <span style={{ fontSize: 22, display: 'block', marginBottom: 4 }}>{data.icon}</span>
      <div style={{ fontSize: 11, fontWeight: 600, color: dimmed ? '#555' : '#ccc' }}>{data.label}</div>
      <div style={{ fontSize: 9, color: data.color, fontFamily: "'JetBrains Mono', monospace", opacity: 0.7, marginTop: 2 }}>
        {data.tech}
      </div>
      {data.details && (
        <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {data.details.map((d) => (
            <div key={d} style={{ fontSize: 8, color: dimmed ? '#333' : '#555' }}>{d}</div>
          ))}
        </div>
      )}

      <Handle type="target" position={Position.Top} style={handleStyleSmall} />
      <Handle type="source" position={Position.Bottom} style={handleStyleSmall} />
      <Handle type="target" position={Position.Left} id="left" style={handleStyleSmall} />
      <Handle type="source" position={Position.Right} id="right" style={handleStyleSmall} />
    </div>
  );
}

export const InfraNode = React.memo(InfraNodeComponent);

/* ── Handle styles ── */
function handleStyle(color: string): React.CSSProperties {
  return { width: 6, height: 6, background: color, border: 'none', borderRadius: 3, opacity: 0.4 };
}
const handleStyleSmall: React.CSSProperties = { width: 4, height: 4, background: '#444', border: 'none', borderRadius: 2, opacity: 0.3 };

/* ── Export ── */
export const nodeTypes = {
  zone: ZoneNode,
  component: ComponentNode,
  feature: FeatureCard,
  integrationGrid: IntegrationGrid,
  infra: InfraNode,
};
