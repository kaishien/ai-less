import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const vaultDir = await mkdtemp(path.join(tmpdir(), "ai-less-obsidian-"));
process.env.OBSIDIAN_VAULT_PATH = vaultDir;

const {
  readVaultNote,
  searchVaultNotes,
  writeVaultNote,
} = await import("./obsidian.js");
const { registerObsidianTools } = await import("../tools/obsidian-tools.js");

after(async () => {
  await rm(vaultDir, { recursive: true, force: true });
});

function assertJsonTextResponse(response: unknown): unknown {
  assert.equal(typeof response, "object");
  assert.notEqual(response, null);

  const content = (response as { content?: unknown }).content;
  assert.ok(Array.isArray(content));
  assert.equal(content.length, 1);
  assert.deepEqual(content[0], {
    type: "text",
    text: (content[0] as { text: string }).text,
  });

  return JSON.parse((content[0] as { text: string }).text);
}

describe("Obsidian vault notes", () => {
  it("resolves a note path without .md to a markdown file", async () => {
    await writeVaultNote("folder/note.md", "Existing note", "create");

    const note = await readVaultNote("folder/note");

    assert.deepEqual(note, {
      content: "Existing note",
      relativePath: "folder/note.md",
    });
  });

  it("rejects path traversal outside the vault", async () => {
    await assert.rejects(
      () => readVaultNote("../outside"),
      /Vault path must be relative and cannot contain '\.\.'/,
    );

    await assert.rejects(
      () => writeVaultNote("nested/../../outside", "nope", "overwrite"),
      /Vault path must be relative and cannot contain '\.\.'/,
    );
  });

  it("writes notes in create, overwrite and append modes", async () => {
    const created = await writeVaultNote("daily/log", "First entry", "create");
    assert.equal(created.path, "daily/log.md");
    assert.equal(created.bytes, Buffer.byteLength("First entry", "utf8"));
    assert.equal(await readFile(path.join(vaultDir, "daily/log.md"), "utf8"), "First entry");

    await assert.rejects(
      () => writeVaultNote("daily/log", "Duplicate", "create"),
      /Note already exists: daily\/log\.md/,
    );

    const overwritten = await writeVaultNote("daily/log", "Replacement", "overwrite");
    assert.equal(overwritten.path, "daily/log.md");
    assert.equal(await readFile(path.join(vaultDir, "daily/log.md"), "utf8"), "Replacement");

    const appended = await writeVaultNote("daily/log", "Appended", "append");
    assert.equal(appended.path, "daily/log.md");
    assert.equal(await readFile(path.join(vaultDir, "daily/log.md"), "utf8"), "Replacement\nAppended");
  });

  it("returns matched note path and snippet when searching", async () => {
    await writeVaultNote("search/hit", "First line\nFind ME here with extra text\nLast line", "overwrite");

    const matches = await searchVaultNotes("find me", 10);

    assert.ok(matches.some((match) =>
      match.path === "search/hit.md" &&
      match.line === 2 &&
      match.text === "Find ME here with extra text",
    ));
  });
});

describe("Obsidian MCP tools", () => {
  it("return jsonText responses", async () => {
    type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;
    const handlers = new Map<string, ToolHandler>();
    const server = {
      registerTool(name: string, _config: unknown, handler: ToolHandler) {
        handlers.set(name, handler);
      },
    } as unknown as McpServer;

    registerObsidianTools(server);

    const writeHandler = handlers.get("obsidian_write_note");
    const readHandler = handlers.get("obsidian_read_note");
    const listHandler = handlers.get("obsidian_list_notes");
    const searchHandler = handlers.get("obsidian_search_notes");
    assert.ok(writeHandler);
    assert.ok(readHandler);
    assert.ok(listHandler);
    assert.ok(searchHandler);

    const writeJson = assertJsonTextResponse(
      await writeHandler({ path: "tool/json", content: "Tool search target", mode: "overwrite" }),
    ) as { vaultPath: string; path: string; mode: string; bytes: number };
    assert.equal(writeJson.vaultPath, vaultDir);
    assert.equal(writeJson.path, "tool/json.md");
    assert.equal(writeJson.mode, "overwrite");
    assert.equal(writeJson.bytes, Buffer.byteLength("Tool search target", "utf8"));

    const readJson = assertJsonTextResponse(await readHandler({ path: "tool/json" })) as {
      content: string;
      relativePath: string;
    };
    assert.deepEqual(readJson, {
      content: "Tool search target",
      relativePath: "tool/json.md",
    });

    const listJson = assertJsonTextResponse(await listHandler({ limit: 100 })) as {
      vaultPath: string;
      notes: string[];
    };
    assert.equal(listJson.vaultPath, vaultDir);
    assert.ok(listJson.notes.includes("tool/json.md"));

    const searchJson = assertJsonTextResponse(await searchHandler({ query: "search target", limit: 10 })) as {
      vaultPath: string;
      query: string;
      matches: Array<{ path: string; line: number; text: string }>;
    };
    assert.equal(searchJson.vaultPath, vaultDir);
    assert.equal(searchJson.query, "search target");
    assert.ok(searchJson.matches.some((match) =>
      match.path === "tool/json.md" &&
      match.line === 1 &&
      match.text === "Tool search target",
    ));
  });
});
