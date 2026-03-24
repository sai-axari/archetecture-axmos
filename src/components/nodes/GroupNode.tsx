import React from 'react';
import type { NodeProps, Node } from '@xyflow/react';

export type GroupNodeData = {
  label: string;
  width: number;
  height: number;
};

type GroupNodeType = Node<GroupNodeData, 'group'>;

function GroupNodeComponent({ data }: NodeProps<GroupNodeType>) {
  return (
    <div
      style={{
        minWidth: data.width || 300,
        minHeight: data.height || 200,
        width: data.width || 300,
        height: data.height || 200,
        border: '1px dashed rgba(99,102,241,0.15)',
        background: 'transparent',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 12,
          fontSize: 11,
          fontWeight: 600,
          color: '#818cf8',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {data.label}
      </div>
    </div>
  );
}

export const GroupNode = React.memo(GroupNodeComponent);
