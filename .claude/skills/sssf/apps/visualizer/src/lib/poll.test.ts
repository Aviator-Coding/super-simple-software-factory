import { expect, test } from "bun:test";
import { DEFAULT_POLL_MS } from "@shared/poll";

/**
 * fetchPollMs memoizes, so each case imports a fresh copy of the module.
 * normalizePollMs itself is covered once, on the shared contract, in
 * server/config.test.ts.
 */
async function pollMsFor(body: unknown, tag: string): Promise<number> {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
  try {
    const fresh = await import(`./poll.ts?t=${tag}`);
    return (await fresh.fetchPollMs()) as number;
  } finally {
    globalThis.fetch = original;
  }
}

test("fetchPollMs reads observability.poll_ms from /api/config", async () => {
  expect(await pollMsFor({ observability: { db: "x", poll_ms: 2500 } }, "configured")).toBe(2500);
});

test("fetchPollMs falls back to the documented default when poll_ms is unusable", async () => {
  expect(await pollMsFor({ observability: { db: "x", poll_ms: 0 } }, "zero")).toBe(DEFAULT_POLL_MS);
  expect(await pollMsFor({}, "absent")).toBe(DEFAULT_POLL_MS);
});
