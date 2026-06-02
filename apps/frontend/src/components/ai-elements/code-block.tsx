import { useEffect, useState } from 'react';
import { cx } from '../../lib/classes';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null);
  const label = language?.trim() || 'code';

  useEffect(() => {
    let isCurrent = true;

    async function renderHighlightedCode() {
      try {
        const { highlightCode } = await import('../../lib/highlightCode');
        const html = await highlightCode(code, language);

        if (isCurrent) {
          setHighlightedCode(html);
        }
      } catch {
        if (isCurrent) {
          setHighlightedCode(null);
        }
      }
    }

    void renderHighlightedCode();

    return () => {
      isCurrent = false;
    };
  }, [code, language]);

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <figure className="my-4 overflow-hidden rounded-xl border border-white/10 bg-[#0f0f10] shadow-[0_14px_32px_rgba(0,0,0,0.28)]">
      <figcaption className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-400">
        <span className="font-medium uppercase tracking-wide">{label}</span>
        <button
          className={cx(
            'rounded-md border border-white/10 px-2.5 py-1 font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white',
            copied && 'bg-emerald-400/10 text-emerald-200',
          )}
          type="button"
          onClick={() => void copyCode()}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
      {highlightedCode ? (
        <div className="code-block__highlight" dangerouslySetInnerHTML={{ __html: highlightedCode }} />
      ) : (
        <pre className="m-0 overflow-x-auto p-4 text-[0.9rem] leading-6 text-zinc-100">
          <code>{code}</code>
        </pre>
      )}
    </figure>
  );
}
