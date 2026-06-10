import { Inject, Injectable } from '@nestjs/common';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createAgent } from 'langchain';
import * as z from 'zod';
import {
  CommitMessage,
  CommitMessageRequest,
  CommitMessageResponse,
  CurrentDiffMode,
  CurrentDiffRequest,
  CurrentDiffResponse,
  EnvAuditRequest,
  EnvAuditResponse,
  GitCommitAgentRequest,
  GitCommitAgentResponse,
  ReadmeGenerateRequest,
  ReadmeGenerateStreamEvent,
  ReadmeSaveRequest,
  ReadmeSaveResponse,
  AnalyzeSessionLogsStreamEvent,
  AnalyzeSessionLogsRequest,
  AnalyzeSessionLogsResponse,
  CaptureSessionLogRequest,
  SessionLogsRequest,
  SessionLogsResponse,
  TriggerSessionLogTestErrorRequest,
} from './dev-agents.types';
import { getCurrentDiff, getRecentCommitsTool, getStagedDiffTool } from './tools/git.tools';
import { readEnvKeys, readEnvKeysTool } from './tools/env.tools';
import { DevAgentsModelFactory } from './dev-agents-model.factory';
import { ReadmeGeneratorService } from './readme-generator.service';
import { SessionLogsService } from './session-logs.service';
import { createLangfuseConfig } from '../common/langfuse/langfuse-tracing';

const CommitMessageSchema = z
  .object({
    type: z.enum(['feat', 'fix', 'refactor', 'docs', 'chore']),
    scope: z.string().nullable(),
    description: z.string().min(1),
  })
  .describe('Conventional commit message components.');

const GitCommitAgentSchema = z.object({
  commit: z.string().describe('One conventional commit line, for example fix(auth): handle missing token'),
  summary: z.string().describe('Short reason for the chosen type and scope.'),
});

const EnvAuditSchema = z.object({
  missing: z.array(z.string()).describe('Keys present in .env.example but absent in .env.'),
  extra: z.array(z.string()).describe('Keys present in .env but absent in .env.example.'),
  matching: z.array(z.string()).describe('Keys present in both files.'),
  summary: z.string().describe('Short human-readable summary.'),
});

@Injectable()
export class DevAgentsService {
  constructor(
    @Inject(DevAgentsModelFactory) private readonly modelFactory: DevAgentsModelFactory,
    @Inject(ReadmeGeneratorService) private readonly readmeGenerator: ReadmeGeneratorService,
    @Inject(SessionLogsService) private readonly sessionLogs: SessionLogsService,
  ) {}

  async getCurrentDiff(request: CurrentDiffRequest = {}): Promise<CurrentDiffResponse> {
    const mode = this.normalizeDiffMode(request.mode);
    const diff = await getCurrentDiff(mode);

    return {
      diff,
      mode,
      isEmpty: diff.length === 0,
    };
  }

  async generateCommitMessage(request: CommitMessageRequest): Promise<CommitMessageResponse> {
    const diff = request.diff?.trim();

    if (!diff) {
      throw new Error('diff is required');
    }

    const chain = this.createCommitMessageChain();
    const message = await chain.invoke(
      { diff },
      createLangfuseConfig({
        name: 'dev-agents.commit-message.generate',
        sessionId: request.sessionId,
        tags: ['commit-message'],
        metadata: { diffLength: diff.length },
      }),
    );

    return {
      message,
      conventionalCommit: this.formatCommitMessage(message),
    };
  }

