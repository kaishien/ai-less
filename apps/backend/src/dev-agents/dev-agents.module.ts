import { Module } from '@nestjs/common';
import { DevAgentsController } from './dev-agents.controller';
import { DevAgentsModelFactory } from './dev-agents-model.factory';
import { DevAgentsService } from './dev-agents.service';
import { ReadmeGeneratorService } from './readme-generator.service';
import { SessionLogsService } from './session-logs.service';

@Module({
  controllers: [DevAgentsController],
  providers: [DevAgentsModelFactory, DevAgentsService, ReadmeGeneratorService, SessionLogsService],
})
export class DevAgentsModule {}
