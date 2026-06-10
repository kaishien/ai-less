import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tool } from 'langchain';
import * as z from 'zod';

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_DIFF_CHARS = 24_000;
const MAX_LOG_CHARS = 8_000;
const DIFF_SEPARATOR = '\n\n# --- staged changes above / unstaged tracked changes below ---\n\n';

async function runGit(args: string[]) {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: process.env.DEV_AGENTS_REPO_PATH ?? process.cwd(),
      timeout: DEFAULT_TIMEOUT_MS,
      maxBuffer: 1024 * 1024 * 2,
    });

    return stdout.toString();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown git error';
    return `Git command failed: ${message}`;
  }
}

function truncate(value: string, maxChars: number) {
  return value.length > maxChars ? `${value.slice(0, maxChars)}\n\n[truncated ${value.length - maxChars} chars]` : value;
}

export async function getCurrentDiff(mode: 'unstaged' | 'staged' | 'all' = 'all') {
  if (mode === 'staged') {
    return truncate((await runGit(['diff', '--staged'])).trim(), MAX_DIFF_CHARS);
  }

  if (mode === 'unstaged') {
    return truncate((await runGit(['diff'])).trim(), MAX_DIFF_CHARS);
  }

  const [staged, unstaged] = await Promise.all([runGit(['diff', '--staged']), runGit(['diff'])]);
  const parts = [staged.trim(), unstaged.trim()].filter(Boolean);

  return truncate(parts.join(DIFF_SEPARATOR), MAX_DIFF_CHARS);
}

export const getStagedDiffTool = tool(
  async () => {
    const diff = await getCurrentDiff('staged');
    return truncate(diff.trim() || 'No staged changes found.', MAX_DIFF_CHARS);
  },
  {
    name: 'get_staged_diff',
    description: 'Read the current git staged diff with git diff --staged. This tool is read-only.',
    schema: z.object({}),
  },
);

export const getRecentCommitsTool = tool(
  async ({ n }) => {
    const limit = Math.max(1, Math.min(n, 20));
    const log = await runGit(['log', '--oneline', `-${limit}`]);
    return truncate(log.trim() || 'No recent commits found.', MAX_LOG_CHARS);
  },
  {
    name: 'get_recent_commits',
    description: 'Read recent commit subjects with git log --oneline -N. This tool is read-only.',
    schema: z.object({
      n: z.number().int().min(1).max(20).describe('Number of recent commits to read. Use 5 unless the user asks otherwise.'),
    }),
  },
);
