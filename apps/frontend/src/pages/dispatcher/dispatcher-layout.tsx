import type React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DispatcherTraceStep, ReviewReport } from './dispatcher-store';

export const Panel = ({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="rounded-lg border border-white/10 bg-[#222326] p-4 shadow-[0_16px_44px_rgba(0,0,0,0.18)]">
    <div className="mb-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-zinc-300" aria-hidden="true" />
        <h2 className="m-0 truncate text-sm font-semibold text-zinc-100">{title}</h2>
      </div>
      {action ? <div className="min-w-0 sm:shrink-0">{action}</div> : null}
    </div>
    {children}
  </section>
);

export const TraceList = ({ trace }: { trace: DispatcherTraceStep[] }) => {
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

const riskStyle = (risk: ReviewReport['risk']) => {
  const riskMap = {
    high: 'border-red-300/20 bg-red-300/10 text-red-100',
    medium: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    low: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
  };

  return riskMap[risk];
};

export const RiskPill = ({ risk }: { risk: ReviewReport['risk'] }) => {
  return <span className={cn('rounded-md border px-2 py-0.5 text-[11px] font-medium', riskStyle(risk))}>{risk}</span>;
};
