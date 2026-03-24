import { useCallback, useRef, useState } from 'react';
import { useReactFlow, type Viewport, type Node, type Edge } from '@xyflow/react';

type ViewMode = 'overview' | 'detail';

interface ZoomToNodeReturn {
  currentView: ViewMode;
  zoomToDetail: (nodeId: string, detailNodes: Node[], detailEdges: Edge[]) => void;
  zoomToOverview: (overviewNodes: Node[], overviewEdges: Edge[]) => void;
}

export function useZoomToNode(): ZoomToNodeReturn {
  const { setNodes, setEdges, fitView, getViewport } = useReactFlow();
  const [currentView, setCurrentView] = useState<ViewMode>('overview');
  const savedViewport = useRef<Viewport | null>(null);

  const zoomToDetail = useCallback(
    (nodeId: string, detailNodes: Node[], detailEdges: Edge[]) => {
      savedViewport.current = getViewport();
      setCurrentView('detail');
      setNodes(detailNodes);
      setEdges(detailEdges);
      // Allow React Flow to process the new nodes before fitting
      requestAnimationFrame(() => {
        fitView({ duration: 800, padding: 0.15 });
      });
    },
    [setNodes, setEdges, fitView, getViewport],
  );

  const zoomToOverview = useCallback(
    (overviewNodes: Node[], overviewEdges: Edge[]) => {
      setCurrentView('overview');
      setNodes(overviewNodes);
      setEdges(overviewEdges);
      requestAnimationFrame(() => {
        fitView({ duration: 600, padding: 0.1 });
      });
    },
    [setNodes, setEdges, fitView],
  );

  return { currentView, zoomToDetail, zoomToOverview };
}
