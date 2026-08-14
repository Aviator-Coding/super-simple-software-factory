import { onUnmounted } from 'vue'
import { fetchPollMs } from './poll'

/**
 * A live-refresh timer running at the configured observability.poll_ms cadence.
 *
 * The cadence is fetched, so a component can unmount before it arrives. This
 * owns that race and the unmount teardown, so no caller has to remember the
 * cancellation guard. `start` is idempotent: it is a no-op while a timer is
 * already running.
 */
export function usePolling(tick: () => void | Promise<void>) {
  let timer: ReturnType<typeof setInterval> | undefined
  let cancelled = false

  function stop() {
    clearInterval(timer)
    timer = undefined
  }

  async function start() {
    if (cancelled || timer) return
    const ms = await fetchPollMs()
    if (cancelled || timer) return
    timer = setInterval(() => void tick(), ms)
  }

  onUnmounted(() => {
    cancelled = true
    stop()
  })

  return { start, stop }
}
