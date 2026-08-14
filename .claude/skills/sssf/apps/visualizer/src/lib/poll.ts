import { fetchConfig } from './api'

export const DEFAULT_POLL_MS = 500

let cached: Promise<number> | undefined

/** Visualizer live-poll cadence from observability.poll_ms, default 500. */
export function fetchPollMs(): Promise<number> {
  cached ??= fetchConfig()
    .then((cfg) => normalizePollMs(cfg.observability?.poll_ms))
    .catch(() => DEFAULT_POLL_MS)
  return cached
}

export function normalizePollMs(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_POLL_MS
  const ms = Math.trunc(raw)
  return ms >= 1 ? ms : DEFAULT_POLL_MS
}
