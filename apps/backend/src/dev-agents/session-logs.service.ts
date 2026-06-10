import { Inject, Injectable } from '@nestjs/common';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createAgent } from 'langchain';
import * as z from 'zod';
import {
  AnalyzeSessionLogsRequest,
  AnalyzeSessionLogsResponse,
  AnalyzeSessionLogsStreamEvent,
  CaptureSessionLogRequest,
  SessionLogFilter,
  SessionLogsRequest,
  SessionLogsResponse,
  TriggerSessionLogTestErrorRequest,
} from './dev-agents.types';
import { DevAgentsModelFactory } from './dev-agents-model.factory';
import { sessionLogBuffer } from './logs/session-log-buffer';
import { getRecentBackendLogsTool, readSourceContextTool } from './tools/log.tools';
import { createLangfuseConfig } from '../common/langfuse/langfuse-tracing';

const AnalyzeSessionLogsSchema = z.object({
  errorType: z.string().describe('Error class/type, for example BadRequestError or TypeError.'),
  filePath: z.string().nullable().describe('Repository-relative source file path from the stack trace, if found.'),
  lineNumber: z.number().int().nullable().describe('One-based source line number from the stack trace, if found.'),
  cause: z.string().describe('Concrete root cause of the latest relevant backend error.'),
  fix: z.string().describe('Specific recommended fix, preferably with code-level guidance.'),
  sourceContext: z.string().nullable().describe('Source context returned by read_source_context, if available.'),
});

@Injectable()
export class SessionLogsService {
  constructor(@Inject(DevAgentsModelFactory) private readonly modelFactory: DevAgentsModelFactory) {}

  captureSessionLog(request: CaptureSessionLogRequest): SessionLogsResponse {
    const level = this.normalizeCaptureLogLevel(request.level);
    const source = request.source?.trim() || 'frontend';
    const message = request.message?.trim() || 'empty log message';

    sessionLogBuffer.addMessage(level, `[${source}] ${message}`, request.stack);

    return this.getSessionLogs({
      limit: 1,
      level,
    });
  }

  getSessionLogs(request: SessionLogsRequest = {}): SessionLogsResponse {
    return {
      logs: sessionLogBuffer.list({
        limit: this.normalizeLogLimit(request.limit),
        level: this.normalizeLogLevel(request.level),
      }),
    };
  }

  async triggerSessionLogTestError(request: TriggerSessionLogTestErrorRequest = {}): Promise<never> {
    const kind = request.kind ?? 'enoent';

    try {
      if (kind === 'type-error') {
        const value: unknown = null;
        (value as { trim: () => string }).trim();
      }

      if (kind === 'generic') {
        throw new Error('DevAgents test generic error: synthetic backend failure for log analyzer.');
      }

      await readFile(resolve(process.cwd(), '.env.example.missing'), 'utf8');
      throw new Error('Unexpectedly read missing test file.');
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async analyzeSessionLogs(request: AnalyzeSessionLogsRequest = {}): Promise<AnalyzeSessionLogsResponse> {
    const limit = this.normalizeLogLimit(request.limit ?? 80);
    const level = this.normalizeLogLevel(request.level ?? 'error');
    const contextLines = Math.max(1, Math.min(request.contextLines ?? 10, 40));
    const agent = createAgent({
      model: this.modelFactory.createChatModel({ temperature: 0 }),
      tools: [getRecentBackendLogsTool, readSourceContextTool],
      systemPrompt:
        'Ты анализатор backend-логов текущей dev-сессии. ' +
        'Сначала вызови get_recent_backend_logs. Найди последнюю релевантную ошибку. ' +
        'Если в stack trace есть путь к файлу и строка внутри репозитория, вызови read_source_context. ' +
        'Верни конкретную причину и исправление. Не выдумывай файл/строку, если их нет в логах.',
      responseFormat: AnalyzeSessionLogsSchema,
    });

    const result = await agent.invoke(
      {
        messages: [
          {
            role: 'user',
            content:
              `Проанализируй последние backend logs: limit=${limit}, level=${level}, context=${contextLines}. ` +
              'Если ошибок нет, явно скажи это в cause/fix.',
          },
        ],
      },
      createLangfuseConfig({
        name: 'dev-agents.session-logs.analyze',
        sessionId: request.sessionId,
        tags: ['session-logs'],
        metadata: { limit, level, contextLines },
      }),
    );

    return result.structuredResponse as AnalyzeSessionLogsResponse;
  }

  async *streamAnalyzeSessionLogs(
    request: AnalyzeSessionLogsRequest = {},
  ): AsyncGenerator<AnalyzeSessionLogsStreamEvent> {
    const limit = this.normalizeLogLimit(request.limit ?? 80);
    const level = this.normalizeLogLevel(request.level ?? 'error');
    const contextLines = Math.max(1, Math.min(request.contextLines ?? 10, 40));

    yield { type: 'status', message: 'Reading captured backend logs' };

    const logsText = this.formatSessionLogsForAnalysis(limit, level);

    yield { type: 'status', message: 'Streaming model analysis' };

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'Ты анализатор backend-логов текущей dev-сессии. ' +
          'Пиши кратко и практически: что сломалось, почему, где искать, как исправить. ' +
          'Не выдумывай файл или строку, если их нет в логах.',
      ],
      [
        'human',
        'Проанализируй последние backend logs.\n' +
          'Фильтр: {level}; limit: {limit}; source context позже будет собран отдельно с context={contextLines}.\n\n' +
          'Logs:\n{logsText}',
      ],
    ]);
    const chain = prompt.pipe(this.modelFactory.createChatModel({ temperature: 0 }));
    const stream = await chain.stream(
      {
        limit,
        level,
        contextLines,
        logsText,
      },
      createLangfuseConfig({
        name: 'dev-agents.session-logs.analyze-stream-preview',
        sessionId: request.sessionId,
        tags: ['session-logs', 'stream'],
        metadata: { limit, level, contextLines, logsLength: logsText.length },
      }),
    );

    for await (const chunk of stream) {
      const content = typeof chunk.content === 'string' ? chunk.content : '';
      if (content) {
        yield { type: 'delta', delta: content };
      }
    }

    yield { type: 'status', message: 'Preparing structured source-context result' };
    const result = await this.analyzeSessionLogs({
      limit,
      level,
      contextLines,
      sessionId: request.sessionId,
    });

    yield { type: 'done', result };
  }

  private normalizeLogLevel(level: SessionLogFilter | undefined): SessionLogFilter {
    return level === 'error' || level === 'warn' || level === 'log' || level === 'debug' || level === 'all'
      ? level
      : 'all';
  }

  private normalizeCaptureLogLevel(level: CaptureSessionLogRequest['level']) {
    return level === 'error' || level === 'warn' || level === 'log' || level === 'debug' ? level : 'log';
  }

  private normalizeLogLimit(limit: number | undefined): number {
    return Math.max(1, Math.min(limit ?? 100, 200));
  }

  private formatSessionLogsForAnalysis(limit: number, level: SessionLogFilter): string {
    const logs = sessionLogBuffer.list({ limit, level });

    if (logs.length === 0) {
      return 'No captured logs.';
    }

    return logs
      .map((entry) => {
        const stack = entry.stack ? `\n${entry.stack}` : '';
        return `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message}${stack}`;
      })
      .join('\n\n');
  }
}
