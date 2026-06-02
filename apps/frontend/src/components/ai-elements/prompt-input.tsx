import type { ComponentPropsWithoutRef, FormEvent, ReactNode } from 'react';
import { cx } from '../../lib/classes';

interface PromptInputProps extends Omit<ComponentPropsWithoutRef<'form'>, 'onSubmit'> {
  children: ReactNode;
  onSubmit: () => void;
}

export function PromptInput({ children, className = '', onSubmit, ...props }: PromptInputProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      className={cx(
        'mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 pb-5 pt-3 md:px-6 md:pb-6',
        className,
      )}
      onSubmit={handleSubmit}
      {...props}
    >
      {children}
    </form>
  );
}

interface PromptInputTextareaProps extends ComponentPropsWithoutRef<'textarea'> {
  label: string;
}

export function PromptInputTextarea({ className = '', label, ...props }: PromptInputTextareaProps) {
  return (
    <label className="min-w-0">
      <span className="sr-only">{label}</span>
      <textarea
        className={cx(
          'block min-h-[52px] max-h-[180px] w-full resize-none rounded-3xl border border-white/10 bg-[#2f3033] px-5 py-3.5 text-[0.96rem] text-zinc-100 outline-none shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition placeholder:text-zinc-500 focus:border-white/20 focus:bg-[#34363a] focus:ring-2 focus:ring-white/10',
          className,
        )}
        rows={1}
        {...props}
      />
    </label>
  );
}

interface PromptInputSubmitProps extends ComponentPropsWithoutRef<'button'> {
  children: ReactNode;
}

export function PromptInputSubmit({ children, className = '', ...props }: PromptInputSubmitProps) {
  return (
    <button
      className={cx(
        'min-h-[52px] min-w-[72px] self-end rounded-3xl bg-zinc-100 px-5 font-bold text-zinc-950 shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition hover:bg-white disabled:bg-zinc-700 disabled:text-zinc-500',
        className,
      )}
      type="submit"
      {...props}
    >
      {children}
    </button>
  );
}
