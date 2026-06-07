import { Controller, Get, Inject, Param, Query, Req } from '@nestjs/common';
import { MockJiraService } from './mock-jira.service';

interface HttpRequest {
  protocol: string;
  get(name: string): string | undefined;
}

@Controller('mock-jira')
export class MockJiraController {
  constructor(@Inject(MockJiraService) private readonly mockJiraService: MockJiraService) {}

  @Get('tasks')
  listTasks(@Query('q') query?: string) {
    return {
      tasks: this.mockJiraService.searchTasks(query),
    };
  }

  @Get('tasks/:key')
  getTask(@Param('key') key: string) {
    return this.mockJiraService.getTask(key);
  }
}

@Controller('rest/api/3')
export class MockJiraRestController {
  constructor(@Inject(MockJiraService) private readonly mockJiraService: MockJiraService) {}

  @Get('issue/:key')
  getIssue(@Param('key') key: string, @Req() request: HttpRequest) {
    return this.mockJiraService.getIssue(key, this.getBaseUrl(request));
  }

  @Get('search')
  search(
    @Req() request: HttpRequest,
    @Query('jql') jql?: string,
    @Query('startAt') startAt?: string,
    @Query('maxResults') maxResults?: string,
  ) {
    return this.mockJiraService.searchIssues({
      jql,
      startAt: startAt ? Number(startAt) : undefined,
      maxResults: maxResults ? Number(maxResults) : undefined,
      baseUrl: this.getBaseUrl(request),
    });
  }

  private getBaseUrl(request: HttpRequest): string {
    return `${request.protocol}://${request.get('host')}/api`;
  }
}
