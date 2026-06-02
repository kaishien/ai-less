import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatController } from './chat/chat.controller';
import { ChatService, LLM_CLIENT } from './chat/chat.service';
import { OpenAiLlmClient } from './chat/openai-llm.client';
import { TokenBudget } from './chat/token-budget';

@Module({
  imports: [],
  controllers: [AppController, ChatController],
  providers: [
    AppService,
    ChatService,
    TokenBudget,
    {
      provide: LLM_CLIENT,
      useClass: OpenAiLlmClient,
    },
  ],
})
export class AppModule {}
