import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cx } from '../../lib/classes';

interface ConversationProps extends ComponentPropsWithoutRef<'section'> {
  children: ReactNode;
}

export function Conversation({ children, className = '', ...props }: ConversationProps) {
  return (
    <section className={cx('min-h-0 overflow-hidden', className)} {...props}>
      {children}
    </section>
  );
}

interface ConversationContentProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode;
}

export function ConversationContent({ children, className = '', ...props }: ConversationContentProps) {
  return (
    <div className={cx('mx-auto flex h-full w-full max-w-3xl flex-col gap-5 overflow-y-auto px-4 py-6 md:px-6 md:py-8', className)} {...props}>
      {children}
    </div>
  );
}
