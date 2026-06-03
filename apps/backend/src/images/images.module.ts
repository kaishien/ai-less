import { Module } from '@nestjs/common';
import { GuardModule } from '../common/guard/guard.module';
import { OpenAiModule } from '../common/openai/openai.module';
import { IMAGE_CLIENT, ImagesService } from './images.service';
import { OpenAiImageClient } from './openai-image.client';

@Module({
  imports: [GuardModule, OpenAiModule],
  providers: [
    ImagesService,
    {
      provide: IMAGE_CLIENT,
      useClass: OpenAiImageClient,
    },
  ],
  exports: [ImagesService],
})
export class ImagesModule {}
