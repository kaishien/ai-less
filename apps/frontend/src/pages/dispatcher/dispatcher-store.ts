import { makeAutoObservable, runInAction } from 'mobx';
import { readNdjsonStream } from '@/lib/read-ndjson-stream';
import { AlertTriangle, Bot, FileCode2, Network, type LucideIcon } from 'lucide-react';
import { FLOW_EDGES, REPLAY_STEP_MS } from './dispatcher-flow-graph';
import { buildHighlightedMermaid, buildReplayTrace, clampText } from './dispatcher-flow-utils';

export type DispatcherRoute = 'code_review' | 'incident' | 'analytics' | 'needs_human';

export interface DispatcherInputSummary {
  id: string;
  title: string;
  kind: DispatcherRoute;
  fileName: string;
  preview: string;
}

export interface DispatcherClassification {
  route: DispatcherRoute;
  confidence: number;
  reasoning: string;
}

export interface DispatcherTraceStep {
  node: string;
  title: string;
  detail: string;
}

export interface ReviewReport {
  axis: string;
  risk: 'low' | 'medium' | 'high';
  finding: string;
  recommendation: string;
}

export interface ReviewVerdict {
  verdict: 'approve' | 'changes_requested' | 'block';
  reason: string;
}

export interface AnalyticsTask {
  metric: string;
  segment: string;
  rationale: string;
}

