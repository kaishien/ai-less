import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';
import { ChatMessage, ChatStore } from './chat-store';

interface FullscreenImage {
  src: string;
  prompt?: string;
}

export const ChatPage = observer(() => {
  const [store] = useState(() => new ChatStore());
  const [fullscreenImage, setFullscreenImage] = useState<FullscreenImage | null>(null);

  useEffect(() => () => store.dispose(), [store]);

  return (
    <main className="view-transition-page h-dvh overflow-hidden bg-[#212121] text-zinc-100">
      <section
        className="grid h-dvh max-h-dvh w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[#212121]"
        aria-label="AI chat"
      >
        <ChatHeader store={store} />
        <ChatConversation store={store} onOpenImage={setFullscreenImage} />
        <ChatComposer store={store} />
      </section>

      <FullscreenImageDialog image={fullscreenImage} onClose={() => setFullscreenImage(null)} />
    </main>
  );
});

const ChatHeader = observer(({ store }: { store: ChatStore }) => (
  <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/8 bg-[#212121]/95 px-4 py-3 backdrop-blur md:px-5">
    <div className="min-w-0">
      <h1 className="m-0 text-base font-semibold leading-tight text-zinc-100">{store.assistant.name}</h1>
      <p className="m-0 mt-1 truncate text-xs text-zinc-500">{store.lastUsageLabel}</p>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {store.budgetLabel ? (
        <span className="hidden rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-400 md:inline">
          {store.budgetLabel}
        </span>
      ) : null}
      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-300">
        {store.isStreaming ? 'Thinking' : 'Ready'}
      </span>
    </div>
  </header>
));

const ChatConversation = observer(
  ({ store, onOpenImage }: { store: ChatStore; onOpenImage: (image: FullscreenImage) => void }) => {
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const lastMessageContent = store.messages.at(-1)?.content;

    useEffect(() => {
      bottomRef.current?.scrollIntoView({ block: 'end' });
    }, [store.messages.length, store.isStreaming, lastMessageContent]);

    return (
      <Conversation className="min-h-0 overflow-y-auto">
        <ConversationContent className="mx-auto min-h-full w-full max-w-3xl gap-5 px-4 py-6 md:px-6 md:py-8">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-zinc-400">
            {store.assistant.roleDescription}
          </div>
          {store.messages.map((message) => (
            <ChatMessageItem key={message.id} message={message} onOpenImage={onOpenImage} />
          ))}
          {store.error ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-950/30 px-4 py-3 text-sm text-red-200">
              {store.error}
            </div>
          ) : null}
          <div ref={bottomRef} />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    );
  },
);

const ChatMessageItem = ({ message, onOpenImage }: { message: ChatMessage; onOpenImage: (image: FullscreenImage) => void }) => (
  <Message from={message.role}>
    <MessageContent
      className={
        message.role === 'user'
          ? 'bg-[#303030] text-zinc-100'
          : 'w-full max-w-full bg-transparent px-0 text-zinc-100 md:max-w-[82%]'
      }
    >
      {message.imageLoading && message.content.startsWith('Генерирую изображение:') ? null : (
        <MessageResponse>{message.content || 'Печатает...'}</MessageResponse>
      )}
      <ChatMessageImage message={message} onOpenImage={onOpenImage} />
    </MessageContent>
  </Message>
);

const ChatMessageImage = ({ message, onOpenImage }: { message: ChatMessage; onOpenImage: (image: FullscreenImage) => void }) => {
  if (message.imageLoading) {
    return <ImageGenerationLoader prompt={message.imagePrompt} />;
  }

  if (!message.imageUrl) {
    return null;
  }

  return (
    <figure className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <button
        className="group block w-full cursor-zoom-in text-left"
        type="button"
        aria-label="Открыть изображение на весь экран"
        onClick={() => onOpenImage({ src: message.imageUrl!, prompt: message.imagePrompt })}
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
  );
};

