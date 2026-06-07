import { env } from "./env.js";

export interface MockJiraTask {
  key: string;
  title: string;
  description: string;
  target: {
    service: string;
    file: string;
  };
  testSteps: string[];
}

interface MockJiraIssue {
  key: string;
  fields: {
    summary: string;
    description: unknown;
    customfield_10010?: string[];
    customfield_10011?: {
      service?: string;
      file?: string;
    };
  };
}

interface MockJiraSearchResponse {
  startAt: number;
  maxResults: number;
  total: number;
  issues: MockJiraIssue[];
}

export interface MockJiraIssueSummary {
  key: string;
  title: string;
  target: MockJiraTask["target"];
}

const DEFAULT_MOCK_JIRA_URL = "http://localhost:3000/api/rest/api/3";

export function getMockJiraBaseUrl(): string {
  return (env("MOCK_JIRA_BASE_URL")?.trim() || DEFAULT_MOCK_JIRA_URL).replace(/\/+$/, "");
}

export async function fetchMockJiraTask(taskKey: string): Promise<MockJiraTask> {
  const issue = await fetchMockJiraIssue(taskKey);

  return toTask(issue);
}

export async function fetchMockJiraIssue(taskKey: string): Promise<MockJiraIssue> {
  const url = `${getMockJiraBaseUrl()}/issue/${encodeURIComponent(taskKey)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mock Jira request failed: ${response.status} ${response.statusText}\n${body}`);
  }

  return (await response.json()) as MockJiraIssue;
}

export async function searchMockJiraIssues(query: string, maxResults = 10): Promise<{
  total: number;
  issues: MockJiraIssueSummary[];
}> {
  const url = new URL(`${getMockJiraBaseUrl()}/search`);
  const jql = query.trim() ? `text ~ "${query.trim().replace(/"/g, '\\"')}"` : "";

  if (jql) {
    url.searchParams.set("jql", jql);
  }

  url.searchParams.set("maxResults", String(maxResults));

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mock Jira search failed: ${response.status} ${response.statusText}\n${body}`);
  }

  const result = (await response.json()) as MockJiraSearchResponse;

  return {
    total: result.total,
    issues: result.issues.map((issue) => ({
      key: issue.key,
      title: issue.fields.summary,
      target: readTarget(issue),
    })),
  };
}

export function createCursorTaskBrief(task: MockJiraTask): string {
  const lines = [
    `# ${task.key}: ${task.title}`,
    ``,
    `## Context`,
    ``,
    task.description,
    ``,
    `## Target`,
    ``,
    `- Service: ${task.target.service}`,
    `- File: ${task.target.file}`,
    ``,
    `## Task`,
    ``,
    `Use the steps from this mock Jira task as requirements. Implement the requested code changes in the repository and verify them with the project's test command.`,
    ``,
    `## Steps`,
    ``,
  ];

  for (const [index, step] of task.testSteps.entries()) {
    lines.push(`${index + 1}. ${step}`);
  }

  lines.push(``);
  lines.push(`## Expected Cursor behavior`);
  lines.push(``);
  lines.push(`- Read the target source and existing test patterns before editing.`);
  lines.push(`- Create or update tests that cover every step above.`);
  lines.push(`- Keep the generated tests aligned with the repository's existing Node test runner.`);
  lines.push(`- Run focused verification and report the result.`);

  return lines.join("\n");
}

function toTask(issue: MockJiraIssue): MockJiraTask {
  return {
    key: issue.key,
    title: issue.fields.summary,
    description: stringifyJiraValue(issue.fields.description),
    target: readTarget(issue),
    testSteps: Array.isArray(issue.fields.customfield_10010) ? issue.fields.customfield_10010 : [],
  };
}

function readTarget(issue: MockJiraIssue): MockJiraTask["target"] {
  return {
    service: issue.fields.customfield_10011?.service ?? "Unknown",
    file: issue.fields.customfield_10011?.file ?? "",
  };
}

function stringifyJiraValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const node = value as { type?: unknown; text?: unknown; content?: unknown };

  if (node.type === "text" && typeof node.text === "string") {
    return node.text;
  }

  if (!Array.isArray(node.content)) {
    return "";
  }

  return node.content.map(stringifyJiraValue).filter(Boolean).join(node.type === "paragraph" ? " " : "\n").trim();
}
