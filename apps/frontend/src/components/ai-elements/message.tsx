import type { ComponentPropsWithoutRef, ReactNode } from 'react';
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
      <div className={cx('m-0 space-y-2 break-words text-[0.96rem] leading-7', className)} {...props}>
        <RichText content={children} />
      </div>
    );
  }

  return (
    <div className={cx('m-0 break-words text-[0.96rem] leading-7', className)} {...props}>
      {children}
    </div>
  );
}

function RichText({ content }: { content: string }) {
  const parts = parseCodeBlocks(content);

  return (
    <>
      {parts.map((part, index) =>
        part.type === 'code' ? (
          <CodeBlock code={part.code} language={part.language} key={`${part.type}-${index}`} />
        ) : (
          <TextBlock content={part.content} key={`${part.type}-${index}`} />
        ),
      )}
    </>
  );
}

function TextBlock({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).filter((block) => block.length > 0);

  return (
    <>
      {blocks.map((block, index) => (
        <p className="my-2 whitespace-pre-wrap" key={index}>
          <InlineText content={block} />
        </p>
      ))}
    </>
  );
}

function InlineText({ content }: { content: string }) {
  const parts = parseInlineCode(content);

  return (
    <>
      {parts.map((part, index) =>
        part.type === 'code' ? (
          <code
            className="inline-code rounded-md border border-white/10 bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.88em] text-zinc-100"
            key={`${part.type}-${index}`}
          >
            {part.content}
          </code>
        ) : (
          <span key={`${part.type}-${index}`}>{part.content}</span>
        ),
      )}
    </>
  );
}

type InlineTextPart = {
  type: 'text' | 'code';
  content: string;
};

function parseInlineCode(content: string): InlineTextPart[] {
  const parts: InlineTextPart[] = [];
  const inlineCodePattern = /`([^`\n]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineCodePattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex, match.index),
      });
    }

    parts.push({
      type: 'code',
      content: match[1],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.slice(lastIndex),
    });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content }];
}

type RichTextPart =
  | {
      type: 'text';
      content: string;
    }
  | {
      type: 'code';
      language?: string;
      code: string;
    };

function parseCodeBlocks(content: string): RichTextPart[] {
  const parts: RichTextPart[] = [];
  const codeBlockPattern = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockPattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex, match.index),
      });
    }

    parts.push({
      type: 'code',
      language: match[1],
      code: match[2].replace(/\n$/, ''),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.slice(lastIndex),
    });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content }];
}
