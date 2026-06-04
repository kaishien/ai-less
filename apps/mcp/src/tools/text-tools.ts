import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { countLines, countWords, toSnakeCaseValue } from "../lib/text.js";

export function registerTextTools(server: McpServer): void {
  server.registerTool(
    "word_count",
    {
      description:
        "Use this tool when you need exact counts of words, characters, and lines in a provided text.",
      inputSchema: {
        text: z.string().describe("Text to count words, characters, and lines for."),
      },
    },
    async ({ text }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            words: countWords(text),
            chars: text.length,
            lines: countLines(text),
          }),
        },
      ],
    }),
  );

  server.registerTool(
    "to_snake_case",
    {
      description:
        "Use this tool when you need to convert identifiers or short labels such as getUserById into snake_case.",
      inputSchema: {
        text: z.string().describe("Identifier or label to convert to snake_case."),
      },
    },
    async ({ text }) => ({
      content: [
        {
          type: "text",
          text: toSnakeCaseValue(text),
        },
      ],
    }),
  );
}
