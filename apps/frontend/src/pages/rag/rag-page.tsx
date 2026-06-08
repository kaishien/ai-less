import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  ArrowLeft,
  ArrowDown,
  CheckCircle2,
  ChevronDown,
  Database,
  FileSearch,
  FileText,
  Gauge,
  GitBranch,
  ListTree,
  Layers3,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  Upload,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { MessageResponse } from '@/components/ai-elements/message';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { type RagChunk, type RagSearchMode, type RagTraceStep, RagStore } from './rag-store';

const PRESET_QUESTIONS = [
  {
    label: 'VPN',
    question: 'Как подключиться к VPN?',
  },
  {
    label: 'Пароль',
    question: 'Какие требования к новому паролю?',
  },
  {
    label: 'Отпуск',
    question: 'За сколько дней нужно подать заявку на отпуск?',
  },
  {
    label: 'ИБ',
    question: 'Что делать при потере корпоративного ноутбука?',
  },
];

const SEARCH_MODES: Array<{ mode: RagSearchMode; label: string; description: string }> = [
  {
    mode: 'dense',
    label: 'Dense',
    description: 'Embeddings + Qdrant cosine search',
  },
  {
    mode: 'bm25',
    label: 'BM25',
    description: 'Локальный keyword search по формуле BM25',
  },
  {
    mode: 'sparse',
    label: 'Sparse',
    description: 'Qdrant sparse vectors для поиска по токенам',
  },
  {
    mode: 'hybrid',
    label: 'Hybrid',
    description: 'Dense + Qdrant sparse через RRF',
  },
  {
    mode: 'hyde',
    label: 'HyDE',
    description: 'LLM hypothetical doc + Hybrid',
  },
  {
    mode: 'multiQuery',
    label: 'MultiQuery',
    description: 'LLM reformulations + Hybrid + RRF',
  },
  {
    mode: 'advanced',
    label: 'Advanced',
    description: 'Hybrid top-20 + rerank',
  },
];

export const RagPage = observer(() => {
  const [store] = useState(() => new RagStore());

  useEffect(() => () => store.dispose(), [store]);

  return (
    <main className="view-transition-page min-h-dvh bg-[#18191b] text-zinc-100">
      <div className="mx-auto grid min-h-dvh w-full max-w-7xl grid-rows-[auto_minmax(0,1fr)] px-4 py-5 md:px-6 md:py-7">
        <RagHeader store={store} />

        <section className="min-w-0 py-5 md:py-6" aria-label="RAG workspace">
          <RagWorkspace store={store} />
        </section>
      </div>
    </main>
  );
});

const RagHeader = observer(({ store }: { store: RagStore }) => (
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
          <Sparkles className="size-3.5 text-zinc-300" aria-hidden="true" />
        </div>
        <h1 className="m-0 text-2xl font-semibold leading-tight text-zinc-50 md:text-3xl">RAG по документам</h1>
      </div>

      <HeaderActions store={store} />
    </div>
  </header>
));

const HeaderActions = observer(({ store }: { store: RagStore }) => (
  <div className="grid w-full gap-3 lg:w-[430px]">
    <div className="grid gap-2 rounded-lg border border-white/10 bg-[#222326] p-3 shadow-[0_16px_44px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-sm font-semibold text-zinc-100">Индекс документов</p>
          <p className="m-0 mt-1 text-xs leading-5 text-zinc-500">
            {store.indexResult
              ? `${store.indexResult.documents} док., ${store.indexResult.chunks} чанков в ${store.indexResult.collection}`
              : 'Готов к переиндексации локальной базы.'}
          </p>
        </div>
        <StatusPill busy={store.isIndexing} ready={Boolean(store.indexResult)} />
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <DocumentUpload store={store} />
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07] hover:text-zinc-50 sm:w-auto"
          disabled={store.isBusy}
          onClick={() => void store.index()}
        >
          {store.isIndexing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCcw aria-hidden="true" />}
          {store.isIndexing ? 'Индексирую' : 'Обновить'}
        </Button>
      </div>
    </div>
  </div>
));

const StatusPill = ({ busy, ready }: { busy: boolean; ready: boolean }) => {
  if (busy) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 text-xs font-medium text-sky-200">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
        Работаю
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
      <CheckCircle2 className="size-3" aria-hidden="true" />
      {ready ? 'Обновлён' : 'Готов'}
    </span>
  );
};

