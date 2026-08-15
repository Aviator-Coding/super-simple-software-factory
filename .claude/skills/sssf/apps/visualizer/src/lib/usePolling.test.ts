/**
 * The cadence arrives from /api/config, so there is a window where a component
 * has asked to start polling and nothing is scheduled yet. A run that ends in
 * that window calls stop() (SessionCard does exactly this), and the timer must
 * never appear afterwards — while a later start() still has to work.
 *
 * setInterval is stubbed rather than awaited: the assertion is whether a timer
 * was installed at all, which is a fact, not a duration.
 */
import { afterEach, expect, mock, test } from "bun:test";

// The scheduling logic under test is vue-independent, and the rest of this
// suite runs without an install; stubbing the one vue import keeps it that way.
mock.module("vue", () => ({ onUnmounted: () => {} }));

const realFetch = globalThis.fetch;
const realSetInterval = globalThis.setInterval;
const timers: ReturnType<typeof realSetInterval>[] = [];

afterEach(() => {
  globalThis.fetch = realFetch;
  globalThis.setInterval = realSetInterval;
  for (const id of timers.splice(0)) clearInterval(id);
});

/** Records the cadence of every installed timer; the timers never fire. */
function captureIntervals(): number[] {
  const cadences: number[] = [];
  globalThis.setInterval = ((fn: () => void, ms?: number) => {
    cadences.push(ms as number);
    const id = realSetInterval(fn, 60_000);
    timers.push(id);
    return id;
  }) as unknown as typeof setInterval;
  return cadences;
}

test("stop() beats a start() still awaiting the cadence, and a later start() still polls", async () => {
  let release!: () => void;
  const cadenceArrived = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalThis.fetch = (async () => {
    await cadenceArrived;
    return new Response(JSON.stringify({ observability: { db: "x", poll_ms: 2500 } }), {
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  const cadences = captureIntervals();
  const { usePolling } = await import("./usePolling.ts");
  const { start, stop } = usePolling(() => {});

  const pending = start();
  stop();
  release();
  await pending;
  expect(cadences).toEqual([]);

  await start();
  expect(cadences).toEqual([2500]);
  stop();
});
