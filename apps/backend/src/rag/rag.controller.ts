import { Body, Controller, Inject, Post } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagAskRequest, RagAskResponse } from './rag.types';

@Controller('rag')
export class RagController {
  constructor(@Inject(RagService) private readonly ragService: RagService) {}

  @Post('ask')
  ask(@Body() body: RagAskRequest): RagAskResponse {
    return this.ragService.ask(body);
  }
}
