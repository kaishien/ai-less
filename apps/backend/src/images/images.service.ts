import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ImageClient, ImageRequest, ImageResponse } from './images.types';
import { InputGuard } from '../chat/input-guard';

export const IMAGE_CLIENT = Symbol('IMAGE_CLIENT');

@Injectable()
export class ImagesService {
  constructor(
    @Inject(IMAGE_CLIENT) private readonly imageClient: ImageClient,
    @Inject(InputGuard) private readonly inputGuard: InputGuard,
  ) {}

  async generate(request: ImageRequest): Promise<ImageResponse> {
    const prompt = String(request.prompt ?? '').trim();

    if (!prompt) {
      throw new HttpException(
        {
          message: 'Image prompt is required.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const guard = await this.inputGuard.inspect([{ role: 'user', content: prompt }]);

    if (guard.blocked && guard.reason === 'prompt_injection') {
      throw new HttpException(
        {
          message: guard.response,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.imageClient.generate({
      prompt,
      size: request.size ?? '1024x1024',
      quality: request.quality ?? 'low',
    });
  }
}
