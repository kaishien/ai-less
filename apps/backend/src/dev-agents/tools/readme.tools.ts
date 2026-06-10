import { execFile } from 'node:child_process';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { tool } from 'langchain';
import * as z from 'zod';

const execFileAsync = promisify(execFile);
const MAX_STRUCTURE_ENTRIES = 240;
const MAX_READ_FILE_LINES = 60;
const MAX_READ_FILE_CHARS = 12_000;
const MAX_WRITE_FILE_CHARS = 60_000;
const EXCLUDED_DIRS = new Set(['.git', '.next', '.turbo', 'coverage', 'dist', 'node_modules', '__pycache__']);

export const readPyprojectTool = tool(
  async ({ path }) => readProjectManifest(path),
  {
    name: 'read_pyproject',
    description: 'Read pyproject.toml or requirements.txt from a project directory. Falls back to package.json for JS projects.',
    schema: z.object({
      path: z.string().describe('Repository-relative project directory. Use "." unless the user provides a subdirectory.'),
    }),
  },
);

export const getProjectStructureTool = tool(
  async ({ path, depth }) => getProjectStructure(path, depth),
  {
    name: 'get_project_structure',
    description:
      'Return a compact file tree for a project directory, excluding .git, __pycache__, node_modules, dist and generated folders.',
    schema: z.object({
      path: z.string().describe('Repository-relative project directory. Use "." unless the user provides a subdirectory.'),
      depth: z.number().int().min(1).max(5).describe('Maximum directory depth. Use 2 by default.'),
    }),
  },
);

export const readProjectFileTool = tool(
  async ({ path }) => readProjectFile(path),
  {
    name: 'read_file',
    description: 'Read the first 60 lines of a repository file.',
    schema: z.object({
      path: z.string().min(1).describe('Repository-relative file path to read.'),
    }),
  },
);

export const writeProjectFileTool = tool(
  async ({ path, content }) => writeProjectFile(path, content),
  {
    name: 'write_file',
    description: 'Write a repository file. Use only after the user confirms the generated README draft.',
    schema: z.object({
      path: z.string().min(1).describe('Repository-relative output path. Use README_generated.md by default.'),
      content: z.string().min(1).describe('File content to write.'),
    }),
  },
);

export async function readProjectManifest(path = '.') {
  const projectRoot = await resolveInsideRepo(path);
  const repoRoot = await getRepoRoot();
  const candidates = ['pyproject.toml', 'requirements.txt', 'package.json'];

  for (const file of candidates) {
    const filePath = join(projectRoot, file);

    try {
      const content = await readFile(filePath, 'utf8');
      return `# ${relative(repoRoot, filePath)}\n${truncate(content, MAX_READ_FILE_CHARS)}`;
    } catch {
      // Try the next conventional manifest.
    }
  }

  return `No pyproject.toml, requirements.txt, or package.json found in ${path || '.'}.`;
}

export async function getProjectStructure(path = '.', depth = 2) {
  const projectRoot = await resolveInsideRepo(path);
  const maxDepth = Math.max(1, Math.min(depth, 5));
  const lines: string[] = [`${basename(projectRoot) || '.'}/`];
  let entries = 0;

  async function walk(currentPath: string, currentDepth: number, prefix: string) {
    if (currentDepth >= maxDepth || entries >= MAX_STRUCTURE_ENTRIES) {
      return;
    }

    const children = await readdir(currentPath, { withFileTypes: true });
    const visibleChildren = children
      .filter((child) => !shouldSkip(child.name))
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));

    for (const child of visibleChildren) {
      if (entries >= MAX_STRUCTURE_ENTRIES) {
        lines.push(`${prefix}...`);
        return;
      }

      entries += 1;
      const childPath = join(currentPath, child.name);
      const marker = child.isDirectory() ? '/' : '';
      lines.push(`${prefix}${child.name}${marker}`);

      if (child.isDirectory()) {
        await walk(childPath, currentDepth + 1, `${prefix}  `);
      }
    }
  }

  await walk(projectRoot, 0, '  ');
  return lines.join('\n');
}

export async function readProjectFile(path: string) {
  const filePath = await resolveInsideRepo(path);
  const fileStat = await stat(filePath);

  if (!fileStat.isFile()) {
    return `${path} is not a file.`;
  }

  const content = await readFile(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const excerpt = lines.slice(0, MAX_READ_FILE_LINES).join('\n');
  const suffix =
    lines.length > MAX_READ_FILE_LINES ? `\n\n[truncated ${lines.length - MAX_READ_FILE_LINES} lines]` : '';

  return truncate(excerpt, MAX_READ_FILE_CHARS) + suffix;
}

export async function writeProjectFile(path: string, content: string) {
  const outputPath = path.trim() || 'README_generated.md';
  const filePath = await resolveInsideRepo(outputPath);
  const normalizedContent = content.endsWith('\n') ? content : `${content}\n`;

  if (normalizedContent.length > MAX_WRITE_FILE_CHARS) {
    return `Refusing to write ${outputPath}: content is too large.`;
  }

  await writeFile(filePath, normalizedContent, 'utf8');

  return `Wrote ${relative(await getRepoRoot(), filePath)} (${normalizedContent.length} chars).`;
}

async function getRepoRoot() {
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

async function resolveInsideRepo(path: string) {
  const repoRoot = await getRepoRoot();
  const resolvedPath = resolve(repoRoot, path || '.');
  const relativePath = relative(repoRoot, resolvedPath);

  if (relativePath === '..' || relativePath.startsWith('..') || relativePath.startsWith('/')) {
    throw new Error(`Refusing to access outside repository root: ${path}`);
  }

  return resolvedPath;
}

function shouldSkip(name: string) {
  return EXCLUDED_DIRS.has(name) || name.endsWith('.tsbuildinfo') || name.endsWith('.log');
}

function truncate(value: string, maxChars: number) {
  return value.length > maxChars ? `${value.slice(0, maxChars)}\n\n[truncated ${value.length - maxChars} chars]` : value;
}
