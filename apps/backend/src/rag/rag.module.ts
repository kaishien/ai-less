import { Module } from '@nestjs/common';
import { OpenAiModule } from '../common/openai/openai.module';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

@Module({
  imports: [OpenAiModule],
  controllers: [RagController],
  providers: [RagService],
})
export class RagModule {}
