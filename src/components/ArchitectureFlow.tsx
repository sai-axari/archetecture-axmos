import { useCallback, useMemo, useReducer } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type NodeMouseHandler,
} from '@xyflow/react';

import { SystemNode } from './nodes/SystemNode';
import { DetailNode } from './nodes/DetailNode';
import { GroupNode } from './nodes/GroupNode';
import { AnimatedEdge } from './edges/AnimatedEdge';
import { FlowControls } from './panels/FlowControls';
import { InfoPanel } from './panels/InfoPanel';

import { overviewNodes } from '../data/nodes';
import { overviewEdges } from '../data/edges';
import { componentDetails } from '../data/details';
import { FLOWS, type FlowId } from '../data/flows';

// ─── State ──────────────────────────────────────────────────────────────────

type ViewState = { mode: 'overview' } | { mode: 'detail'; nodeId: string };

type State = {
  view: ViewState;
  activeFlows: Set<FlowId>;
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
};

type Action =
  | { type: 'CLICK_NODE'; nodeId: string }
  | { type: 'BACK' }
  | { type: 'HOVER'; nodeId: string }
  | { type: 'UNHOVER' }
  | { type: 'TOGGLE_FLOW'; flowId: FlowId }
  | { type: 'SET_ALL_FLOWS'; enabled: boolean }
  | { type: 'SELECT_NODE'; nodeId: string | null };

const allFlowIds = Object.keys(FLOWS) as FlowId[];

const initialState: State = {
  view: { mode: 'overview' },
  activeFlows: new Set<FlowId>(allFlowIds),
  hoveredNodeId: null,
  selectedNodeId: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'CLICK_NODE':
      return {
        ...state,
        view: { mode: 'detail', nodeId: action.nodeId },
        selectedNodeId: action.nodeId,
      };
    case 'BACK':
      return {
        ...state,
        view: { mode: 'overview' },
        selectedNodeId: null,
      };
    case 'HOVER':
      return { ...state, hoveredNodeId: action.nodeId };
    case 'UNHOVER':
      return { ...state, hoveredNodeId: null };
    case 'TOGGLE_FLOW': {
      const next = new Set(state.activeFlows);
      if (next.has(action.flowId)) next.delete(action.flowId);
      else next.add(action.flowId);
      return { ...state, activeFlows: next };
    }
    case 'SET_ALL_FLOWS': {
      const flows = action.enabled
        ? new Set<FlowId>(allFlowIds)
        : new Set<FlowId>();
      return { ...state, activeFlows: flows };
    }
    case 'SELECT_NODE':
      return { ...state, selectedNodeId: action.nodeId };
    default:
      return state;
  }
}

// ─── Node & edge types ──────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  system: SystemNode,
  detail: DetailNode,
  group: GroupNode,
};

const edgeTypes: EdgeTypes = {
  animated: AnimatedEdge,
};

// ─── Canvas ─────────────────────────────────────────────────────────────────

