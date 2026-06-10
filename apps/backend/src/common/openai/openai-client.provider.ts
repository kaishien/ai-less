import OpenAI from 'openai';
import { observeOpenAI } from '@langfuse/openai';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { isLangfuseEnabled } from '../langfuse/langfuse-env';

@Injectable()
export class OpenAiClientProvider {
  private client: OpenAI | null = null;

  getClient() {
    if (this.client) {
      return this.client;
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new HttpException(
        {
          message: 'OPENAI_API_KEY is required to call OpenAI-backed endpoints.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.client = isLangfuseEnabled()
      ? observeOpenAI(openai, {
          tags: ['ai-less', 'openai'],
        })
      : openai;

    return this.client;
  }
}
