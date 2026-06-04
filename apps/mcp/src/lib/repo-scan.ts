import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getMoscowIsoTime } from "./time.js";

const MAX_SEARCH_FILE_BYTES = 2_000_000;
const CODE_FILE_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".css",
  ".go",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".mjs",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".scss",
  ".sh",
  ".swift",
  ".ts",
  ".tsx",
  ".vue",
]);
const IGNORED_REPO_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "vendor",
]);

export const DEFAULT_REPO_PATH = "/Users/dmitriy.vrnn/HomeProjects/ai-less";

interface TodoItem {
  file: string;
  line: number;
  kind: string;
  text: string;
  symbol: string | null;
  snippet: string;
}

export interface TodoReport {
  root: string;
  scannedFiles: number;
  todos: TodoItem[];
}

function isCodeFile(filePath: string): boolean {
  return CODE_FILE_EXTENSIONS.has(path.extname(filePath));
}

async function walkCodeFiles(root: string, limit: number): Promise<string[]> {
  const result: string[] = [];

  async function visit(directory: string): Promise<void> {
    if (result.length >= limit) {
      return;
    }

    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (result.length >= limit) {
        return;
      }

      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && !IGNORED_REPO_DIRECTORIES.has(entry.name)) {
          await visit(absolutePath);
        }
      } else if (entry.isFile() && isCodeFile(absolutePath)) {
        result.push(absolutePath);
      }
    }
  }

  await visit(root);
  return result;
}

function detectSymbol(line: string): string | null {
  const patterns = [
    /\bclass\s+([A-Za-z_$][\w$]*)/,
    /\bfunction\s+([A-Za-z_$][\w$]*)/,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/,
    /^\s*(?:public\s+|private\s+|protected\s+|static\s+|async\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*[{:]/,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function findNearbySymbol(lines: string[], todoLineIndex: number): string | null {
  for (let index = todoLineIndex; index < Math.min(lines.length, todoLineIndex + 9); index += 1) {
    const symbol = detectSymbol(lines[index]);
    if (symbol) {
      return symbol;
    }
  }

  for (let index = todoLineIndex - 1; index >= Math.max(0, todoLineIndex - 40); index -= 1) {
    const symbol = detectSymbol(lines[index]);
    if (symbol) {
      return symbol;
    }
  }

  return null;
}

function extractTodoText(line: string): { kind: string; text: string } | null {
  const match = line.match(/\b(TODO|FIXME|HACK|NOTE)\b\s*:?\s*(.*)$/i);

  if (!match) {
    return null;
  }

  return {
    kind: match[1].toUpperCase(),
    text: match[2].trim() || line.trim(),
  };
}

function getSnippet(lines: string[], lineIndex: number): string {
  const start = Math.max(0, lineIndex - 1);
  const end = Math.min(lines.length, lineIndex + 4);
  return lines.slice(start, end).join("\n").trim();
}

export async function collectTodoComments(repoPath: string, fileLimit: number, itemLimit: number): Promise<TodoReport> {
  const root = path.resolve(repoPath);
  const files = await walkCodeFiles(root, fileLimit);
  const todos: TodoItem[] = [];

  for (const file of files) {
    if (todos.length >= itemLimit) {
      break;
    }

    const metadata = await stat(file);
    if (metadata.size > MAX_SEARCH_FILE_BYTES) {
      continue;
    }

    const lines = (await readFile(file, "utf8")).split(/\r?\n/);
    for (let index = 0; index < lines.length && todos.length < itemLimit; index += 1) {
      const todo = extractTodoText(lines[index]);
      if (!todo) {
        continue;
      }

      todos.push({
        file: path.relative(root, file),
        line: index + 1,
        kind: todo.kind,
        text: todo.text,
        symbol: findNearbySymbol(lines, index),
        snippet: getSnippet(lines, index),
      });
    }
  }

  return {
    root,
    scannedFiles: files.length,
    todos,
  };
}

function markdownCodeFence(file: string): string {
  const extension = path.extname(file).slice(1);

  if (extension === "tsx" || extension === "jsx") {
    return extension;
  }

  if (extension === "ts" || extension === "js" || extension === "py" || extension === "go" || extension === "rs") {
    return extension;
  }

  return "";
}

export function formatTodoReport(report: TodoReport): string {
  const grouped = new Map<string, TodoItem[]>();

  for (const todo of report.todos) {
    const existing = grouped.get(todo.file) ?? [];
    existing.push(todo);
    grouped.set(todo.file, existing);
  }

  const lines = [
    "# Code TODO Report",
    "",
    `Generated: ${getMoscowIsoTime()}`,
    `Repository: \`${report.root}\``,
    `Scanned files: ${report.scannedFiles}`,
    `Items found: ${report.todos.length}`,
    "",
  ];

  if (report.todos.length === 0) {
    lines.push("No TODO-style comments found.");
    return lines.join("\n");
  }

  for (const [file, todos] of grouped) {
    lines.push(`## ${file}`, "");

    for (const todo of todos) {
      lines.push(`### ${todo.kind} at line ${todo.line}`);
      lines.push("");
      lines.push(`- Function/class: ${todo.symbol ? `\`${todo.symbol}\`` : "not detected"}`);
      lines.push(`- Task: ${todo.text}`);
      lines.push(`- Location: \`${file}:${todo.line}\``);
      lines.push("");
      lines.push(`\`\`\`${markdownCodeFence(file)}`);
      lines.push(todo.snippet);
      lines.push("```", "");
    }
  }

  return lines.join("\n");
}

export async function writeMarkdownFile(filePath: string, markdown: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, markdown, "utf8");
}
