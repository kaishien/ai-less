import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonText } from "../lib/json-response.js";
import {
  OBSIDIAN_VAULT_PATH,
  readVaultNote,
  searchVaultNotes,
  walkMarkdownFiles,
  writeVaultNote,
} from "../lib/obsidian.js";

export function registerObsidianTools(server: McpServer): void {
  server.registerTool(
    "obsidian_list_notes",
    {
      description:
        "List markdown notes in the configured Obsidian vault. Use this before reading notes when you need to discover available documentation.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .default(100)
          .describe("Maximum number of markdown notes to return."),
      },
    },
    async ({ limit }) =>
      jsonText({
        vaultPath: OBSIDIAN_VAULT_PATH,
        notes: await walkMarkdownFiles(OBSIDIAN_VAULT_PATH, limit),
      }),
  );

  server.registerTool(
    "obsidian_read_note",
    {
      description:
        "Read a markdown note from the configured Obsidian vault by relative path. The path is constrained to the vault.",
      inputSchema: {
        path: z.string().describe("Relative note path inside the vault. The .md suffix is optional."),
      },
    },
    async ({ path }) => jsonText(await readVaultNote(path)),
  );

  server.registerTool(
    "obsidian_write_note",
    {
      description:
        "Create, replace, or append to a markdown note in the configured Obsidian vault. Use this to add documentation to Obsidian.",
      inputSchema: {
        path: z.string().describe("Relative note path inside the vault. The .md suffix is optional."),
        content: z.string().describe("Markdown content to write or append."),
        mode: z.enum(["create", "overwrite", "append"]).default("create").describe("Write mode for the note."),
      },
    },
    async ({ path, content, mode }) => {
      const result = await writeVaultNote(path, content, mode);

      return jsonText({
        vaultPath: OBSIDIAN_VAULT_PATH,
        path: result.path,
        mode,
        bytes: result.bytes,
      });
    },
  );

  server.registerTool(
    "obsidian_search_notes",
    {
      description:
        "Search markdown notes in the configured Obsidian vault by case-insensitive text query. Returns matching note paths and short line snippets.",
      inputSchema: {
        query: z.string().min(1).describe("Case-insensitive text to search for."),
        limit: z.number().int().min(1).max(100).default(25).describe("Maximum number of matches to return."),
      },
    },
    async ({ query, limit }) =>
      jsonText({
        vaultPath: OBSIDIAN_VAULT_PATH,
        query,
        matches: await searchVaultNotes(query, limit),
      }),
  );
}
