import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  ArrowLeft,
  Braces,
  CheckCircle2,
  Clipboard,
  FileText,
  FileKey2,
  FileWarning,
  GitCommitHorizontal,
  GitPullRequestDraft,
  Loader2,
  Play,
  RefreshCw,
  Save,
  ScrollText,
  TerminalSquare,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { MessageResponse } from '@/components/ai-elements/message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { type ParsedDiffFile, type ParsedDiffLine } from './diff-parser';
import {
  type AgentTab,
  type AnalyzeSessionLogsView,
  type CommitMessageResponse,
  DevAgentsStore,
  type EnvAuditResponse,
  type GitCommitResponse,
  type SessionLogFilter,
  type SessionLogRowView,
  type SourceContextLineView,
} from './dev-agents-store';

const tabs: Array<{ id: AgentTab; title: string; icon: typeof GitCommitHorizontal }> = [
  { id: 'commit-message', title: 'Commit Message', icon: GitCommitHorizontal },
  { id: 'git-commit', title: 'Git Agent', icon: TerminalSquare },
  { id: 'env-audit', title: '.env Audit', icon: FileKey2 },
  { id: 'session-logs', title: 'Logs', icon: ScrollText },
  { id: 'readme', title: 'README', icon: FileText },
];

export const DevAgentsPage = observer(() => {
  const [store] = useState(() => new DevAgentsStore());

  useEffect(() => () => store.dispose(), [store]);

  return (
    <main className="view-transition-page min-h-dvh bg-[#18191b] text-zinc-100">
      <div className="mx-auto grid min-h-dvh w-full max-w-[1500px] grid-rows-[auto_minmax(0,1fr)] px-4 py-5 md:px-6 md:py-7">
        <header className="border-b border-white/10 pb-5">
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-4 text-zinc-400 hover:text-zinc-100">
            <Link to="/" viewTransition>
              <ArrowLeft aria-hidden="true" />
              Dashboard
            </Link>
          </Button>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="min-w-0 max-w-3xl">
              <h1 className="m-0 text-2xl font-semibold leading-tight text-zinc-50 md:text-3xl">Dev Agents</h1>
             
            </div>
            <nav
              className="flex w-full min-w-0 gap-1 overflow-x-auto rounded-lg border border-white/10 bg-[#222326] p-1 xl:w-auto"
              aria-label="Dev agents"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={
                    store.activeTab === tab.id
                      ? 'inline-flex h-11 min-w-32 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-zinc-100 px-4 text-sm font-semibold text-zinc-950'
                      : 'inline-flex h-11 min-w-32 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100'
                  }
                  onClick={() => store.setActiveTab(tab.id)}
                >
                  <tab.icon className="size-4" aria-hidden="true" />
                  <span>{tab.title}</span>
                </button>
              ))}
            </nav>
          </div>
        </header>

        <section className="min-w-0 py-5 md:py-6" aria-label="Dev agents workspace">
          {store.activeTab === 'commit-message' ? <CommitMessagePanel store={store} /> : null}
          {store.activeTab === 'git-commit' ? <GitCommitPanel store={store} /> : null}
          {store.activeTab === 'env-audit' ? <EnvAuditPanel store={store} /> : null}
          {store.activeTab === 'session-logs' ? <SessionLogsPanel store={store} /> : null}
          {store.activeTab === 'readme' ? <ReadmePanel store={store} /> : null}
        </section>
      </div>
    </main>
  );
});

