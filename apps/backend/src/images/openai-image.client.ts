import OpenAI from 'openai';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ImageClient, ImageRequest, ImageResponse } from './images.types';

@Injectable()
export class OpenAiImageClient implements ImageClient {
  private client: OpenAI | null = null;
  private readonly model = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1';

  async generate(request: Required<ImageRequest>): Promise<ImageResponse> {
    const result = await this.getClient().images.generate({
      model: this.model,
      prompt: request.prompt,
      size: request.size,
      quality: request.quality,
      n: 1,
    });

    const image = result.data?.[0]?.b64_json;

    if (!image) {
      throw new HttpException(
        {
          message: 'Image provider did not return image data.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    console.log(`[images] total_tokens=${result.usage?.total_tokens ?? 0}`);

    return {
      prompt: request.prompt,
      image: {
        dataUrl: `data:image/png;base64,${image}`,
        mimeType: 'image/png',
      },
      usage: result.usage
        ? {
            total_tokens: result.usage.total_tokens,
            input_tokens: result.usage.input_tokens,
            output_tokens: result.usage.output_tokens,
          }
        : undefined,
    };
  }

  private getClient() {
    if (this.client) {
      return this.client;
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new HttpException(
        {
          message: 'OPENAI_API_KEY is required to call /api/images.',
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
