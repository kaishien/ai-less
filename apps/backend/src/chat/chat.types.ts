export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatResponse {
  assistant: {
    name: string;
    roleDescription: string;
  };
  message: ChatMessage;
  usage: TokenUsage;
  budget: {
    used: number;
    limit: number;
    resetsAt: string;
  };
}

export interface ChatStreamAssistantEvent {
  type: 'assistant';
  assistant: ChatResponse['assistant'];
}

export interface ChatStreamDeltaEvent {
  type: 'delta';
  delta: string;
}

export interface ChatStreamDoneEvent {
  type: 'done';
  message: ChatMessage;
  usage: TokenUsage;
  budget: ChatResponse['budget'];
}

export interface ChatStreamErrorEvent {
  type: 'error';
  message: string;
}

export type ChatStreamEvent =
  | ChatStreamAssistantEvent
  | ChatStreamDeltaEvent
  | ChatStreamDoneEvent
  | ChatStreamErrorEvent;

export interface LlmChatResult {
  content: string;
  usage: TokenUsage;
}

export interface LlmStreamChunk {
  delta?: string;
  usage?: TokenUsage;
}

export interface LlmClient {
  complete(messages: ChatMessage[]): Promise<LlmChatResult>;
  stream(messages: ChatMessage[]): Promise<AsyncIterable<LlmStreamChunk>>;
}
