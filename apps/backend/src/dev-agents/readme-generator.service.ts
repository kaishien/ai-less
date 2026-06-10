import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { startObservation } from '@langfuse/tracing';
import type { LangfuseObservation } from '@langfuse/tracing';
import * as z from 'zod';
import {
  ReadmeGenerateRequest,
  ReadmeGenerateStreamEvent,
  ReadmeSaveRequest,
  ReadmeSaveResponse,
} from './dev-agents.types';
import {
  getProjectStructureTool,
  readProjectFileTool,
  readPyprojectTool,
  writeProjectFileTool,
} from './tools/readme.tools';
import { DevAgentsModelFactory } from './dev-agents-model.factory';
import { createLangfuseConfig } from '../common/langfuse/langfuse-tracing';
import { isLangfuseEnabled } from '../common/langfuse/langfuse-env';

const ReadmeFileSelectionSchema = z.object({
  files: z
    .array(z.string())
    .max(8)
    .describe('Project-relative or repository-relative files worth reading before drafting the README.'),
});

type ReadmeObservationType = 'agent' | 'chain' | 'generation' | 'tool';
type ReadmeObservation = LangfuseObservation & {
  update: (attributes: Record<string, unknown>) => void;
};

@Injectable()
export class ReadmeGeneratorService {
  constructor(private readonly modelFactory: DevAgentsModelFactory) {}

