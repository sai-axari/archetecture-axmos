import React, { useState } from 'react';
import { FLOWS, type FlowId } from '../../data/flows';

interface FlowControlsProps {
  activeFlows: Set<string>;
  onToggleFlow: (flowId: string) => void;
  onSetAll: () => void;
  onClearAll: () => void;
}

function FlowControlsComponent({
  activeFlows,
  onToggleFlow,
  onSetAll,
  onClearAll,
}: FlowControlsProps) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(3,8,16,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid #262626',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        zIndex: 10,
      }}
    >
      {Object.values(FLOWS).map((flow) => {
        const isActive = activeFlows.has(flow.id);
        return (
          <FlowButton
            key={flow.id}
            flow={flow}
            isActive={isActive}
            onClick={() => onToggleFlow(flow.id)}
          />
        );
      })}

      <div style={{ width: 1, height: 24, background: '#262626', margin: '0 4px' }} />

      <button
        onClick={onSetAll}
        style={{
          background: '#262626',
          border: 'none',
          color: '#a3a3a3',
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
          padding: '4px 8px',
          cursor: 'pointer',
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#e5e5e5')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#a3a3a3')}
      >
        All
      </button>
      <button
        onClick={onClearAll}
        style={{
          background: '#262626',
          border: 'none',
          color: '#a3a3a3',
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
          padding: '4px 8px',
          cursor: 'pointer',
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#e5e5e5')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#a3a3a3')}
      >
        None
      </button>
    </div>
  );
}

function FlowButton({
  flow,
  isActive,
  onClick,
}: {
  flow: { id: string; label: string; color: string };
  isActive: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: isActive ? `${flow.color}26` : hovered ? '#1a1a2e' : '#262626',
        border: `1px solid ${isActive ? flow.color : 'transparent'}`,
        color: isActive ? '#e5e5e5' : '#737373',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: flow.color,
          opacity: isActive ? 1 : 0.4,
          transition: 'opacity 0.15s',
          animation: isActive ? 'pulse 2s ease-in-out infinite' : 'none',
        }}
      />
      {flow.label}
    </button>
  );
}

export const FlowControls = React.memo(FlowControlsComponent);
