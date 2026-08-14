/**
 * The visualizer's live-poll cadence — one definition for both sides.
 *
 * The server reads observability.poll_ms out of sssf.config.yaml and the client
 * schedules its refresh timers on it, so the fallback and the validation rules
 * have to agree. YAML can hand back a numeric string, so a numeric string
 * coerces; anything else (missing, zero, negative, non-numeric) falls back to
 * the documented default of 500 (references/observability.md).
 */

export const DEFAULT_POLL_MS = 500;

export function normalizePollMs(raw: unknown): number {
  const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_POLL_MS;
  const ms = Math.trunc(n);
  return ms >= 1 ? ms : DEFAULT_POLL_MS;
}
