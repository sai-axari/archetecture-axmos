import React, { useState } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';

export type SystemNodeData = {
  label: string;
  description: string;
  icon: string;
  tags: string[];
  category: string;
  isHighlighted?: boolean;
};

type SystemNodeType = Node<SystemNodeData, 'system'>;

function SystemNodeComponent({ data, selected }: NodeProps<SystemNodeType>) {
  const [hovered, setHovered] = useState(false);
  const glowing = hovered || data.isHighlighted || selected;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 280,
        background: '#030810',
        border: `1px solid ${glowing ? '#6366f1' : '#262626'}`,
        boxShadow: glowing
          ? '0 0 8px rgba(99,102,241,0.3), 0 0 20px rgba(99,102,241,0.15), 0 0 40px rgba(99,102,241,0.05)'
          : 'none',
        padding: 0,
        transition: 'border-color 0.2s, box-shadow 0.2s',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
        }}
      >
        <span style={{ fontSize: 24, lineHeight: 1 }}>{data.icon}</span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#ffffff',
            flex: 1,
          }}
        >
          {data.label}
        </span>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 6px rgba(34,197,94,0.6)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: '#262626' }} />

      {/* Description */}
      <div
        style={{
          padding: '8px 12px',
          fontSize: 12,
          color: '#a3a3a3',
          lineHeight: 1.4,
        }}
      >
        {data.description}
      </div>

      {/* Tags */}
      {data.tags && data.tags.length > 0 && (
        <div
          style={{
            padding: '4px 12px 10px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
          }}
        >
          {data.tags.map((tag) => (
            <span
              key={tag}
              style={{
                background: '#262626',
                color: '#818cf8',
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                padding: '2px 6px',
                lineHeight: 1.4,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 6,
          height: 6,
          background: '#6366f1',
          border: 'none',
          borderRadius: 0,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 6,
          height: 6,
          background: '#6366f1',
          border: 'none',
          borderRadius: 0,
        }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          width: 6,
          height: 6,
          background: '#6366f1',
          border: 'none',
          borderRadius: 0,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{
          width: 6,
          height: 6,
          background: '#6366f1',
          border: 'none',
          borderRadius: 0,
        }}
      />

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

export const SystemNode = React.memo(SystemNodeComponent);
