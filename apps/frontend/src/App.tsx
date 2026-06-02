import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Conversation, ConversationContent } from './components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from './components/ai-elements/message';
import { PromptInput, PromptInputSubmit, PromptInputTextarea } from './components/ai-elements/prompt-input';
import { chatStore } from './stores/chatStore';

export const App = observer(() => {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastMessageContent = chatStore.messages.at(-1)?.content;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [chatStore.messages.length, chatStore.isStreaming, lastMessageContent]);

  return (
    <main className="min-h-screen bg-[#212121] text-zinc-100">
      <section
        className="grid min-h-screen w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[#212121]"
        aria-label="AI chat"
      >
        <header className="flex items-center justify-between gap-4 border-b border-white/8 bg-[#212121]/95 px-4 py-3 md:px-5">
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

        <PromptInput onSubmit={() => void chatStore.sendMessage()}>
          <PromptInputTextarea
            label="Сообщение"
            placeholder="Спроси что-нибудь..."
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
    </main>
  );
});
