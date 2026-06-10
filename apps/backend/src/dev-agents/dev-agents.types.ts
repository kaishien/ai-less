export interface DevAgentsTraceContext {
  sessionId?: string;
}

export type CommitType = 'feat' | 'fix' | 'refactor' | 'docs' | 'chore';

export interface CommitMessage {
  type: CommitType;
  scope: string | null;
  description: string;
}

export interface CommitMessageRequest extends DevAgentsTraceContext {
  diff: string;
}

export interface CommitMessageResponse {
  message: CommitMessage;
  conventionalCommit: string;
}

export type CurrentDiffMode = 'unstaged' | 'staged' | 'all';

export interface CurrentDiffRequest {
  mode?: CurrentDiffMode;
}

export interface CurrentDiffResponse {
  diff: string;
  mode: CurrentDiffMode;
  isEmpty: boolean;
}

export interface GitCommitAgentRequest extends DevAgentsTraceContext {
  recentCommitCount?: number;
}

export interface GitCommitAgentResponse {
  commit: string;
  summary: string;
}

export interface EnvAuditRequest extends DevAgentsTraceContext {
  examplePath?: string;
  envPath?: string;
}

export interface EnvAuditResponse {
  missing: string[];
  extra: string[];
  matching: string[];
  summary: string;
}

export interface ReadmeGenerateRequest extends DevAgentsTraceContext {
  projectPath?: string;
}

export interface ReadmeSaveRequest extends DevAgentsTraceContext {
  outputPath?: string;
  content: string;
}

export interface ReadmeSaveResponse {
  path: string;
  message: string;
}

export type SessionLogLevel = 'log' | 'warn' | 'error' | 'debug';
export type SessionLogFilter = SessionLogLevel | 'all';

export interface SessionLogEntryDto {
  id: string;
  timestamp: string;
  level: SessionLogLevel;
  message: string;
  stack?: string;
}

export interface SessionLogsRequest {
  limit?: number;
  level?: SessionLogFilter;
}

export interface CaptureSessionLogRequest {
  level: SessionLogLevel;
  message: string;
  stack?: string;
  source?: string;
}

export type SessionLogTestErrorKind = 'enoent' | 'type-error' | 'generic';

export interface TriggerSessionLogTestErrorRequest {
  kind?: SessionLogTestErrorKind;
}

export interface SessionLogsResponse {
  logs: SessionLogEntryDto[];
}

export interface AnalyzeSessionLogsRequest extends DevAgentsTraceContext {
  limit?: number;
  level?: SessionLogFilter;
  contextLines?: number;
}

export interface AnalyzeSessionLogsResponse {
  errorType: string;
  filePath: string | null;
  lineNumber: number | null;
  cause: string;
  fix: string;
  sourceContext: string | null;
}

export type DevAgentsStreamEvent =
  | {
      type: 'delta';
      delta: string;
    }
  | {
      type: 'done';
      text: string;
    }
  | {
      type: 'error';
      message: string;
    };

export type AnalyzeSessionLogsStreamEvent =
  | {
      type: 'status';
      message: string;
    }
  | {
      type: 'delta';
      delta: string;
    }
  | {
      type: 'done';
      result: AnalyzeSessionLogsResponse;
    }
  | {
      type: 'error';
      message: string;
    };

export type ReadmeGenerateStreamEvent =
  | {
      type: 'status';
      message: string;
    }
  | {
      type: 'delta';
      delta: string;
    }
  | {
      type: 'done';
      text: string;
    }
  | {
      type: 'error';
      message: string;
    };
