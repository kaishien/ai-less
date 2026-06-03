import { Module } from '@nestjs/common';
import { GuardModule } from '../common/guard/guard.module';
import { OpenAiModule } from '../common/openai/openai.module';
import { ImagesModule } from '../images/images.module';
import { ChatController } from './chat.controller';
import { ChatService, LLM_CLIENT } from './chat.service';
import { OpenAiLlmClient } from './openai-llm.client';
import { TokenBudget } from './token-budget';

@Module({
  imports: [GuardModule, ImagesModule, OpenAiModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    TokenBudget,
    {
      provide: LLM_CLIENT,
      useClass: OpenAiLlmClient,
    },
  ],
})
export class ChatModule {}
