import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { join } from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const generatedDir = join(process.cwd(), 'generated');
  if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir);

  app.useStaticAssets(generatedDir, { prefix: '/generated' });
  app.useStaticAssets(join(process.cwd(), 'public'));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running → http://localhost:${port}`);
}

bootstrap();
