import type { DispatcherTraceStep } from './dispatcher-store';

export const clampText = (text: string, maxLength = 180) => (text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text);

export const buildReplayTrace = (trace: DispatcherTraceStep[]): DispatcherTraceStep[] => {
  if (trace.length === 0) {
    return [];
  }

  return [
    { node: 'START', title: 'START', detail: 'Input entered the dispatcher graph.' },
    ...trace,
    { node: 'END', title: 'END', detail: 'Graph returned the final response.' },
  ];
};

export const buildHighlightedMermaid = (chart: string, visitedNodes: string[]) => {
  const uniqueNodes = Array.from(new Set(visitedNodes.filter(Boolean)));

  if (!chart.trim() || uniqueNodes.length === 0) {
    return chart;
  }

  const nodesToHighlight = ['START', ...uniqueNodes, 'END'];
  const classTargets = Array.from(new Set(nodesToHighlight)).join(',');

  return `${chart}
  classDef visited fill:#f4f4f5,color:#18181b,stroke:#fbbf24,stroke-width:3px;
  class ${classTargets} visited;`;
};
