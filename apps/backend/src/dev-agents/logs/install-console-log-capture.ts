import { sessionLogBuffer, SessionLogLevel } from './session-log-buffer';

let installed = false;
let forwardingConsoleOutput = false;

export function installConsoleLogCapture() {
  if (installed) {
    return;
  }

  installed = true;
  wrapConsoleMethod('log');
  wrapConsoleMethod('warn');
  wrapConsoleMethod('error');
  wrapConsoleMethod('debug');
  wrapStreamWrite(process.stdout, 'log');
  wrapStreamWrite(process.stderr, 'error');
}

function wrapConsoleMethod(level: SessionLogLevel) {
  const original = console[level].bind(console);

  console[level] = (...args: unknown[]) => {
    sessionLogBuffer.add(level, args);
    forwardingConsoleOutput = true;
    try {
      original(...args);
    } finally {
      forwardingConsoleOutput = false;
    }
  };
}

function wrapStreamWrite(stream: NodeJS.WriteStream, level: SessionLogLevel) {
  const original = stream.write.bind(stream);

  stream.write = ((chunk: unknown, encoding?: BufferEncoding | ((error?: Error | null) => void), callback?: (error?: Error | null) => void) => {
    if (!forwardingConsoleOutput) {
      const message = renderStreamChunk(chunk);

      if (message.trim()) {
        sessionLogBuffer.add(level, [message]);
      }
    }

    return original(chunk as string | Uint8Array, encoding as BufferEncoding, callback);
  }) as NodeJS.WriteStream['write'];
}

function renderStreamChunk(chunk: unknown) {
  if (typeof chunk === 'string') {
    return stripAnsi(chunk);
  }

  if (chunk instanceof Uint8Array) {
    return stripAnsi(Buffer.from(chunk).toString('utf8'));
  }

  return String(chunk);
}

function stripAnsi(value: string) {
  return value.replace(/\u001b\[[0-9;]*m/g, '').trimEnd();
}
