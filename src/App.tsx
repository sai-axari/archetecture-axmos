import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  BackgroundVariant,
  useReactFlow,
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type Edge,
  type ColorMode,
  type NodeMouseHandler,
} from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';

import { nodeTypes } from './nodes';
import { nodes as rawNodes, edges as rawEdges, type EdgeData, C } from './data';

/* ══════════════════════════════════════════════════════════
   Selection logic:
   - Nothing selected → everything at normal opacity
   - Node selected → that node + connected nodes highlight,
     connected edges get full color & labels,
     everything else dims
   ══════════════════════════════════════════════════════════ */

function useSelectionHighlight(selectedId: string | null) {
  return useMemo(() => {
    if (!selectedId) {
      return { nodes: rawNodes, edges: rawEdges };
    }

    // Find connected edges and nodes
    const connectedEdgeIds = new Set<string>();
    const connectedNodeIds = new Set<string>([selectedId]);

    for (const edge of rawEdges) {
      if (edge.source === selectedId || edge.target === selectedId) {
        connectedEdgeIds.add(edge.id);
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      }
    }

    // Also include parent zone of selected node
    const selectedNode = rawNodes.find((n) => n.id === selectedId);
    if (selectedNode?.parentId) {
      connectedNodeIds.add(selectedNode.parentId);
    }
    // Include parent zones of connected nodes
    for (const nid of [...connectedNodeIds]) {
      const n = rawNodes.find((nd) => nd.id === nid);
      if (n?.parentId) connectedNodeIds.add(n.parentId);
    }

    const nodes: Node[] = rawNodes.map((node) => {
      const isZone = node.type === 'zone';
      const isConnected = connectedNodeIds.has(node.id);
      const isSelected = node.id === selectedId;

      if (isZone) {
        return {
          ...node,
          style: {
            ...node.style,
            opacity: connectedNodeIds.has(node.id) ? 1 : 0.3,
          },
        };
      }

      return {
        ...node,
        data: {
          ...node.data,
          _highlighted: isSelected,
          _dimmed: !isConnected,
        },
      };
    });

    const edges: Edge[] = rawEdges.map((edge) => {
      const isConnected = connectedEdgeIds.has(edge.id);
      const edgeData = edge.data as EdgeData | undefined;
      const color = edgeData?.color ?? '#444';

      if (isConnected) {
        return {
          ...edge,
          animated: true,
          style: { stroke: color, strokeWidth: 2.5, strokeDasharray: undefined },
          labelStyle: { fill: '#ddd', fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" },
          labelBgStyle: { fill: '#141414', fillOpacity: 1, stroke: color, strokeWidth: 1 },
          labelBgPadding: [8, 4] as [number, number],
          labelBgBorderRadius: 6,
        };
      }

      return {
        ...edge,
        animated: false,
        style: { stroke: '#151515', strokeWidth: 1 },
        label: undefined,
      };
    });

    return { nodes, edges };
  }, [selectedId]);
}

/* ══════════════════════════════════════════════════════════
   Main diagram component
   ══════════════════════════════════════════════════════════ */

function miniMapColor(node: { type?: string }) {
  switch (node.type) {
    case 'zone': return 'rgba(255,255,255,0.03)';
    case 'component': return '#818cf8';
    case 'feature': return '#a78bfa';
    case 'infra': return '#64748b';
    case 'integrationGrid': return '#2dd4bf';
    default: return '#333';
  }
}

const IMAGE_W = 4096;
const IMAGE_H = 5120;

function ArchitectureDiagram() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { nodes, edges } = useSelectionHighlight(selectedId);
  const { getNodes } = useReactFlow();

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    if (node.type === 'zone') {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => (prev === node.id ? null : node.id));
  }, []);

  const onPaneClick = useCallback(() => setSelectedId(null), []);

  const doExport = useCallback(
    async (format: 'png' | 'svg') => {
      const el = document.querySelector<HTMLElement>('.react-flow__viewport');
      if (!el) return;
      setExporting(true);
      const allNodes = getNodes();
      const bounds = getNodesBounds(allNodes);
      const pad = 80;
      const vp = getViewportForBounds(
        { x: bounds.x - pad, y: bounds.y - pad, width: bounds.width + pad * 2, height: bounds.height + pad * 2 },
        IMAGE_W, IMAGE_H, 0.1, 2, 0,
      );
      try {
        const fn = format === 'svg' ? toSvg : toPng;
        const dataUrl = await fn(el, {
          backgroundColor: '#0a0a0a',
          width: IMAGE_W,
          height: IMAGE_H,
          style: {
            width: `${IMAGE_W}px`,
            height: `${IMAGE_H}px`,
            transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
          },
        });
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `axari-architecture.${format}`;
        a.click();
      } finally {
        setExporting(false);
      }
    },
    [getNodes],
  );

  // Count connected edges for the info bar
  const connectedCount = selectedId
    ? rawEdges.filter((e) => e.source === selectedId || e.target === selectedId).length
    : 0;
  const selectedNode = selectedId ? rawNodes.find((n) => n.id === selectedId) : null;

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        colorMode={'dark' as ColorMode}
        fitView
        fitViewOptions={{ padding: 0.05 }}
        minZoom={0.06}
        maxZoom={2.5}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.03)" />
        <Controls showInteractive={false} />
        <MiniMap nodeColor={miniMapColor} maskColor="rgba(0,0,0,0.75)" pannable zoomable />

        {/* ── Title ── */}
        <Panel position="top-left">
          <div style={panelStyle}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
              Axari Platform Architecture
            </div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>
              Click any service to see its connections
            </div>
          </div>
        </Panel>

        {/* ── Legend + Export ── */}
        <Panel position="top-right">
          <div style={{ ...panelStyle, minWidth: 190 }}>
            <SectionLabel>Legend</SectionLabel>
            <LegendItem
              swatch={<div style={{ width: 22, height: 3, background: C.emerald, borderRadius: 2 }} />}
              label="Data flow (animated)"
            />
            <LegendItem
              swatch={<div style={{ width: 22, height: 0, borderTop: '2px dashed #60a5fa' }} />}
              label="Dependency (dashed)"
            />
            <LegendItem
              swatch={<div style={{ width: 22, height: 1, background: '#333' }} />}
              label="Internal link"
            />
            <div style={{ height: 8 }} />
            <LegendItem
              swatch={<div style={{ width: 22, height: 13, borderRadius: 4, border: '1px solid #333', background: '#141414' }} />}
              label="Service"
            />
            <LegendItem
              swatch={<div style={{ width: 22, height: 13, borderRadius: 4, border: '1px solid #222', background: '#111' }} />}
              label="Feature"
            />
            <LegendItem
              swatch={<div style={{ width: 22, height: 13, borderRadius: 4, border: '1.5px dashed #444', background: '#0e0e0e' }} />}
              label="Infrastructure"
            />

            <div style={{ borderTop: '1px solid #1a1a1a', margin: '12px 0', paddingTop: 10 }}>
              <SectionLabel>Export</SectionLabel>
              <div style={{ display: 'flex', gap: 6 }}>
                <ExportBtn label="PNG" loading={exporting} onClick={() => doExport('png')} />
                <ExportBtn label="SVG" loading={exporting} onClick={() => doExport('svg')} />
              </div>
            </div>
          </div>
        </Panel>

        {/* ── Stats ── */}
        <Panel position="bottom-left">
          <div style={{ ...panelStyle, display: 'flex', gap: 28 }}>
            <Stat value="5" label="Services" />
            <Stat value="19" label="API Routes" />
            <Stat value="25+" label="DB Models" />
            <Stat value="12" label="Features" />
            <Stat value="20+" label="Integrations" />
          </div>
        </Panel>

        {/* ── Selection info bar ── */}
        {selectedNode && (
          <Panel position="bottom-center">
            <div
              style={{
                ...panelStyle,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 20px',
              }}
            >
              <span style={{ fontSize: 18 }}>{(selectedNode.data as any).icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                  {(selectedNode.data as any).label}
                </div>
                <div style={{ fontSize: 10, color: '#666', fontFamily: "'JetBrains Mono', monospace" }}>
                  {connectedCount} connection{connectedCount !== 1 ? 's' : ''} · click background to deselect
                </div>
              </div>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

/* ── Shared UI ── */

const panelStyle: React.CSSProperties = {
  background: 'rgba(10,10,10,0.92)',
  backdropFilter: 'blur(12px)',
  border: '1px solid #1f1f1f',
  borderRadius: 12,
  padding: '14px 18px',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.08em', color: '#444', marginBottom: 8,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {children}
    </div>
  );
}

function LegendItem({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      {swatch}
      <span style={{ fontSize: 10, color: '#666' }}>{label}</span>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{value}</div>
      <div style={{ fontSize: 8, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}

function ExportBtn({ label, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        flex: 1, padding: '7px 0', fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
        background: '#1a1a1a', border: '1px solid #262626', borderRadius: 6,
        color: loading ? '#444' : '#aaa', cursor: loading ? 'wait' : 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.background = '#262626'; e.currentTarget.style.color = '#fff'; } }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#aaa'; }}
    >
      {loading ? '...' : label}
    </button>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <ArchitectureDiagram />
    </ReactFlowProvider>
  );
}
