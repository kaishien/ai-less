import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { MockJiraModule } from './mock-jira/mock-jira.module';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [ChatModule, RagModule, MockJiraModule],
})
export class AppModule {}
