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
}
