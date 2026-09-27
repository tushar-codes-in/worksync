// Lightweight `ms` parser to avoid an extra dependency.
// Supports: `<n>ms|s|m|h|d`, e.g. "15m", "30d". Returns milliseconds.
const UNIT: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDurationMs(input: string): number {
  const m = /^(\d+)(ms|s|m|h|d)$/.exec(input.trim());
  if (!m) throw new Error(`Invalid duration: ${input}`);
  return Number(m[1]) * UNIT[m[2]];
}
