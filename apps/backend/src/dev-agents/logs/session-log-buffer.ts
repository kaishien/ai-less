import { inspect } from 'node:util';

export type SessionLogLevel = 'log' | 'warn' | 'error' | 'debug';

export interface SessionLogEntry {
  id: string;
  timestamp: string;
  level: SessionLogLevel;
  message: string;
  stack?: string;
}

const MAX_LOGS = 800;
const MAX_FIELD_LENGTH = 12_000;
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/(OPENAI_API_KEY\s*=\s*)[^\s]+/gi, '$1[REDACTED]'],
  [/(ANTHROPIC_API_KEY\s*=\s*)[^\s]+/gi, '$1[REDACTED]'],
  [/(LANGFUSE_SECRET_KEY\s*=\s*)[^\s]+/gi, '$1[REDACTED]'],
  [/(Authorization:\s*Bearer\s+)[^\s]+/gi, '$1[REDACTED]'],
  [/(api[_-]?key["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, '$1[REDACTED]'],
  [/(secret["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, '$1[REDACTED]'],
  [/(password["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, '$1[REDACTED]'],
  [/sk-[A-Za-z0-9_-]{12,}/g, 'sk-[REDACTED]'],
];

class SessionLogBuffer {
  private entries: SessionLogEntry[] = [];
  private nextId = 1;

  add(level: SessionLogLevel, args: unknown[]) {
    const { message, stack } = this.serializeArgs(args);
    this.addMessage(level, message, stack);
  }

  addMessage(level: SessionLogLevel, message: string, stack?: string) {
    const entry: SessionLogEntry = {
      id: String(this.nextId++),
      timestamp: new Date().toISOString(),
      level,
      message: this.truncate(redactSecrets(message)),
      stack: stack ? this.truncate(redactSecrets(stack)) : undefined,
    };

    this.entries.push(entry);

    if (this.entries.length > MAX_LOGS) {
      this.entries.splice(0, this.entries.length - MAX_LOGS);
    }
  }

  list({ limit = 100, level = 'all' }: { limit?: number; level?: SessionLogLevel | 'all' } = {}) {
    const safeLimit = Math.max(1, Math.min(limit, MAX_LOGS));
    const filtered = level === 'all' ? this.entries : this.entries.filter((entry) => entry.level === level);

    return filtered.slice(-safeLimit).reverse();
  }

  clear() {
    this.entries = [];
  }

  private serializeArgs(args: unknown[]) {
    const rendered = args.map((arg) => {
      if (arg instanceof Error) {
        return arg.message;
      }

      return typeof arg === 'string'
        ? arg
        : inspect(arg, {
            depth: 4,
            breakLength: 140,
            colors: false,
          });
    });
    const stacks = args
      .filter((arg): arg is Error => arg instanceof Error)
      .map((error) => error.stack)
      .filter((stack): stack is string => Boolean(stack));

    return {
      message: rendered.join(' '),
      stack: stacks.join('\n\n') || undefined,
    };
  }

  private truncate(value: string) {
    return value.length > MAX_FIELD_LENGTH ? `${value.slice(0, MAX_FIELD_LENGTH)}\n[truncated]` : value;
  }
}

export const sessionLogBuffer = new SessionLogBuffer();

export function redactSecrets(value: string) {
  return SECRET_PATTERNS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), value);
}
