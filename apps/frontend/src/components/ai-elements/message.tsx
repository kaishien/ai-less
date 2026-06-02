import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cx } from '../../lib/classes';
import { CodeBlock } from './code-block';

export type MessageRole = 'user' | 'assistant' | 'system';

interface MessageProps extends ComponentPropsWithoutRef<'article'> {
  children: ReactNode;
  from: MessageRole;
}

export function Message({ children, className = '', from, ...props }: MessageProps) {
  return (
    <article className={cx('flex w-full', from === 'user' ? 'justify-end' : 'justify-start', className)} {...props}>
      {children}
    </article>
  );
}

interface MessageContentProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode;
}

export function MessageContent({ children, className = '', ...props }: MessageContentProps) {
  return (
    <div
      className={cx(
        'w-fit max-w-[92%] rounded-2xl px-4 py-3 leading-relaxed md:max-w-[78%]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface MessageResponseProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  children: ReactNode;
}

export function MessageResponse({ children, className = '', ...props }: MessageResponseProps) {
  if (typeof children === 'string') {
    return (
      <div className={cx('markdown-response m-0 break-words text-[0.96rem] leading-7', className)} {...props}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="my-2 whitespace-pre-wrap">{children}</p>,
            ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
            ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
            li: ({ children }) => <li className="pl-1">{children}</li>,
            h1: ({ children }) => <h1 className="mb-2 mt-4 text-xl font-semibold leading-8">{children}</h1>,
            h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-semibold leading-7">{children}</h2>,
            h3: ({ children }) => <h3 className="mb-2 mt-3 text-base font-semibold leading-7">{children}</h3>,
            a: ({ children, href }) => (
              <a className="text-sky-300 underline decoration-sky-300/40 underline-offset-4 hover:text-sky-200" href={href} rel="noreferrer" target="_blank">
                {children}
              </a>
            ),
            blockquote: ({ children }) => (
              <blockquote className="my-3 border-l-2 border-white/20 pl-3 text-zinc-300">{children}</blockquote>
            ),
            table: ({ children }) => (
              <div className="my-3 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full border-collapse text-left text-sm">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-white/[0.06] text-zinc-200">{children}</thead>,
            th: ({ children }) => <th className="border-b border-white/10 px-3 py-2 font-semibold">{children}</th>,
            td: ({ children }) => <td className="border-t border-white/8 px-3 py-2 text-zinc-300">{children}</td>,
            code: ({ className: codeClassName, children }) => {
              const language = /language-([\w-]+)/.exec(codeClassName ?? '')?.[1];
              const rawCode = String(children);
              const code = rawCode.replace(/\n$/, '');
              const isBlock = Boolean(language || rawCode.endsWith('\n'));

              if (isBlock) {
                return <CodeBlock code={code} language={language} />;
              }

              return (
                <code className="inline-code rounded-md border border-white/10 bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.88em] text-zinc-100">
                  {children}
                </code>
              );
            },
          }}
        >
          {children}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className={cx('m-0 break-words text-[0.96rem] leading-7', className)} {...props}>
      {children}
    </div>
  );
}