  async *streamCommitMessage(request: CommitMessageRequest): AsyncGenerator<string> {
    const diff = request.diff?.trim();

    if (!diff) {
      throw new Error('diff is required');
    }

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'Ты — эксперт Conventional Commits. Верни только одну строку commit message.'],
      ['human', 'Diff:\n{diff}'],
    ]);
    const chain = prompt.pipe(this.modelFactory.createChatModel({ temperature: 0.1 }));
    const stream = await chain.stream(
      { diff },
      createLangfuseConfig({
        name: 'dev-agents.commit-message.stream',
        sessionId: request.sessionId,
        tags: ['commit-message', 'stream'],
        metadata: { diffLength: diff.length },
      }),
    );

    for await (const chunk of stream) {
      const content = typeof chunk.content === 'string' ? chunk.content : '';
      if (content) {
        yield content;
      }
    }
  }

  async suggestGitCommit(request: GitCommitAgentRequest = {}): Promise<GitCommitAgentResponse> {
    const agent = createAgent({
      model: this.modelFactory.createChatModel({ temperature: 0.1 }),
      tools: [getStagedDiffTool, getRecentCommitsTool],
      systemPrompt:
        'Ты — эксперт Conventional Commits. Сначала вызови get_staged_diff и get_recent_commits. ' +
        'Если staged diff пустой, верни chore: no staged changes. ' +
        'Иначе предложи ровно один commit в формате type(scope): description, учитывая стиль последних коммитов.',
      responseFormat: GitCommitAgentSchema,
    });

    const result = await agent.invoke(
      {
        messages: [
          {
            role: 'user',
            content: `Предложи commit message для staged changes. Прочитай ${request.recentCommitCount ?? 5} последних коммитов.`,
          },
        ],
      },
      createLangfuseConfig({
        name: 'dev-agents.git-commit.analyze-staged',
        sessionId: request.sessionId,
        tags: ['git-commit'],
        metadata: { recentCommitCount: request.recentCommitCount ?? 5 },
      }),
    );

    return result.structuredResponse as GitCommitAgentResponse;
  }

  async auditEnv(request: EnvAuditRequest = {}): Promise<EnvAuditResponse> {
    const examplePath = request.examplePath?.trim() || '.env.example';
    const envPath = request.envPath?.trim() || '.env';

    const agent = createAgent({
      model: this.modelFactory.createChatModel({ temperature: 0 }),
      tools: [readEnvKeysTool],
      systemPrompt:
        'Ты аудитор env-файлов. Вызови read_env_keys для examplePath и envPath. ' +
        'Сравни только имена ключей. Никогда не запрашивай и не выводи значения переменных.',
      responseFormat: EnvAuditSchema,
    });

    const result = await agent.invoke(
      {
        messages: [
          {
            role: 'user',
            content:
              `Сравни env-файлы. examplePath=${examplePath}; envPath=${envPath}. ` +
              'Верни missing, extra, matching и краткий summary.',
          },
        ],
      },
      createLangfuseConfig({
        name: 'dev-agents.env-audit',
        sessionId: request.sessionId,
        tags: ['env-audit'],
        metadata: { examplePath, envPath },
      }),
    );

    const response = result.structuredResponse as EnvAuditResponse;

    // Keep the safety-critical comparison deterministic even if the LLM summarizes poorly.
    return {
      ...response,
      ...(await this.auditEnvDeterministically(examplePath, envPath)),
    };
  }

  async *streamGenerateReadme(request: ReadmeGenerateRequest = {}): AsyncGenerator<ReadmeGenerateStreamEvent> {
    yield* this.readmeGenerator.streamGenerateReadme(request);
  }

  async saveGeneratedReadme(request: ReadmeSaveRequest): Promise<ReadmeSaveResponse> {
    return this.readmeGenerator.saveGeneratedReadme(request);
  }

  captureSessionLog(request: CaptureSessionLogRequest): SessionLogsResponse {
    return this.sessionLogs.captureSessionLog(request);
  }

  getSessionLogs(request: SessionLogsRequest = {}): SessionLogsResponse {
    return this.sessionLogs.getSessionLogs(request);
  }

  async triggerSessionLogTestError(request: TriggerSessionLogTestErrorRequest = {}): Promise<never> {
    return this.sessionLogs.triggerSessionLogTestError(request);
  }

  async analyzeSessionLogs(request: AnalyzeSessionLogsRequest = {}): Promise<AnalyzeSessionLogsResponse> {
    return this.sessionLogs.analyzeSessionLogs(request);
  }

  async *streamAnalyzeSessionLogs(
    request: AnalyzeSessionLogsRequest = {},
  ): AsyncGenerator<AnalyzeSessionLogsStreamEvent> {
    yield* this.sessionLogs.streamAnalyzeSessionLogs(request);
  }

  private createCommitMessageChain() {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'Ты — эксперт Conventional Commits. Классифицируй diff строго по схеме.'],
      [
        'human',
        'Diff:\n{diff}\n\nВерни type, scope и description. Description должен быть кратким imperative sentence без точки.',
      ],
    ]);

    return prompt.pipe(
      this.modelFactory.createChatModel({ temperature: 0.1 }).withStructuredOutput(CommitMessageSchema, {
        name: 'CommitMessage',
        strict: true,
      }),
    );
  }

  private formatCommitMessage(message: CommitMessage) {
    const scope = message.scope ? `(${message.scope})` : '';
    return `${message.type}${scope}: ${message.description}`;
  }

  private normalizeDiffMode(mode: CurrentDiffRequest['mode']): CurrentDiffMode {
    return mode === 'staged' || mode === 'unstaged' || mode === 'all' ? mode : 'all';
  }

  private async auditEnvDeterministically(examplePath: string, envPath: string) {
    const [exampleKeys, envKeys] = await Promise.all([readEnvKeys(examplePath), readEnvKeys(envPath)]);
    const exampleSet = new Set(exampleKeys);
    const envSet = new Set(envKeys);
    const missing = exampleKeys.filter((key) => !envSet.has(key));
    const extra = envKeys.filter((key) => !exampleSet.has(key));
    const matching = exampleKeys.filter((key) => envSet.has(key));

    return {
      missing,
      extra,
      matching,
      summary: `Missing: ${missing.length}; extra: ${extra.length}; matching: ${matching.length}.`,
    };
  }
}