const ImageGenerationLoader = ({ prompt }: { prompt?: string }) => (
  <figure className="mt-3">
    <div className="image-generation-loader relative flex w-full flex-col gap-3 text-left" aria-label="Генерация изображения" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-sm font-medium text-zinc-100">Генерирую изображение</p>
          <p className="m-0 mt-1 text-xs text-zinc-500">Готовлю превью</p>
        </div>
        <div className="image-generation-shimmer__spinner size-9 shrink-0 rounded-full border-2 border-white/15 border-t-zinc-100" />
      </div>
      <div className="grid place-items-center">
        <div className="image-generation-shimmer__preview aspect-square w-full">
          <div className="image-generation-shimmer__ridge image-generation-shimmer__ridge--wide" />
          <div className="image-generation-shimmer__ridge image-generation-shimmer__ridge--medium" />
          <div className="image-generation-shimmer__ridge image-generation-shimmer__ridge--short" />
        </div>
      </div>
      <div>
        {prompt ? (
          <p className="m-0 line-clamp-2 text-xs leading-5 text-zinc-400">{prompt}</p>
        ) : (
          <p className="m-0 h-4 w-2/3 rounded-full bg-white/8" aria-hidden="true" />
        )}
      </div>
    </div>
  </figure>
);

const ChatComposer = observer(({ store }: { store: ChatStore }) => (
  <PromptInput
    className="relative sticky bottom-0 z-20 mx-auto w-full max-w-5xl bg-[#212121]/95 px-4 pb-5 pt-3 backdrop-blur md:px-6 md:pb-6 [&_[data-slot=input-group]]:min-h-[58px] [&_[data-slot=input-group]]:rounded-[30px] [&_[data-slot=input-group]]:border-white/10 [&_[data-slot=input-group]]:bg-[#2f3033] [&_[data-slot=input-group]]:shadow-[0_10px_28px_rgba(0,0,0,0.22)] [&_[data-slot=input-group]]:ring-1 [&_[data-slot=input-group]]:ring-white/5 [&_[data-slot=input-group]:has(textarea:focus-visible)]:border-white/20 [&_[data-slot=input-group]:has(textarea:focus-visible)]:bg-[#34363a] [&_[data-slot=input-group]:has(textarea:focus-visible)]:ring-white/10"
    onSubmit={() => void store.sendMessage()}
  >
    <PromptInputBody>
      <PromptInputTextarea
        className="min-h-[56px] px-5 py-[17px] pr-16 text-[0.96rem] leading-[22px] text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0"
        placeholder="Спроси что-нибудь или попроси нарисовать изображение..."
        value={store.input}
        onChange={(event) => store.setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void store.sendMessage();
          }
        }}
      />
      <PromptInputSubmit
        className="absolute bottom-2.5 right-2.5 size-10 rounded-full bg-zinc-100 text-zinc-950 hover:bg-white disabled:bg-white/6 disabled:text-zinc-500"
        disabled={!store.input.trim() || store.isStreaming}
        status={store.isStreaming ? 'streaming' : 'ready'}
      />
    </PromptInputBody>
  </PromptInput>
));

const FullscreenImageDialog = ({ image, onClose }: { image: FullscreenImage | null; onClose: () => void }) => {
  useEffect(() => {
    if (!image) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [image, onClose]);

  if (!image) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Изображение на весь экран"
      onClick={onClose}
    >
      <button
        className="absolute right-4 top-4 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/20"
        type="button"
        onClick={onClose}
      >
        Закрыть
      </button>
      <figure className="flex max-h-full max-w-6xl flex-col items-center gap-3" onClick={(event) => event.stopPropagation()}>
        <img
          className="max-h-[82dvh] max-w-full rounded-xl object-contain shadow-[0_24px_90px_rgba(0,0,0,0.65)]"
          src={image.src}
          alt={image.prompt ?? 'Generated image'}
        />
        {image.prompt ? (
          <figcaption className="max-w-3xl text-center text-sm leading-6 text-zinc-300">{image.prompt}</figcaption>
        ) : null}
      </figure>
    </div>
  );
};
