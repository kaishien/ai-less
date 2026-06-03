import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ArrowLeft, ChevronDown, Database, FileSearch, Loader2, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MessageResponse } from '@/components/ai-elements/message';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { type RagChunk, RagStore } from './rag-store';

const PRESET_QUESTIONS = [
  'Где появились два гражданина?',
  'Что сказано в договоре?',
  'Как подключиться к VPN?',
];

export const RagPage = observer(() => {
  const [store] = useState(() => new RagStore());

  useEffect(() => () => store.dispose(), [store]);

  return (
    <main className="view-transition-page min-h-dvh bg-[#18191b] text-zinc-100">
      <div className="mx-auto grid min-h-dvh w-full max-w-7xl grid-rows-[auto_minmax(0,1fr)] px-4 py-5 md:px-6 md:py-7">
        <RagHeader store={store} />

        <section className="min-w-0 py-6" aria-label="RAG workspace">
          <RagWorkspace store={store} />
        </section>
      </div>
    </main>
  );
});

const RagHeader = observer(({ store }: { store: RagStore }) => (
  <header className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
    <div className="min-w-0">
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3 text-zinc-400 hover:text-zinc-100">
        <Link to="/" viewTransition>
          <ArrowLeft aria-hidden="true" />
          Dashboard
        </Link>
      </Button>
      <h1 className="m-0 text-2xl font-semibold leading-tight text-zinc-50 md:text-3xl">RAG</h1>
      <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
        Поиск по документам: вопрос, найденный контекст и источники.
      </p>
      {store.indexResult ? (
        <p className="m-0 mt-2 text-sm leading-6 text-emerald-300/90">
          Индекс обновлён: {store.indexResult.documents} док., {store.indexResult.chunks} чанков (
          {store.indexResult.collection})
        </p>
      ) : null}
    </div>
    <Button
      type="button"
      variant="outline"
      className="w-full shrink-0 border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07] hover:text-zinc-50 md:w-auto"
      disabled={store.isBusy}
      onClick={() => void store.index()}
    >
      {store.isIndexing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Database aria-hidden="true" />}
      {store.isIndexing ? 'Индексирую…' : 'Переиндексировать'}
    </Button>
  </header>
));

const RagWorkspace = observer(({ store }: { store: RagStore }) => (
  <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
    <div className="flex min-w-0 flex-col rounded-lg border border-white/10 bg-[#222326] p-4 md:p-5">
      <QuestionForm store={store} />

      {store.error ? <ErrorNotice message={store.error} /> : null}
      {store.hasResults || store.isAsking ? <AnswerSection store={store} /> : <EmptyState />}
    </div>

    <RetrievalPanel store={store} />
  </div>
));

const QuestionForm = observer(({ store }: { store: RagStore }) => (
  <>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <label className="text-sm font-medium text-zinc-200" htmlFor="rag-question">
        Вопрос по документам
      </label>
      {store.askedQuestion ? (
        <span className="text-xs text-zinc-500">Последний запрос: {store.askedQuestion}</span>
      ) : null}
    </div>
    <Textarea
      id="rag-question"
      className="mt-3 min-h-32 resize-none border-white/10 bg-[#18191b] text-zinc-100 placeholder:text-zinc-500 disabled:opacity-70"
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
    <div className="mt-3 flex flex-wrap gap-2">
      {PRESET_QUESTIONS.map((question) => (
        <Button
          key={question}
          type="button"
          variant="outline"
          size="xs"
          className="border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07] hover:text-zinc-50"
          disabled={store.isBusy}
          onClick={() => store.usePreset(question)}
        >
          {question}
        </Button>
      ))}
    </div>
    <div className="mt-4 flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-end">
      {store.isAsking ? (
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => store.cancel()}>
          Остановить
        </Button>
      ) : null}
      <Button
        type="button"
        className="w-full sm:w-auto"
        disabled={!store.question.trim() || store.isBusy}
        onClick={() => void store.ask()}
      >
        {store.isAsking ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
        {store.isAsking ? 'Ищу' : 'Спросить'}
      </Button>
    </div>
  </>
));

const ErrorNotice = ({ message }: { message: string }) => (
  <div className="mt-5 rounded-md border border-red-300/20 bg-red-300/10 p-3 text-sm leading-6 text-red-100">
    {message}
  </div>
);

