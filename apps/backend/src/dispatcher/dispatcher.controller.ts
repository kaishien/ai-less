import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { DispatcherService } from './dispatcher.service';
import {
  DispatcherGraphResponse,
  DispatcherInputSummary,
  DispatcherRunRequest,
  DispatcherRunResponse,
} from './dispatcher.types';

@Controller('dispatcher')
export class DispatcherController {
  constructor(@Inject(DispatcherService) private readonly dispatcherService: DispatcherService) {}

  @Get('inputs')
  inputs(): Promise<DispatcherInputSummary[]> {
    return this.dispatcherService.listInputs();
  }

  @Get('graph')
  graph(): DispatcherGraphResponse {
    return this.dispatcherService.graph();
  }

  @Post('run')
  run(@Body() body: DispatcherRunRequest): Promise<DispatcherRunResponse> {
    return this.dispatcherService.run(body);
  }
}
