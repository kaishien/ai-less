import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { createLangfuseConfig } from '../common/langfuse/langfuse-tracing';
import { DISPATCHER_MERMAID, DispatcherGraphFactory } from './dispatcher.graph';
import {
  DispatcherGraphResponse,
  DispatcherInputSummary,
  DispatcherRunRequest,
  DispatcherRunResponse,
  DispatcherStreamEvent,
  DispatcherTraceStep,
  DispatcherRoute,
} from './dispatcher.types';

const INPUT_TITLES: Record<string, { title: string; kind: DispatcherRoute }> = {
  'pr-clean.txt': { title: 'Чистый PR', kind: 'code_review' },
  'pr-risky.txt': { title: 'Рискованный PR', kind: 'code_review' },
  'incident-alert.txt': { title: 'Production alert', kind: 'incident' },
  'analytics-retention.txt': { title: 'Retention question', kind: 'analytics' },
  'analytics-revenue.txt': { title: 'Revenue question', kind: 'analytics' },
};

@Injectable()
export class DispatcherService {
  private readonly dataDir = resolve(process.env.DISPATCHER_DATA_DIR ?? './data/dispatcher');
  private readonly graphFactory = new DispatcherGraphFactory();

  async listInputs(): Promise<DispatcherInputSummary[]> {
    const files = (await readdir(this.dataDir)).filter((file) => file.endsWith('.txt') && INPUT_TITLES[file]);
    const summaries = await Promise.all(
      files.sort().map(async (fileName) => {
        const content = await readFile(resolve(this.dataDir, fileName), 'utf8');
        const metadata = INPUT_TITLES[fileName];

        return {
          id: basename(fileName, extname(fileName)),
          title: metadata.title,
          kind: metadata.kind,
          fileName,
          preview: content.replace(/\s+/g, ' ').trim().slice(0, 180),
        };
      }),
    );

    return summaries;
  }

  graph(): DispatcherGraphResponse {
    return { mermaid: DISPATCHER_MERMAID };
  }

  async run(request: DispatcherRunRequest): Promise<DispatcherRunResponse> {
    const input = await this.resolveInput(request);
    const app = this.graphFactory.create();
    const traceConfig = createLangfuseConfig({
      name: 'dispatcher.graph.run',
      component: 'dispatcher',
      sessionId: `dispatcher:${input.id}`,
      tags: ['langgraph', input.id === 'custom' ? 'custom-input' : 'fixture'],
      metadata: {
        inputId: input.id,
        inputTitle: input.title,
        contentLength: input.content.length,
      },
    });
    const result = await app.invoke(
      {
        inputId: input.id,
        inputTitle: input.title,
        content: input.content,
        reviewReports: [],
        analyticsTasks: [],
        analyticsFindings: [],
        trace: [],
      },
      {
        recursionLimit: 12,
        ...(traceConfig ?? {}),
      },
    );

    return {
      inputId: input.id,
      inputTitle: input.title,
      classification: result.classification,
      route: result.route,
      finalAnswer: result.finalAnswer ?? 'Граф завершился без финального ответа.',
      reviewReports: result.reviewReports ?? [],
      reviewVerdict: result.reviewVerdict,
      analyticsTasks: result.analyticsTasks ?? [],
      analyticsFindings: result.analyticsFindings ?? [],
      trace: result.trace ?? [],
    };
  }

  async *runStream(request: DispatcherRunRequest): AsyncGenerator<DispatcherStreamEvent> {
    const input = await this.resolveInput(request);
    const app = this.graphFactory.create();
    const result = this.createInitialResult(input.id, input.title);
    const traceConfig = createLangfuseConfig({
      name: 'dispatcher.graph.run-stream',
      component: 'dispatcher',
      sessionId: `dispatcher:${input.id}`,
      tags: ['langgraph', 'stream', input.id === 'custom' ? 'custom-input' : 'fixture'],
      metadata: {
        inputId: input.id,
        inputTitle: input.title,
        contentLength: input.content.length,
      },
    });

    let finalAnswer = '';

    result.finalAnswer = this.buildProgressMarkdown(result, 'Граф запущен.', finalAnswer);
    yield { type: 'started', result: this.cloneResult(result) };

    const stream = await app.stream(
      {
        inputId: input.id,
        inputTitle: input.title,
        content: input.content,
        reviewReports: [],
        analyticsTasks: [],
        analyticsFindings: [],
        trace: [],
      },
      {
        recursionLimit: 12,
        streamMode: 'updates',
        ...(traceConfig ?? {}),
      },
    );

    for await (const chunk of stream as AsyncIterable<Record<string, Partial<DispatcherRunResponse>>>) {
      for (const [node, update] of Object.entries(chunk)) {
        const steps = this.applyUpdate(result, update);
        const lastStep = steps.length ? steps[steps.length - 1] : undefined;

        if (update.finalAnswer?.trim()) {
          finalAnswer = update.finalAnswer.trim();
        }

        result.finalAnswer = this.buildProgressMarkdown(result, lastStep?.detail ?? `Узел ${node} завершён.`, finalAnswer);

        for (const step of steps) {
          yield {
            type: 'node',
            node,
            step,
            result: this.cloneResult(result),
          };
        }

        yield {
          type: 'result',
          result: this.cloneResult(result),
        };
      }
    }

    result.finalAnswer = this.buildProgressMarkdown(result, 'Граф завершён.', finalAnswer || 'Граф завершился без финального ответа.');
    yield { type: 'done', result: this.cloneResult(result) };
  }

