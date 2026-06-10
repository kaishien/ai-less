import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { DevAgentsModule } from './dev-agents/dev-agents.module';
import { DispatcherModule } from './dispatcher/dispatcher.module';
import { MockJiraModule } from './mock-jira/mock-jira.module';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [ChatModule, RagModule, MockJiraModule, DevAgentsModule, DispatcherModule],
})
export class AppModule {}
