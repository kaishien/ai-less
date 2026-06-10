import { makeAutoObservable, runInAction } from 'mobx';
import { readNdjsonStream } from '@/lib/read-ndjson-stream';
import { parseUnifiedDiff } from './diff-parser';

export type AgentTab = 'commit-message' | 'git-commit' | 'env-audit' | 'session-logs' | 'readme';
export type DiffViewMode = 'preview' | 'raw';
export type SessionLogFilter = 'all' | 'error' | 'warn' | 'log' | 'debug';

export interface CommitMessageResponse {
  message: {
    type: 'feat' | 'fix' | 'refactor' | 'docs' | 'chore';
    scope: string | null;
    description: string;
  };
  conventionalCommit: string;
}

interface CurrentDiffResponse {
  diff: string;
  mode: 'unstaged' | 'staged' | 'all';
  isEmpty: boolean;
}

export interface GitCommitResponse {
  commit: string;
  summary: string;
}

export interface EnvAuditResponse {
  missing: string[];
  extra: string[];
  matching: string[];
  summary: string;
}

export interface SessionLogEntry {
  id: string;
  timestamp: string;
  level: Exclude<SessionLogFilter, 'all'>;
  message: string;
  stack?: string;
}

export interface SessionLogRowView extends SessionLogEntry {
  time: string;
}

interface SessionLogsResponse {
  logs: SessionLogEntry[];
}

export interface AnalyzeSessionLogsResponse {
  errorType: string;
  filePath: string | null;
  lineNumber: number | null;
  cause: string;
  fix: string;
  sourceContext: string | null;
}

export interface SourceContextLineView {
  id: string;
  lineNumber: string;
  code: string;
  isTarget: boolean;
}

export interface AnalyzeSessionLogsView extends AnalyzeSessionLogsResponse {
  sourceContextLines: SourceContextLineView[];
}

type StreamEvent =
  | {
      type: 'delta';
      delta: string;
    }
  | {
      type: 'done';
      text: string;
    }
  | {
      type: 'error';
      message: string;
    };

type AnalyzeSessionLogsStreamEvent =
  | {
      type: 'status';
      message: string;
    }
  | {
      type: 'delta';
      delta: string;
    }
  | {
      type: 'done';
      result: AnalyzeSessionLogsResponse;
    }
  | {
      type: 'error';
      message: string;
    };

type ReadmeGenerateStreamEvent =
  | {
      type: 'status';
      message: string;
    }
  | {
      type: 'delta';
      delta: string;
    }
  | {
      type: 'done';
      text: string;
    }
  | {
      type: 'error';
      message: string;
    };

interface ReadmeSaveResponse {
  path: string;
  message: string;
}

const SAMPLE_DIFF = `diff --git a/src/auth.ts b/src/auth.ts
index 1a2b3c4..5d6e7f8 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -8,6 +8,10 @@ export function validateToken(token?: string) {
-  return decode(token);
+  if (!token) {
+    throw new Error('Missing token');
+  }
+
+  return decode(token);
 }`;

export class DevAgentsStore {
  private copiedResetTimer: number | null = null;
  private readonly langfuseSessionId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `dev-agents-${Date.now()}`;

  activeTab: AgentTab = 'commit-message';
  diffViewMode: DiffViewMode = 'preview';
  diff = SAMPLE_DIFF;
  commitResult: CommitMessageResponse | null = null;
  streamText = '';
  isGeneratingCommit = false;
  isStreamingCommit = false;
  isLoadingDiff = false;
  commitError: string | null = null;

  recentCommitCount = 5;
  gitCommitResult: GitCommitResponse | null = null;
  isAnalyzingGitCommit = false;
  gitCommitError: string | null = null;

  examplePath = '.env.example';
  envPath = '.env';
  envAuditResult: EnvAuditResponse | null = null;
  isAuditingEnv = false;
  envAuditError: string | null = null;

