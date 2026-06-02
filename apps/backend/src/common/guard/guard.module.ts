import { Module } from '@nestjs/common';
import { GUARD_CLIENT, InputGuard } from './input-guard';
import { OpenAiGuardClient } from './openai-guard.client';

@Module({
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
