import { expect, test } from "bun:test";
import { DEFAULT_POLL_MS, normalizePollMs } from "./poll.ts";

test("normalizePollMs matches the documented default for bad values", () => {
  expect(normalizePollMs(undefined)).toBe(DEFAULT_POLL_MS);
  expect(normalizePollMs(0)).toBe(DEFAULT_POLL_MS);
  expect(normalizePollMs(2500)).toBe(2500);
});

test("fetchPollMs reads observability.poll_ms from /api/config", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ observability: { db: "x", poll_ms: 2500 } }), {
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
  try {
    const fresh = await import(`./poll.ts?t=${Date.now()}`);
    expect(await fresh.fetchPollMs()).toBe(2500);
  } finally {
    globalThis.fetch = original;
  }
});
