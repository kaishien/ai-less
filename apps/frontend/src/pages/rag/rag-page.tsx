import { observer } from 'mobx-react-lite';
import { ArrowLeft, DatabaseZap, FileSearch, Layers3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ragStore } from './rag-store';

const pipelineSteps = [
  {
    title: 'Индексация',
    description: 'Chunking документов, embeddings батчами и загрузка в Qdrant.',
    icon: Layers3,
  },
  {
    title: 'Retrieval',
    description: 'Поиск top-k чанков с threshold и метаданными источников.',
    icon: FileSearch,
  },
  {
    title: 'Ответ',
    description: 'Генерация ответа только на основе найденного контекста.',
    icon: DatabaseZap,
  },
];

export const RagPage = observer(() => (
  <main className="view-transition-page min-h-dvh bg-[#18191b] text-zinc-100">
    <div className="mx-auto grid min-h-dvh w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] px-4 py-5 md:px-6 md:py-7">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3 text-zinc-400 hover:text-zinc-100">
            <Link to="/" viewTransition>
              <ArrowLeft aria-hidden="true" />
              Dashboard
            </Link>
          </Button>
          <h1 className="m-0 text-2xl font-semibold leading-tight text-zinc-50 md:text-3xl">RAG</h1>
          <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Заготовка под поиск по документам: вопрос, найденный контекст, источники и статус индексации.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-md border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-sm font-medium text-amber-100">
          Backend retrieval еще не подключен
        </span>
      </header>

      <section className="grid min-h-0 gap-5 py-6 lg:grid-cols-[minmax(0,1fr)_340px]" aria-label="RAG workspace">
        <div className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-[#222326] p-4 md:p-5">
          <label className="text-sm font-medium text-zinc-200" htmlFor="rag-question">
            Вопрос по документам
          </label>
          <Textarea
            id="rag-question"
            className="mt-3 min-h-32 resize-none border-white/10 bg-[#18191b] text-zinc-100 placeholder:text-zinc-500"
            placeholder="Например: как подключиться к VPN?"
            value={ragStore.question}
            onChange={(event) => ragStore.setQuestion(event.target.value)}
          />
          <div className="mt-4 flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-sm leading-6 text-zinc-500">Endpoint планируется как /api/rag/ask.</p>
            <Button disabled className="w-full sm:w-auto">
              Спросить
            </Button>
          </div>

          <div className="grid flex-1 place-items-center py-10 text-center">
            <div className="max-w-md">
              <div className="mx-auto grid size-12 place-items-center rounded-md border border-white/10 bg-white/[0.04]">
                <FileSearch className="size-5 text-zinc-300" aria-hidden="true" />
              </div>
              <h2 className="m-0 mt-4 text-base font-semibold text-zinc-100">Источники появятся после retrieval</h2>
              <p className="m-0 mt-2 text-sm leading-6 text-zinc-500">
                Здесь будет ответ, список уникальных документов и найденные чанки с score.
              </p>
            </div>
          </div>
        </div>

        <aside className="rounded-lg border border-white/10 bg-[#222326] p-4 md:p-5" aria-label="RAG pipeline">
          <h2 className="m-0 text-base font-semibold text-zinc-100">Pipeline</h2>
          <div className="mt-4 grid gap-3">
            {pipelineSteps.map((step) => (
              <div key={step.title} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-md bg-white/[0.05]">
                    <step.icon className="size-4 text-zinc-300" aria-hidden="true" />
                  </div>
                  <h3 className="m-0 text-sm font-semibold text-zinc-100">{step.title}</h3>
                </div>
                <p className="m-0 mt-2 text-sm leading-6 text-zinc-500">{step.description}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  </main>
));
