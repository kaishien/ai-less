#!/usr/bin/env bun

import "./lib/env.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerFigmaTools } from "./tools/figma-tools.js";
import { registerObsidianTools } from "./tools/obsidian-tools.js";
import { registerJiraTools } from "./tools/jira-tools.js";
import { registerRepoTools } from "./tools/repo-tools.js";
import { registerTextTools } from "./tools/text-tools.js";
import { registerTimeTools } from "./tools/time-tools.js";

const server = new McpServer({
  name: "ai-less-mcp",
  version: "0.1.0",
});

registerTextTools(server);
registerTimeTools(server);
registerObsidianTools(server);
registerRepoTools(server);
registerJiraTools(server);
registerFigmaTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