function FlowCanvas() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { fitView } = useReactFlow();

  const isOverview = state.view.mode === 'overview';
  const detailNodeId =
    state.view.mode === 'detail' ? state.view.nodeId : null;

  // Compute nodes
  const nodes: Node[] = useMemo(() => {
    if (isOverview) {
      return overviewNodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isHighlighted:
            state.hoveredNodeId === n.id || state.selectedNodeId === n.id,
        },
      }));
    }
    const detail = detailNodeId ? componentDetails[detailNodeId] : null;
    return detail?.nodes ?? [];
  }, [isOverview, detailNodeId, state.hoveredNodeId, state.selectedNodeId]);

  // Compute edges with active flow info
  const edges: Edge[] = useMemo(() => {
    if (isOverview) {
      return overviewEdges.map((e) => {
        const edgeFlows: string[] = (e.data as any)?.flows ?? [];
        const activeOnEdge = edgeFlows
          .filter((f) => state.activeFlows.has(f as FlowId))
          .map((f) => ({
            id: f,
            color: FLOWS[f as FlowId]?.color ?? '#6366f1',
          }));
        return {
          ...e,
          data: { ...e.data, activeFlows: activeOnEdge },
        };
      });
    }
    const detail = detailNodeId ? componentDetails[detailNodeId] : null;
    return (detail?.edges ?? []).map((e) => ({
      ...e,
      data: { ...e.data, activeFlows: [] },
    }));
  }, [isOverview, detailNodeId, state.activeFlows]);

  // Handlers
  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (isOverview && componentDetails[node.id]) {
        dispatch({ type: 'CLICK_NODE', nodeId: node.id });
        setTimeout(() => fitView({ duration: 800, padding: 0.15 }), 50);
      } else {
        dispatch({ type: 'SELECT_NODE', nodeId: node.id });
      }
    },
    [isOverview, fitView]
  );

  const onNodeMouseEnter: NodeMouseHandler = useCallback((_e, node) => {
    dispatch({ type: 'HOVER', nodeId: node.id });
  }, []);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    dispatch({ type: 'UNHOVER' });
  }, []);

  const handleBack = useCallback(() => {
    dispatch({ type: 'BACK' });
    setTimeout(() => fitView({ duration: 600, padding: 0.1 }), 50);
  }, [fitView]);

  const panelInfo = useMemo(() => {
    if (!state.selectedNodeId) return null;
    return componentDetails[state.selectedNodeId]?.panelInfo ?? null;
  }, [state.selectedNodeId]);

  const detailLabel = useMemo(() => {
    if (!detailNodeId) return null;
    return componentDetails[detailNodeId]?.panelInfo?.title ?? detailNodeId;
  }, [detailNodeId]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={() => dispatch({ type: 'SELECT_NODE', nodeId: null })}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#030810' }}
      >
        <Background
          variant={'lines' as any}
          gap={48}
          color="rgba(99,102,241,0.04)"
        />
        <Controls
          showInteractive={false}
          style={{ bottom: 80, left: 16 }}
        />
        <MiniMap
          style={{
            background: '#0a0f1a',
            border: '1px solid #262626',
          }}
          maskColor="rgba(3,8,16,0.8)"
          nodeColor="#6366f1"
        />
      </ReactFlow>

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '-0.02em',
            textShadow: '0 0 20px rgba(99,102,241,0.3)',
          }}
        >
          Axari
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#818cf8',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            fontFamily: "'JetBrains Mono', monospace",
            marginTop: 2,
          }}
        >
          {isOverview ? 'System Architecture' : detailLabel}
        </div>
      </div>

      {/* Back button */}
      {!isOverview && (
        <button
          onClick={handleBack}
          style={{
            position: 'absolute',
            top: 20,
            right: panelInfo ? 400 : 20,
            zIndex: 10,
            background: '#0a0f1a',
            border: '1px solid #6366f1',
            color: '#e5e5e5',
            padding: '8px 16px',
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#6366f1';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#0a0f1a';
            e.currentTarget.style.color = '#e5e5e5';
          }}
        >
          &#8592; Back to Overview
        </button>
      )}

      {/* Flow controls */}
      {isOverview && (
        <FlowControls
          activeFlows={state.activeFlows}
          onToggleFlow={(id) =>
            dispatch({ type: 'TOGGLE_FLOW', flowId: id as FlowId })
          }
          onSetAll={() =>
            dispatch({ type: 'SET_ALL_FLOWS', enabled: true })
          }
          onClearAll={() =>
            dispatch({ type: 'SET_ALL_FLOWS', enabled: false })
          }
        />
      )}

      {/* Info panel */}
      <InfoPanel panelInfo={panelInfo} onClose={() =>
        dispatch({ type: 'SELECT_NODE', nodeId: null })
      } />
    </div>
  );
}

export function ArchitectureFlow() {
  return <FlowCanvas />;
}
