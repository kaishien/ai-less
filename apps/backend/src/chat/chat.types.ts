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

export interface ImageStreamUsage {
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
}

export interface ChatStreamImagePendingEvent {
  type: 'image_pending';
  prompt: string;
}

export interface ChatStreamImageEvent {
  type: 'image';
  prompt: string;
  image: {
    dataUrl: string;
    mimeType: string;
  };
  usage?: ImageStreamUsage;
}

export type ChatStreamEvent =
  | ChatStreamAssistantEvent
  | ChatStreamDeltaEvent
  | ChatStreamImagePendingEvent
  | ChatStreamImageEvent
  | ChatStreamDoneEvent
  | ChatStreamErrorEvent;

export interface LlmChatResult {
  content: string;
  usage: TokenUsage;
}

export interface LlmTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface LlmStreamOptions {
  tools?: LlmTool[];
}

export interface LlmStreamChunk {
  delta?: string;
  usage?: TokenUsage;
  toolCalls?: LlmToolCall[];
}

export interface LlmClient {
  complete(messages: ChatMessage[]): Promise<LlmChatResult>;
  stream(messages: ChatMessage[], options?: LlmStreamOptions): Promise<AsyncIterable<LlmStreamChunk>>;
}

export type GuardDecision = 'allow' | 'prompt_injection' | 'out_of_scope';

export interface GuardClient {
  classify(messages: ChatMessage[]): Promise<GuardDecision>;
}