const CommitMessagePanel = observer(({ store }: { store: DevAgentsStore }) => {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
      <section
        className="grid min-h-[620px] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-white/10 bg-[#222326] shadow-[0_18px_60px_rgba(0,0,0,0.22)]"
      >
        <div className="border-b border-white/10 p-4 md:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="m-0 text-lg font-semibold text-zinc-50">LCEL structured chain</h2>
             
            </div>
            <Braces className="size-5 shrink-0 text-zinc-400" aria-hidden="true" />
          </div>
        </div>

        <div className="min-h-0 p-4 md:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <DiffToolbar store={store} />
          </div>
          {store.diffViewMode === 'raw' ? (
            <Textarea
              id="dev-agents-diff"
              className="mt-2 min-h-[460px] resize-none border-white/10 bg-[#18191b] font-mono text-sm leading-6 text-zinc-100 placeholder:text-zinc-500"
              value={store.diff}
              onChange={(event) => store.setDiff(event.target.value)}
            />
          ) : (
            <DiffPanel files={store.diffFiles} />
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
          <Button type="button" disabled={!store.canGenerateCommit} onClick={() => void store.generateCommitMessage()}>
            {store.isGeneratingCommit ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
            Generate
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07] hover:text-zinc-50"
            disabled={!store.canStreamCommit}
            onClick={() => void store.streamCommitMessage()}
          >
            {store.isStreamingCommit ? <Loader2 className="animate-spin" aria-hidden="true" /> : <GitPullRequestDraft aria-hidden="true" />}
            Stream text
          </Button>
        </div>
      </section>

      <ResultRail error={store.commitError}>
        {store.commitResult ? (
          <CommitResult result={store.commitResult} store={store} />
        ) : (
          <EmptyResult title="Structured output" description="После генерации здесь появятся type, scope, description и готовая строка." />
        )}
        <section className="rounded-lg border border-white/10 bg-[#222326] p-4">
          <h3 className="m-0 text-sm font-semibold text-zinc-100">Stream output</h3>
          <pre className="mt-3 min-h-28 whitespace-pre-wrap rounded-md border border-white/10 bg-[#18191b] p-3 text-sm leading-6 text-zinc-300">
            {store.streamText || 'No stream yet.'}
          </pre>
        </section>
      </ResultRail>
    </div>
  );
});

const DiffToolbar = observer(({ store }: { store: DevAgentsStore }) => (
  <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <label className="text-sm font-medium text-zinc-200" htmlFor="dev-agents-diff">
        Diff
      </label>
      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-400">
        {store.diffStats.files} files
      </span>
      <span className="rounded-md border border-emerald-300/20 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
        +{store.diffStats.additions}
      </span>
      <span className="rounded-md border border-red-300/20 bg-red-500/10 px-2 py-1 text-xs text-red-200">
        -{store.diffStats.deletions}
      </span>
    </div>

    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="grid grid-cols-2 rounded-md border border-white/10 bg-[#18191b] p-1">
        <button
          type="button"
          className={
            store.diffViewMode === 'preview'
              ? 'rounded-sm bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-950'
              : 'rounded-sm px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100'
          }
          onClick={() => store.setDiffViewMode('preview')}
        >
          Preview
        </button>
        <button
          type="button"
          className={
            store.diffViewMode === 'raw'
              ? 'rounded-sm bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-950'
              : 'rounded-sm px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100'
          }
          onClick={() => store.setDiffViewMode('raw')}
        >
          Raw
        </button>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07] hover:text-zinc-50 sm:w-auto"
        disabled={!store.canLoadDiff}
        onClick={() => void store.loadCurrentDiff()}
      >
        {store.isLoadingDiff ? <Loader2 className="animate-spin" aria-hidden="true" /> : <GitPullRequestDraft aria-hidden="true" />}
        Load repo diff
      </Button>
    </div>
  </div>
));

