import { Inject, Injectable } from '@nestjs/common';
import { ASSISTANT_NAME } from '../../chat/assistant-profile';
import { ChatMessage, GuardClient, GuardDecision } from '../../chat/chat.types';

export const GUARD_CLIENT = Symbol('GUARD_CLIENT');

export interface InputGuardResult {
  blocked: boolean;
  reason?: string;
  response?: string;
}

const RESPONSES: Record<Exclude<GuardDecision, 'allow'>, { reason: string; response: string }> = {
  prompt_injection: {
    reason: 'prompt_injection',
    response:
      'Я не могу выполнять инструкции, которые пытаются сменить мою роль, раскрыть внутренние правила или обойти ограничения. Могу помочь с технической задачей по API, TypeScript, backend, тестированию или безопасной LLM-интеграции.',
  },
  out_of_scope: {
    reason: 'out_of_scope',
    response: `${ASSISTANT_NAME} работает как технический наставник и отвечает только на вопросы по разработке ПО, архитектуре, API, тестам и безопасной интеграции LLM. Могу помочь, например, спроектировать API, написать типы данных или тесты для backend.`,
  },
};

@Injectable()
export class InputGuard {
  constructor(@Inject(GUARD_CLIENT) private readonly client: GuardClient) {}

  async inspect(messages: ChatMessage[]): Promise<InputGuardResult> {
    const hasUserMessage = messages.some((message) => message.role === 'user');

    if (!hasUserMessage) {
      return { blocked: false };
    }

    const decision = await this.classifySafely(messages);

    if (decision === 'allow') {
      return { blocked: false };
    }

    const { reason, response } = RESPONSES[decision];
    return { blocked: true, reason, response };
  }

  private async classifySafely(messages: ChatMessage[]): Promise<GuardDecision> {
    try {
      return await this.client.classify(messages);
    } catch (error) {
      // Fail open: the system prompt is the primary defense, so a guard
      // outage must not take chat down. We just lose the cheap pre-filter.
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[chat] guard_classifier_error message=${message}`);
      return 'allow';
    }
  }
}
