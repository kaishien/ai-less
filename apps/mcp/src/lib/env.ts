import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

const MODULE_DIR = import.meta.dirname ?? import.meta.dir;
const PACKAGE_ROOT = path.join(MODULE_DIR, "../..");

const ENV_FILES = [".env", ".env.local"] as const;

function loadEnvFiles(): void {
  for (const file of ENV_FILES) {
    const envPath = path.join(PACKAGE_ROOT, file);

    if (!existsSync(envPath)) {
      continue;
    }

    const parsedEnv = parseEnv(readFileSync(envPath, "utf8"));

    for (const [name, value] of Object.entries(parsedEnv)) {
      process.env[name] ??= value;
    }
  }
}

loadEnvFiles();

export function env(name: string): string | undefined {
  return typeof Bun === "undefined" ? process.env[name] : Bun.env[name];
}

export function requireEnv(name: string): string {
  const value = env(name)?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
