import { CheckCircle2, FileCode2, Loader2, Network, Workflow } from 'lucide-react';
import { MessageResponse } from '@/components/ai-elements/message';
import type { DispatcherRunResponse } from './dispatcher-store';
import { routeIcon, routeLabel } from './dispatcher-store';
import { Panel, RiskPill } from './dispatcher-layout';

export const ResultSummary = ({ result, isLoading }: { result: DispatcherRunResponse | null; isLoading: boolean }) => {
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

  const route = result.route ?? result.classification?.route;
  const Icon = route ? routeIcon[route] : Workflow;

  return (
    <Panel title="Результат" icon={CheckCircle2}>
      <div className="grid min-h-[180px] gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="grid content-start rounded-md border border-white/10 bg-[#18191b] p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{route ? routeLabel[route] : 'Routing'}</span>
          </div>
          <p className="m-0 mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{result.inputTitle}</p>
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
          <div className="pr-1">
            <MessageResponse className="break-words text-sm leading-6 text-zinc-200 [overflow-wrap:anywhere] [&_code]:rounded [&_code]:bg-white/[0.07] [&_code]:px-1 [&_h3]:mb-2 [&_h3]:mt-0 [&_h4]:mb-2 [&_h4]:mt-3 [&_li]:my-1 [&_ol]:pl-5 [&_p]:my-2 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-[#101112] [&_pre]:p-3 [&_ul]:pl-5">
              {result.finalAnswer}
            </MessageResponse>
          </div>
        </div>
      </div>
    </Panel>
  );
};

export const BranchDetails = ({ result }: { result: DispatcherRunResponse | null }) => {
  if (!result) {
    return null;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Code review fan-out" icon={FileCode2}>
        {result.reviewReports.length ? (
          <div className="grid max-h-[460px] gap-2 overflow-auto pr-1">
            {result.reviewReports.map((report) => (
              <div key={report.axis} className="rounded-md border border-white/10 bg-[#18191b] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="m-0 min-w-0 truncate text-sm font-semibold text-zinc-100">{report.axis}</p>
                  <RiskPill risk={report.risk} />
                </div>
                <p className="m-0 mt-2 line-clamp-3 text-xs leading-5 text-zinc-400">{report.finding}</p>
                <p className="m-0 mt-2 line-clamp-3 text-xs leading-5 text-zinc-500">{report.recommendation}</p>
              </div>
            ))}
            {result.reviewVerdict ? (
              <div className="rounded-md border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm leading-5 text-emerald-100">
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
          <div className="grid max-h-[460px] gap-3 overflow-auto pr-1">
            <div className="grid gap-2">
              {result.analyticsTasks.map((task) => (
                <div key={`${task.metric}-${task.segment}`} className="rounded-md border border-white/10 bg-[#18191b] p-3">
                  <p className="m-0 truncate text-sm font-semibold text-zinc-100">
                    {task.metric} <span className="text-zinc-500">/ {task.segment}</span>
                  </p>
                  <p className="m-0 mt-1 line-clamp-3 text-xs leading-5 text-zinc-500">{task.rationale}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              {result.analyticsFindings.map((finding) => (
                <div key={`${finding.metric}-${finding.segment}`} className="rounded-md border border-white/10 bg-[#18191b] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="m-0 min-w-0 truncate text-sm font-semibold text-zinc-100">{finding.metric}</p>
                    <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-zinc-400">
                      {finding.confidence}
                    </span>
                  </div>
                  <p className="m-0 mt-1 line-clamp-3 text-xs leading-5 text-zinc-400">{finding.result}</p>
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
