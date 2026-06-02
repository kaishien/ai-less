import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ImagesModule } from './modules/images/images.module';

@Module({
  imports: [ImagesModule],
  controllers: [AppController],
})
export class AppModule {}
