import { Module } from '@nestjs/common';
import { OpenAiModule } from '../openai/openai.module';
import { GUARD_CLIENT, InputGuard } from './input-guard';
import { OpenAiGuardClient } from './openai-guard.client';

@Module({
  imports: [OpenAiModule],
  providers: [
    InputGuard,
    {
      provide: GUARD_CLIENT,
      useClass: OpenAiGuardClient,
    },
  ],
  exports: [InputGuard],
})
export class GuardModule {}
