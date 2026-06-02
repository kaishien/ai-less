import OpenAI from 'openai';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SYSTEM_PROMPT } from './assistant-profile';
import { ChatMessage, LlmChatResult, LlmClient, LlmStreamChunk } from './chat.types';

@Injectable()
export class OpenAiLlmClient implements LlmClient {
  private client: OpenAI | null = null;
  private readonly model = process.env.OPENAI_MODEL ?? 'gpt-5.4-mini';

  async complete(messages: ChatMessage[]): Promise<LlmChatResult> {
    const completion = await this.getClient().chat.completions.create({
      model: this.model,
      messages: this.toOpenAiMessages(messages),
    });

    return {
      content: completion.choices[0]?.message.content ?? '',
      usage: {
        prompt_tokens: completion.usage?.prompt_tokens ?? 0,
        completion_tokens: completion.usage?.completion_tokens ?? 0,
        total_tokens: completion.usage?.total_tokens ?? 0,
      },
    };
  }

  async stream(messages: ChatMessage[]): Promise<AsyncIterable<LlmStreamChunk>> {
    const stream = await this.getClient().chat.completions.create({
      model: this.model,
      stream: true,
      stream_options: {
        include_usage: true,
      },
      messages: this.toOpenAiMessages(messages),
    });

    return {
      async *[Symbol.asyncIterator]() {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          const usage = chunk.usage
            ? {
                prompt_tokens: chunk.usage.prompt_tokens ?? 0,
                completion_tokens: chunk.usage.completion_tokens ?? 0,
                total_tokens: chunk.usage.total_tokens ?? 0,
              }
            : undefined;

          if (typeof delta === 'string' || usage) {
            yield {
              delta: typeof delta === 'string' ? delta : undefined,
              usage,
            };
          }
        }
      },
    };
  }

  private getClient() {
    if (this.client) {
      return this.client;
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new HttpException(
        {
          message: 'OPENAI_API_KEY is required to call /api/chat.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    return this.client;
  }

  private toOpenAiMessages(messages: ChatMessage[]) {
    return [
      {
        role: 'system' as const,
        content: SYSTEM_PROMPT,
      },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];
  }
}
