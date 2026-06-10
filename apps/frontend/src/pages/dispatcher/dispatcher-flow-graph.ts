import { MarkerType, Position, type Edge, type Node } from '@xyflow/react';
import { DISPATCHER_NODE_TYPE, type DispatcherFlowNodeData } from './dispatcher-flow-node';

export type FlowNodeStatus = 'idle' | 'active' | 'done';

export const REPLAY_STEP_MS = 620;

export const FLOW_NODE_LABELS: Record<string, { label: string; caption: string }> = {
  START: { label: 'START', caption: 'Input enters graph' },
  classify: { label: 'classify', caption: 'Route incoming work' },
  code_review_start: { label: 'code review', caption: 'Parallel review fan-out' },
  review_api_compatibility: { label: 'API check', caption: 'Compatibility risk' },
  review_test_coverage: { label: 'Tests check', caption: 'Coverage risk' },
  review_change_risk: { label: 'Risk check', caption: 'Change blast radius' },
  review_aggregate: { label: 'review verdict', caption: 'Fan-in decision' },
  incident: { label: 'incident', caption: 'On-call triage' },
  analytics_orchestrator: { label: 'analytics plan', caption: 'Dynamic fan-out' },
  analytics_worker: { label: 'analytics worker', caption: 'Per-task finding' },
  analytics_synthesize: { label: 'synthesis', caption: 'Fan-in answer' },
  needs_human: { label: 'needs human', caption: 'Manual triage' },
  END: { label: 'END', caption: 'Final response' },
};

export const FLOW_NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  START: { x: 0, y: 300 },
  classify: { x: 220, y: 300 },
  code_review_start: { x: 455, y: 55 },
  review_api_compatibility: { x: 715, y: 0 },
  review_test_coverage: { x: 715, y: 120 },
  review_change_risk: { x: 715, y: 240 },
  review_aggregate: { x: 990, y: 120 },
  incident: { x: 455, y: 360 },
  analytics_orchestrator: { x: 455, y: 505 },
  analytics_worker: { x: 715, y: 505 },
  analytics_synthesize: { x: 990, y: 505 },
  needs_human: { x: 455, y: 650 },
  END: { x: 1265, y: 300 },
};

export const FLOW_EDGES: Edge[] = [
  { id: 'START-classify', source: 'START', target: 'classify' },
  { id: 'classify-code_review_start', source: 'classify', target: 'code_review_start' },
  { id: 'classify-incident', source: 'classify', target: 'incident' },
  { id: 'classify-analytics_orchestrator', source: 'classify', target: 'analytics_orchestrator' },
  { id: 'classify-needs_human', source: 'classify', target: 'needs_human' },
  { id: 'code_review_start-review_api_compatibility', source: 'code_review_start', target: 'review_api_compatibility' },
  { id: 'code_review_start-review_test_coverage', source: 'code_review_start', target: 'review_test_coverage' },
  { id: 'code_review_start-review_change_risk', source: 'code_review_start', target: 'review_change_risk' },
  { id: 'review_api_compatibility-review_aggregate', source: 'review_api_compatibility', target: 'review_aggregate' },
  { id: 'review_test_coverage-review_aggregate', source: 'review_test_coverage', target: 'review_aggregate' },
  { id: 'review_change_risk-review_aggregate', source: 'review_change_risk', target: 'review_aggregate' },
  { id: 'review_aggregate-END', source: 'review_aggregate', target: 'END' },
  { id: 'incident-END', source: 'incident', target: 'END' },
  { id: 'analytics_orchestrator-analytics_worker', source: 'analytics_orchestrator', target: 'analytics_worker' },
  { id: 'analytics_worker-analytics_synthesize', source: 'analytics_worker', target: 'analytics_synthesize' },
  { id: 'analytics_synthesize-END', source: 'analytics_synthesize', target: 'END' },
  { id: 'needs_human-END', source: 'needs_human', target: 'END' },
];

export type FlowVisualState = {
  activeNode: string | undefined;
  doneNodes: Set<string>;
  visitCounts: Record<string, number>;
};

export const resolveNodeStatus = (nodeId: string, activeNode: string | undefined, doneNodes: Set<string>): FlowNodeStatus => {
  if (activeNode === nodeId) {
    return 'active';
  }

  return doneNodes.has(nodeId) ? 'done' : 'idle';
};

export const buildFlowNodes = ({ activeNode, doneNodes, visitCounts }: FlowVisualState, positions?: Record<string, { x: number; y: number }>): Node[] =>
  Object.entries(FLOW_NODE_POSITIONS).map(([id, defaultPosition]) => {
    const text = FLOW_NODE_LABELS[id];
    const status = resolveNodeStatus(id, activeNode, doneNodes);
    const width = id === 'START' || id === 'END' ? 170 : 220;
    const height = 84;
    const data: DispatcherFlowNodeData = {
      label: text.label,
      caption: text.caption,
      status,
      visits: visitCounts[id] ?? 0,
    };

    return {
      id,
      type: DISPATCHER_NODE_TYPE,
      position: positions?.[id] ?? defaultPosition,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      width,
      height,
      initialWidth: width,
      initialHeight: height,
      measured: { width, height },
      data,
    };
  });

export const buildFlowEdges = (activeEdgeIds: Set<string>, animate: boolean): Edge[] =>
  FLOW_EDGES.map((edge) => {
    const active = activeEdgeIds.has(edge.id);

    return {
      ...edge,
      type: 'smoothstep',
      animated: active && animate,
      markerEnd: { type: MarkerType.ArrowClosed, color: active ? '#fbbf24' : '#52525b' },
      style: {
        stroke: active ? '#fbbf24' : '#3f3f46',
        strokeWidth: active ? 2.6 : 1.5,
      },
    };
  });

export const mergeFlowNodes = (nextNodes: Node[], currentNodes: Node[]) => {
  if (currentNodes.some((node) => node.dragging)) {
    return currentNodes;
  }

  const currentById = new Map(currentNodes.map((node) => [node.id, node]));

  return nextNodes.map((node) => {
    const current = currentById.get(node.id);

    return current
      ? {
          ...node,
          position: current.position,
          selected: current.selected,
          dragging: current.dragging,
        }
      : node;
  });
};