  sessionLogLevel: SessionLogFilter = 'error';
  sessionLogLimit = 100;
  sessionLogs: SessionLogEntry[] = [];
  sessionLogAnalysis: AnalyzeSessionLogsResponse | null = null;
  sessionLogAnalysisStreamText = '';
  sessionLogAnalysisStatus: string | null = null;
  isLoadingSessionLogs = false;
  isAnalyzingSessionLogs = false;
  isTriggeringSessionLogError = false;
  sessionLogsError: string | null = null;

  readmeProjectPath = '.';
  readmeOutputPath = 'README_generated.md';
  readmeDraft = '';
  readmeStatus: string | null = null;
  readmeSaveMessage: string | null = null;
  isGeneratingReadme = false;
  isSavingReadme = false;
  readmeError: string | null = null;

  copiedText: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  setActiveTab(value: AgentTab) {
    this.activeTab = value;

    if (value === 'session-logs' && this.sessionLogs.length === 0 && !this.isLoadingSessionLogs) {
      void this.loadSessionLogs();
    }
  }

  setDiffViewMode(value: DiffViewMode) {
    this.diffViewMode = value;
  }

  setDiff(value: string) {
    this.diff = value;
  }

  setRecentCommitCount(value: number) {
    this.recentCommitCount = Number.isFinite(value) ? value : 5;
  }

  setExamplePath(value: string) {
    this.examplePath = value;
  }

  setEnvPath(value: string) {
    this.envPath = value;
  }

  setSessionLogLevel(value: SessionLogFilter) {
    this.sessionLogLevel = value;
  }

  setSessionLogLimit(value: number) {
    this.sessionLogLimit = Number.isFinite(value) ? value : 100;
  }

  setReadmeProjectPath(value: string) {
    this.readmeProjectPath = value;
  }

  setReadmeOutputPath(value: string) {
    this.readmeOutputPath = value;
  }

  setReadmeDraft(value: string) {
    this.readmeDraft = value;
    this.readmeSaveMessage = null;
  }

  async generateCommitMessage() {
    this.isGeneratingCommit = true;
    this.commitError = null;
    this.commitResult = null;

    try {
      const response = await this.postJson<CommitMessageResponse>('/api/dev-agents/commit-message', {
        diff: this.diff,
        sessionId: this.langfuseSessionId,
      });

      runInAction(() => {
        this.commitResult = response;
      });
    } catch (error) {
      runInAction(() => {
        this.commitError = this.readErrorMessage(error, 'Commit generation failed');
      });
    } finally {
      runInAction(() => {
        this.isGeneratingCommit = false;
      });
    }
  }

