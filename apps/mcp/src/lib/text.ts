export function countWords(text: string): number {
  const normalized = text.trim();
  return normalized.length === 0 ? 0 : normalized.split(/\s+/).length;
}

export function countLines(text: string): number {
  return text.length === 0 ? 0 : text.split(/\r?\n/).length;
}

export function toSnakeCaseValue(text: string): string {
  return text
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z\d]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}
