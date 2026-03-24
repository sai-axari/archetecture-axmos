import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { userFlows, SYSTEM_COLORS, type UserFlow, type FlowStep } from '../data/userFlows';

// ─── System badge pill ──────────────────────────────────────────────────────

function SystemBadge({ system }: { system: FlowStep['system'] }) {
  const color = SYSTEM_COLORS[system];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 600,
        color,
        background: `${color}15`,
        border: `1px solid ${color}40`,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        lineHeight: '16px',
      }}
    >
      {system}
    </span>
  );
}

// ─── Step number pill ───────────────────────────────────────────────────────

function StepPill({ number }: { number: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 20,
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 700,
        color: '#c7d2fe',
        background: 'rgba(99,102,241,0.15)',
        border: '1px solid rgba(99,102,241,0.3)',
      }}
    >
      {number}
    </span>
  );
}

// ─── Technical detail block ─────────────────────────────────────────────────

function TechnicalBlock({ lines }: { lines: string[] }) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: '8px 10px',
        background: '#030810',
        border: '1px solid #1a1a2e',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        lineHeight: '18px',
        color: '#818cf8',
      }}
    >
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', gap: 6 }}>
          <span style={{ color: '#4b5563', userSelect: 'none' }}>{'>'}</span>
          <span>{line}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Connecting line between steps ──────────────────────────────────────────

function ConnectorLine({ isActive }: { isActive: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        height: 32,
        position: 'relative',
      }}
    >
      {/* Dashed line */}
      <div
        style={{
          width: 1,
          height: '100%',
          backgroundImage: `repeating-linear-gradient(
            to bottom,
            ${isActive ? '#6366f1' : '#262626'} 0px,
            ${isActive ? '#6366f1' : '#262626'} 4px,
            transparent 4px,
            transparent 8px
          )`,
          transition: 'all 0.3s',
        }}
      />
      {/* Animated dot */}
      {isActive && (
        <motion.div
          style={{
            position: 'absolute',
            width: 6,
            height: 6,
            background: '#6366f1',
            boxShadow: '0 0 8px rgba(99,102,241,0.6)',
            left: '50%',
            marginLeft: -3,
          }}
          animate={{
            top: ['0%', '100%'],
            opacity: [1, 0.3],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      )}
    </div>
  );
}

// ─── Single step card ───────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  isHighlighted,
}: {
  step: FlowStep;
  index: number;
  isHighlighted: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const active = isHighlighted || isHovered;

  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: '#0a0f1a',
        border: `1px solid ${active ? '#6366f1' : '#262626'}`,
        padding: 16,
        position: 'relative',
        cursor: 'default',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: active
          ? '0 0 12px rgba(99,102,241,0.15), 0 0 30px rgba(99,102,241,0.05)'
          : 'none',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <StepPill number={index + 1} />
        <SystemBadge system={step.system} />
      </div>

      {/* Separator */}
      <div
        style={{
          height: 1,
          background: active
            ? 'linear-gradient(to right, #6366f1, transparent)'
            : '#1a1a2e',
          marginBottom: 10,
          transition: 'background 0.3s',
        }}
      />

      {/* Label */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#fff',
          marginBottom: 4,
          lineHeight: '20px',
        }}
      >
        {step.label}
      </div>

      {/* Detail */}
      <div
        style={{
          fontSize: 12,
          color: '#a3a3a3',
          lineHeight: '18px',
        }}
      >
        {step.detail}
      </div>

      {/* Technical details */}
      {step.technical && step.technical.length > 0 && (
        <TechnicalBlock lines={step.technical} />
      )}
    </motion.div>
  );
}

// ─── Flow sidebar item ─────────────────────────────────────────────────────

function FlowSidebarItem({
  flow,
  isSelected,
  onClick,
}: {
  flow: UserFlow;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 12px',
        background: isSelected
          ? 'rgba(99,102,241,0.08)'
          : isHovered
            ? 'rgba(255,255,255,0.02)'
            : 'transparent',
        border: 'none',
        borderLeft: isSelected
          ? '2px solid #6366f1'
          : '2px solid transparent',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
        outline: 'none',
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
        {flow.icon}
      </span>

      {/* Text */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: isSelected ? 600 : 400,
            color: isSelected ? '#e5e5e5' : isHovered ? '#a3a3a3' : '#737373',
            lineHeight: '16px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            transition: 'color 0.15s',
          }}
        >
          {flow.title}
        </div>
        <div
          style={{
            fontSize: 10,
            color: '#525252',
            fontFamily: "'JetBrains Mono', monospace",
            marginTop: 2,
          }}
        >
          {flow.steps.length} steps
        </div>
      </div>
    </button>
  );
}

// ─── Play/Pause button ──────────────────────────────────────────────────────

