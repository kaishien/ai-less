import { Module } from '@nestjs/common';
import { MockJiraController, MockJiraRestController } from './mock-jira.controller';
import { MockJiraService } from './mock-jira.service';

@Module({
  controllers: [MockJiraController, MockJiraRestController],
  providers: [MockJiraService],
})
export class MockJiraModule {}
