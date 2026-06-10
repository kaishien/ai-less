import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { isLangfuseEnabled } from './langfuse-env';

let sdk: NodeSDK | null = null;

export function startLangfuseInstrumentation(): void {
  if (!isLangfuseEnabled() || sdk) {
    return;
  }

  sdk = new NodeSDK({
    spanProcessors: [new LangfuseSpanProcessor()],
  });

  sdk.start();
}

export async function shutdownLangfuseInstrumentation(): Promise<void> {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  sdk = null;
}
