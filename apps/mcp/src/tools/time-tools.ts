import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMoscowIsoTime } from "../lib/time.js";

export function registerTimeTools(server: McpServer): void {
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
}
