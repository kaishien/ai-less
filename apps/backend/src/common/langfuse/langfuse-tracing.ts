import type { RunnableConfig } from '@langchain/core/runnables';
import { CallbackHandler } from '@langfuse/langchain';
import { isLangfuseEnabled, normalizeTraceMetadata } from './langfuse-env';

export interface LangfuseTraceOptions {
  name: string;
  component?: string;
  sessionId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export function createLangfuseConfig(options: LangfuseTraceOptions): RunnableConfig | undefined {
  if (!isLangfuseEnabled()) {
    return undefined;
  }

  const tags = ['ai-less', options.component ?? 'dev-agents', ...(options.tags ?? [])];
  const traceMetadata = normalizeTraceMetadata(options.metadata);

  return {
    callbacks: [
      new CallbackHandler({
        sessionId: options.sessionId ?? 'dev-agents',
        tags,
        traceMetadata,
      }),
    ],
    metadata: traceMetadata,
    runName: options.name,
    tags,
  };
}
