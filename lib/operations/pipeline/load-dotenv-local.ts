/**
 * Minimal, dependency-free `.env.local` loader for CLI scripts.
 *
 * Only reads an existing, git-ignored, user-managed `.env.local` (same file
 * Next.js itself reads) — never writes one, never creates one, never
 * overrides a variable already present in the real environment.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function loadDotEnvLocalIfPresent(rootDir: string): void {
  const path = join(rootDir, ".env.local");
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
