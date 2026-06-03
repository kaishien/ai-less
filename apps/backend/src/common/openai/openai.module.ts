import { Global, Module } from '@nestjs/common';
import { OpenAiClientProvider } from './openai-client.provider';

@Global()
@Module({
  providers: [OpenAiClientProvider],
  exports: [OpenAiClientProvider],
})
export class OpenAiModule {}
