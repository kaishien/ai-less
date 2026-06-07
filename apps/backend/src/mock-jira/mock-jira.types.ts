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

export interface MockJiraIssue {
  id: string;
  key: string;
  self: string;
  fields: MockJiraIssueFields;
}

export type MockJiraIssuePayload = Omit<MockJiraIssue, 'self'>;

export interface MockJiraIssueFields {
  project: {
    key: string;
  };
  summary: string;
  description: MockJiraAdfDocument;
  status: {
    name: string;
  };
  issuetype: {
    name: string;
  };
  labels: string[];
  customfield_10010: string[];
  customfield_10011: {
    service: string;
    file: string;
  };
}

export interface MockJiraSearchResponse {
  startAt: number;
  maxResults: number;
  total: number;
  issues: MockJiraIssue[];
}

export interface MockJiraAdfDocument {
  type: 'doc';
  version: 1;
  content: MockJiraAdfBlockNode[];
}

export type MockJiraAdfBlockNode =
  | {
      type: 'paragraph' | 'heading';
      attrs?: {
        level?: number;
      };
      content: MockJiraAdfTextNode[];
    }
  | {
      type: 'bulletList';
      content: MockJiraAdfListItemNode[];
    };

export interface MockJiraAdfTextNode {
  type: 'text';
  text: string;
}

export interface MockJiraAdfListItemNode {
  type: 'listItem';
  content: Array<{
    type: 'paragraph';
    content: MockJiraAdfTextNode[];
  }>;
}
