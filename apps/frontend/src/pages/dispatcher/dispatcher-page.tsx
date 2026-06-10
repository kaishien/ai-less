import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ArrowLeft, FileCode2, Loader2, Play, Route, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { FlowReplayPanel } from './dispatcher-flow';
import { Panel } from './dispatcher-layout';
import { ResultSummary } from './dispatcher-result';
import { DispatcherStore, routeIcon, routeLabel } from './dispatcher-store';

export const DispatcherPage = observer(() => {
  const [store] = useState(() => new DispatcherStore());

  useEffect(() => {
    void store.load();

    return () => store.dispose();
  }, [store]);

  return (
    <main className="view-transition-page min-h-dvh bg-[#18191b] text-zinc-100">
      <div className="mx-auto grid min-h-dvh w-full max-w-7xl grid-rows-[auto_minmax(0,1fr)] px-4 py-5 md:px-6 md:py-7">
        <DispatcherHeader store={store} />

        <section className="grid min-h-0 gap-4 py-5 md:py-6">
          <InputWorkspace store={store} />
          <FlowReplayPanel store={store} />
          <ResultSummary result={store.result} isLoading={store.isLoading || store.isRunning} />
        </section>
      </div>
    </main>
  );
});

const DispatcherHeader = observer(({ store }: { store: DispatcherStore }) => (
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
        <Button className="h-10" disabled={!store.canRun} onClick={() => void store.run()}>
          {store.isRunning ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
          {store.isRunning ? 'В процессе...' : 'Запустить'}
        </Button>
        {store.error ? (
          <div className="rounded-md border border-red-300/20 bg-red-300/10 px-3 py-2 text-sm leading-5 text-red-100">{store.error}</div>
        ) : null}
      </div>
    </div>
  </header>
));

const InputWorkspace = observer(({ store }: { store: DispatcherStore }) => (
  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
    <Panel title="Входящие" icon={Route}>
      <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
        {store.inputs.map((input) => {
          const Icon = routeIcon[input.kind];
          const active = input.id === store.selectedInput?.id && !store.customInput.trim();

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
              onClick={() => store.selectInput(input.id)}
            >
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04]">
                  <Icon className="size-4 text-zinc-200" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="m-0 min-w-0 truncate text-sm font-semibold text-zinc-100">{input.title}</p>
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
        value={store.customInput}
        className="min-h-32 resize-y border-white/10 bg-[#18191b] text-sm text-zinc-100 placeholder:text-zinc-600"
        placeholder="Задай вопрос или вставь свой PR, alert или аналитический вопрос..."
        onChange={(event) => store.setCustomInput(event.target.value)}
      />
    </Panel>
  </div>
));