function PlayButton({
  isPlaying,
  onClick,
}: {
  isPlaying: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: isPlaying
          ? 'rgba(99,102,241,0.15)'
          : hovered
            ? 'rgba(99,102,241,0.1)'
            : 'transparent',
        border: `1px solid ${isPlaying ? '#6366f1' : '#262626'}`,
        color: isPlaying ? '#818cf8' : '#737373',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        cursor: 'pointer',
        transition: 'all 0.2s',
        outline: 'none',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {isPlaying ? (
        <>
          <span style={{ fontSize: 10 }}>&#9646;&#9646;</span> Pause
        </>
      ) : (
        <>
          <span style={{ fontSize: 10 }}>&#9654;</span> Auto-Play
        </>
      )}
    </button>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function UserFlowView() {
  const [selectedFlowId, setSelectedFlowId] = useState(userFlows[0].id);
  const [highlightedStep, setHighlightedStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepsContainerRef = useRef<HTMLDivElement>(null);

  const selectedFlow = userFlows.find((f) => f.id === selectedFlowId) ?? userFlows[0];

  // ── Auto-play logic ──────────────────────────────────────
  const stopAutoPlay = useCallback(() => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const startAutoPlay = useCallback(() => {
    setHighlightedStep(0);
    setIsPlaying(true);

    let step = 0;
    playIntervalRef.current = setInterval(() => {
      step += 1;
      if (step >= selectedFlow.steps.length) {
        stopAutoPlay();
        setHighlightedStep(-1);
        return;
      }
      setHighlightedStep(step);
    }, 1500);
  }, [selectedFlow.steps.length, stopAutoPlay]);

  const toggleAutoPlay = useCallback(() => {
    if (isPlaying) {
      stopAutoPlay();
      setHighlightedStep(-1);
    } else {
      startAutoPlay();
    }
  }, [isPlaying, stopAutoPlay, startAutoPlay]);

  // Reset on flow change
  useEffect(() => {
    stopAutoPlay();
    setHighlightedStep(-1);
    if (stepsContainerRef.current) {
      stepsContainerRef.current.scrollTop = 0;
    }
  }, [selectedFlowId, stopAutoPlay]);

  // Scroll highlighted step into view
  useEffect(() => {
    if (highlightedStep >= 0 && stepsContainerRef.current) {
      const stepEls = stepsContainerRef.current.querySelectorAll('[data-step]');
      const el = stepEls[highlightedStep];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [highlightedStep]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: '#030810',
        position: 'relative',
      }}
    >
      {/* ── Left sidebar ────────────────────────────────────── */}
      <div
        style={{
          width: 240,
          minWidth: 240,
          height: '100%',
          borderRight: '1px solid #262626',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(10,15,26,0.6)',
        }}
      >
        {/* Sidebar header */}
        <div
          style={{
            padding: '20px 14px 12px',
            borderBottom: '1px solid #1a1a2e',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: '#818cf8',
              marginBottom: 4,
            }}
          >
            User Flows
          </div>
          <div
            style={{
              fontSize: 10,
              color: '#525252',
            }}
          >
            {userFlows.length} lifecycle flows
          </div>
        </div>

        {/* Flow list */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 0',
          }}
        >
          {userFlows.map((flow) => (
            <FlowSidebarItem
              key={flow.id}
              flow={flow}
              isSelected={flow.id === selectedFlowId}
              onClick={() => setSelectedFlowId(flow.id)}
            />
          ))}
        </div>

        {/* Legend */}
        <div
          style={{
            padding: '12px 14px',
            borderTop: '1px solid #1a1a2e',
          }}
        >
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
            Systems
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Object.entries(SYSTEM_COLORS).map(([name, color]) => (
              <span
                key={name}
                style={{
                  fontSize: 9,
                  fontFamily: "'JetBrains Mono', monospace",
                  color,
                  padding: '1px 5px',
                  background: `${color}10`,
                  border: `1px solid ${color}25`,
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content area ───────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* Flow header */}
        <div
          style={{
            padding: '20px 32px 16px',
            borderBottom: '1px solid #1a1a2e',
            background: 'rgba(10,15,26,0.4)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 22 }}>{selectedFlow.icon}</span>
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#fff',
                    margin: 0,
                    lineHeight: '24px',
                  }}
                >
                  {selectedFlow.title}
                </h2>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: '#737373',
                  lineHeight: '18px',
                  margin: 0,
                  maxWidth: 600,
                }}
              >
                {selectedFlow.description}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
                paddingTop: 4,
              }}
            >
              {/* Step counter */}
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#525252',
                }}
              >
                {highlightedStep >= 0 ? (
                  <span>
                    Step{' '}
                    <span style={{ color: '#818cf8' }}>
                      {highlightedStep + 1}
                    </span>{' '}
                    of {selectedFlow.steps.length}
                  </span>
                ) : (
                  <span>{selectedFlow.steps.length} steps</span>
                )}
              </div>

              <PlayButton isPlaying={isPlaying} onClick={toggleAutoPlay} />
            </div>
          </div>
        </div>

        {/* Steps list */}
        <div
          ref={stepsContainerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 32px 80px',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedFlow.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: {
                    transition: {
                      staggerChildren: 0.08,
                    },
                  },
                }}
              >
                {selectedFlow.steps.map((step, i) => (
                  <motion.div
                    key={step.id}
                    data-step
                    variants={{
                      hidden: { opacity: 0, x: -24 },
                      visible: { opacity: 1, x: 0 },
                    }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  >
                    <div style={{ maxWidth: 680 }}>
                      <StepCard
                        step={step}
                        index={i}
                        isHighlighted={highlightedStep === i}
                      />
                      {i < selectedFlow.steps.length - 1 && (
                        <ConnectorLine
                          isActive={
                            highlightedStep === i || highlightedStep === i + 1
                          }
                        />
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* End marker */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 16,
                  maxWidth: 680,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    background: '#6366f1',
                    boxShadow: '0 0 8px rgba(99,102,241,0.4)',
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#525252',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  Flow complete
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background:
                      'linear-gradient(to right, #262626, transparent)',
                  }}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
