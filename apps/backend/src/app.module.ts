import { Module } from '@nestjs/common';
import { ChatController } from './chat/chat.controller';
import { ChatService, LLM_CLIENT } from './chat/chat.service';
import { GUARD_CLIENT, InputGuard } from './chat/input-guard';
import { OpenAiGuardClient } from './chat/openai-guard.client';
import { OpenAiLlmClient } from './chat/openai-llm.client';
import { TokenBudget } from './chat/token-budget';
import { IMAGE_CLIENT, ImagesService } from './images/images.service';
import { OpenAiImageClient } from './images/openai-image.client';

@Module({
  imports: [],
  controllers: [ChatController],
  providers: [
    ChatService,
    TokenBudget,
    InputGuard,
    {
      provide: LLM_CLIENT,
      useClass: OpenAiLlmClient,
    },
    {
      provide: GUARD_CLIENT,
      useClass: OpenAiGuardClient,
    },
    ImagesService,
    {
      provide: IMAGE_CLIENT,
      useClass: OpenAiImageClient,
    },
  ],
})
export class AppModule {}