const DocumentUpload = observer(({ store }: { store: RagStore }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);

  return (
    <form
      className="min-w-0"
      onSubmit={(event) => {
        event.preventDefault();
        void store.uploadFile(file).then(() => {
          if (inputRef.current) {
            inputRef.current.value = '';
          }
          setFile(null);
        });
      }}
    >
      <label
        className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-[#18191b] px-3 text-sm text-zinc-300 transition hover:border-white/20 hover:bg-[#202124] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
        htmlFor="rag-file"
      >
        <Upload className="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{file ? file.name : 'Выбрать .txt или .md'}</span>
        <input
          ref={inputRef}
          id="rag-file"
          type="file"
          accept=".txt,.md,.markdown,text/plain,text/markdown"
          className="sr-only"
          disabled={store.isBusy}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="m-0 min-w-0 truncate text-xs text-zinc-500">
          {store.uploadResult ? `Добавлен ${store.uploadResult.uploaded.source}` : 'До 2 МБ, индекс обновится автоматически.'}
        </p>
        <Button type="submit" size="xs" className="shrink-0" disabled={!file || store.isBusy}>
          {store.isUploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
          Загрузить
        </Button>
      </div>
    </form>
  );
});

const RagWorkspace = observer(({ store }: { store: RagStore }) => (
  <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
    <section className="flex min-h-[640px] min-w-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#222326] shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
      <QuestionForm store={store} />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-5 md:pb-5">
        {store.error ? <ErrorNotice message={store.error} /> : null}
        {store.hasResults || store.isAsking ? <AnswerSection store={store} /> : <EmptyState />}
      </div>
    </section>

    <RetrievalPanel store={store} />
  </div>
));

const QuestionForm = observer(({ store }: { store: RagStore }) => (
  <div className="border-b border-white/10 bg-[#222326]/95 p-4 md:p-5">
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <label className="text-sm font-semibold text-zinc-100" htmlFor="rag-question">
          Вопрос по базе знаний
        </label>
        <p className="m-0 mt-1 text-xs leading-5 text-zinc-500">
          Enter отправляет, Shift+Enter добавляет новую строку.
        </p>
      </div>
      {store.askedQuestion ? (
        <span className="max-w-full truncate rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-400 md:max-w-80">
          {store.askedQuestion}
        </span>
      ) : null}
    </div>

    <SearchModeSelector store={store} />

    <Textarea
      id="rag-question"
      className="mt-3 min-h-28 resize-none border-white/10 bg-[#18191b] text-[0.95rem] leading-6 text-zinc-100 placeholder:text-zinc-500 shadow-inner shadow-black/10 disabled:opacity-70"
      placeholder="Например: как подключиться к VPN?"
      disabled={store.isBusy}
      value={store.question}
      onChange={(event) => store.setQuestion(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' || event.shiftKey) {
          return;
        }

        event.preventDefault();

        if (store.question.trim() && !store.isBusy) {
          void store.ask();
        }
      }}
    />

    <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="flex min-w-0 flex-wrap gap-2">
        {PRESET_QUESTIONS.map((preset) => (
          <Button
            key={preset.question}
            type="button"
            variant="outline"
            size="xs"
            className="border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07] hover:text-zinc-50"
            disabled={store.isBusy}
            onClick={() => store.usePreset(preset.question)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="flex gap-2">
        {store.isAsking ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07] hover:text-zinc-50 sm:flex-none"
            onClick={() => store.cancel()}
          >
            <Square aria-hidden="true" />
            Стоп
          </Button>
        ) : null}
        <Button
          type="button"
          className="flex-1 sm:flex-none"
          disabled={!store.question.trim() || store.isBusy}
          onClick={() => void store.ask()}
        >
          {store.isAsking ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
          {store.isAsking ? 'Ищу' : 'Спросить'}
        </Button>
      </div>
    </div>
  </div>
));

const SearchModeSelector = observer(({ store }: { store: RagStore }) => {
  const currentMode = SEARCH_MODES.find((item) => item.mode === store.searchMode) ?? SEARCH_MODES[0];

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-[#18191b] p-2">
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3" role="radiogroup" aria-label="Режим поиска">
        {SEARCH_MODES.map((item) => (
          <button
            key={item.mode}
            type="button"
            role="radio"
            aria-checked={store.searchMode === item.mode}
            className={`min-w-0 rounded-md px-2.5 py-2 text-sm font-medium transition ${
              store.searchMode === item.mode
                ? 'bg-zinc-100 text-zinc-950'
                : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100'
            }`}
            disabled={store.isBusy}
            onClick={() => store.setSearchMode(item.mode)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="m-0 mt-2 px-1 text-xs leading-5 text-zinc-500">{currentMode.description}</p>
    </div>
  );
});

const ErrorNotice = ({ message }: { message: string }) => (
  <div className="mt-5 rounded-md border border-red-300/20 bg-red-300/10 p-3 text-sm leading-6 text-red-100">
    {message}
  </div>
);

const AnswerSection = observer(({ store }: { store: RagStore }) => (
  <section className="py-5" aria-label="RAG answer">
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="m-0 text-lg font-semibold text-zinc-100">Ответ</h2>
        <p className="m-0 mt-1 text-xs leading-5 text-zinc-500">Сформирован только по найденному контексту.</p>
      </div>
      {store.isAsking ? (
        <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-400">
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          Генерация
        </span>
      ) : null}
    </div>

    <div className="rounded-lg border border-white/10 bg-[#18191b] p-4 md:p-5">
      {store.answer ? (
        <MessageResponse className="text-sm leading-6 text-zinc-300">{store.answer}</MessageResponse>
      ) : (
        <StreamingSkeleton />
      )}
    </div>
  </section>
));

const StreamingSkeleton = () => (
  <div className="grid gap-3" aria-hidden="true">
    <div className="h-4 w-11/12 animate-pulse rounded bg-white/10" />
    <div className="h-4 w-9/12 animate-pulse rounded bg-white/10" />
    <div className="h-4 w-7/12 animate-pulse rounded bg-white/10" />
  </div>
);

const RetrievalPanel = observer(({ store }: { store: RagStore }) => (
  <aside
    className="grid min-w-0 max-w-full content-start gap-4 overflow-hidden rounded-lg border border-white/10 bg-[#222326] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] md:p-5"
    aria-label="RAG retrieval"
  >
    <RetrievalSummary store={store} />
    <EvaluationSection store={store} />
    <TraceSection trace={store.trace} isAsking={store.isAsking} />
    <SourcesSection store={store} />
    <ChunksSection chunks={store.chunks} isAsking={store.isAsking} />
  </aside>
));

const RetrievalSummary = observer(({ store }: { store: RagStore }) => (
  <section className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#18191b] p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="m-0 text-base font-semibold text-zinc-100">Retrieval</h2>
        <p className="m-0 mt-1 text-xs leading-5 text-zinc-500">Текущая выборка контекста</p>
      </div>
      <div className="grid size-10 place-items-center rounded-md border border-white/10 bg-white/[0.04]">
        <FileSearch className="size-4 text-zinc-300" aria-hidden="true" />
      </div>
    </div>

    <dl className="mt-4 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 text-center">
      <Metric icon={FileText} label="sources" value={String(store.sources.length)} />
      <Metric icon={Layers3} label="chunks" value={String(store.chunks.length)} />
      <Metric icon={Gauge} label="top" value={store.topScore ? store.topScore.toFixed(2) : '0.00'} />
    </dl>
  </section>
));

const Metric = ({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) => (
  <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.03] px-2 py-2">
    <Icon className="mx-auto size-3.5 text-zinc-500" aria-hidden="true" />
    <dt className="mt-1 truncate text-[11px] uppercase tracking-normal text-zinc-500">{label}</dt>
    <dd className="m-0 mt-0.5 text-sm font-semibold text-zinc-100">{value}</dd>
  </div>
);

const EvaluationSection = observer(({ store }: { store: RagStore }) => (
  <section className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] p-4" aria-label="RAG evaluation">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="m-0 text-base font-semibold text-zinc-100">Evaluation</h2>
        <p className="m-0 mt-1 text-xs leading-5 text-zinc-500">hit_rate / MRR / precision@5</p>
      </div>
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="shrink-0 border-white/10 bg-[#18191b] text-zinc-300 hover:bg-white/[0.07] hover:text-zinc-50"
        disabled={store.isBusy}
        onClick={() => void store.evaluate()}
      >
        {store.isEvaluating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Database aria-hidden="true" />}
        Run
      </Button>
    </div>

    {store.evaluationResult ? (
      <>
        <div className="mt-3 grid gap-2">
          {Object.entries(store.evaluationResult.metrics).map(([method, value]) => (
            <EvaluationMetric key={method} label={method} value={value.hitRate} detail={`MRR ${value.mrr.toFixed(3)}`} />
          ))}
        </div>
        <p className="m-0 mt-3 truncate text-xs text-zinc-500">Saved: {store.evaluationResult.resultsPath}</p>
      </>
    ) : (
      <p className="m-0 mt-3 text-sm leading-6 text-zinc-500">Запусти после индексации, чтобы сравнить поисковые режимы.</p>
    )}
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-md border border-white/10 bg-[#18191b] p-1">
      {(['small', 'full'] as const).map((dataset) => (
        <button
          key={dataset}
          type="button"
          className={`rounded px-2 py-1.5 text-xs font-medium transition ${
            store.evaluationDataset === dataset
              ? 'bg-zinc-100 text-zinc-950'
              : 'text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200'
          }`}
          disabled={store.isBusy}
          onClick={() => store.setEvaluationDataset(dataset)}
        >
          {dataset}
        </button>
      ))}
    </div>
  </section>
));

const EvaluationMetric = ({ label, value, detail }: { label: string; value: number; detail: string }) => (
  <div className="grid grid-cols-[104px_minmax(0,1fr)_44px] items-center gap-2 text-xs">
    <dt className="text-zinc-400">{label}</dt>
    <dd className="m-0 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
      <div className="h-full rounded-full bg-zinc-300" style={{ width: `${Math.round(value * 100)}%` }} />
    </dd>
    <dd className="m-0 text-right font-medium text-zinc-200" title={detail}>
      {value.toFixed(3)}
    </dd>
  </div>
);

const TraceSection = ({ trace, isAsking }: { trace: RagTraceStep[]; isAsking: boolean }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] p-4" aria-label="RAG trace">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 text-base font-semibold text-zinc-100">Trace</h2>
          <p className="m-0 mt-1 text-xs leading-5 text-zinc-500">Что происходило внутри поиска</p>
        </div>
        <Dialog
          onOpenChange={(open) => {
            if (open) {
              setSelectedIndex(0);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="shrink-0 border-white/10 bg-[#18191b] text-zinc-300 hover:bg-white/[0.07] hover:text-zinc-50"
              disabled={trace.length === 0}
            >
              <GitBranch aria-hidden="true" />
              Схема
            </Button>
          </DialogTrigger>
          <TraceDiagramDialog trace={trace} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
        </Dialog>
      </div>

      {trace.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {trace.map((step, index) => (
            <TraceStepCard key={`${step.title}-${index}`} step={step} index={index} />
          ))}
        </div>
      ) : (
        <p className="m-0 mt-3 text-sm leading-6 text-zinc-500">
          {isAsking ? 'Шаги появятся после retrieval.' : 'После запроса здесь будет лог поиска.'}
        </p>
      )}
    </section>
  );
};

const TraceDiagramDialog = ({
  trace,
  selectedIndex,
  onSelect,
}: {
  trace: RagTraceStep[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) => {
  const selectedStep = trace[selectedIndex] ?? trace[0];

  return (
    <DialogContent className="flex h-[88dvh] max-h-[88dvh] flex-col overflow-hidden border-white/10 bg-[#18191b] p-0 text-zinc-100 shadow-2xl sm:max-w-5xl">
      <DialogHeader className="border-b border-white/10 px-5 py-4">
        <DialogTitle className="text-zinc-50">RAG trace diagram</DialogTitle>
        <DialogDescription className="text-zinc-500">
          Фактическая цепочка шагов для последнего запроса.
        </DialogDescription>
      </DialogHeader>

      <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="min-h-0 overflow-auto border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
          <TraceFlow trace={trace} selectedIndex={selectedIndex} onSelect={onSelect} />
        </div>
        <TraceStepInspector step={selectedStep} index={selectedIndex} />
      </div>
    </DialogContent>
  );
};

const TraceFlow = ({
  trace,
  selectedIndex,
  onSelect,
}: {
  trace: RagTraceStep[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) => (
  <div className="mx-auto w-full max-w-md">
    <div className="grid gap-2">
      {trace.map((step, index) => (
        <div key={`${step.title}-flow-${index}`} className="grid gap-2">
          <button
            type="button"
            className={`h-32 min-w-0 rounded-lg border p-3 text-left transition ${
              selectedIndex === index
                ? 'border-zinc-100 bg-zinc-100 text-zinc-950'
                : 'border-white/10 bg-[#222326] text-zinc-300 hover:border-white/20 hover:bg-white/[0.06]'
            }`}
            onClick={() => onSelect(index)}
            >
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-md text-xs font-semibold ${
                  selectedIndex === index ? 'bg-zinc-950 text-zinc-100' : 'bg-[#18191b] text-zinc-500'
                }`}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold">{step.title}</span>
                  <TraceDurationPill durationMs={step.durationMs} selected={selectedIndex === index} />
                </span>
                <span className={`mt-2 line-clamp-3 block text-xs leading-5 ${selectedIndex === index ? 'text-zinc-700' : 'text-zinc-500'}`}>
                  {step.description}
                </span>
              </div>
            </div>
          </button>
          <div className="grid h-10 place-items-center text-zinc-500">
            {index < trace.length - 1 ? (
              <button
                type="button"
                className="grid size-8 place-items-center rounded-full border border-white/10 bg-[#222326] text-zinc-400 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-zinc-100"
                aria-label={`Перейти к шагу ${index + 2}`}
                onClick={() => onSelect(index + 1)}
              >
                <ArrowDown className="size-4" aria-hidden="true" />
              </button>
            ) : (
              <span className="rounded-full border border-emerald-300/15 bg-emerald-300/10 px-2 py-1 text-[11px] font-medium text-emerald-200">
                done
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const TraceStepInspector = ({ step, index }: { step?: RagTraceStep; index: number }) => {
  if (!step) {
    return (
      <div className="p-5 text-sm text-zinc-500">
        Trace пуст.
      </div>
    );
  }

  return (
    <aside className="min-h-0 overflow-auto p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-sm font-semibold text-zinc-300">
          {index + 1}
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="m-0 text-base font-semibold text-zinc-50">{step.title}</h3>
            <TraceDurationPill durationMs={step.durationMs} />
          </div>
          <p className="m-0 mt-1 text-sm leading-6 text-zinc-500">{step.description}</p>
        </div>
      </div>

      <div className="grid gap-3">
        {step.query ? <TraceCodeBlock label="query" value={step.query} /> : null}
        {step.model ? <TraceCodeBlock label="model" value={step.model} /> : null}
        {step.output ? <TraceCodeBlock label="output" value={Array.isArray(step.output) ? step.output.join('\n') : step.output} /> : null}
        {step.chunks?.length ? <TraceChunkList chunks={step.chunks} /> : null}
      </div>
    </aside>
  );
};

const TraceChunkList = ({ chunks }: { chunks: NonNullable<RagTraceStep['chunks']> }) => (
  <div className="grid gap-2">
    <div className="text-xs font-medium text-zinc-400">top chunks</div>
    {chunks.map((chunk) => (
      <div key={`${chunk.source}-${chunk.chunkId}-${chunk.rank}-dialog`} className="min-w-0 rounded-md border border-white/10 bg-[#222326] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-zinc-200">
            #{chunk.rank} {chunk.source}:{chunk.chunkId}
          </span>
          <span className="shrink-0 rounded border border-white/10 bg-[#18191b] px-1.5 py-0.5 text-xs text-zinc-400">
            {chunk.score.toFixed(3)}
          </span>
        </div>
        <p className="m-0 mt-2 text-xs leading-5 text-zinc-500">{chunk.text}</p>
        <TraceWhyList reasons={chunk.why} />
      </div>
    ))}
  </div>
);

const TraceStepCard = ({ step, index }: { step: RagTraceStep; index: number }) => (
  <details className="group min-w-0 overflow-hidden rounded-md border border-white/10 bg-[#18191b]" open={index < 2}>
    <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3 marker:hidden">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="grid size-5 shrink-0 place-items-center rounded border border-white/10 bg-white/[0.04] text-[11px] font-semibold text-zinc-400">
            {index + 1}
          </span>
          <h3 className="m-0 truncate text-sm font-semibold text-zinc-100">{step.title}</h3>
          <TraceDurationPill durationMs={step.durationMs} />
        </div>
        <p className="m-0 mt-1 text-xs leading-5 text-zinc-500">{step.description}</p>
      </div>
      <ChevronDown className="mt-1 size-4 shrink-0 text-zinc-500 transition group-open:rotate-180" aria-hidden="true" />
    </summary>

    <div className="grid gap-3 border-t border-white/10 p-3 text-xs">
      {step.query ? <TraceCodeBlock label="query" value={step.query} /> : null}
      {step.model ? <TraceCodeBlock label="model" value={step.model} /> : null}
      {step.output ? <TraceCodeBlock label="output" value={Array.isArray(step.output) ? step.output.join('\n') : step.output} /> : null}
      {step.chunks?.length ? (
        <div className="grid gap-2">
          <div className="font-medium text-zinc-400">top chunks</div>
          {step.chunks.map((chunk) => (
            <div key={`${chunk.source}-${chunk.chunkId}-${chunk.rank}`} className="min-w-0 rounded border border-white/10 bg-white/[0.03] p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium text-zinc-300">
                  #{chunk.rank} {chunk.source}:{chunk.chunkId}
                </span>
                <span className="shrink-0 text-zinc-500">{chunk.score.toFixed(3)}</span>
              </div>
              <p className="m-0 mt-1 line-clamp-2 text-[11px] leading-5 text-zinc-500">{chunk.text}</p>
              <TraceWhyList reasons={chunk.why} compact />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  </details>
);

const TraceDurationPill = ({ durationMs, selected = false }: { durationMs?: number; selected?: boolean }) => {
  if (typeof durationMs !== 'number') {
    return null;
  }

  return (
    <span
      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
        selected
          ? 'border-zinc-950/10 bg-zinc-950/5 text-zinc-700'
          : 'border-white/10 bg-white/[0.04] text-zinc-500'
      }`}
    >
      {durationMs.toFixed(1)} ms
    </span>
  );
};

const TraceWhyList = ({ reasons, compact = false }: { reasons?: string[]; compact?: boolean }) => {
  if (!reasons?.length) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? 'mt-2' : 'mt-3'}`}>
      {reasons.map((reason) => (
        <span
          key={reason}
          className="rounded border border-sky-300/15 bg-sky-300/10 px-1.5 py-0.5 text-[10px] font-medium leading-4 text-sky-100/80"
        >
          {reason}
        </span>
      ))}
    </div>
  );
};

const TraceCodeBlock = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <div className="mb-1 font-medium text-zinc-400">{label}</div>
    <pre className="m-0 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded border border-white/10 bg-black/20 p-2 font-mono text-[11px] leading-5 text-zinc-500">
      {value}
    </pre>
  </div>
);

const SourcesSection = observer(({ store }: { store: RagStore }) => {
  const sourceStats = getSourceStats(store.chunks);

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] p-4" aria-label="RAG sources">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-base font-semibold text-zinc-100">Источники</h2>
        <span className="text-xs text-zinc-500">{sourceStats.length}</span>
      </div>
      {sourceStats.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {sourceStats.map((source) => (
            <div key={source.name} className="min-w-0 rounded-md border border-white/10 bg-[#18191b] px-3 py-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                <div className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-200">{source.name}</div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
                <div className="h-full rounded-full bg-zinc-300" style={{ width: `${Math.max(8, source.bestScore * 100)}%` }} />
              </div>
              <div className="mt-1.5 text-xs text-zinc-500">
                {source.count} chunks, best {source.bestScore.toFixed(3)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 mt-3 text-sm leading-6 text-zinc-500">
          {store.isAsking ? 'Ищу релевантные документы.' : 'Источники появятся после запроса.'}
        </p>
      )}
    </section>
  );
});

const ChunksSection = ({ chunks, isAsking }: { chunks: RagChunk[]; isAsking: boolean }) => {
  if (chunks.length === 0) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4" aria-label="Retrieved chunks">
        <h2 className="m-0 text-base font-semibold text-zinc-100">Чанки</h2>
        <p className="m-0 mt-3 text-sm leading-6 text-zinc-500">
          {isAsking ? 'Контекст появится после поиска.' : 'Здесь будут найденные фрагменты.'}
        </p>
      </section>
    );
  }

  return (
    <section className="grid min-w-0 gap-3" aria-label="Retrieved chunks">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-base font-semibold text-zinc-100">Чанки</h2>
        <span className="text-xs text-zinc-500">{chunks.length}</span>
      </div>
      {chunks.map((chunk, index) => (
        <ChunkCard key={`${chunk.source}-${chunk.chunkId}`} chunk={chunk} initiallyOpen={index === 0} rank={index + 1} />
      ))}
    </section>
  );
};

const ChunkCard = ({ chunk, initiallyOpen, rank }: { chunk: RagChunk; initiallyOpen: boolean; rank: number }) => (
  <details className="group min-w-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]" open={initiallyOpen}>
    <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3 marker:hidden">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="grid size-5 shrink-0 place-items-center rounded-md border border-white/10 bg-[#18191b] text-[11px] font-semibold text-zinc-400">
            {rank}
          </span>
          <h3 className="m-0 truncate text-sm font-semibold text-zinc-100">{chunk.source}</h3>
        </div>
        <p className="m-0 mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{chunk.text}</p>
        {chunk.retrieval?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chunk.retrieval.map((item) => (
              <span key={item} className="rounded-md border border-white/10 bg-[#18191b] px-1.5 py-0.5 text-[11px] text-zinc-500">
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-md border border-white/10 bg-[#18191b] px-2 py-1 text-xs text-zinc-400">
          {chunk.score.toFixed(3)}
        </span>
        <ChevronDown className="mt-1 size-4 text-zinc-500 transition group-open:rotate-180" aria-hidden="true" />
      </div>
    </summary>
    <pre className="m-3 mt-0 max-h-72 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-md border border-white/10 bg-[#18191b] p-3 font-sans text-sm leading-6 text-zinc-400">
      {chunk.text}
    </pre>
    <ScoreDetails chunk={chunk} />
  </details>
);

const ScoreDetails = ({ chunk }: { chunk: RagChunk }) => {
  const scores = [
    ['dense', chunk.denseScore],
    ['bm25', chunk.bm25Score],
    ['sparse', chunk.sparseScore],
    ['rrf', chunk.rrfScore],
    ['rerank', chunk.rerankScore],
  ].filter((item): item is [string, number] => typeof item[1] === 'number');

  if (scores.length === 0) {
    return null;
  }

  return (
    <dl className="mx-3 mb-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-xs sm:grid-cols-4">
      {scores.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="truncate text-zinc-500">{label}</dt>
          <dd className="m-0 mt-0.5 font-medium text-zinc-300">{value.toFixed(3)}</dd>
        </div>
      ))}
    </dl>
  );
};

const getSourceStats = (chunks: RagChunk[]) => {
  const sources = new Map<string, { name: string; count: number; bestScore: number }>();

  for (const chunk of chunks) {
    const current = sources.get(chunk.source) ?? {
      name: chunk.source,
      count: 0,
      bestScore: 0,
    };

    current.count += 1;
    current.bestScore = Math.max(current.bestScore, chunk.score);
    sources.set(chunk.source, current);
  }

  return [...sources.values()].sort((left, right) => right.bestScore - left.bestScore);
};

const EmptyState = () => (
  <div className="grid min-h-[380px] place-items-center py-10 text-center">
    <div className="max-w-md">
      <div className="mx-auto grid size-12 place-items-center rounded-md border border-white/10 bg-white/[0.04]">
        <FileSearch className="size-5 text-zinc-300" aria-hidden="true" />
      </div>
      <h2 className="m-0 mt-4 text-base font-semibold text-zinc-100">Задай вопрос по документам</h2>
      <p className="m-0 mt-2 text-sm leading-6 text-zinc-500">
        Ответ появится в рабочей области, а справа будет видно, какие источники и чанки попали в контекст.
      </p>
    </div>
  </div>
);
