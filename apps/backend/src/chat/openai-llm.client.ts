import OpenAI from 'openai';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SYSTEM_PROMPT } from './assistant-profile';
import { TOOL_GUIDANCE } from './chat-tools';
import { ChatMessage, LlmChatResult, LlmClient, LlmStreamChunk, LlmStreamOptions } from './chat.types';

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

  async stream(messages: ChatMessage[], options?: LlmStreamOptions): Promise<AsyncIterable<LlmStreamChunk>> {
    const tools = options?.tools?.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
    const hasTools = Boolean(tools && tools.length);

    const stream = await this.getClient().chat.completions.create({
      model: this.model,
      stream: true,
      stream_options: {
        include_usage: true,
      },
      messages: this.toOpenAiMessages(messages, hasTools ? TOOL_GUIDANCE : undefined),
      ...(hasTools ? { tools, tool_choice: 'auto' as const } : {}),
    });

    return {
      async *[Symbol.asyncIterator]() {
        const toolAccumulator = new Map<number, { id: string; name: string; arguments: string }>();

        for await (const chunk of stream) {
          const choice = chunk.choices[0];
          const delta = choice?.delta?.content;
          const usage = chunk.usage
            ? {
                prompt_tokens: chunk.usage.prompt_tokens ?? 0,
                completion_tokens: chunk.usage.completion_tokens ?? 0,
                total_tokens: chunk.usage.total_tokens ?? 0,
              }
            : undefined;

          for (const toolDelta of choice?.delta?.tool_calls ?? []) {
            const index = toolDelta.index ?? 0;
            const current = toolAccumulator.get(index) ?? { id: '', name: '', arguments: '' };

            if (toolDelta.id) {
              current.id = toolDelta.id;
            }
            if (toolDelta.function?.name) {
              current.name = toolDelta.function.name;
            }
            if (toolDelta.function?.arguments) {
              current.arguments += toolDelta.function.arguments;
            }

            toolAccumulator.set(index, current);
          }

          if (typeof delta === 'string' && delta.length > 0) {
            yield { delta };
          }

          if (choice?.finish_reason === 'tool_calls' && toolAccumulator.size > 0) {
            yield { toolCalls: [...toolAccumulator.values()] };
            toolAccumulator.clear();
          }

          if (usage) {
            yield { usage };
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

  private toOpenAiMessages(messages: ChatMessage[], extraSystemPrompt?: string) {
    return [
      {
        role: 'system' as const,
        content: extraSystemPrompt ? `${SYSTEM_PROMPT} ${extraSystemPrompt}` : SYSTEM_PROMPT,
      },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];
  }
}
