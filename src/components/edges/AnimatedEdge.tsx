import React from 'react';
import {
  getBezierPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';

export type AnimatedEdgeData = {
  label?: string;
  flows?: string[];
  activeFlows?: { id: string; color: string }[];
};

type AnimatedEdgeType = Edge<AnimatedEdgeData, 'animated'>;

function AnimatedEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<AnimatedEdgeType>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const activeFlows = data?.activeFlows ?? [];

  return (
    <g>
      {/* Defs for blur filters */}
      <defs>
        {activeFlows.map((flow) => (
          <filter
            key={`blur-${id}-${flow.id}`}
            id={`blur-${id}-${flow.id}`}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="3" />
          </filter>
        ))}
      </defs>

      {/* Base path */}
      <path
        d={edgePath}
        fill="none"
        stroke="#262626"
        strokeWidth={1.5}
        markerEnd={markerEnd}
      />

      {/* Active flow glow paths and particles */}
      {activeFlows.map((flow) => (
        <g key={`flow-${id}-${flow.id}`}>
          {/* Glow path */}
          <path
            d={edgePath}
            fill="none"
            stroke={flow.color}
            strokeWidth={2}
            strokeOpacity={0.6}
            filter={`url(#blur-${id}-${flow.id})`}
          />

          {/* Animated particles */}
          {[0, 0.5, 1, 1.5].map((delay, i) => (
            <circle
              key={`particle-${id}-${flow.id}-${i}`}
              r={3}
              fill={flow.color}
              opacity={0.8}
            >
              <animateMotion
                dur="2.5s"
                repeatCount="indefinite"
                begin={`${delay}s`}
                path={edgePath}
              />
            </circle>
          ))}
        </g>
      ))}

      {/* Label */}
      {data?.label && (
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontSize: 10,
            fill: '#737373',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {data.label}
        </text>
      )}
    </g>
  );
}

export const AnimatedEdge = React.memo(AnimatedEdgeComponent);
