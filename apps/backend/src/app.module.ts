import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [ChatModule, RagModule],
})
export class AppModule {}
