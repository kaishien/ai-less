export interface NdjsonResponse {
  setHeader(name: string, value: string): void;
  flushHeaders?(): void;
  flush?(): void;
  write(chunk: string): void;
  end(): void;
}

export async function writeNdjsonResponse<T>(
  response: NdjsonResponse,
  stream: AsyncIterable<T>,
  options: { errorType?: string } = {},
) {
  response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders?.();

  try {
    for await (const event of stream) {
      response.write(`${JSON.stringify(event)}\n`);
      response.flush?.();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown stream error';
    response.write(`${JSON.stringify({ type: options.errorType ?? 'error', message })}\n`);
    response.flush?.();
  } finally {
    response.end();
  }
}
