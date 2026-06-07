import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpException, HttpStatus } from '@nestjs/common';
import { InputGuard } from '../common/guard/input-guard';
import { ImagesService } from '../images/images.service';
import { ASSISTANT_NAME, ASSISTANT_ROLE_DESCRIPTION } from './assistant-profile';
import { ChatService } from './chat.service';
import { ChatMessage, LlmClient } from './chat.types';
import { TokenBudget } from './token-budget';

type ServiceOverrides = {
  llmClient?: Partial<LlmClient>;
  tokenBudget?: Partial<TokenBudget>;
  inputGuard?: Partial<InputGuard>;
};

function createChatService(overrides: ServiceOverrides = {}) {
  const completeCalls: ChatMessage[][] = [];
  let completeCalled = false;

  const llmClient: LlmClient = {
    complete: async (messages) => {
      completeCalled = true;
      completeCalls.push(messages);

      if (overrides.llmClient?.complete) {
        return overrides.llmClient.complete(messages);
      }

      return {
        content: 'ok',
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      };
    },
    stream: overrides.llmClient?.stream ?? (async () => (async function* () {})()),
  };

  const spendCalls: number[] = [];
  const tokenBudget = Object.assign(new TokenBudget(), {
    spend(tokens: number) {
      spendCalls.push(tokens);
      TokenBudget.prototype.spend.call(this, tokens);
    },
    ...overrides.tokenBudget,
  });

  const inputGuard = {
    inspect: async () => ({ blocked: false }),
    ...overrides.inputGuard,
  } as InputGuard;

  const imagesService = {} as ImagesService;
  const service = new ChatService(llmClient, tokenBudget, inputGuard, imagesService);

  return { service, llmClient, tokenBudget, inputGuard, completeCalls, completeCalled: () => completeCalled, spendCalls };
}

describe('ChatService.chat', () => {
  it('passes only trimmed user/assistant messages to LlmClient', async () => {
    const { service, completeCalls } = createChatService();

    await service.chat({
      messages: [
        { role: 'user', content: '  hello  ' },
        { role: 'assistant', content: '' },
        { role: 'user', content: 'world' },
        { role: 'system' as ChatMessage['role'], content: 'ignore me' },
        { role: 'user', content: '   ' },
      ],
    });

    assert.deepEqual(completeCalls, [[
      { role: 'user', content: 'hello' },
      { role: 'user', content: 'world' },
    ]]);
  });

  it('returns guarded response without calling LlmClient when InputGuard blocks', async () => {
    const { service, completeCalled } = createChatService({
      inputGuard: {
        inspect: async () => ({
          blocked: true,
          reason: 'out_of_scope',
          response: 'Guarded message',
        }),
      },
    });

    const response = await service.chat({
      messages: [{ role: 'user', content: 'recipe please' }],
    });

    assert.equal(completeCalled(), false);
    assert.equal(response.message.content, 'Guarded message');
    assert.equal(response.message.role, 'assistant');
    assert.equal(response.assistant.name, ASSISTANT_NAME);
    assert.equal(response.assistant.roleDescription, ASSISTANT_ROLE_DESCRIPTION);
    assert.deepEqual(response.usage, {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    });
  });

  it('throws HTTP 429 when TokenBudget.canSpend returns false', async () => {
    const resetsAt = new Date('2026-06-05T13:00:00.000Z');
    const { service, completeCalled } = createChatService({
      tokenBudget: {
        canSpend: () => false,
        snapshot: () => ({ used: 20_000, limit: 20_000, resetsAt }),
      },
    });

    await assert.rejects(
      () => service.chat({ messages: [{ role: 'user', content: 'hello' }] }),
      (error: unknown) => {
        assert.ok(error instanceof HttpException);
        assert.equal(error.getStatus(), HttpStatus.TOO_MANY_REQUESTS);
        assert.deepEqual(error.getResponse(), {
          message: 'Hourly token budget exceeded. Try again after the reset time.',
          budget: {
            used: 20_000,
            limit: 20_000,
            resetsAt: resetsAt.toISOString(),
          },
        });
        return true;
      },
    );

    assert.equal(completeCalled(), false);
  });

  it('returns assistant message, usage and spends total_tokens on successful completion', async () => {
    const resetsAt = new Date('2026-06-05T13:00:00.000Z');
    const { service, spendCalls } = createChatService({
      tokenBudget: {
        canSpend: () => true,
        snapshot: () => ({ used: 100, limit: 20_000, resetsAt }),
      },
      llmClient: {
        complete: async () => ({
          content: 'Assistant reply',
          usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
        }),
      },
    });

    const response = await service.chat({
      messages: [{ role: 'user', content: 'hi' }],
    });

    assert.equal(response.message.content, 'Assistant reply');
    assert.equal(response.message.role, 'assistant');
    assert.equal(response.assistant.name, ASSISTANT_NAME);
    assert.deepEqual(response.usage, {
      prompt_tokens: 12,
      completion_tokens: 8,
      total_tokens: 20,
    });
    assert.deepEqual(spendCalls, [20]);
    assert.deepEqual(response.budget, {
      used: 100,
      limit: 20_000,
      resetsAt: resetsAt.toISOString(),
    });
  });
});
