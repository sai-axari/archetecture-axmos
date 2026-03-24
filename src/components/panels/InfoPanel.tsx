import React from 'react';
import { AnimatePresence, motion } from 'motion/react';

export interface PanelInfo {
  title: string;
  description: string;
  technologies?: string[];
  features?: string[];
  stats?: Record<string, string>;
  flows?: { id: string; label: string; color: string }[];
}

interface InfoPanelProps {
  panelInfo: PanelInfo | null;
  onClose: () => void;
}

function InfoPanelComponent({ panelInfo, onClose }: InfoPanelProps) {
  return (
    <AnimatePresence>
      {panelInfo && (
        <motion.div
          initial={{ x: 380 }}
          animate={{ x: 0 }}
          exit={{ x: 380 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 380,
            background: '#0a0f1a',
            borderLeft: '1px solid #262626',
            zIndex: 20,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 28,
              height: 28,
              background: 'transparent',
              border: '1px solid #262626',
              color: '#a3a3a3',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#6366f1';
              e.currentTarget.style.color = '#e5e5e5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#262626';
              e.currentTarget.style.color = '#a3a3a3';
            }}
          >
            ×
          </button>

          <div style={{ padding: '24px 20px' }}>
            {/* Header */}
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: '#ffffff',
                margin: 0,
                paddingRight: 36,
              }}
            >
              {panelInfo.title}
            </h2>
            <p
              style={{
                fontSize: 13,
                color: '#a3a3a3',
                lineHeight: 1.5,
                marginTop: 8,
                marginBottom: 20,
              }}
            >
              {panelInfo.description}
            </p>

            {/* Technologies */}
            {panelInfo.technologies && panelInfo.technologies.length > 0 && (
              <Section title="Technologies">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {panelInfo.technologies.map((tech) => (
                    <span
                      key={tech}
                      style={{
                        background: '#262626',
                        color: '#818cf8',
                        fontSize: 11,
                        fontFamily: "'JetBrains Mono', monospace",
                        padding: '3px 8px',
                      }}
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Features */}
            {panelInfo.features && panelInfo.features.length > 0 && (
              <Section title="Features">
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 16,
                    listStyleType: 'disc',
                  }}
                >
                  {panelInfo.features.map((feature) => (
                    <li
                      key={feature}
                      style={{
                        fontSize: 12,
                        color: '#a3a3a3',
                        lineHeight: 1.6,
                      }}
                    >
                      {feature}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Stats */}
            {panelInfo.stats && Object.keys(panelInfo.stats).length > 0 && (
              <Section title="Stats">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(panelInfo.stats).map(([key, value]) => (
                    <div
                      key={key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: 12, color: '#737373' }}>{key}</span>
                      <span
                        style={{
                          fontSize: 12,
                          color: '#e5e5e5',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Data Flows */}
            {panelInfo.flows && panelInfo.flows.length > 0 && (
              <Section title="Data Flows">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {panelInfo.flows.map((flow) => (
                    <div
                      key={flow.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: flow.color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 12, color: '#a3a3a3' }}>{flow.label}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#818cf8',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontFamily: "'JetBrains Mono', monospace",
          marginBottom: 10,
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

export const InfoPanel = React.memo(InfoPanelComponent);
