import { useEffect, useId, useMemo, useState } from 'react';
import mermaid from 'mermaid';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  FileCode2,
  GitBranch,
  Loader2,
  Network,
  Play,
  Route,
  Workflow,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type DispatcherRoute = 'code_review' | 'incident' | 'analytics' | 'needs_human';

interface DispatcherInputSummary {
  id: string;
  title: string;
  kind: DispatcherRoute;
  fileName: string;
  preview: string;
}

interface DispatcherClassification {
  route: DispatcherRoute;
  confidence: number;
  reasoning: string;
}

interface DispatcherTraceStep {
  node: string;
  title: string;
  detail: string;
}

interface ReviewReport {
  axis: string;
  risk: 'low' | 'medium' | 'high';
  finding: string;
  recommendation: string;
}

interface ReviewVerdict {
  verdict: 'approve' | 'changes_requested' | 'block';
  reason: string;
}

interface AnalyticsTask {
  metric: string;
  segment: string;
  rationale: string;
}

interface AnalyticsFinding {
  metric: string;
  segment: string;
  result: string;
  confidence: 'low' | 'medium' | 'high';
}

interface DispatcherRunResponse {
  inputId: string;
  inputTitle: string;
  classification?: DispatcherClassification;
  route?: DispatcherRoute;
  finalAnswer: string;
  reviewReports: ReviewReport[];
  reviewVerdict?: ReviewVerdict;
  analyticsTasks: AnalyticsTask[];
  analyticsFindings: AnalyticsFinding[];
  trace: DispatcherTraceStep[];
}

const routeLabel: Record<DispatcherRoute, string> = {
  code_review: 'Code review',
  incident: 'Incident',
  analytics: 'Analytics',
  needs_human: 'Needs human',
};

const routeIcon: Record<DispatcherRoute, typeof FileCode2> = {
  code_review: FileCode2,
  incident: AlertTriangle,
  analytics: Network,
  needs_human: Bot,
};

