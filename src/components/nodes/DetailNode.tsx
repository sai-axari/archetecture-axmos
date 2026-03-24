import React, { useState } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';

export type DetailNodeData = {
  label: string;
  subtitle?: string;
};

type DetailNodeType = Node<DetailNodeData, 'detail'>;

function DetailNodeComponent({ data }: NodeProps<DetailNodeType>) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 200,
        height: 60,
        background: 'rgba(99,102,241,0.05)',
        border: `1px solid ${hovered ? '#818cf8' : 'rgba(99,102,241,0.2)'}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 12px',
        transition: 'border-color 0.2s',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          color: '#e5e5e5',
          lineHeight: 1.3,
        }}
      >
        {data.label}
      </div>
      {data.subtitle && (
        <div
          style={{
            fontSize: 10,
            color: '#737373',
            marginTop: 2,
          }}
        >
          {data.subtitle}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 4,
          height: 4,
          background: '#6366f1',
          border: 'none',
          borderRadius: 0,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 4,
          height: 4,
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
          width: 4,
          height: 4,
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
          width: 4,
          height: 4,
          background: '#6366f1',
          border: 'none',
          borderRadius: 0,
        }}
      />
    </div>
  );
}

export const DetailNode = React.memo(DetailNodeComponent);
