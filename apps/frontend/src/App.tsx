import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Conversation, ConversationContent } from './components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from './components/ai-elements/message';
import { PromptInput, PromptInputSubmit, PromptInputTextarea } from './components/ai-elements/prompt-input';
import { chatStore } from './stores/chatStore';

export const App = observer(() => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastMessageContent = chatStore.messages.at(-1)?.content;
  const [fullscreenImage, setFullscreenImage] = useState<{ src: string; prompt?: string } | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [chatStore.messages.length, chatStore.isStreaming, lastMessageContent]);

  useEffect(() => {
    if (!fullscreenImage) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFullscreenImage(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenImage]);

  return (
    <main className="h-dvh overflow-hidden bg-[#212121] text-zinc-100">
      <section
        className="grid h-dvh max-h-dvh w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[#212121]"
        aria-label="AI chat"
      >
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/8 bg-[#212121]/95 px-4 py-3 backdrop-blur md:px-5">
          <div className="min-w-0">
            <h1 className="m-0 text-base font-semibold leading-tight text-zinc-100">{chatStore.assistant.name}</h1>
            <p className="m-0 mt-1 truncate text-xs text-zinc-500">{chatStore.lastUsageLabel}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {chatStore.budgetLabel ? (
              <span className="hidden rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-400 md:inline">
                {chatStore.budgetLabel}
              </span>
            ) : null}
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-300">
              {chatStore.isStreaming ? 'Thinking' : 'Ready'}
            </span>
          </div>
        </header>

        <Conversation>
          <ConversationContent>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-zinc-400">
              {chatStore.assistant.roleDescription}
            </div>
            {chatStore.messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent
                  className={
                    message.role === 'user'
                      ? 'bg-[#303030] text-zinc-100'
                      : 'max-w-full bg-transparent px-0 text-zinc-100 md:max-w-[82%]'
                  }
                >
                  <MessageResponse>{message.content || 'Печатает...'}</MessageResponse>
                  {message.imageLoading ? (
                    <figure className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                      <div
                        className="image-loader relative flex aspect-square w-full flex-col items-center justify-center gap-4 overflow-hidden bg-[#171717] px-6 text-center"
                        aria-label="Генерация изображения"
                      >
                        <div className="h-10 w-10 rounded-full border-2 border-white/15 border-t-zinc-100" />
                        <div className="relative z-10 max-w-sm">
                          <p className="m-0 text-sm font-medium text-zinc-100">Генерирую изображение</p>
                          <p className="m-0 mt-2 line-clamp-3 text-xs leading-5 text-zinc-400">
                            {message.imagePrompt}
                          </p>
                        </div>
                      </div>
                      {message.imagePrompt ? (
                        <figcaption className="border-t border-white/10 px-3 py-2 text-xs text-zinc-400">
                          {message.imagePrompt}
                        </figcaption>
                      ) : null}
                    </figure>
                  ) : message.imageUrl ? (
                    <figure className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                      <button
                        className="group block w-full cursor-zoom-in text-left"
                        type="button"
                        aria-label="Открыть изображение на весь экран"
                        onClick={() => setFullscreenImage({ src: message.imageUrl!, prompt: message.imagePrompt })}
                      >
                        <span className="relative block overflow-hidden">
                          <img
                            className="block aspect-square w-full object-cover transition duration-200 group-hover:scale-[1.01] group-hover:brightness-110"
                            src={message.imageUrl}
                            alt={message.imagePrompt ?? 'Generated image'}
                          />
                          <span className="absolute bottom-3 right-3 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-xs font-medium text-zinc-100 opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100">
                            Открыть
                          </span>
                        </span>
                      </button>
                      {message.imagePrompt ? (
                        <figcaption className="border-t border-white/10 px-3 py-2 text-xs text-zinc-400">
                          {message.imagePrompt}
                        </figcaption>
                      ) : null}
                    </figure>
                  ) : null}
                </MessageContent>
              </Message>
            ))}
            {chatStore.error ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                {chatStore.error}
              </div>
            ) : null}
            <div ref={bottomRef} />
          </ConversationContent>
        </Conversation>

        <PromptInput className="sticky bottom-0 z-20 border-t border-white/8 bg-[#212121]/95 backdrop-blur" onSubmit={() => void chatStore.sendMessage()}>
          <PromptInputTextarea
            label="Сообщение"
            placeholder="Спроси что-нибудь или попроси нарисовать изображение..."
            value={chatStore.input}
            onChange={(event) => chatStore.setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void chatStore.sendMessage();
              }
            }}
          />
          <PromptInputSubmit disabled={!chatStore.input.trim() || chatStore.isStreaming}>
            {chatStore.isStreaming ? '...' : 'Send'}
          </PromptInputSubmit>
        </PromptInput>
      </section>

      {fullscreenImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm md:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Изображение на весь экран"
          onClick={() => setFullscreenImage(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/20"
            type="button"
            onClick={() => setFullscreenImage(null)}
          >
            Закрыть
          </button>
          <figure className="flex max-h-full max-w-6xl flex-col items-center gap-3" onClick={(event) => event.stopPropagation()}>
            <img
              className="max-h-[82dvh] max-w-full rounded-xl object-contain shadow-[0_24px_90px_rgba(0,0,0,0.65)]"
              src={fullscreenImage.src}
              alt={fullscreenImage.prompt ?? 'Generated image'}
            />
            {fullscreenImage.prompt ? (
              <figcaption className="max-w-3xl text-center text-sm leading-6 text-zinc-300">
                {fullscreenImage.prompt}
              </figcaption>
            ) : null}
          </figure>
        </div>
      ) : null}
    </main>
  );
});
