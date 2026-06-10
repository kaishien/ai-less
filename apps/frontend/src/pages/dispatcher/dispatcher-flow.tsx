import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react';
import mermaid from 'mermaid';
import { Background, Controls, ReactFlow, useNodesState, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { observer } from 'mobx-react-lite';
import { Eye, GitBranch, Loader2, RotateCcw, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { buildFlowEdges, buildFlowNodes, mergeFlowNodes, type FlowVisualState } from './dispatcher-flow-graph';
import { DispatcherFlowNode } from './dispatcher-flow-node';
import { Panel, TraceList } from './dispatcher-layout';
import type { DispatcherStore } from './dispatcher-store';

const outlineButtonClass =
  'h-8 border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07] hover:text-zinc-50';

const flowNodeTypes = { dispatcherNode: DispatcherFlowNode };

export const FlowReplayPanel = observer(({ store }: { store: DispatcherStore }) => (
  <Panel
    title="Flow replay"
    icon={Workflow}
    action={
      <div className="flex flex-wrap items-center gap-2">
        <TraceDialog trace={store.trace} disabled={!store.trace.length} />
        <MermaidDialog highlightedChart={store.highlightedMermaidChart} visitedNodes={store.visitedNodes} disabled={!store.graph} />
      </div>
    }
  >
    <DispatcherFlow store={store} />
  </Panel>
));

const TraceDialog = ({ trace, disabled }: { trace: DispatcherStore['trace']; disabled: boolean }) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button type="button" variant="outline" size="sm" disabled={disabled} className={outlineButtonClass}>
        <GitBranch aria-hidden="true" />
        Trace
      </Button>
    </DialogTrigger>
    <DialogContent className="max-h-[82dvh] overflow-hidden border-white/10 bg-[#202124] text-zinc-100 sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Trace последнего запуска</DialogTitle>
        <DialogDescription>Порядок узлов, которые реально прошёл граф.</DialogDescription>
      </DialogHeader>
      <div className="max-h-[60dvh] overflow-auto pr-1">
        <TraceList trace={trace} />
      </div>
    </DialogContent>
  </Dialog>
);

const MermaidDialog = ({
  highlightedChart,
  visitedNodes,
  disabled,
}: {
  highlightedChart: string;
  visitedNodes: string[];
  disabled: boolean;
}) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button type="button" variant="outline" size="sm" disabled={disabled} className={outlineButtonClass}>
        <Eye aria-hidden="true" />
        Mermaid
      </Button>
    </DialogTrigger>
    <DialogContent className="flex h-[86dvh] max-h-[86dvh] flex-col overflow-hidden border-white/10 bg-[#202124] text-zinc-100 sm:max-w-6xl">
      <DialogHeader>
        <DialogTitle>Mermaid схема</DialogTitle>
        <DialogDescription>Статичная схема графа с подсветкой последнего маршрута.</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-auto pr-1">
        <MermaidDiagram highlightedChart={highlightedChart} visitedNodes={visitedNodes} />
      </div>
    </DialogContent>
  </Dialog>
);

type FlowVisualSnapshot = FlowVisualState & {
  activeEdgeIds: Set<string>;
  animateEdges: boolean;
};

type FlowCanvasProps = {
  replaySignature: string;
  visualRef: RefObject<FlowVisualSnapshot>;
};

