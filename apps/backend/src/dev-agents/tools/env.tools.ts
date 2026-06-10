import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tool } from 'langchain';
import * as z from 'zod';

const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseEnvKeys(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.replace(/^export\s+/, ''))
    .map((line) => line.split('=')[0]?.trim() ?? '')
    .filter((key) => ENV_KEY_PATTERN.test(key));
}

export async function readEnvKeys(path: string) {
  const resolvedPath = resolve(process.env.DEV_AGENTS_REPO_PATH ?? process.cwd(), path);
  const content = await readFile(resolvedPath, 'utf8');
  return Array.from(new Set(parseEnvKeys(content))).sort();
}

export const readEnvKeysTool = tool(
  async ({ path }) => {
    try {
      return (await readEnvKeys(path)).join('\n');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown file read error';
      return `Could not read env keys from ${path}: ${message}`;
    }
  },
  {
    name: 'read_env_keys',
    description:
      'Read an env file and return only variable names, one per line. Never returns values or secrets.',
    schema: z.object({
      path: z.string().min(1).describe('Path to .env or .env.example, relative to the repository root.'),
    }),
  },
);
