import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createCursorTaskBrief, fetchMockJiraTask, searchMockJiraIssues } from "../lib/jira";
import { jsonText } from "../lib/json-response.js";

export function registerJiraTools(server: McpServer): void {
  server.registerTool(
    "mock_jira_search_issues",
    {
      description:
        "Search issues in the local Jira-like mock API and return matching issue keys, summaries, and targets.",
      inputSchema: {
        query: z.string().default("").describe("Text to search for in mock Jira issues."),
        maxResults: z.number().int().min(1).max(50).default(10).describe("Maximum number of issues to return."),
      },
    },
    async ({ query, maxResults }) => jsonText(await searchMockJiraIssues(query, maxResults)),
  );

  server.registerTool(
    "mock_jira_get_task",
    {
      description:
        "Fetch an issue from the local Jira-like mock API and return the task steps plus an implementation brief",
      inputSchema: {
        taskKey: z.string().regex(/^[A-Z][A-Z0-9]+-\d+$/).default("TASK-1").describe("Mock Jira task key, for example TASK-1."),
        includeTask: z.boolean().default(true).describe("Include the mock Jira task in the response."),
      },
    },
    async ({ taskKey, includeTask }) => {
      const task = await fetchMockJiraTask(taskKey);
      const brief = createCursorTaskBrief(task);

      return jsonText({
        taskKey: task.key,
        title: task.title,
        target: task.target,
        steps: task.testSteps,
        brief,
        task: includeTask ? task : undefined,
      });
    },
  );
}
