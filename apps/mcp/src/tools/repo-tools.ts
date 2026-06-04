import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonText } from "../lib/json-response.js";
import { OBSIDIAN_VAULT_PATH, resolveVaultPath } from "../lib/obsidian.js";
import { collectTodoComments, DEFAULT_REPO_PATH, formatTodoReport, writeMarkdownFile } from "../lib/repo-scan.js";

export function registerRepoTools(server: McpServer): void {
  server.registerTool(
    "repo_collect_todos_to_obsidian",
    {
      description:
        "Scan a local repository for TODO/FIXME/HACK/NOTE comments, detect nearby functions/classes, and write a polished markdown report into the configured Obsidian vault.",
      inputSchema: {
        repoPath: z
          .string()
          .default(DEFAULT_REPO_PATH)
          .describe("Absolute repository path to scan. Defaults to the ai-less repository."),
        outputNotePath: z
          .string()
          .default("Code/TODO Report")
          .describe("Relative Obsidian note path where the report will be overwritten. The .md suffix is optional."),
        fileLimit: z.number().int().min(1).max(20_000).default(5_000).describe("Maximum number of code files to scan."),
        itemLimit: z.number().int().min(1).max(5_000).default(500).describe("Maximum number of TODO items to collect."),
      },
    },
    async ({ repoPath, outputNotePath, fileLimit, itemLimit }) => {
      const report = await collectTodoComments(repoPath, fileLimit, itemLimit);
      const markdown = formatTodoReport(report);
      const resolved = resolveVaultPath(outputNotePath);

      await writeMarkdownFile(resolved.absolutePath, markdown);

      return jsonText({
        vaultPath: OBSIDIAN_VAULT_PATH,
        outputNotePath: resolved.relativePath,
        repository: report.root,
        scannedFiles: report.scannedFiles,
        itemsFound: report.todos.length,
      });
    },
  );
}
