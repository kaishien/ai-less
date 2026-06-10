import 'dotenv/config';
import { startLangfuseInstrumentation, shutdownLangfuseInstrumentation } from './common/langfuse/instrumentation';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { installConsoleLogCapture } from './dev-agents/logs/install-console-log-capture';

startLangfuseInstrumentation();
installConsoleLogCapture();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  });
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

const shutdown = async () => {
  await shutdownLangfuseInstrumentation();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

void bootstrap();
