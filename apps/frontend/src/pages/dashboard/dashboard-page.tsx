import { ArrowRight, Bot, DatabaseZap, MessageSquareText, Route } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const sections = [
  {
    title: 'Chat',
    description: 'Диалоговый ассистент с потоковым ответом, защитой роли и генерацией изображений.',
    href: '/chat',
    icon: MessageSquareText,
    status: 'Готов',
    meta: ['Streaming', 'Image tool', 'Token budget'],
  },
  {
    title: 'RAG',
    description: 'Будущая рабочая зона для вопросов по документам, источников и статуса индексации.',
    href: '/rag',
    icon: DatabaseZap,
    status: 'Заготовка',
    meta: ['Qdrant', 'Chunking', 'Sources'],
  },
];

export const DashboardPage = () => (
  <main className="view-transition-page min-h-dvh bg-[#18191b] text-zinc-100">
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-5 md:px-6 md:py-7">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-400">
            <Route className="size-3.5" aria-hidden="true" />
            AI Less workspace
          </div>
          <h1 className="m-0 text-2xl font-semibold leading-tight text-zinc-50 md:text-3xl">Панель приложений</h1>
          <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Выбери рабочий режим: текущий ассистент или будущий RAG-пайплайн по документам.
          </p>
        </div>
        <Button asChild className="w-full md:w-auto">
          <Link to="/chat" viewTransition>
            <Bot aria-hidden="true" />
            Открыть Chat
          </Link>
        </Button>
      </header>

      <section className="grid flex-1 content-start gap-4 py-6 md:grid-cols-2 md:py-8" aria-label="Разделы приложения">
        {sections.map((section) => (
          <Link
            key={section.href}
            to={section.href}
            viewTransition
            className="group flex min-h-[260px] flex-col justify-between rounded-lg border border-white/10 bg-[#222326] p-5 text-left shadow-[0_18px_60px_rgba(0,0,0,0.22)] transition hover:border-white/20 hover:bg-[#27292d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="grid size-11 place-items-center rounded-md border border-white/10 bg-white/[0.04]">
                  <section.icon className="size-5 text-zinc-100" aria-hidden="true" />
                </div>
                <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-300">
                  {section.status}
                </span>
              </div>
              <h2 className="m-0 mt-5 text-xl font-semibold text-zinc-50">{section.title}</h2>
              <p className="m-0 mt-3 text-sm leading-6 text-zinc-400">{section.description}</p>
            </div>

            <div className="mt-8 flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {section.meta.map((item) => (
                  <span key={item} className="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-zinc-400">
                    {item}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-4 text-sm font-medium text-zinc-100">
                Перейти
                <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden="true" />
              </div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  </main>
);
