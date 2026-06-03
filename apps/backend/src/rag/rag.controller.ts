import { Body, Controller, Inject, Post, Res } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagAskRequest, RagAskResponse, RagIndexResponse } from './rag.types';
import { writeNdjsonResponse } from '../common/streaming/ndjson-response';

@Controller('rag')
export class RagController {
  constructor(@Inject(RagService) private readonly ragService: RagService) {}

  @Post('ask')
  ask(@Body() body: RagAskRequest): Promise<RagAskResponse> {
    return this.ragService.ask(body);
  }

  @Post('ask/stream')
  async askStream(@Body() body: RagAskRequest, @Res() response: any) {
    await writeNdjsonResponse(response, this.ragService.askStream(body));
  }

  @Post('index')
  index(): Promise<RagIndexResponse> {
    return this.ragService.indexDocuments();
  }
}
