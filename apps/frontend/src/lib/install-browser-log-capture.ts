type BrowserLogLevel = 'log' | 'warn' | 'error' | 'debug';

const MAX_MESSAGE_LENGTH = 12_000;
let installed = false;
let forwardingConsoleOutput = false;

export function installBrowserLogCapture() {
  if (installed || typeof window === 'undefined') {
    return;
  }

  installed = true;
  wrapConsoleMethod('log');
  wrapConsoleMethod('warn');
  wrapConsoleMethod('error');
  wrapConsoleMethod('debug');

  window.addEventListener('error', (event) => {
    sendBrowserLog({
      level: 'error',
      message: event.message || 'window.error',
      stack: formatErrorLocation(event.filename, event.lineno, event.colno),
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    sendBrowserLog({
      level: 'error',
      message: 'unhandledrejection',
      stack: stringifyLogValue(event.reason),
    });
  });
}

function wrapConsoleMethod(level: BrowserLogLevel) {
  const original = console[level].bind(console);

  console[level] = (...args: unknown[]) => {
    if (!forwardingConsoleOutput) {
      sendBrowserLog({
        level,
        message: args.map(stringifyLogValue).join(' '),
        stack: args.filter((arg): arg is Error => arg instanceof Error).map((error) => error.stack).join('\n\n') || undefined,
      });
    }

    forwardingConsoleOutput = true;
    try {
      original(...args);
    } finally {
      forwardingConsoleOutput = false;
    }
  };
}

function sendBrowserLog(log: { level: BrowserLogLevel; message: string; stack?: string }) {
  const body = JSON.stringify({
    source: 'frontend',
    level: log.level,
    message: truncate(log.message),
    stack: log.stack ? truncate(log.stack) : undefined,
  });

  void fetch('/api/dev-agents/session-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

function stringifyLogValue(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatErrorLocation(filename: string, lineNumber: number, columnNumber: number) {
  return [filename, lineNumber, columnNumber].filter(Boolean).join(':');
}

function truncate(value: string) {
  return value.length > MAX_MESSAGE_LENGTH ? `${value.slice(0, MAX_MESSAGE_LENGTH)}\n[truncated]` : value;
}
