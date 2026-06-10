export function isLangfuseEnabled(): boolean {
  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

/** Langfuse v5 trace metadata values must be strings (≤200 chars). */
export function normalizeTraceMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, string> | undefined {
  if (!metadata) {
    return undefined;
  }

  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) {
      continue;
    }

    const text = typeof value === 'string' ? value : JSON.stringify(value);
    normalized[key] = text.length <= 200 ? text : `${text.slice(0, 197)}...`;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