  async streamCommitMessage() {
    this.isStreamingCommit = true;
    this.commitError = null;
    this.streamText = '';

    try {
      const response = await fetch('/api/dev-agents/commit-message/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diff: this.diff, sessionId: this.langfuseSessionId }),
      });

      if (!response.ok) {
        throw new Error(await this.readHttpError(response, `Stream failed: ${response.status}`));
      }

      await readNdjsonStream<StreamEvent>(response, (event) => this.applyCommitStreamEvent(event));
    } catch (error) {
      runInAction(() => {
        this.commitError = this.readErrorMessage(error, 'Commit stream failed');
      });
    } finally {
      runInAction(() => {
        this.isStreamingCommit = false;
      });
    }
  }

  async loadCurrentDiff() {
    this.isLoadingDiff = true;
    this.commitError = null;
    this.commitResult = null;
    this.streamText = '';

    try {
      const response = await this.postJson<CurrentDiffResponse>('/api/dev-agents/current-diff', { mode: 'all' });

      runInAction(() => {
        this.diff = response.diff;

        if (response.isEmpty) {
          this.commitError = 'No tracked diff found. Stage new files or edit tracked files, then load repo diff again.';
        }
      });
    } catch (error) {
      runInAction(() => {
        this.commitError = this.readErrorMessage(error, 'Could not load current repository diff');
      });
    } finally {
      runInAction(() => {
        this.isLoadingDiff = false;
      });
    }
  }

  async analyzeGitCommit() {
    this.isAnalyzingGitCommit = true;
    this.gitCommitError = null;
    this.gitCommitResult = null;

    try {
      const response = await this.postJson<GitCommitResponse>('/api/dev-agents/git-commit', {
        recentCommitCount: this.recentCommitCount,
        sessionId: this.langfuseSessionId,
      });

      runInAction(() => {
        this.gitCommitResult = response;
      });
    } catch (error) {
      runInAction(() => {
        this.gitCommitError = this.readErrorMessage(error, 'Git commit agent failed');
      });
    } finally {
      runInAction(() => {
        this.isAnalyzingGitCommit = false;
      });
    }
  }

  async auditEnv() {
    this.isAuditingEnv = true;
    this.envAuditError = null;
    this.envAuditResult = null;

    try {
      const response = await this.postJson<EnvAuditResponse>('/api/dev-agents/env-audit', {
        examplePath: this.examplePath,
        envPath: this.envPath,
        sessionId: this.langfuseSessionId,
      });

      runInAction(() => {
        this.envAuditResult = response;
      });
    } catch (error) {
      runInAction(() => {
        this.envAuditError = this.readErrorMessage(error, '.env audit failed');
      });
    } finally {
      runInAction(() => {
        this.isAuditingEnv = false;
      });
    }
  }

  async loadSessionLogs() {
    this.isLoadingSessionLogs = true;
    this.sessionLogsError = null;

    try {
      const params = new URLSearchParams({
        level: this.sessionLogLevel,
        limit: String(this.normalizedSessionLogLimit),
      });
      const response = await this.getJson<SessionLogsResponse>(`/api/dev-agents/session-logs?${params.toString()}`);

      runInAction(() => {
        this.sessionLogs = response.logs;
      });
    } catch (error) {
      runInAction(() => {
        this.sessionLogsError = this.readErrorMessage(error, 'Could not load backend session logs');
      });
    } finally {
      runInAction(() => {
        this.isLoadingSessionLogs = false;
      });
    }
  }

  async analyzeSessionLogs() {
    this.isAnalyzingSessionLogs = true;
    this.sessionLogsError = null;
    this.sessionLogAnalysis = null;
    this.sessionLogAnalysisStreamText = '';
    this.sessionLogAnalysisStatus = 'Starting analysis';

    try {
      const response = await fetch('/api/dev-agents/session-logs/analyze/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: this.sessionLogLevel,
          limit: this.normalizedSessionLogLimit,
          contextLines: 10,
          sessionId: this.langfuseSessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(await this.readHttpError(response, `Session log analysis stream failed: ${response.status}`));
      }

      await readNdjsonStream<AnalyzeSessionLogsStreamEvent>(response, (event) => this.applySessionLogAnalysisStreamEvent(event));
      await this.loadSessionLogs();
    } catch (error) {
      runInAction(() => {
        this.sessionLogsError = this.readErrorMessage(error, 'Session log analysis failed');
        this.sessionLogAnalysisStatus = null;
      });
    } finally {
      runInAction(() => {
        this.isAnalyzingSessionLogs = false;
      });
    }
  }

  async triggerSessionLogTestError() {
    this.isTriggeringSessionLogError = true;
    this.sessionLogsError = null;

    try {
      const response = await fetch('/api/dev-agents/session-logs/test-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'type-error' }),
      });

      if (response.ok) {
        throw new Error('Test error endpoint unexpectedly returned success');
      }

      await this.loadSessionLogs();
    } catch (error) {
      runInAction(() => {
        this.sessionLogsError = this.readErrorMessage(error, 'Could not trigger test backend error');
      });
    } finally {
      runInAction(() => {
        this.isTriggeringSessionLogError = false;
      });
    }
  }

  async generateReadme() {
    this.isGeneratingReadme = true;
    this.readmeError = null;
    this.readmeSaveMessage = null;
    this.readmeDraft = '';
    this.readmeStatus = 'Starting README agent';

    try {
      const response = await fetch('/api/dev-agents/readme/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: this.readmeProjectPath.trim() || '.',
          sessionId: this.langfuseSessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(await this.readHttpError(response, `README stream failed: ${response.status}`));
      }

      await readNdjsonStream<ReadmeGenerateStreamEvent>(response, (event) => this.applyReadmeGenerateStreamEvent(event));
    } catch (error) {
      runInAction(() => {
        this.readmeError = this.readErrorMessage(error, 'README generation failed');
        this.readmeStatus = null;
      });
    } finally {
      runInAction(() => {
        this.isGeneratingReadme = false;
      });
    }
  }

  async saveReadme() {
    this.isSavingReadme = true;
    this.readmeError = null;
    this.readmeSaveMessage = null;

    try {
      const response = await this.postJson<ReadmeSaveResponse>('/api/dev-agents/readme/save', {
        outputPath: this.readmeOutputPath.trim() || 'README_generated.md',
        content: this.readmeDraft,
        sessionId: this.langfuseSessionId,
      });

      runInAction(() => {
        this.readmeSaveMessage = response.message;
      });
    } catch (error) {
      runInAction(() => {
        this.readmeError = this.readErrorMessage(error, 'Could not save generated README');
      });
    } finally {
      runInAction(() => {
        this.isSavingReadme = false;
      });
    }
  }

  async copyText(value: string) {
    await navigator.clipboard.writeText(value);

    runInAction(() => {
      this.copiedText = value;
    });

    if (this.copiedResetTimer) {
      window.clearTimeout(this.copiedResetTimer);
    }

    this.copiedResetTimer = window.setTimeout(() => {
      runInAction(() => {
        if (this.copiedText === value) {
          this.copiedText = null;
        }
      });
    }, 1200);
  }

  isCopied(value: string) {
    return this.copiedText === value;
  }

  get isCommitBusy() {
    return this.isGeneratingCommit || this.isStreamingCommit || this.isLoadingDiff;
  }

  get canGenerateCommit() {
    return !this.isCommitBusy && Boolean(this.diff.trim());
  }

  get canStreamCommit() {
    return this.canGenerateCommit;
  }

  get canLoadDiff() {
    return !this.isCommitBusy;
  }

  get diffFiles() {
    return parseUnifiedDiff(this.diff);
  }

  get diffStats() {
    return this.diffFiles.reduce(
      (stats, file) => ({
        files: stats.files + 1,
        additions: stats.additions + file.additions,
        deletions: stats.deletions + file.deletions,
      }),
      { files: 0, additions: 0, deletions: 0 },
    );
  }

  get canAnalyzeGitCommit() {
    return !this.isAnalyzingGitCommit;
  }

  get canAuditEnv() {
    return !this.isAuditingEnv && Boolean(this.examplePath.trim()) && Boolean(this.envPath.trim());
  }

  get normalizedSessionLogLimit() {
    return Math.max(1, Math.min(Math.trunc(this.sessionLogLimit) || 100, 200));
  }

  get sessionLogRows(): SessionLogRowView[] {
    return this.sessionLogs.map((entry) => ({
      ...entry,
      time: new Date(entry.timestamp).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    }));
  }

  get sessionLogCounts() {
    return this.sessionLogs.reduce(
      (counts, entry) => ({
        ...counts,
        [entry.level]: counts[entry.level] + 1,
      }),
      { error: 0, warn: 0, log: 0, debug: 0 },
    );
  }

  get canLoadSessionLogs() {
    return !this.isLoadingSessionLogs;
  }

  get canAnalyzeSessionLogs() {
    return !this.isAnalyzingSessionLogs && !this.isLoadingSessionLogs;
  }

  get canTriggerSessionLogTestError() {
    return !this.isTriggeringSessionLogError && !this.isLoadingSessionLogs;
  }

  get canGenerateReadme() {
    return !this.isGeneratingReadme && !this.isSavingReadme && Boolean(this.readmeProjectPath.trim());
  }

  get canSaveReadme() {
    return !this.isGeneratingReadme && !this.isSavingReadme && Boolean(this.readmeDraft.trim()) && Boolean(this.readmeOutputPath.trim());
  }

  get hasReadmeDraft() {
    return Boolean(this.readmeDraft.trim());
  }

  get hasSessionLogAnalysisStream() {
    return Boolean(this.sessionLogAnalysisStreamText.trim()) || Boolean(this.sessionLogAnalysisStatus);
  }

  get sessionLogAnalysisView(): AnalyzeSessionLogsView | null {
    if (!this.sessionLogAnalysis) {
      return null;
    }

    return {
      ...this.sessionLogAnalysis,
      sourceContextLines: this.parseSourceContext(this.sessionLogAnalysis.sourceContext),
    };
  }

  dispose() {
    if (this.copiedResetTimer) {
      window.clearTimeout(this.copiedResetTimer);
      this.copiedResetTimer = null;
    }
  }

  private applyCommitStreamEvent(event: StreamEvent) {
    if (event.type === 'delta') {
      runInAction(() => {
        this.streamText += event.delta;
      });
      return;
    }

    if (event.type === 'done') {
      runInAction(() => {
        this.streamText = event.text;
      });
      return;
    }

    throw new Error(event.message);
  }

  private applySessionLogAnalysisStreamEvent(event: AnalyzeSessionLogsStreamEvent) {
    if (event.type === 'status') {
      runInAction(() => {
        this.sessionLogAnalysisStatus = event.message;
      });
      return;
    }

    if (event.type === 'delta') {
      runInAction(() => {
        this.sessionLogAnalysisStreamText += event.delta;
      });
      return;
    }

    if (event.type === 'done') {
      runInAction(() => {
        this.sessionLogAnalysis = event.result;
        this.sessionLogAnalysisStatus = 'Analysis complete';
      });
      return;
    }

    throw new Error(event.message);
  }

  private applyReadmeGenerateStreamEvent(event: ReadmeGenerateStreamEvent) {
    if (event.type === 'status') {
      runInAction(() => {
        this.readmeStatus = event.message;
      });
      return;
    }

    if (event.type === 'delta') {
      runInAction(() => {
        this.readmeDraft += event.delta;
      });
      return;
    }

    if (event.type === 'done') {
      runInAction(() => {
        this.readmeDraft = event.text;
        this.readmeStatus = 'README draft ready';
      });
      return;
    }

    throw new Error(event.message);
  }

  private async postJson<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(await this.readHttpError(response, `Request failed: ${response.status}`));
    }

    return (await response.json()) as T;
  }

  private async getJson<T>(url: string): Promise<T> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(await this.readHttpError(response, `Request failed: ${response.status}`));
    }

    return (await response.json()) as T;
  }

  private async readHttpError(response: Response, fallback: string) {
    const body = await response.json().catch(() => null);
    return typeof body?.message === 'string' ? body.message : fallback;
  }

  private readErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
  }

  private parseSourceContext(sourceContext: string | null): SourceContextLineView[] {
    if (!sourceContext) {
      return [];
    }

    return this.normalizeSourceContext(sourceContext)
      .split(/\r?\n/)
      .filter((line) => line.length > 0)
      .map((line, index) => {
        const match = line.match(/^([> ])\s*(\d+)\s\|\s?(.*)$/);

        if (!match) {
          return {
            id: `source-context-${index}`,
            lineNumber: '',
            code: line,
            isTarget: false,
          };
        }

        return {
          id: `source-context-${match[2]}-${index}`,
          lineNumber: match[2],
          code: match[3],
          isTarget: match[1] === '>',
        };
      });
  }

  private normalizeSourceContext(sourceContext: string) {
    return sourceContext.replace(/\\n(?=\s*(?:>| )?\s*\d+\s\|)/g, '\n').trim();
  }
}