export const DispatcherPage = () => {
  const [inputs, setInputs] = useState<DispatcherInputSummary[]>([]);
  const [selectedInputId, setSelectedInputId] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [graph, setGraph] = useState('');
  const [result, setResult] = useState<DispatcherRunResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedInput = useMemo(
    () => inputs.find((input) => input.id === selectedInputId) ?? inputs[0],
    [inputs, selectedInputId],
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [inputsResponse, graphResponse] = await Promise.all([fetch('/api/dispatcher/inputs'), fetch('/api/dispatcher/graph')]);

        if (!inputsResponse.ok) {
          throw new Error(`Не удалось загрузить fixtures: ${inputsResponse.status}`);
        }

        if (!graphResponse.ok) {
          throw new Error(`Не удалось загрузить схему: ${graphResponse.status}`);
        }

        const loadedInputs = (await inputsResponse.json()) as DispatcherInputSummary[];
        const loadedGraph = (await graphResponse.json()) as { mermaid: string };

        if (!mounted) {
          return;
        }

        setInputs(loadedInputs);
        setSelectedInputId(loadedInputs[0]?.id ?? '');
        setGraph(loadedGraph.mermaid);
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : 'Неизвестная ошибка загрузки.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const run = async () => {
    if (isRunning) {
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const body = customInput.trim() ? { content: customInput.trim() } : { inputId: selectedInput?.id };
      const response = await fetch('/api/dispatcher/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? `Запуск графа завершился ошибкой: ${response.status}`);
      }

      setResult((await response.json()) as DispatcherRunResponse);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Неизвестная ошибка запуска.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <main className="view-transition-page min-h-dvh bg-[#18191b] text-zinc-100">
      <div className="mx-auto grid min-h-dvh w-full max-w-7xl grid-rows-[auto_minmax(0,1fr)] px-4 py-5 md:px-6 md:py-7">
        <header className="border-b border-white/10 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3 text-zinc-400 hover:text-zinc-100">
                <Link to="/" viewTransition>
                  <ArrowLeft aria-hidden="true" />
                  Dashboard
                </Link>
              </Button>
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-400">
                <Workflow className="size-3.5 text-zinc-300" aria-hidden="true" />
                LangGraph workflow
              </div>
              <h1 className="m-0 text-2xl font-semibold leading-tight text-zinc-50 md:text-3xl">AI-диспетчер задач</h1>
            </div>

            <div className="grid w-full gap-3 lg:w-[390px]">
              <Button className="h-10" disabled={isLoading || isRunning || (!selectedInput && !customInput.trim())} onClick={() => void run()}>
                {isRunning ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
                {isRunning ? 'Граф работает' : 'Запустить граф'}
              </Button>
              {error ? (
                <div className="rounded-md border border-red-300/20 bg-red-300/10 px-3 py-2 text-sm leading-5 text-red-100">{error}</div>
              ) : null}
            </div>
          </div>
        </header>

        <section className="grid min-h-0 gap-4 py-5 lg:grid-cols-[360px_minmax(0,1fr)] md:py-6">
          <aside className="grid content-start gap-4">
            <Panel title="Входящие" icon={Route}>
              <div className="grid gap-2">
                {inputs.map((input) => {
                  const Icon = routeIcon[input.kind];
                  const active = input.id === selectedInput?.id && !customInput.trim();

                  return (
                    <button
                      key={input.id}
                      type="button"
                      className={cn(
                        'rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                        active
                          ? 'border-zinc-200/40 bg-white/[0.08]'
                          : 'border-white/10 bg-[#18191b] hover:border-white/20 hover:bg-white/[0.04]',
                      )}
                      onClick={() => {
                        setCustomInput('');
                        setSelectedInputId(input.id);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04]">
                          <Icon className="size-4 text-zinc-200" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="m-0 text-sm font-semibold text-zinc-100">{input.title}</p>
                            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-zinc-400">
                              {routeLabel[input.kind]}
                            </span>
                          </div>
                          <p className="m-0 mt-1 line-clamp-3 text-xs leading-5 text-zinc-500">{input.preview}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Custom input" icon={FileCode2}>
              <Textarea
                value={customInput}
                className="min-h-32 resize-y border-white/10 bg-[#18191b] text-sm text-zinc-100 placeholder:text-zinc-600"
                placeholder="Можно вставить свой PR, alert или аналитический вопрос..."
                onChange={(event) => setCustomInput(event.target.value)}
              />
            </Panel>
          </aside>

          <div className="grid min-w-0 content-start gap-4">
            <ResultSummary result={result} isLoading={isLoading || isRunning} />

            <Panel
              title="Mermaid"
              icon={Workflow}
              action={
                <TraceDialog trace={result?.trace ?? []} disabled={!result?.trace.length} />
              }
            >
                <MermaidDiagram chart={graph} visitedNodes={result?.trace.map((step) => step.node) ?? []} />
            </Panel>

            <BranchDetails result={result} />
          </div>
        </section>
      </div>
    </main>
  );
};

const Panel = ({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: typeof FileCode2;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="rounded-lg border border-white/10 bg-[#222326] p-4 shadow-[0_16px_44px_rgba(0,0,0,0.18)]">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-zinc-300" aria-hidden="true" />
        <h2 className="m-0 truncate text-sm font-semibold text-zinc-100">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
    {children}
  </section>
);

const TraceDialog = ({ trace, disabled }: { trace: DispatcherTraceStep[]; disabled: boolean }) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        className="h-8 border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07] hover:text-zinc-50"
      >
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

const MermaidDiagram = ({ chart, visitedNodes }: { chart: string; visitedNodes: string[] }) => {
  const rawId = useId();
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const diagramId = `dispatcher-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const highlightedChart = useMemo(() => buildHighlightedMermaid(chart, visitedNodes), [chart, visitedNodes]);

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

const buildHighlightedMermaid = (chart: string, visitedNodes: string[]) => {
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

const ResultSummary = ({ result, isLoading }: { result: DispatcherRunResponse | null; isLoading: boolean }) => {
  if (isLoading && !result) {
    return (
      <Panel title="Результат" icon={Loader2}>
        <div className="flex min-h-40 items-center justify-center text-sm text-zinc-500">
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          Загрузка
        </div>
      </Panel>
    );
  }

  if (!result) {
    return (
      <Panel title="Результат" icon={CheckCircle2}>
        <div className="min-h-40 rounded-md border border-dashed border-white/10 bg-[#18191b] p-4 text-sm leading-6 text-zinc-500">
          Выбери fixture или вставь свой текст, затем запусти граф.
        </div>
      </Panel>
    );
  }

  const route = result.route ?? result.classification?.route ?? 'needs_human';
  const Icon = routeIcon[route];

  return (
    <Panel title="Результат" icon={CheckCircle2}>
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="rounded-md border border-white/10 bg-[#18191b] p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Icon className="size-4" aria-hidden="true" />
            {routeLabel[route]}
          </div>
          <p className="m-0 mt-2 text-xs leading-5 text-zinc-500">{result.inputTitle}</p>
          {result.classification ? (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full bg-zinc-100" style={{ width: `${Math.round(result.classification.confidence * 100)}%` }} />
            </div>
          ) : null}
          {result.classification ? (
            <p className="m-0 mt-2 text-xs text-zinc-500">confidence {result.classification.confidence.toFixed(2)}</p>
          ) : null}
        </div>

        <div className="min-w-0 rounded-md border border-white/10 bg-[#18191b] p-4">
          <p className="m-0 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{result.finalAnswer}</p>
        </div>
      </div>
    </Panel>
  );
};

const TraceList = ({ trace }: { trace: DispatcherTraceStep[] }) => {
  if (trace.length === 0) {
    return <p className="m-0 rounded-md border border-dashed border-white/10 bg-[#18191b] p-4 text-sm text-zinc-500">Trace появится после запуска.</p>;
  }

  return (
    <ol className="m-0 grid list-none gap-2 p-0">
      {trace.map((step, index) => (
        <li key={`${step.node}-${index}`} className="rounded-md border border-white/10 bg-[#18191b] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="m-0 text-sm font-semibold text-zinc-100">{step.title}</p>
            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-zinc-500">{step.node}</span>
          </div>
          <p className="m-0 mt-1 text-xs leading-5 text-zinc-500">{step.detail}</p>
        </li>
      ))}
    </ol>
  );
};

const BranchDetails = ({ result }: { result: DispatcherRunResponse | null }) => {
  if (!result) {
    return null;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Code review fan-out" icon={FileCode2}>
        {result.reviewReports.length ? (
          <div className="grid gap-2">
            {result.reviewReports.map((report) => (
              <div key={report.axis} className="rounded-md border border-white/10 bg-[#18191b] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="m-0 text-sm font-semibold text-zinc-100">{report.axis}</p>
                  <RiskPill risk={report.risk} />
                </div>
                <p className="m-0 mt-2 text-xs leading-5 text-zinc-400">{report.finding}</p>
                <p className="m-0 mt-2 text-xs leading-5 text-zinc-500">{report.recommendation}</p>
              </div>
            ))}
            {result.reviewVerdict ? (
              <div className="rounded-md border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">
                {result.reviewVerdict.verdict}: {result.reviewVerdict.reason}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="m-0 rounded-md border border-dashed border-white/10 bg-[#18191b] p-4 text-sm text-zinc-500">Эта ветка не запускалась.</p>
        )}
      </Panel>

      <Panel title="Analytics orchestration" icon={Network}>
        {result.analyticsTasks.length ? (
          <div className="grid gap-3">
            <div className="grid gap-2">
              {result.analyticsTasks.map((task) => (
                <div key={`${task.metric}-${task.segment}`} className="rounded-md border border-white/10 bg-[#18191b] p-3">
                  <p className="m-0 text-sm font-semibold text-zinc-100">
                    {task.metric} <span className="text-zinc-500">/ {task.segment}</span>
                  </p>
                  <p className="m-0 mt-1 text-xs leading-5 text-zinc-500">{task.rationale}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              {result.analyticsFindings.map((finding) => (
                <div key={`${finding.metric}-${finding.segment}`} className="rounded-md border border-white/10 bg-[#18191b] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="m-0 text-sm font-semibold text-zinc-100">{finding.metric}</p>
                    <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-zinc-400">
                      {finding.confidence}
                    </span>
                  </div>
                  <p className="m-0 mt-1 text-xs leading-5 text-zinc-400">{finding.result}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="m-0 rounded-md border border-dashed border-white/10 bg-[#18191b] p-4 text-sm text-zinc-500">Эта ветка не запускалась.</p>
        )}
      </Panel>
    </div>
  );
};

const RiskPill = ({ risk }: { risk: ReviewReport['risk'] }) => {
  const className =
    risk === 'high'
      ? 'border-red-300/20 bg-red-300/10 text-red-100'
      : risk === 'medium'
        ? 'border-amber-300/20 bg-amber-300/10 text-amber-100'
        : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100';

  return <span className={cn('rounded-md border px-2 py-0.5 text-[11px] font-medium', className)}>{risk}</span>;
};
