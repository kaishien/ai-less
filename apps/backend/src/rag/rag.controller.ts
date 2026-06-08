import { Body, Controller, Inject, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RagService, UploadedTextFile } from './rag.service';
import {
  RagAskRequest,
  RagAskResponse,
  RagEvaluationRequest,
  RagEvaluationResponse,
  RagIndexResponse,
  RagSearchResponse,
  RagUploadResponse,
} from './rag.types';
import { writeNdjsonResponse } from '../common/streaming/ndjson-response';

@Controller('rag')
export class RagController {
  constructor(@Inject(RagService) private readonly ragService: RagService) {}

  @Post('ask')
  ask(@Body() body: RagAskRequest): Promise<RagAskResponse> {
    return this.ragService.ask(body);
  }

  @Post('search')
  search(@Body() body: RagAskRequest): Promise<RagSearchResponse> {
    return this.ragService.searchOnly(body);
  }

  @Post('evaluate')
  evaluate(@Body() body: RagEvaluationRequest = {}): Promise<RagEvaluationResponse> {
    return this.ragService.evaluate(body);
  }

  @Post('ask/stream')
  async askStream(@Body() body: RagAskRequest, @Res() response: any) {
    await writeNdjsonResponse(response, this.ragService.askStream(body));
  }

  @Post('index')
  index(): Promise<RagIndexResponse> {
    return this.ragService.indexDocuments();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  upload(@UploadedFile() file?: UploadedTextFile): Promise<RagUploadResponse> {
    return this.ragService.uploadDocument(file);
  }
}