export interface AnalyticsFinding {
  metric: string;
  segment: string;
  result: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface DispatcherRunResponse {
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

type DispatcherStreamEvent =
  | { type: 'started'; result: DispatcherRunResponse }
  | { type: 'node'; node: string; step: DispatcherTraceStep; result: DispatcherRunResponse }
  | { type: 'result'; result: DispatcherRunResponse }
  | { type: 'done'; result: DispatcherRunResponse }
  | { type: 'error'; message: string };

export const routeLabel: Record<DispatcherRoute, string> = {
  code_review: 'Code review',
  incident: 'Incident',
  analytics: 'Analytics',
  needs_human: 'Needs human',
};

export const routeIcon: Record<DispatcherRoute, LucideIcon> = {
  code_review: FileCode2,
  incident: AlertTriangle,
  analytics: Network,
  needs_human: Bot,
};

export class DispatcherStore {
  private loadAbortController: AbortController | null = null;
  private runAbortController: AbortController | null = null;
  private replayTimer: ReturnType<typeof window.setInterval> | null = null;

  inputs: DispatcherInputSummary[] = [];
  selectedInputId = '';
  customInput = '';
  graph = '';
  result: DispatcherRunResponse | null = null;
  isLoading = true;
  isRunning = false;
  error: string | null = null;
  replayIndex = -1;

  constructor() {
    makeAutoObservable(this);
  }

  get selectedInput() {
    return this.inputs.find((input) => input.id === this.selectedInputId) ?? this.inputs[0];
  }

  get canRun() {
    return !this.isLoading && !this.isRunning && Boolean(this.selectedInput || this.customInput.trim());
  }

  get visitedNodes() {
    return this.result?.trace.map((step) => step.node) ?? [];
  }

  get trace() {
    return this.result?.trace ?? [];
  }

  get replayTrace() {
    return buildReplayTrace(this.trace);
  }

  get isLiveReplay() {
    return this.isRunning && this.replayTrace.length > 0;
  }

  get visibleTrace() {
    if (this.isLiveReplay) {
      return this.replayTrace;
    }

    return this.replayTrace.slice(0, Math.max(this.replayIndex + 1, 0));
  }

  get activeReplayStep() {
    if (this.isLiveReplay) {
      return this.replayTrace.at(-1);
    }

    return this.replayIndex >= 0 ? this.replayTrace[this.replayIndex] : undefined;
  }

  get activeReplayNode() {
    const isFinalStep = this.replayTrace.length > 0 && this.replayIndex >= this.replayTrace.length - 1;

    if (this.isLiveReplay || !isFinalStep) {
      return this.activeReplayStep?.node;
    }

    return undefined;
  }

  get doneReplayNodes() {
    return new Set(this.visibleTrace.map((step) => step.node));
  }

  get replayVisitCounts() {
    return this.visibleTrace.reduce<Record<string, number>>((counts, step) => {
      counts[step.node] = (counts[step.node] ?? 0) + 1;
      return counts;
    }, {});
  }

  get activeReplayEdgeIds() {
    const doneNodes = this.doneReplayNodes;

    return new Set(
      FLOW_EDGES.filter((edge) => doneNodes.has(edge.source) && doneNodes.has(edge.target)).map((edge) => edge.id),
    );
  }

  get shouldAnimateReplayEdges() {
    return this.replayIndex < this.replayTrace.length - 1;
  }

  get replayVisualSignature() {
    return `${this.replayIndex}|${this.isRunning}|${this.trace.map((step) => step.node).join('>')}`;
  }

  get canReplay() {
    return this.trace.length > 0 && !this.isRunning;
  }

  get highlightedMermaidChart() {
    return buildHighlightedMermaid(this.graph, this.visitedNodes);
  }

  get replayStatusLine() {
    const step = this.activeReplayStep;

    if (step) {
      return `${step.node} · ${step.title} · ${clampText(step.detail, 160)}`;
    }

    if (this.result) {
      return 'Replay готов к запуску.';
    }

    return 'Запусти граф, чтобы увидеть маршрут.';
  }

  selectInput(inputId: string) {
    this.customInput = '';
    this.selectedInputId = inputId;
  }

  setCustomInput(value: string) {
    this.customInput = value;
  }

  startReplay() {
    this.stopReplayTimer();

    if (!this.canReplay) {
      return;
    }

    this.replayIndex = -1;

    let index = -1;
    this.replayTimer = window.setInterval(() => {
      runInAction(() => {
        index += 1;
        this.replayIndex = index;

        if (index >= this.replayTrace.length - 1) {
          this.stopReplayTimer();
        }
      });
    }, REPLAY_STEP_MS);
  }

  async load() {
    this.loadAbortController?.abort();
    const abortController = new AbortController();
    this.loadAbortController = abortController;
    this.isLoading = true;
    this.error = null;

    try {
      const [inputsResponse, graphResponse] = await Promise.all([
        fetch('/api/dispatcher/inputs', { signal: abortController.signal }),
        fetch('/api/dispatcher/graph', { signal: abortController.signal }),
      ]);

      if (!inputsResponse.ok) {
        throw new Error(`Не удалось загрузить fixtures: ${inputsResponse.status}`);
      }

      if (!graphResponse.ok) {
        throw new Error(`Не удалось загрузить схему: ${graphResponse.status}`);
      }

      const inputs = (await inputsResponse.json()) as DispatcherInputSummary[];
      const graph = (await graphResponse.json()) as { mermaid: string };

      runInAction(() => {
        this.inputs = inputs;
        this.selectedInputId = inputs[0]?.id ?? '';
        this.graph = graph.mermaid;
      });
    } catch (error) {
      runInAction(() => {
        if (!this.isAbortError(error)) {
          this.error = error instanceof Error ? error.message : 'Неизвестная ошибка загрузки.';
        }
      });
    } finally {
      runInAction(() => {
        if (this.loadAbortController === abortController) {
          this.isLoading = false;
          this.loadAbortController = null;
        }
      });
    }
  }

  async run() {
    if (this.isRunning) {
      return;
    }

    const body = this.customInput.trim() ? { content: this.customInput.trim() } : { inputId: this.selectedInput?.id };
    const abortController = new AbortController();
    this.runAbortController = abortController;
    this.isRunning = true;
    this.error = null;
    this.result = null;
    this.stopReplayTimer();
    this.replayIndex = -1;

    try {
      const response = await fetch('/api/dispatcher/run/stream', {
        method: 'POST',
        signal: abortController.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(await this.readError(response, `Запуск графа завершился ошибкой: ${response.status}`));
      }

      await readNdjsonStream<DispatcherStreamEvent>(response, (event) => this.applyStreamEvent(event));
    } catch (error) {
      runInAction(() => {
        if (!this.isAbortError(error)) {
          this.error = error instanceof Error ? error.message : 'Неизвестная ошибка запуска.';
        }
      });
    } finally {
      runInAction(() => {
        if (this.runAbortController === abortController) {
          this.isRunning = false;
          this.runAbortController = null;
        }
      });
    }
  }

  dispose() {
    this.loadAbortController?.abort();
    this.runAbortController?.abort();
    this.stopReplayTimer();
    this.loadAbortController = null;
    this.runAbortController = null;
  }

  private applyStreamEvent(event: DispatcherStreamEvent) {
    if (event.type === 'error') {
      throw new Error(event.message);
    }

    runInAction(() => {
      this.result = event.result;
      this.syncReplayIndex();
    });
  }

  private syncReplayIndex() {
    if (this.trace.length === 0) {
      this.replayIndex = -1;
      return;
    }

    this.replayIndex = this.replayTrace.length - 1;
  }

  private stopReplayTimer() {
    if (this.replayTimer) {
      window.clearInterval(this.replayTimer);
      this.replayTimer = null;
    }
  }

  private async readError(response: Response, fallback: string) {
    const payload = await response.json().catch(() => null);

    return typeof payload?.message === 'string' ? payload.message : fallback;
  }

  private isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === 'AbortError';
  }
}