  private async resolveInput(request: DispatcherRunRequest) {
    if (request.content?.trim()) {
      return {
        id: 'custom',
        title: 'Custom input',
        content: request.content.trim(),
      };
    }

    if (!request.inputId) {
      throw new HttpException({ message: 'inputId or content is required.' }, HttpStatus.BAD_REQUEST);
    }

    const inputs = await this.listInputs();
    const input = inputs.find((item) => item.id === request.inputId);

    if (!input) {
      throw new HttpException({ message: `Unknown dispatcher input: ${request.inputId}` }, HttpStatus.NOT_FOUND);
    }

    return {
      id: input.id,
      title: input.title,
      content: await readFile(resolve(this.dataDir, input.fileName), 'utf8'),
    };
  }

  private createInitialResult(inputId: string, inputTitle: string): DispatcherRunResponse {
    return {
      inputId,
      inputTitle,
      finalAnswer: '',
      reviewReports: [],
      analyticsTasks: [],
      analyticsFindings: [],
      trace: [],
    };
  }

  private applyUpdate(result: DispatcherRunResponse, update: Partial<DispatcherRunResponse>) {
    if (update.classification) {
      result.classification = update.classification;
    }

    if (update.route) {
      result.route = update.route;
    }

    if (update.reviewReports?.length) {
      result.reviewReports.push(...update.reviewReports);
    }

    if (update.reviewVerdict) {
      result.reviewVerdict = update.reviewVerdict;
    }

    if (update.analyticsTasks?.length) {
      result.analyticsTasks = update.analyticsTasks;
    }

    if (update.analyticsFindings?.length) {
      result.analyticsFindings.push(...update.analyticsFindings);
    }

    const steps = update.trace ?? [];

    if (steps.length) {
      result.trace.push(...steps);
    }

    if (update.finalAnswer) {
      result.finalAnswer = update.finalAnswer;
    }

    return steps;
  }

  private buildProgressMarkdown(result: DispatcherRunResponse, status: string, finalAnswer?: string) {
    const route = result.route ?? result.classification?.route;
    const lines = [
      '### Результат',
      '',
      `**Статус:** ${status}`,
      route ? `**Маршрут:** ${route}` : '**Маршрут:** определяется...',
      '',
      '#### Trace',
    ];

    if (result.trace.length === 0) {
      lines.push('- Ожидаю первый узел...');
    } else {
      lines.push(...result.trace.map((step) => `- **${step.node}**: ${step.title} — ${step.detail}`));
    }

    if (result.classification) {
      lines.push(
        '',
        '#### Классификация',
        '',
        `- **Route:** ${result.classification.route}`,
        `- **Confidence:** ${result.classification.confidence.toFixed(2)}`,
        `- **Reasoning:** ${result.classification.reasoning}`,
      );
    }

    if (result.reviewReports.length) {
      lines.push('', '#### Code review checks', '');
      lines.push(
        ...result.reviewReports.map(
          (report) =>
            `- **${report.axis}** (${report.risk}): ${report.finding}\n  - Recommendation: ${report.recommendation}`,
        ),
      );
    }

    if (result.reviewVerdict) {
      lines.push('', '#### Review verdict', '', `**${result.reviewVerdict.verdict}:** ${result.reviewVerdict.reason}`);
    }

    if (result.analyticsTasks.length) {
      lines.push('', '#### Analytics plan', '');
      lines.push(
        ...result.analyticsTasks.map(
          (task) => `- **${task.metric} / ${task.segment}:** ${task.rationale}`,
        ),
      );
    }

    if (result.analyticsFindings.length) {
      lines.push('', '#### Analytics findings', '');
      lines.push(
        ...result.analyticsFindings.map(
          (finding) => `- **${finding.metric} / ${finding.segment}** (${finding.confidence}): ${finding.result}`,
        ),
      );
    }

    if (finalAnswer?.trim()) {
      lines.push('', '#### Финальный ответ', '', finalAnswer.trim());
    }

    return lines.join('\n');
  }

  private cloneResult(result: DispatcherRunResponse): DispatcherRunResponse {
    return {
      ...result,
      classification: result.classification ? { ...result.classification } : undefined,
      reviewReports: result.reviewReports.map((report) => ({ ...report })),
      reviewVerdict: result.reviewVerdict ? { ...result.reviewVerdict } : undefined,
      analyticsTasks: result.analyticsTasks.map((task) => ({ ...task })),
      analyticsFindings: result.analyticsFindings.map((finding) => ({ ...finding })),
      trace: result.trace.map((step: DispatcherTraceStep) => ({ ...step })),
    };
  }
}
