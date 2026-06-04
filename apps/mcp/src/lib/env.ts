import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

const PACKAGE_ROOT = path.join(import.meta.dir, "../..");

const ENV_FILES = [".env", ".env.local"] as const;

function loadEnvFiles(): void {
  for (const file of ENV_FILES) {
    const envPath = path.join(PACKAGE_ROOT, file);

    if (!existsSync(envPath)) {
      continue;
    }

    Object.assign(process.env, parseEnv(readFileSync(envPath, "utf8")));
  }
}

loadEnvFiles();

export function env(name: string): string | undefined {
  return Bun.env[name];
}

export function requireEnv(name: string): string {
  const value = Bun.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
