#!/usr/bin/env bun

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "ai-less-mcp",
  version: "0.1.0",
});

function countWords(text: string): number {
  const normalized = text.trim();
  return normalized.length === 0 ? 0 : normalized.split(/\s+/).length;
}

function countLines(text: string): number {
  return text.length === 0 ? 0 : text.split(/\r?\n/).length;
}

function toSnakeCaseValue(text: string): string {
  return text
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z\d]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function getMoscowIsoTime(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const value = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((item) => item.type === type);
    if (!part) {
      throw new Error(`Missing ${type} in Moscow time formatter`);
    }
    return part.value;
  };

  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}+03:00`;
}

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

server.registerTool(
  "current_moscow_time",
  {
    description: "Use this tool when you need the current date and time in Moscow as an ISO string.",
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: "text",
        text: getMoscowIsoTime(),
      },
    ],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
