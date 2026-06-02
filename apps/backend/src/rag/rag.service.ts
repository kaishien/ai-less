import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RagAskRequest, RagAskResponse } from './rag.types';

@Injectable()
export class RagService {
  ask(request: RagAskRequest): RagAskResponse {
    const question = String(request.question ?? '').trim();

    if (!question) {
      throw new HttpException(
        {
          message: 'Question is required.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    throw new HttpException(
      {
        message: 'RAG retrieval is not implemented yet.',
      },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
