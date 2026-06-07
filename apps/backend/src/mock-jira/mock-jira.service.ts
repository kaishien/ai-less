import { Injectable, NotFoundException } from '@nestjs/common';
import { MOCK_JIRA_ISSUES } from './mock-jira.data';
import { MockJiraIssue, MockJiraIssuePayload, MockJiraSearchResponse, MockJiraTask } from './mock-jira.types';

@Injectable()
export class MockJiraService {
  listTasks(): MockJiraTask[] {
    return MOCK_JIRA_ISSUES.map((issue) => this.toTask(issue));
  }

  searchTasks(query = ''): MockJiraTask[] {
    return this.searchIssuePayloads(query).map((issue) => this.toTask(issue));
  }

  getTask(key: string): MockJiraTask {
    return this.toTask(this.getIssuePayload(key));
  }

  getIssue(key: string, baseUrl: string): MockJiraIssue {
    return this.withSelf(this.getIssuePayload(key), baseUrl);
  }

  searchIssues(options: { jql?: string; startAt?: number; maxResults?: number; baseUrl: string }): MockJiraSearchResponse {
    const startAt = Math.max(0, options.startAt ?? 0);
    const maxResults = Math.min(Math.max(1, options.maxResults ?? 50), 100);
    const query = this.extractQueryFromJql(options.jql ?? '');
    const issues = this.searchIssuePayloads(query);
    const page = issues.slice(startAt, startAt + maxResults);

    return {
      startAt,
      maxResults,
      total: issues.length,
      issues: page.map((issue) => this.withSelf(issue, options.baseUrl)),
    };
  }

  private getIssuePayload(key: string): MockJiraIssuePayload {
    const issue = MOCK_JIRA_ISSUES.find((item) => item.key === key);

    if (!issue) {
      throw new NotFoundException(`Mock Jira issue ${key} was not found`);
    }

    return issue;
  }

  private searchIssuePayloads(query = ''): MockJiraIssuePayload[] {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return MOCK_JIRA_ISSUES;
    }

    return MOCK_JIRA_ISSUES.filter((issue) => this.getSearchText(issue).includes(normalizedQuery));
  }

  private withSelf(issue: MockJiraIssuePayload, baseUrl: string): MockJiraIssue {
    return {
      ...issue,
      self: `${baseUrl}/rest/api/3/issue/${encodeURIComponent(issue.key)}`,
    };
  }

  private toTask(issue: MockJiraIssuePayload): MockJiraTask {
    return {
      key: issue.key,
      title: issue.fields.summary,
      description: this.stringifyAdf(issue.fields.description),
      target: issue.fields.customfield_10011,
      testSteps: issue.fields.customfield_10010,
    };
  }

  private getSearchText(issue: MockJiraIssuePayload): string {
    return [
      issue.key,
      issue.fields.project.key,
      issue.fields.summary,
      this.stringifyAdf(issue.fields.description),
      issue.fields.status.name,
      issue.fields.issuetype.name,
      ...issue.fields.labels,
      issue.fields.customfield_10011.service,
      issue.fields.customfield_10011.file,
      ...issue.fields.customfield_10010,
    ]
      .join(' ')
      .toLowerCase();
  }

  private extractQueryFromJql(jql: string): string {
    const textMatch = jql.match(/text\s*~\s*"([^"]+)"/i) ?? jql.match(/text\s*~\s*'([^']+)'/i);
    const summaryMatch = jql.match(/summary\s*~\s*"([^"]+)"/i) ?? jql.match(/summary\s*~\s*'([^']+)'/i);
    const keyMatch = jql.match(/key\s*=\s*([A-Z][A-Z0-9]+-\d+)/i);

    return textMatch?.[1] ?? summaryMatch?.[1] ?? keyMatch?.[1] ?? '';
  }

  private stringifyAdf(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (!value || typeof value !== 'object') {
      return '';
    }

    const node = value as { type?: unknown; text?: unknown; content?: unknown };

    if (node.type === 'text' && typeof node.text === 'string') {
      return node.text;
    }

    if (!Array.isArray(node.content)) {
      return '';
    }

    return node.content
      .map((child) => this.stringifyAdf(child))
      .filter(Boolean)
      .join(node.type === 'paragraph' ? ' ' : '\n')
      .trim();
  }
}
