import { onUnmounted } from 'vue'
import { fetchPollMs } from './poll'

/**
 * A live-refresh timer running at the configured observability.poll_ms cadence.
 *
 * The cadence is fetched, so a caller can stop — or the component unmount —
 * before it arrives. This owns that race and the unmount teardown, so no caller
 * has to remember the cancellation guard: a `stop` beats a `start` still
 * awaiting the cadence, and it beats it without disabling a later `start`.
 * `start` is idempotent: it is a no-op while a timer is already running.
 */
export function usePolling(tick: () => void | Promise<void>) {
  let timer: ReturnType<typeof setInterval> | undefined
  let cancelled = false
  /** Bumped by every stop, so a start that predates it knows it lost. */
  let generation = 0

  function stop() {
    generation += 1
    clearInterval(timer)
    timer = undefined
  }

  async function start() {
    if (cancelled || timer) return
    const started = generation
    const ms = await fetchPollMs()
    if (cancelled || timer || generation !== started) return
    timer = setInterval(() => void tick(), ms)
  }

  onUnmounted(() => {
    cancelled = true
    stop()
  })

  return { start, stop }
}
