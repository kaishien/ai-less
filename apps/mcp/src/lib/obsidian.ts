import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireEnv } from "./env.js";

const MAX_NOTE_BYTES = 1_000_000;
const MAX_SEARCH_FILE_BYTES = 2_000_000;

export const OBSIDIAN_VAULT_PATH = path.resolve(requireEnv("OBSIDIAN_VAULT_PATH"));

export function normalizeVaultRelativePath(relativePath: string): string {
  const normalized = relativePath.trim().replace(/\\/g, "/").replace(/^\/+/, "");

  if (normalized.length === 0) {
    throw new Error("Vault path cannot be empty.");
  }

  if (path.posix.isAbsolute(normalized) || normalized.split("/").includes("..")) {
    throw new Error("Vault path must be relative and cannot contain '..'.");
  }

  return normalized.endsWith(".md") ? normalized : `${normalized}.md`;
}

export function resolveVaultPath(relativePath: string): { absolutePath: string; relativePath: string } {
  const normalized = normalizeVaultRelativePath(relativePath);
  const absolutePath = path.resolve(OBSIDIAN_VAULT_PATH, normalized);

  if (absolutePath !== OBSIDIAN_VAULT_PATH && !absolutePath.startsWith(`${OBSIDIAN_VAULT_PATH}${path.sep}`)) {
    throw new Error("Resolved note path is outside of the Obsidian vault.");
  }

  return { absolutePath, relativePath: normalized };
}

export async function walkMarkdownFiles(root: string, limit: number): Promise<string[]> {
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

      if (entry.name.startsWith(".")) {
        continue;
      }

      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        result.push(path.relative(root, absolutePath));
      }
    }
  }

  await visit(root);
  return result;
}

export async function readVaultNote(relativePath: string): Promise<{ content: string; relativePath: string }> {
  const resolved = resolveVaultPath(relativePath);
  const metadata = await stat(resolved.absolutePath);

  if (metadata.size > MAX_NOTE_BYTES) {
    throw new Error(`Note is too large to read through MCP (${metadata.size} bytes).`);
  }

  return {
    content: await readFile(resolved.absolutePath, "utf8"),
    relativePath: resolved.relativePath,
  };
}

export async function writeVaultNote(
  relativePath: string,
  content: string,
  mode: "create" | "overwrite" | "append",
): Promise<{ path: string; bytes: number }> {
  const resolved = resolveVaultPath(relativePath);

  if (mode === "create") {
    try {
      await stat(resolved.absolutePath);
      throw new Error(`Note already exists: ${resolved.relativePath}`);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  let nextContent = content;
  if (mode === "append") {
    try {
      const current = await readFile(resolved.absolutePath, "utf8");
      nextContent = `${current}${current.endsWith("\n") ? "" : "\n"}${content}`;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  await mkdir(path.dirname(resolved.absolutePath), { recursive: true });
  await writeFile(resolved.absolutePath, nextContent, "utf8");

  return {
    path: resolved.relativePath,
    bytes: Buffer.byteLength(nextContent, "utf8"),
  };
}

export async function searchVaultNotes(query: string, limit: number) {
  const files = await walkMarkdownFiles(OBSIDIAN_VAULT_PATH, 5_000);
  const normalizedQuery = query.toLocaleLowerCase();
  const matches: Array<{ path: string; line: number; text: string }> = [];

  for (const file of files) {
    if (matches.length >= limit) {
      break;
    }

    const resolved = resolveVaultPath(file);
    const metadata = await stat(resolved.absolutePath);

    if (metadata.size > MAX_SEARCH_FILE_BYTES) {
      continue;
    }

    const lines = (await readFile(resolved.absolutePath, "utf8")).split(/\r?\n/);

    for (let index = 0; index < lines.length && matches.length < limit; index += 1) {
      const line = lines[index];
      if (line.toLocaleLowerCase().includes(normalizedQuery)) {
        matches.push({
          path: file,
          line: index + 1,
          text: line.trim().slice(0, 240),
        });
      }
    }
  }

  return matches;
}
