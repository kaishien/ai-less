import { Body, Controller, Get, Inject, Post, Query, Res } from '@nestjs/common';
import { writeNdjsonResponse } from '../common/streaming/ndjson-response';
import { DevAgentsService } from './dev-agents.service';
import {
  AnalyzeSessionLogsRequest,
  AnalyzeSessionLogsResponse,
  AnalyzeSessionLogsStreamEvent,
  CaptureSessionLogRequest,
  CommitMessageRequest,
  CommitMessageResponse,
  CurrentDiffRequest,
  CurrentDiffResponse,
  DevAgentsStreamEvent,
  EnvAuditRequest,
  EnvAuditResponse,
  GitCommitAgentRequest,
  GitCommitAgentResponse,
  ReadmeGenerateRequest,
  ReadmeGenerateStreamEvent,
  ReadmeSaveRequest,
  ReadmeSaveResponse,
  SessionLogFilter,
  SessionLogsResponse,
  TriggerSessionLogTestErrorRequest,
} from './dev-agents.types';

@Controller('dev-agents')
export class DevAgentsController {
  constructor(@Inject(DevAgentsService) private readonly devAgentsService: DevAgentsService) {}

  @Post('current-diff')
  getCurrentDiff(@Body() body: CurrentDiffRequest = {}): Promise<CurrentDiffResponse> {
    return this.devAgentsService.getCurrentDiff(body);
  }

  @Post('commit-message')
  generateCommitMessage(@Body() body: CommitMessageRequest): Promise<CommitMessageResponse> {
    return this.devAgentsService.generateCommitMessage(body);
  }

  @Post('commit-message/stream')
  async streamCommitMessage(@Body() body: CommitMessageRequest, @Res() response: any) {
    await writeNdjsonResponse(response, this.streamCommitEvents(body));
  }

  @Post('git-commit')
  suggestGitCommit(@Body() body: GitCommitAgentRequest = {}): Promise<GitCommitAgentResponse> {
    return this.devAgentsService.suggestGitCommit(body);
  }

  @Post('env-audit')
  auditEnv(@Body() body: EnvAuditRequest = {}): Promise<EnvAuditResponse> {
    return this.devAgentsService.auditEnv(body);
  }

  @Post('readme/stream')
  async streamGenerateReadme(@Body() body: ReadmeGenerateRequest = {}, @Res() response: any) {
    await writeNdjsonResponse(response, this.streamReadmeGenerateEvents(body));
  }

  @Post('readme/save')
  saveReadme(@Body() body: ReadmeSaveRequest): Promise<ReadmeSaveResponse> {
    return this.devAgentsService.saveGeneratedReadme(body);
  }

  @Get('session-logs')
  getSessionLogs(@Query('level') level?: SessionLogFilter, @Query('limit') limit?: string): SessionLogsResponse {
    return this.devAgentsService.getSessionLogs({
      level,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('session-logs')
  captureSessionLog(@Body() body: CaptureSessionLogRequest): SessionLogsResponse {
    return this.devAgentsService.captureSessionLog(body);
  }

  @Post('session-logs/test-error')
  triggerSessionLogTestError(@Body() body: TriggerSessionLogTestErrorRequest = {}): Promise<never> {
    return this.devAgentsService.triggerSessionLogTestError(body);
  }

  @Post('session-logs/analyze')
  analyzeSessionLogs(@Body() body: AnalyzeSessionLogsRequest = {}): Promise<AnalyzeSessionLogsResponse> {
    return this.devAgentsService.analyzeSessionLogs(body);
  }

  @Post('session-logs/analyze/stream')
  async streamAnalyzeSessionLogs(@Body() body: AnalyzeSessionLogsRequest = {}, @Res() response: any) {
    await writeNdjsonResponse(response, this.streamSessionLogAnalysisEvents(body));
  }

  private async *streamCommitEvents(body: CommitMessageRequest): AsyncGenerator<DevAgentsStreamEvent> {
    let text = '';

    try {
      for await (const delta of this.devAgentsService.streamCommitMessage(body)) {
        text += delta;
        yield { type: 'delta', delta };
      }

      yield { type: 'done', text };
    } catch (error) {
      yield {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown commit stream error',
      };
    }
  }

  private async *streamSessionLogAnalysisEvents(
    body: AnalyzeSessionLogsRequest,
  ): AsyncGenerator<AnalyzeSessionLogsStreamEvent> {
    try {
      yield* this.devAgentsService.streamAnalyzeSessionLogs(body);
    } catch (error) {
      yield {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown session log analysis stream error',
      };
    }
  }

  private async *streamReadmeGenerateEvents(body: ReadmeGenerateRequest): AsyncGenerator<ReadmeGenerateStreamEvent> {
    try {
      yield* this.devAgentsService.streamGenerateReadme(body);
    } catch (error) {
      yield {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown README generation stream error',
      };
    }
  }
}
