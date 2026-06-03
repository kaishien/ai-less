import OpenAI from 'openai';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

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

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    return this.client;
  }
}