  async *streamGenerateReadme(request: ReadmeGenerateRequest = {}): AsyncGenerator<ReadmeGenerateStreamEvent> {
    const projectPath = request.projectPath?.trim() || '.';
    const trace = this.startReadmeObservation('README Generator agent', { projectPath, sessionId: request.sessionId }, 'agent');
    const tools = this.startReadmeChildObservation(trace, 'tools', { projectPath }, 'chain');
    let markdown = '';
    let toolsEnded = false;

    try {
      yield { type: 'status', message: 'Calling read_pyproject and get_project_structure tools' };

      const [manifest, structure] = await Promise.all([
        this.invokeReadmeTool(tools, 'read_pyproject', { path: projectPath }, () => readPyprojectTool.invoke({ path: projectPath })),
        this.invokeReadmeTool(tools, 'get_project_structure', { path: projectPath, depth: 2 }, () =>
          getProjectStructureTool.invoke({ path: projectPath, depth: 2 }),
        ),
      ]);
      const selectedFiles = await this.selectReadmeFiles(projectPath, String(manifest), String(structure), trace);
      const fileContexts: string[] = [];

      yield { type: 'status', message: 'Calling read_file tools for selected entry files' };

      for (const filePath of selectedFiles) {
        const content = await this.tryReadReadmeCandidate(filePath, tools);

        if (content) {
          fileContexts.push(`# ${filePath}\n${content}`);
        }
      }
      this.endReadmeObservation(tools, { selectedFiles, readFiles: fileContexts.length });
      toolsEnded = true;

      yield { type: 'status', message: 'Streaming README draft' };

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          'Ты README Generator агент. Нужно изучить проект и подготовить README.md с нуля. ' +
            'Верни только markdown README без обрамляющих ``` блоков. ' +
            'README должен содержать секции: Description, Installation, Usage, Project Structure. ' +
            'Если реальный README есть в контексте, учти расхождения, но не копируй его дословно. ' +
            'Не утверждай того, чего нет в manifest, structure или file excerpts.',
        ],
        [
          'human',
          'Project path: {projectPath}\n\n' +
            'Manifest:\n{manifest}\n\n' +
            'Project structure:\n{structure}\n\n' +
            'Selected file excerpts:\n{fileContexts}\n\n' +
            'Сгенерируй README draft. Сохранять файл пока нельзя.',
        ],
      ]);
      const chainInput = {
        projectPath,
        manifest: String(manifest),
        structure: String(structure),
        fileContexts: fileContexts.length > 0 ? fileContexts.join('\n\n') : 'No entrypoint excerpts were found.',
      };
      const generation = this.startReadmeChildObservation(trace, 'ChatOpenAI README draft stream', chainInput, 'generation');
      const chain = prompt.pipe(this.modelFactory.createChatModel({ temperature: 0.2 }));
      const stream = await chain.stream(chainInput);

      for await (const chunk of stream) {
        const content = typeof chunk.content === 'string' ? chunk.content : '';

        if (content) {
          markdown += content;
          yield { type: 'delta', delta: content };
        }
      }

      this.endReadmeObservation(generation, markdown.trim());
      this.endReadmeObservation(trace, markdown.trim());
    } catch (error) {
      if (!toolsEnded) {
        this.endReadmeObservation(tools, undefined, error);
      }
      this.endReadmeObservation(trace, undefined, error);
      throw error;
    }

    yield { type: 'done', text: markdown.trim() };
  }

  async saveGeneratedReadme(request: ReadmeSaveRequest): Promise<ReadmeSaveResponse> {
    const outputPath = request.outputPath?.trim() || 'README_generated.md';
    const content = request.content?.trim();

    if (!content) {
      throw new HttpException(
        {
          message: 'README content is required.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const message = await writeProjectFileTool.invoke(
      { path: outputPath, content },
      createLangfuseConfig({
        name: 'dev-agents.readme.save',
        sessionId: request.sessionId,
        tags: ['readme-generator', 'write-file'],
        metadata: { outputPath },
      }),
    );

    return {
      path: outputPath,
      message: String(message),
    };
  }

  private async selectReadmeFiles(
    projectPath: string,
    manifest: string,
    structure: string,
    parentObservation: ReadmeObservation | null,
  ) {
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'Ты выбираешь файлы, которые нужно прочитать перед генерацией README. ' +
          'Верни только существующие пути из структуры. Предпочитай README.md, main.py, app.py, agent.py, package.json, src/main.ts, src/app.module.ts и близкие entrypoints. ' +
          'Если projectPath не ".", можно вернуть пути относительно projectPath.',
      ],
      [
        'human',
        'Project path: {projectPath}\n\nManifest:\n{manifest}\n\nProject structure:\n{structure}\n\nВыбери до 8 файлов для read_file.',
      ],
    ]);
    const selector = prompt.pipe(
      this.modelFactory.createChatModel({ temperature: 0 }).withStructuredOutput(ReadmeFileSelectionSchema, {
        name: 'ReadmeFileSelection',
        strict: true,
      }),
    );
    const input = { projectPath, manifest, structure };
    const observation = this.startReadmeChildObservation(parentObservation, 'select_readme_files', input, 'chain');
    const result = await selector.invoke(input);
    this.endReadmeObservation(observation, result);
    const modelFiles = result.files
      .map((file) => this.normalizeReadmeCandidatePath(projectPath, file))
      .filter((file) => !file.includes('..'));
    const fallbackFiles = this.getFallbackReadmeCandidateFiles(projectPath, structure);

    return Array.from(new Set([...modelFiles, ...fallbackFiles])).slice(0, 8);
  }

  private getFallbackReadmeCandidateFiles(projectPath: string, structure: string) {
    const basePath = projectPath === '.' ? '' : `${projectPath.replace(/\/+$/, '')}/`;
    const candidates = [
      'README.md',
      'main.py',
      'app.py',
      'agent.py',
      'package.json',
      'src/main.ts',
      'src/app.module.ts',
      'src/App.tsx',
      'src/pages/dev-agents/dev-agents-page.tsx',
    ];

    return candidates
      .filter((candidate) => this.structureContainsPath(structure, candidate))
      .map((candidate) => `${basePath}${candidate}`);
  }

  private normalizeReadmeCandidatePath(projectPath: string, file: string) {
    const trimmedFile = file.trim().replace(/^\.\/+/, '');

    if (!trimmedFile || projectPath === '.' || trimmedFile.startsWith(`${projectPath.replace(/\/+$/, '')}/`)) {
      return trimmedFile;
    }

    return `${projectPath.replace(/\/+$/, '')}/${trimmedFile}`;
  }

  private structureContainsPath(structure: string, path: string) {
    const parts = path.split('/');
    return parts.every((part) => structure.includes(part));
  }

  private async tryReadReadmeCandidate(path: string, parentObservation: ReadmeObservation | null) {
    try {
      return String(
        await this.invokeReadmeTool(parentObservation, 'read_file', { path }, () => readProjectFileTool.invoke({ path })),
      );
    } catch {
      return null;
    }
  }

  private async invokeReadmeTool<T>(
    parentObservation: ReadmeObservation | null,
    name: string,
    input: Record<string, unknown>,
    fn: () => Promise<T>,
  ): Promise<T> {
    const observation = this.startReadmeChildObservation(parentObservation, name, input, 'tool');

    try {
      const output = await fn();
      this.endReadmeObservation(observation, output);
      return output;
    } catch (error) {
      this.endReadmeObservation(observation, undefined, error);
      throw error;
    }
  }

  private startReadmeObservation(name: string, input: Record<string, unknown>, asType: ReadmeObservationType) {
    if (!isLangfuseEnabled()) {
      return null;
    }

    switch (asType) {
      case 'agent':
        return startObservation(name, { input }, { asType: 'agent' });
      case 'chain':
        return startObservation(name, { input }, { asType: 'chain' });
      case 'generation':
        return startObservation(name, { input }, { asType: 'generation' });
      case 'tool':
        return startObservation(name, { input }, { asType: 'tool' });
    }
  }

  private startReadmeChildObservation(
    parentObservation: ReadmeObservation | null,
    name: string,
    input: unknown,
    asType: ReadmeObservationType,
  ) {
    if (!parentObservation) {
      return null;
    }

    switch (asType) {
      case 'agent':
        return parentObservation.startObservation(name, { input }, { asType: 'agent' });
      case 'chain':
        return parentObservation.startObservation(name, { input }, { asType: 'chain' });
      case 'generation':
        return parentObservation.startObservation(name, { input }, { asType: 'generation' });
      case 'tool':
        return parentObservation.startObservation(name, { input }, { asType: 'tool' });
    }
  }

  private endReadmeObservation(observation: ReadmeObservation | null, output?: unknown, error?: unknown) {
    if (!observation) {
      return;
    }

    if (error) {
      observation.update({
        level: 'ERROR',
        statusMessage: error instanceof Error ? error.message : 'Unknown README observation error',
      });
    } else {
      observation.update({
        output: this.truncateObservationValue(output),
      });
    }

    observation.end();
  }

  private truncateObservationValue(value: unknown) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);

    if (!text || text.length <= 12_000) {
      return value;
    }

    return `${text.slice(0, 12_000)}\n\n[truncated ${text.length - 12_000} chars]`;
  }
}
