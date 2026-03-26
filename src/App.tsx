import { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ArchitectureFlow } from './components/ArchitectureFlow';
import { UserFlowView } from './components/UserFlowView';
import { AgentTeamsViz } from './components/AgentTeamsViz';
import { ParticleBackground } from './components/effects/ParticleBackground';
import { Scanline } from './components/effects/Scanline';
import './index.css';

type Tab = 'architecture' | 'user-flows' | 'agent-teams';

function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'architecture', label: 'Architecture' },
    { id: 'user-flows', label: 'User Flows' },
    { id: 'agent-teams', label: 'Agent Teams' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        background: 'rgba(3,8,16,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid #262626',
      }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = '#a3a3a3';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = '#737373';
              }
            }}
            style={{
              padding: '8px 20px',
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
              color: isActive ? '#e5e5e5' : '#737373',
              cursor: 'pointer',
              transition: 'all 0.15s',
              outline: 'none',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('architecture');

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#030810',
        position: 'relative',
      }}
    >
      {/* <ParticleBackground /> */}
      <Scanline />

      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Architecture view */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          display: activeTab === 'architecture' ? 'block' : 'none',
        }}
      >
        <ReactFlowProvider>
          <ArchitectureFlow />
        </ReactFlowProvider>
      </div>

      {/* User Flows view */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: activeTab === 'user-flows' ? 1 : -1,
          opacity: activeTab === 'user-flows' ? 1 : 0,
          transition: 'opacity 0.3s',
          pointerEvents: activeTab === 'user-flows' ? 'auto' : 'none',
        }}
      >
        <UserFlowView />
      </div>

      {/* Agent Teams view */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: activeTab === 'agent-teams' ? 1 : -1,
          opacity: activeTab === 'agent-teams' ? 1 : 0,
          transition: 'opacity 0.3s',
          pointerEvents: activeTab === 'agent-teams' ? 'auto' : 'none',
        }}
      >
        <AgentTeamsViz />
      </div>
    </div>
  );
}
