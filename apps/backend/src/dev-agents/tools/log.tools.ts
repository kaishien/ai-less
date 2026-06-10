import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { tool } from 'langchain';
import * as z from 'zod';
import { sessionLogBuffer } from '../logs/session-log-buffer';

const execFileAsync = promisify(execFile);
const MAX_CONTEXT_LINES = 40;

export const getRecentBackendLogsTool = tool(
  async ({ limit, level }) => {
    const logs = sessionLogBuffer.list({
      limit,
      level: level === 'all' ? 'all' : level,
    });

    return logs
      .map((entry) => {
        const stack = entry.stack ? `\n${entry.stack}` : '';
        return `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message}${stack}`;
      })
      .join('\n\n');
  },
  {
    name: 'get_recent_backend_logs',
    description: 'Read recent logs captured from the current backend process. Secrets are redacted.',
    schema: z.object({
      limit: z.number().int().min(1).max(200).describe('Number of log records to read. Use 80 unless asked otherwise.'),
      level: z.enum(['error', 'warn', 'log', 'debug', 'all']).describe('Log level filter. Use error for latest error analysis.'),
    }),
  },
);

export const readSourceContextTool = tool(
  async ({ filepath, lineNumber, context }) => {
    const safeContext = Math.max(1, Math.min(context, MAX_CONTEXT_LINES));
    const repoRoot = await getRepoRoot();
    const resolvedPath = resolve(repoRoot, filepath);

    if (!isInsidePath(resolvedPath, repoRoot)) {
      return `Refusing to read outside repository root: ${filepath}`;
    }

    try {
      const content = await readFile(resolvedPath, 'utf8');
      const lines = content.split(/\r?\n/);
      const start = Math.max(1, lineNumber - safeContext);
      const end = Math.min(lines.length, lineNumber + safeContext);

      return lines
        .slice(start - 1, end)
        .map((line, index) => {
          const number = start + index;
          const marker = number === lineNumber ? '>' : ' ';
          return `${marker} ${String(number).padStart(4, ' ')} | ${line}`;
        })
        .join('\n');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown source read error';
      return `Could not read source context for ${filepath}:${lineNumber}: ${message}`;
    }
  },
  {
    name: 'read_source_context',
    description: 'Read source code lines around a repository file and line number.',
    schema: z.object({
      filepath: z.string().min(1).describe('Repository-relative source file path from a stack trace.'),
      lineNumber: z.number().int().min(1).describe('One-based line number to inspect.'),
      context: z.number().int().min(1).max(MAX_CONTEXT_LINES).describe('Number of lines before and after the target line. Use 10 by default.'),
    }),
  },
);

export async function getRepoRoot() {
  if (process.env.DEV_AGENTS_REPO_PATH) {
    return resolve(process.env.DEV_AGENTS_REPO_PATH);
  }

  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
      cwd: process.cwd(),
      timeout: 5_000,
    });

    return stdout.toString().trim();
  } catch {
    return process.cwd();
  }
}

function isInsidePath(path: string, parent: string) {
  const rel = relative(parent, path);
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith('/'));
}