const FlowCanvas = memo(function FlowCanvas({ replaySignature, visualRef }: FlowCanvasProps) {
  const graphNodes = useMemo(() => buildFlowNodes(visualRef.current), [replaySignature, visualRef]);

  const edges = useMemo(
    () => buildFlowEdges(visualRef.current.activeEdgeIds, visualRef.current.animateEdges),
    [replaySignature, visualRef],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(graphNodes);

  useEffect(() => {
    setNodes((currentNodes) => mergeFlowNodes(graphNodes, currentNodes));
  }, [graphNodes, replaySignature, setNodes]);

  const onFlowInit = useCallback((instance: ReactFlowInstance) => {
    void instance.fitView({ padding: 0.12 });
  }, []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={flowNodeTypes}
      onNodesChange={onNodesChange}
      onInit={onFlowInit}
      minZoom={0.25}
      maxZoom={1.15}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable={false}
      onlyRenderVisibleElements
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#3f3f46" gap={22} size={1} />
      <Controls
        showInteractive={false}
        className="!border-white/10 !bg-[#202124] [&_button]:!border-white/10 [&_button]:!bg-[#202124] [&_button]:!text-zinc-200"
      />
    </ReactFlow>
  );
});

const DispatcherFlow = observer(({ store }: { store: DispatcherStore }) => {
  const visualRef = useRef<FlowVisualSnapshot>({
    activeNode: undefined,
    doneNodes: new Set(),
    visitCounts: {},
    activeEdgeIds: new Set(),
    animateEdges: false,
  });

  visualRef.current = {
    activeNode: store.activeReplayNode,
    doneNodes: store.doneReplayNodes,
    visitCounts: store.replayVisitCounts,
    activeEdgeIds: store.activeReplayEdgeIds,
    animateEdges: store.shouldAnimateReplayEdges,
  };

  const activeStep = store.activeReplayStep;

  return (
    <div className="grid gap-3">
      <div className="grid min-h-[72px] gap-3 rounded-md border border-white/10 bg-[#18191b] px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {store.isRunning ? 'Live execution' : 'Execution replay'}
          </p>
          <p className="m-0 mt-1 line-clamp-2 text-sm leading-5 text-zinc-300">{store.replayStatusLine}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!store.canReplay}
          className={cn('h-8 shrink-0', outlineButtonClass)}
          onClick={() => store.startReplay()}
        >
          <RotateCcw aria-hidden="true" />
          Replay
        </Button>
      </div>

      <FlowLegend />

      <div className="h-[620px] overflow-hidden rounded-md border border-white/10 bg-[#101112] xl:h-[680px]">
        <FlowCanvas replaySignature={store.replayVisualSignature} visualRef={visualRef} />
      </div>

      <div className="grid min-h-[116px] rounded-md border border-white/10 bg-[#18191b] p-3">
        {activeStep ? (
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-zinc-400">{activeStep.node}</span>
              <p className="m-0 truncate text-sm font-semibold text-zinc-100">{activeStep.title}</p>
            </div>
            <p className="m-0 line-clamp-3 text-xs leading-5 text-zinc-500">{activeStep.detail}</p>
          </div>
        ) : (
          <p className="m-0 self-center text-sm text-zinc-500">Здесь появится текущий шаг replay. Полный trace доступен в модальном окне.</p>
        )}
      </div>

      <StatusLegend />
    </div>
  );
});

const FlowLegend = () => (
  <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-zinc-500">
    <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1">classify routes</span>
    <span className="rounded-md bg-white/[0.06] px-2 py-1 text-zinc-300">code_review</span>
    <span className="rounded-md bg-white/[0.06] px-2 py-1 text-zinc-300">incident</span>
    <span className="rounded-md bg-white/[0.06] px-2 py-1 text-zinc-300">analytics</span>
    <span className="rounded-md bg-white/[0.06] px-2 py-1 text-zinc-300">needs_human</span>
    <span className="rounded-md bg-white/[0.06] px-2 py-1 text-zinc-300">analytics fan-out per task</span>
  </div>
);

const StatusLegend = () => (
  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-full bg-zinc-700" aria-hidden="true" />
      idle
    </span>
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-full bg-amber-300" aria-hidden="true" />
      active
    </span>
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-full bg-emerald-300" aria-hidden="true" />
      done
    </span>
  </div>
);

const MermaidDiagram = ({ highlightedChart, visitedNodes }: { highlightedChart: string; visitedNodes: string[] }) => {
  const rawId = useId();
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const diagramId = `dispatcher-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      if (!highlightedChart.trim()) {
        setSvg('');
        setError(null);
        return;
      }

      try {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'dark',
          themeVariables: {
            background: '#18191b',
            primaryColor: '#27292d',
            primaryTextColor: '#f4f4f5',
            primaryBorderColor: 'rgba(255,255,255,0.22)',
            lineColor: '#a1a1aa',
            secondaryColor: '#202124',
            tertiaryColor: '#18191b',
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          },
        });

        const rendered = await mermaid.render(diagramId, highlightedChart);

        if (!cancelled) {
          setSvg(rendered.svg);
          setError(null);
        }
      } catch (renderError) {
        if (!cancelled) {
          setSvg('');
          setError(renderError instanceof Error ? renderError.message : 'Mermaid render failed.');
        }
      }
    };

    void render();

    return () => {
      cancelled = true;
    };
  }, [diagramId, highlightedChart]);

  if (error) {
    return (
      <div className="grid gap-3">
        <div className="rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm leading-5 text-amber-100">
          Mermaid не смог отрисовать схему: {error}
        </div>
        <pre className="max-h-[340px] overflow-auto rounded-md border border-white/10 bg-[#101112] p-3 text-xs leading-5 text-zinc-300">
          {highlightedChart}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-md border border-white/10 bg-[#18191b] text-sm text-zinc-500">
        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
        Рисую схему
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div
        className="min-h-[420px] max-h-[680px] overflow-auto rounded-md border border-white/10 bg-[#101112] p-4 md:min-h-[520px] [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {visitedNodes.length ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="inline-block size-2.5 rounded-sm border border-amber-300 bg-zinc-100" aria-hidden="true" />
          Подсвечены узлы последнего запуска
        </div>
      ) : (
        <p className="m-0 text-xs leading-5 text-zinc-500">После запуска графа здесь подсветится фактический маршрут.</p>
      )}
    </div>
  );
};
