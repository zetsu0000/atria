/**
 * Minimal argv parser shared by the controlled-automation CLI entrypoints.
 * No external dependency — flags are `--name` (boolean) or `--name value`.
 */
export type ParsedArgs = {
  flags: Set<string>;
  values: Map<string, string>;
};

export function parseArgs(argv: string[]): ParsedArgs {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    const name = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      values.set(name, next);
      i++;
    } else {
      flags.add(name);
    }
  }
  return { flags, values };
}

export function getValue(args: ParsedArgs, name: string, fallback?: string): string | undefined {
  return args.values.get(name) ?? fallback;
}

export function getIntValue(args: ParsedArgs, name: string, fallback: number): number {
  const raw = args.values.get(name);
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function getListValue(args: ParsedArgs, name: string): string[] {
  const raw = args.values.get(name);
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
