import { DEFAULT_POLL_MS, normalizePollMs } from '@shared/poll'
import { fetchConfig } from './api'

let cached: Promise<number> | undefined

/** Visualizer live-poll cadence from observability.poll_ms, default 500. */
export function fetchPollMs(): Promise<number> {
  cached ??= fetchConfig()
    .then((cfg) => normalizePollMs(cfg.observability?.poll_ms))
    .catch(() => DEFAULT_POLL_MS)
  return cached
}