const DiffPanel = ({ files }: { files: ParsedDiffFile[] }) => {
  if (files.length === 0) {
    return (
      <div className="mt-2 grid min-h-[460px] place-items-center rounded-lg border border-white/10 bg-[#18191b] p-6 text-center">
        <div>
          <p className="m-0 text-sm font-semibold text-zinc-200">No diff to preview</p>
          <p className="m-0 mt-2 text-sm leading-6 text-zinc-500">Switch to Raw or load current repository diff.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 max-h-[520px] min-h-[460px] overflow-auto rounded-lg border border-white/10 bg-[#0f1115]">
      <div className="grid gap-4 p-3">
        {files.map((file) => (
          <DiffFileView key={file.id} file={file} />
        ))}
      </div>
    </div>
  );
};

const DiffFileView = ({ file }: { file: ParsedDiffFile }) => (
  <section className="overflow-hidden rounded-md border border-white/10 bg-[#161b22]">
    <header className="flex flex-col gap-2 border-b border-white/10 bg-[#1f242c] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 font-mono text-sm font-semibold text-zinc-100">
        <span className="block truncate">{file.displayPath}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2 font-mono text-xs">
        <span className="text-emerald-300">+{file.additions}</span>
        <span className="text-red-300">-{file.deletions}</span>
      </div>
    </header>
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-xs leading-5">
        <tbody>
          {file.lines.map((line) => (
            <DiffLineView key={line.id} line={line} />
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const DiffLineView = ({ line }: { line: ParsedDiffLine }) => {
  const rowClass =
    line.kind === 'add'
      ? 'bg-emerald-500/10'
      : line.kind === 'remove'
        ? 'bg-red-500/10'
        : line.kind === 'hunk'
          ? 'bg-sky-500/10 text-sky-200'
          : line.kind === 'meta'
            ? 'bg-white/[0.03] text-zinc-500'
            : 'text-zinc-300';
  const marker = line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : line.kind === 'hunk' ? '@' : ' ';

  return (
    <tr className={rowClass}>
      <td className="w-12 select-none border-r border-white/10 px-2 text-right text-zinc-500">{line.oldLineNumber ?? ''}</td>
      <td className="w-12 select-none border-r border-white/10 px-2 text-right text-zinc-500">{line.newLineNumber ?? ''}</td>
      <td
        className={
          line.kind === 'add'
            ? 'w-6 select-none px-2 text-center text-emerald-300'
            : line.kind === 'remove'
              ? 'w-6 select-none px-2 text-center text-red-300'
              : 'w-6 select-none px-2 text-center text-zinc-500'
        }
      >
        {marker}
      </td>
      <td className="min-w-[520px] whitespace-pre px-2 py-0.5 text-left">{line.content || ' '}</td>
    </tr>
  );
};

const GitCommitPanel = observer(({ store }: { store: DevAgentsStore }) => {

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
      <section className="rounded-lg border border-white/10 bg-[#222326] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="m-0 text-lg font-semibold text-zinc-50">Git Commit Agent</h2>
            <p className="m-0 mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
              Агент сам вызывает read-only tools: `git diff --staged` и `git log --oneline`, затем предлагает одну строку commit message.
            </p>
          </div>
          <TerminalSquare className="size-5 shrink-0 text-zinc-400" aria-hidden="true" />
        </div>

        <div className="mt-6 grid max-w-sm gap-2">
          <label className="text-sm font-medium text-zinc-200" htmlFor="recent-commit-count">
            Recent commits
          </label>
          <Input
            id="recent-commit-count"
            type="number"
            min={1}
            max={20}
            className="border-white/10 bg-[#18191b] text-zinc-100"
            value={store.recentCommitCount}
            onChange={(event) => store.setRecentCommitCount(Number(event.target.value))}
          />
        </div>

        <Button className="mt-6" disabled={!store.canAnalyzeGitCommit} onClick={() => void store.analyzeGitCommit()}>
          {store.isAnalyzingGitCommit ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
          Analyze staged changes
        </Button>
      </section>

      <ResultRail error={store.gitCommitError}>
        {store.gitCommitResult ? <GitCommitResult result={store.gitCommitResult} store={store} /> : <EmptyResult title="Agent output" description="Сначала добавь изменения в staged area, затем запусти анализ." />}
      </ResultRail>
    </div>
  );
});

const EnvAuditPanel = observer(({ store }: { store: DevAgentsStore }) => {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_520px]">
      <section
        className="rounded-lg border border-white/10 bg-[#222326] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] md:p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="m-0 text-lg font-semibold text-zinc-50">.env Auditor</h2>
            <p className="m-0 mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
              Tool возвращает только имена ключей. Значения env-переменных не читаются в UI и не отображаются.
            </p>
          </div>
          <FileKey2 className="size-5 shrink-0 text-zinc-400" aria-hidden="true" />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-200" htmlFor="example-path">
              Example file
            </label>
            <Input
              id="example-path"
              className="border-white/10 bg-[#18191b] text-zinc-100"
              value={store.examplePath}
              onChange={(event) => store.setExamplePath(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-200" htmlFor="env-path">
              Env file
            </label>
            <Input
              id="env-path"
              className="border-white/10 bg-[#18191b] text-zinc-100"
              value={store.envPath}
              onChange={(event) => store.setEnvPath(event.target.value)}
            />
          </div>
        </div>

        <Button type="button" className="mt-6" disabled={!store.canAuditEnv} onClick={() => void store.auditEnv()}>
          {store.isAuditingEnv ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
          Compare keys
        </Button>
      </section>

      <ResultRail error={store.envAuditError}>
        {store.envAuditResult ? <EnvAuditResult result={store.envAuditResult} /> : <EmptyResult title="Audit output" description="Запусти сравнение, чтобы увидеть missing, extra и matching ключи." />}
      </ResultRail>
    </div>
  );
});

const ReadmePanel = observer(({ store }: { store: DevAgentsStore }) => {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(620px,0.82fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(760px,0.86fr)]">
      <section className="grid min-h-[680px] min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/10 bg-[#222326] shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
        <div className="border-b border-white/10 p-4 md:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="m-0 text-lg font-semibold text-zinc-50">README Generator</h2>
              <p className="m-0 mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
                Агент читает структуру проекта и entry files, стримит draft, а файл пишется только после подтверждения.
              </p>
            </div>
            <FileText className="size-5 shrink-0 text-zinc-400" aria-hidden="true" />
          </div>
        </div>

        <div className="grid gap-4 border-b border-white/10 p-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)_auto] md:items-end md:p-5">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-200" htmlFor="readme-project-path">
              Project path
            </label>
            <Input
              id="readme-project-path"
              className="border-white/10 bg-[#18191b] text-zinc-100"
              value={store.readmeProjectPath}
              onChange={(event) => store.setReadmeProjectPath(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-zinc-200" htmlFor="readme-output-path">
              Output file
            </label>
            <Input
              id="readme-output-path"
              className="border-white/10 bg-[#18191b] text-zinc-100"
              value={store.readmeOutputPath}
              onChange={(event) => store.setReadmeOutputPath(event.target.value)}
            />
          </div>
          <Button type="button" disabled={!store.canGenerateReadme} onClick={() => void store.generateReadme()}>
            {store.isGeneratingReadme ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
            Generate
          </Button>
        </div>

        <div className="min-h-0 p-4 md:p-5">
          <Textarea
            id="readme-draft"
            className="min-h-[480px] resize-none border-white/10 bg-[#18191b] font-mono text-sm leading-6 text-zinc-100 placeholder:text-zinc-500"
            placeholder="README draft will stream here. Edit it before saving."
            value={store.readmeDraft}
            onChange={(event) => store.setReadmeDraft(event.target.value)}
          />
        </div>
      </section>

      <ResultRail error={store.readmeError}>
        <section className="rounded-lg border border-white/10 bg-[#222326] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="m-0 text-sm font-semibold text-zinc-100">Review and save</h3>
              <p className="m-0 mt-1 text-sm leading-6 text-zinc-500">
                {store.readmeStatus ?? 'Generate a draft, edit it, then save.'}
              </p>
            </div>
            <Button type="button" disabled={!store.canSaveReadme} onClick={() => void store.saveReadme()}>
              {store.isSavingReadme ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              Save
            </Button>
          </div>
          {store.readmeSaveMessage ? (
            <div className="mt-4 rounded-md border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm leading-6 text-emerald-100">
              {store.readmeSaveMessage}
            </div>
          ) : null}
        </section>

        <section className="grid min-h-[680px] overflow-hidden rounded-lg border border-white/10 bg-[#222326] p-4">
          <h3 className="m-0 text-sm font-semibold text-zinc-100">Preview</h3>
          <div className="mt-3 min-h-[600px] overflow-auto rounded-md border border-white/10 bg-[#18191b] px-5 py-4 text-sm leading-6 text-zinc-100 xl:max-h-[calc(100vh-310px)]">
            {store.hasReadmeDraft ? (
              <MessageResponse className="max-w-none text-zinc-100 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_h1]:text-2xl [&_h2]:mt-6 [&_h2]:text-xl [&_li]:my-1 [&_ol]:my-2 [&_ol]:pl-5 [&_p]:my-2 [&_pre]:my-3 [&_strong]:text-zinc-50 [&_ul]:my-2 [&_ul]:pl-5">
                {store.readmeDraft}
              </MessageResponse>
            ) : (
              <p className="m-0 text-sm text-zinc-500">No README draft yet.</p>
            )}
          </div>
        </section>
      </ResultRail>
    </div>
  );
});

const sessionLogFilters: Array<{ value: SessionLogFilter; label: string }> = [
  { value: 'error', label: 'Errors' },
  { value: 'warn', label: 'Warnings' },
  { value: 'log', label: 'Logs' },
  { value: 'debug', label: 'Debug' },
  { value: 'all', label: 'All' },
];

const SessionLogsPanel = observer(({ store }: { store: DevAgentsStore }) => {
  return (
    <div className="grid min-w-0 gap-4">
      <LogAnalysisPanel store={store} />

      <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="grid min-h-[520px] min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/10 bg-[#222326] shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
          <div className="border-b border-white/10 p-4 md:p-5 lg:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="m-0 text-lg font-semibold text-zinc-50">Backend session logs</h2>
                <p className="m-0 mt-1 max-w-4xl text-sm leading-6 text-zinc-500">
                  Сырые строки текущей dev-сессии. Ошибки и source context анализируются в верхнем блоке.
                </p>
              </div>
              <ScrollText className="size-5 shrink-0 text-zinc-400" aria-hidden="true" />
            </div>
          </div>

          <div className="flex flex-col gap-4 border-b border-white/10 p-4 md:p-5 lg:flex-row lg:items-end lg:justify-between lg:p-6">
            <div className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-zinc-200">Level</span>
              <div className="flex min-w-0 flex-wrap gap-2">
                {sessionLogFilters.map((filter) => (
                  <LogFilterButton key={filter.value} filter={filter} store={store} />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:shrink-0">
              <div className="grid w-full gap-2 sm:w-28">
                <label className="text-sm font-medium text-zinc-200" htmlFor="session-log-limit">
                  Limit
                </label>
                <Input
                  id="session-log-limit"
                  type="number"
                  min={1}
                  max={200}
                  className="h-10 border-white/10 bg-[#18191b] text-zinc-100"
                  value={store.sessionLogLimit}
                  onChange={(event) => store.setSessionLogLimit(Number(event.target.value))}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-28 border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07] hover:text-zinc-50"
                  disabled={!store.canLoadSessionLogs}
                  onClick={() => void store.loadSessionLogs()}
                >
                  {store.isLoadingSessionLogs ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
                  Refresh
                </Button>     
              </div>
            </div>
          </div>

          {store.hasSessionLogAnalysisStream ? <SessionLogInlineStream store={store} /> : null}

          <SessionLogList rows={store.sessionLogRows} />
        </section>

        <aside className="grid content-start gap-4">
          <section className="rounded-lg border border-white/10 bg-[#222326] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="m-0 text-sm font-semibold text-zinc-100">Captured</h3>
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-400">
                {store.sessionLogs.length} rows
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <LogCount label="Errors" value={store.sessionLogCounts.error} tone="red" />
              <LogCount label="Warnings" value={store.sessionLogCounts.warn} tone="amber" />
              <LogCount label="Logs" value={store.sessionLogCounts.log} tone="zinc" />
              <LogCount label="Debug" value={store.sessionLogCounts.debug} tone="sky" />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
});

const LogAnalysisPanel = observer(({ store }: { store: DevAgentsStore }) => {
  return (
    <section className="rounded-lg border border-white/10 bg-[#222326] shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
      <div className="flex flex-col gap-4 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between md:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileWarning className="size-4 text-zinc-400" aria-hidden="true" />
            <h2 className="m-0 text-lg font-semibold text-zinc-50">Latest analysis</h2>
          </div>
          <p className="m-0 mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
            Главный вывод агента: причина ошибки, конкретное исправление и source context.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="w-full md:w-auto"
          disabled={!store.canAnalyzeSessionLogs}
          onClick={() => void store.analyzeSessionLogs()}
        >
          {store.isAnalyzingSessionLogs ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileWarning aria-hidden="true" />}
          Analyze logs
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-w-32 border-red-300/20 bg-red-500/10 text-red-100 hover:bg-red-500/15 hover:text-red-50"
          disabled={!store.canTriggerSessionLogTestError}
          onClick={() => void store.triggerSessionLogTestError()}
        >
          {store.isTriggeringSessionLogError ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileWarning aria-hidden="true" />}
          Test error
        </Button>
        </div>
      </div>

      <div className="p-4 md:p-5">
        {store.sessionLogsError ? (
          <div className="mb-4 rounded-lg border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
            {store.sessionLogsError}
          </div>
        ) : null}

        {store.hasSessionLogAnalysisStream ? <SessionLogAnalysisStream store={store} /> : null}

        {store.sessionLogAnalysisView ? (
          <SessionLogAnalysis result={store.sessionLogAnalysisView} variant="hero" />
        ) : !store.hasSessionLogAnalysisStream ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-[#18191b] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <h3 className="m-0 text-sm font-semibold text-zinc-100">No analysis yet</h3>
                <p className="m-0 mt-1 text-sm leading-6 text-zinc-500">
                  Запусти Analyze logs, чтобы увидеть root cause и конкретный fix здесь, над сырыми логами.
                </p>
              </div>
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-400">
                {store.sessionLogs.length} captured
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
});

const SessionLogAnalysisStream = observer(({ store }: { store: DevAgentsStore }) => (
  <section className="mb-4 rounded-lg border border-sky-300/20 bg-sky-500/[0.06] p-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        {store.isAnalyzingSessionLogs ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-sky-200" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="size-4 shrink-0 text-sky-200" aria-hidden="true" />
        )}
        <h3 className="m-0 truncate text-sm font-semibold text-sky-50">
          {store.sessionLogAnalysisStatus ?? 'Streaming analysis'}
        </h3>
      </div>
      <span className="shrink-0 rounded-md border border-sky-200/15 bg-black/15 px-2.5 py-1 text-xs text-sky-100/80">
        live output
      </span>
    </div>
    <div className="mt-3 max-h-80 overflow-auto rounded-md border border-sky-200/10 bg-[#101417] px-4 py-3 text-sm leading-6 text-sky-50/90">
      {store.sessionLogAnalysisStreamText ? (
        <MessageResponse className="max-w-none text-sky-50/90 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.92em] [&_li]:my-1 [&_ol]:my-2 [&_ol]:pl-5 [&_p]:my-2 [&_pre]:my-3 [&_strong]:text-sky-50 [&_ul]:my-2 [&_ul]:pl-5">
          {store.sessionLogAnalysisStreamText}
        </MessageResponse>
      ) : (
        <p className="m-0 text-sm text-sky-100/65">Waiting for model output...</p>
      )}
    </div>
  </section>
));

const SessionLogInlineStream = observer(({ store }: { store: DevAgentsStore }) => (
  <div className="border-b border-white/10 bg-sky-500/[0.05] px-4 py-3 md:px-5">
    <div className="flex min-w-0 items-center gap-2 text-sm text-sky-50">
      {store.isAnalyzingSessionLogs ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-sky-200" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="size-4 shrink-0 text-sky-200" aria-hidden="true" />
      )}
      <span className="shrink-0 font-medium">{store.sessionLogAnalysisStatus ?? 'Streaming analysis'}</span>
    </div>
  </div>
));

const LogFilterButton = observer(
  ({ filter, store }: { filter: { value: SessionLogFilter; label: string }; store: DevAgentsStore }) => (
    <button
      type="button"
      className={
        store.sessionLogLevel === filter.value
          ? 'h-10 min-w-[92px] rounded-md bg-zinc-100 px-4 text-sm font-semibold text-zinc-950'
          : 'h-10 min-w-[92px] rounded-md border border-white/10 bg-[#18191b] px-4 text-sm font-medium text-zinc-400 hover:border-white/20 hover:text-zinc-100'
      }
      onClick={() => store.setSessionLogLevel(filter.value)}
    >
      {filter.label}
    </button>
  ),
);

const SessionLogList = ({ rows }: { rows: SessionLogRowView[] }) => {
  if (rows.length === 0) {
    return (
      <div className="grid min-h-0 place-items-center p-6 text-center">
        <div>
          <p className="m-0 text-sm font-semibold text-zinc-200">No captured logs</p>
          <p className="m-0 mt-2 text-sm leading-6 text-zinc-500">Refresh after backend activity or switch the level filter.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 overflow-auto bg-[#18191b] p-3 md:p-4">
      <div className="grid gap-2">
        {rows.map((row) => (
          <SessionLogRow key={row.id} row={row} />
        ))}
      </div>
    </div>
  );
};

const SessionLogRow = ({ row }: { row: SessionLogRowView }) => {
  const toneClass =
    row.level === 'error'
      ? 'border-red-300/20 bg-red-500/10 text-red-100'
      : row.level === 'warn'
        ? 'border-amber-300/20 bg-amber-500/10 text-amber-100'
        : row.level === 'debug'
          ? 'border-sky-300/20 bg-sky-500/10 text-sky-100'
          : 'border-white/10 bg-white/[0.03] text-zinc-200';

  return (
    <article className={`min-w-0 overflow-hidden rounded-md border p-3 ${toneClass}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded bg-black/20 px-2 py-1 font-mono text-xs uppercase">{row.level}</span>
          <span className="font-mono text-xs opacity-70">{row.time}</span>
        </div>
      </div>
      <pre className="m-0 mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-5">{row.stack ?? row.message}</pre>
    </article>
  );
};

const LogCount = ({ label, value, tone }: { label: string; value: number; tone: 'red' | 'amber' | 'zinc' | 'sky' }) => {
  const toneClass =
    tone === 'red'
      ? 'border-red-300/20 text-red-100'
      : tone === 'amber'
        ? 'border-amber-300/20 text-amber-100'
        : tone === 'sky'
          ? 'border-sky-300/20 text-sky-100'
          : 'border-white/10 text-zinc-100';

  return (
    <div className={`rounded-md border bg-[#18191b] p-3 ${toneClass}`}>
      <p className="m-0 text-xs text-zinc-500">{label}</p>
      <p className="m-0 mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
};

const SessionLogAnalysis = ({ result, variant = 'default' }: { result: AnalyzeSessionLogsView; variant?: 'default' | 'hero' }) => (
  <section className={variant === 'hero' ? 'rounded-lg border border-white/10 bg-[#18191b] p-4' : 'rounded-lg border border-white/10 bg-[#222326] p-4'}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="m-0 text-sm font-semibold text-zinc-100">{result.errorType}</h3>
        <p className="m-0 mt-1 break-words font-mono text-xs text-zinc-500">
          {result.filePath && result.lineNumber ? `${result.filePath}:${result.lineNumber}` : 'No source location'}
        </p>
      </div>
      <FileWarning className="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
    </div>

    <div className="mt-4 grid gap-3">
      <Field label="cause" value={result.cause} />
      <Field label="fix" value={result.fix} />
      {result.sourceContextLines.length > 0 ? <SourceContextBlock lines={result.sourceContextLines} /> : null}
    </div>
  </section>
);

const SourceContextBlock = ({ lines }: { lines: SourceContextLineView[] }) => (
  <div className="max-h-72 overflow-auto rounded-md border border-white/10 bg-[#0f1115] font-mono text-xs leading-5 text-zinc-300">
    <table className="w-full border-collapse">
      <tbody>
        {lines.map((line) => (
          <tr key={line.id} className={line.isTarget ? 'bg-amber-400/10 text-amber-100' : 'hover:bg-white/[0.03]'}>
            <td
              className={
                line.isTarget
                  ? 'w-12 select-none border-r border-white/10 px-2 py-0.5 text-right text-amber-200'
                  : 'w-12 select-none border-r border-white/10 px-2 py-0.5 text-right text-zinc-500'
              }
            >
              {line.lineNumber}
            </td>
            <td className="min-w-[520px] whitespace-pre px-3 py-0.5 text-left">{line.code || ' '}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ResultRail = ({ children, error }: { children: React.ReactNode; error: string | null }) => (
  <aside className="grid content-start gap-4">
    {error ? (
      <div className="rounded-lg border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">{error}</div>
    ) : null}
    {children}
  </aside>
);

const CommitResult = ({ result, store }: { result: CommitMessageResponse; store: DevAgentsStore }) => (
  <section className="rounded-lg border border-white/10 bg-[#222326] p-4">
    <h3 className="m-0 text-sm font-semibold text-zinc-100">CommitMessage</h3>
    <div className="mt-4 grid gap-3">
      <Field label="type" value={result.message.type} />
      <Field label="scope" value={result.message.scope ?? 'none'} />
      <Field label="description" value={result.message.description} />
      <CopyBlock value={result.conventionalCommit} store={store} />
    </div>
  </section>
);

const GitCommitResult = ({ result, store }: { result: GitCommitResponse; store: DevAgentsStore }) => (
  <section className="rounded-lg border border-white/10 bg-[#222326] p-4">
    <h3 className="m-0 text-sm font-semibold text-zinc-100">Suggested commit</h3>
    <div className="mt-4 grid gap-3">
      <CopyBlock value={result.commit} store={store} />
      <p className="m-0 rounded-md border border-white/10 bg-[#18191b] p-3 text-sm leading-6 text-zinc-300">{result.summary}</p>
    </div>
  </section>
);

const EnvAuditResult = ({ result }: { result: EnvAuditResponse }) => {
  const total = result.missing.length + result.extra.length + result.matching.length;

  return (
    <section className="rounded-lg border border-white/10 bg-[#222326] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-sm font-semibold text-zinc-100">Key comparison</h3>
        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-400">
          {total} keys
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        <KeyList title="Missing in .env" tone="red" keys={result.missing} />
        <KeyList title="Extra in .env" tone="amber" keys={result.extra} />
        <KeyList title="Matching" tone="emerald" keys={result.matching} />
      </div>
    </section>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-white/10 bg-[#18191b] p-3">
    <p className="m-0 text-xs font-medium uppercase text-zinc-500">{label}</p>
    <p className="m-0 mt-1 break-words text-sm leading-6 text-zinc-100">{value}</p>
  </div>
);

const CopyBlock = observer(({ value, store }: { value: string; store: DevAgentsStore }) => (
  <div className="grid gap-2 rounded-md border border-white/10 bg-[#18191b] p-3">
    <div className="flex items-center justify-between gap-3">
      <p className="m-0 text-xs font-medium uppercase text-zinc-500">ready to copy</p>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        className="text-zinc-400 hover:text-zinc-100"
        aria-label="Copy"
        onClick={() => void store.copyText(value)}
      >
        {store.isCopied(value) ? <CheckCircle2 aria-hidden="true" /> : <Clipboard aria-hidden="true" />}
      </Button>
    </div>
    <code className="break-words font-mono text-sm leading-6 text-zinc-100">{value}</code>
  </div>
));

const KeyList = ({ title, tone, keys }: { title: string; tone: 'red' | 'amber' | 'emerald'; keys: string[] }) => {
  const toneClass =
    tone === 'red'
      ? 'border-red-300/20 bg-red-500/10 text-red-100'
      : tone === 'amber'
        ? 'border-amber-300/20 bg-amber-500/10 text-amber-100'
        : 'border-emerald-300/20 bg-emerald-500/10 text-emerald-100';

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <p className="m-0 text-sm font-semibold">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {keys.length > 0 ? (
          keys.map((key) => (
            <span key={key} className="rounded-md bg-black/20 px-2 py-1 font-mono text-xs">
              {key}
            </span>
          ))
        ) : (
          <span className="text-sm opacity-70">none</span>
        )}
      </div>
    </div>
  );
};

const EmptyResult = ({ title, description }: { title: string; description: string }) => (
  <section className="rounded-lg border border-white/10 bg-[#222326] p-4">
    <h3 className="m-0 text-sm font-semibold text-zinc-100">{title}</h3>
    <p className="m-0 mt-2 text-sm leading-6 text-zinc-500">{description}</p>
  </section>
);