const AnswerSection = observer(({ store }: { store: RagStore }) => (
  <section className="py-5" aria-label="RAG answer">
    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="m-0 text-lg font-semibold text-zinc-100">Ответ</h2>
      {store.isAsking ? (
        <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          Генерация ответа
        </span>
      ) : null}
    </div>

    {store.answer ? (
      <MessageResponse className="text-sm leading-6 text-zinc-300">{store.answer}</MessageResponse>
    ) : (
      <StreamingSkeleton />
    )}
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
    className="grid min-w-0 max-w-full content-start gap-4 overflow-hidden rounded-lg border border-white/10 bg-[#222326] p-4 md:p-5"
    aria-label="RAG retrieval"
  >
    <RetrievalSummary store={store} />
    <SourcesSection store={store} />
    <ChunksSection chunks={store.chunks} isAsking={store.isAsking} />
  </aside>
));

const RetrievalSummary = observer(({ store }: { store: RagStore }) => (
  <section className="min-w-0 overflow-hidden rounded-md border border-white/10 bg-white/[0.03] p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="m-0 text-base font-semibold text-zinc-100">Retrieval</h2>
        <p className="m-0 mt-1 text-xs leading-5 text-zinc-500">Найденный контекст для ответа</p>
      </div>
      <div className="grid size-10 place-items-center rounded-md border border-white/10 bg-[#18191b]">
        <FileSearch className="size-4 text-zinc-300" aria-hidden="true" />
      </div>
    </div>

    <dl className="mt-4 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 text-center">
      <Metric label="sources" value={String(store.sources.length)} />
      <Metric label="chunks" value={String(store.chunks.length)} />
      <Metric label="top" value={store.topScore ? store.topScore.toFixed(2) : '0.00'} />
    </dl>
  </section>
));

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-md border border-white/10 bg-[#18191b] px-2 py-2">
    <dt className="truncate text-[11px] uppercase tracking-normal text-zinc-500">{label}</dt>
    <dd className="m-0 mt-1 text-sm font-semibold text-zinc-100">{value}</dd>
  </div>
);

const SourcesSection = observer(({ store }: { store: RagStore }) => {
  const sourceStats = getSourceStats(store.chunks);

  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-white/10 bg-white/[0.03] p-4" aria-label="RAG sources">
      <h2 className="m-0 text-base font-semibold text-zinc-100">Источники</h2>
      {sourceStats.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {sourceStats.map((source) => (
            <div key={source.name} className="min-w-0 rounded-md border border-white/10 bg-[#18191b] px-3 py-2">
              <div className="truncate text-sm font-medium text-zinc-200">{source.name}</div>
              <div className="mt-1 text-xs text-zinc-500">
                {source.count} chunks · best {source.bestScore.toFixed(3)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 mt-3 text-sm leading-6 text-zinc-500">
          {store.isAsking ? 'Ищу релевантные документы.' : 'Источники пока не найдены.'}
        </p>
      )}
    </section>
  );
});

const ChunksSection = ({ chunks, isAsking }: { chunks: RagChunk[]; isAsking: boolean }) => {
  if (chunks.length === 0) {
    return (
      <section className="rounded-md border border-white/10 bg-white/[0.03] p-4" aria-label="Retrieved chunks">
        <h2 className="m-0 text-base font-semibold text-zinc-100">Чанки</h2>
        <p className="m-0 mt-3 text-sm leading-6 text-zinc-500">
          {isAsking ? 'Контекст появится после поиска.' : 'Здесь будут найденные фрагменты.'}
        </p>
      </section>
    );
  }

  return (
    <section className="grid min-w-0 gap-3" aria-label="Retrieved chunks">
      <h2 className="m-0 text-base font-semibold text-zinc-100">Чанки</h2>
      {chunks.map((chunk, index) => (
        <ChunkCard key={`${chunk.source}-${chunk.chunkId}`} chunk={chunk} initiallyOpen={index === 0} />
      ))}
    </section>
  );
};

const ChunkCard = ({ chunk, initiallyOpen }: { chunk: RagChunk; initiallyOpen: boolean }) => (
  <details className="group min-w-0 overflow-hidden rounded-md border border-white/10 bg-white/[0.03]" open={initiallyOpen}>
    <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3 marker:hidden">
      <div className="min-w-0">
        <h3 className="m-0 truncate text-sm font-semibold text-zinc-100">{chunk.source}</h3>
        <p className="m-0 mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{chunk.text}</p>
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
  </details>
);

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
  <div className="grid flex-1 place-items-center py-14 text-center">
    <div className="max-w-md">
      <div className="mx-auto grid size-12 place-items-center rounded-md border border-white/10 bg-white/[0.04]">
        <FileSearch className="size-5 text-zinc-300" aria-hidden="true" />
      </div>
      <h2 className="m-0 mt-4 text-base font-semibold text-zinc-100">Задай вопрос по документам</h2>
      <p className="m-0 mt-2 text-sm leading-6 text-zinc-500">
        Ответ появится здесь, а справа будут источники и найденные фрагменты.
      </p>
    </div>
  </div>
);
