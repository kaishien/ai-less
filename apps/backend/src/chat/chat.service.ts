import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ASSISTANT_NAME, ASSISTANT_ROLE_DESCRIPTION } from './assistant-profile';
import { ChatMessage, ChatRequest, ChatResponse, ChatStreamEvent, LlmClient } from './chat.types';
import { TokenBudget } from './token-budget';

export const LLM_CLIENT = Symbol('LLM_CLIENT');

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 250;
const ESTIMATED_MAX_RESPONSE_TOKENS = 1_000;

@Injectable()
export class ChatService {
  constructor(
    @Inject(LLM_CLIENT) private readonly llmClient: LlmClient,
    @Inject(TokenBudget)
    private readonly tokenBudget: TokenBudget,
  ) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const messages = this.normalizeMessages(request.messages);
    this.assertBudgetAvailable(messages);

    const result = await this.completeWithRetry(messages);
    this.tokenBudget.spend(result.usage.total_tokens);

    const budget = this.tokenBudget.snapshot();
    console.log(
      `[chat] prompt_tokens=${result.usage.prompt_tokens} completion_tokens=${result.usage.completion_tokens} total_tokens=${result.usage.total_tokens}`,
    );

    return {
      assistant: {
        name: ASSISTANT_NAME,
        roleDescription: ASSISTANT_ROLE_DESCRIPTION,
      },
      message: {
        role: 'assistant',
        content: result.content,
      },
      usage: result.usage,
      budget: this.serializeBudget(budget),
    };
  }

  async *streamChat(request: ChatRequest): AsyncGenerator<ChatStreamEvent> {
    const messages = this.normalizeMessages(request.messages);
    this.assertBudgetAvailable(messages);

    yield {
      type: 'assistant',
      assistant: {
        name: ASSISTANT_NAME,
        roleDescription: ASSISTANT_ROLE_DESCRIPTION,
      },
    };

    const stream = await this.streamWithRetry(messages);
    let content = '';
    let usage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    for await (const chunk of stream) {
      if (chunk.delta) {
        content += chunk.delta;
        yield {
          type: 'delta',
          delta: chunk.delta,
        };
      }

      if (chunk.usage) {
        usage = chunk.usage;
      }
    }

    this.tokenBudget.spend(usage.total_tokens);
    const budget = this.tokenBudget.snapshot();
    console.log(
      `[chat] prompt_tokens=${usage.prompt_tokens} completion_tokens=${usage.completion_tokens} total_tokens=${usage.total_tokens}`,
    );

    yield {
      type: 'done',
      message: {
        role: 'assistant',
        content,
      },
      usage,
      budget: this.serializeBudget(budget),
    };
  }

  private async completeWithRetry(messages: ChatMessage[]) {
    let attempt = 0;

    for (;;) {
      try {
        return await this.llmClient.complete(messages);
      } catch (error) {
        if (!this.isRateLimitError(error) || attempt >= MAX_RETRIES) {
          throw error;
        }

        attempt += 1;
        const waitMs = BASE_BACKOFF_MS * 2 ** (attempt - 1);
        console.log(`[chat] retry attempt=${attempt} wait_seconds=${(waitMs / 1000).toFixed(2)}`);
        await this.sleep(waitMs);
      }
    }
  }

  private async streamWithRetry(messages: ChatMessage[]) {
    let attempt = 0;

    for (;;) {
      try {
        return await this.llmClient.stream(messages);
      } catch (error) {
        if (!this.isRateLimitError(error) || attempt >= MAX_RETRIES) {
          throw error;
        }

        attempt += 1;
        const waitMs = BASE_BACKOFF_MS * 2 ** (attempt - 1);
        console.log(`[chat] retry attempt=${attempt} wait_seconds=${(waitMs / 1000).toFixed(2)}`);
        await this.sleep(waitMs);
      }
    }
  }

  private assertBudgetAvailable(messages: ChatMessage[]) {
    const estimatedPromptTokens = this.estimateTokens(messages);
    const estimatedTotalTokens = estimatedPromptTokens + ESTIMATED_MAX_RESPONSE_TOKENS;

    if (this.tokenBudget.canSpend(estimatedTotalTokens)) {
      return;
    }

    const budget = this.tokenBudget.snapshot();
    throw new HttpException(
      {
        message: 'Hourly token budget exceeded. Try again after the reset time.',
        budget: this.serializeBudget(budget),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private normalizeMessages(messages: ChatMessage[] | undefined) {
    if (!Array.isArray(messages)) {
      return [];
    }

    return messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        role: message.role,
        content: String(message.content ?? '').trim(),
      }))
      .filter((message) => message.content.length > 0);
  }

  private estimateTokens(messages: ChatMessage[]) {
    const chars = messages.reduce((total, message) => total + message.content.length + message.role.length, 0);
    return Math.ceil(chars / 4);
  }

  private isRateLimitError(error: unknown) {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const status = 'status' in error ? Number((error as { status?: unknown }).status) : undefined;
    const code = 'code' in error ? String((error as { code?: unknown }).code) : undefined;

    return status === 429 || code === 'rate_limit_exceeded';
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private serializeBudget(budget: { used: number; limit: number; resetsAt: Date }) {
    return {
      used: budget.used,
      limit: budget.limit,
      resetsAt: budget.resetsAt.toISOString(),
    };
  }
}
