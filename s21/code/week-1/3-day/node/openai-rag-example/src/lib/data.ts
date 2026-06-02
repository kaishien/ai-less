import fs from "node:fs/promises";
import path from "node:path";

// Список текстовых файлов в директории
export async function listTextFiles(dataDir: string): Promise<string[]> {
  const entries = await fs.readdir(dataDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => path.join(dataDir, e.name))
    .filter((p) => p.toLowerCase().endsWith(".txt"));
}

