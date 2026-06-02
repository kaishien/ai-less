import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatService, LLM_CLIENT } from './chat.service';
import { TokenBudget } from './token-budget';
import { LlmClient } from './chat.types';

class FakeRateLimitClient implements LlmClient {
  calls = 0;

  async complete() {
    this.calls += 1;

    if (this.calls <= 2) {
      const error = new Error('rate limited') as Error & { status: number };
      error.status = 429;
      throw error;
    }

    return {
      content: 'ok after retry',
      usage: {
        prompt_tokens: 12,
        completion_tokens: 4,
        total_tokens: 16,
      },
    };
  }

  async stream() {
    return {
      async *[Symbol.asyncIterator]() {
        yield {
          delta: 'ok',
        };
      },
    };
  }
}

test('retries only rate limit failures before returning a chat response', async () => {
  const fakeClient = new FakeRateLimitClient();
  const service = new ChatService(fakeClient, new TokenBudget());

  const response = await service.chat({
    messages: [{ role: 'user', content: 'test retry' }],
  });

  assert.equal(fakeClient.calls, 3);
  assert.equal(response.message.content, 'ok after retry');
  assert.equal(response.usage.total_tokens, 16);
});

test('does not retry non-rate-limit failures', async () => {
  let calls = 0;
  const client: LlmClient = {
    async complete() {
      calls += 1;
      throw new Error('provider failed');
    },
    async stream() {
      throw new Error('provider failed');
    },
  };
  const service = new ChatService(client, new TokenBudget());

  await assert.rejects(
    () =>
      service.chat({
        messages: [{ role: 'user', content: 'test non retry' }],
      }),
    /provider failed/,
  );
  assert.equal(calls, 1);
});

test('streams deltas and final usage', async () => {
  const client: LlmClient = {
    async complete() {
      throw new Error('not used');
    },
    async stream() {
      return {
        async *[Symbol.asyncIterator]() {
          yield { delta: 'hello' };
          yield { delta: ' world' };
          yield {
            usage: {
              prompt_tokens: 10,
              completion_tokens: 2,
              total_tokens: 12,
            },
          };
        },
      };
    },
  };
  const service = new ChatService(client, new TokenBudget());

  const events = [];
  for await (const event of service.streamChat({ messages: [{ role: 'user', content: 'stream' }] })) {
    events.push(event);
  }

  assert.equal(events[0].type, 'assistant');
  assert.deepEqual(events.slice(1, 3), [
    { type: 'delta', delta: 'hello' },
    { type: 'delta', delta: ' world' },
  ]);
  assert.equal(events.at(-1)?.type, 'done');
  assert.equal(events.at(-1)?.type === 'done' ? events.at(-1)?.message.content : '', 'hello world');
  assert.equal(events.at(-1)?.type === 'done' ? events.at(-1)?.usage.total_tokens : 0, 12);
});

void LLM_CLIENT;
