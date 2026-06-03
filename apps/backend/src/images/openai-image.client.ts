import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ImageClient, ImageRequest, ImageResponse } from './images.types';
import { OpenAiClientProvider } from '../common/openai/openai-client.provider';

@Injectable()
export class OpenAiImageClient implements ImageClient {
  private readonly model = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1';

  constructor(@Inject(OpenAiClientProvider) private readonly openAiClient: OpenAiClientProvider) {}

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
    return this.openAiClient.getClient();
  }
}
