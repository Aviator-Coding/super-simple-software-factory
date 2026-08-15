/**
 * Operator-path regression: `bun run lint` in the visualizer trips
 * unicorn(prefer-array-find) on modelName's last-segment extract
 * (`filter(Boolean).at(-1)`). The rule's help assumes first-match
 * (`filter(...)[0]` -> `find`), which would change behaviour.
 *
 * Reproduction: from apps/visualizer, `bun run lint`.
 * Verified against oxlint 1.76.0 (`bun run lint` / `oxlint .`).
 */
import { expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { modelName } from "./models";

const VISUALIZER_ROOT = dirname(fileURLToPath(import.meta.url)) + "/../..";

test("bun run lint does not report prefer-array-find on models.ts", () => {
  const result = Bun.spawnSync(["bun", "run", "lint"], {
    cwd: VISUALIZER_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = `${result.stdout.toString()}${result.stderr.toString()}`;
  expect(out).not.toMatch(/unicorn\(prefer-array-find\)/);
  expect(out).not.toMatch(/src\/lib\/models\.ts/);
});

test("modelName keeps the last non-empty path segment", () => {
  // Provider-qualified IDs from the roster (README): last segment is the name.
  expect(modelName("fireworks/accounts/fireworks/models/kimi-k3")).toBe("kimi-k3");
  // Empty segments from a leading/double slash must not become the "first match".
  expect(modelName("/openrouter/anthropic/claude-sonnet-4")).toBe("claude-sonnet-4");
  expect(modelName("a//b")).toBe("b");
  expect(modelName("plain")).toBe("plain");
  expect(modelName(null)).toBe("");
  expect(modelName(undefined)).toBe("");
  expect(modelName("")).toBe("");
});

test("modelName does not take the first filter match the lint rule suggests", () => {
  // find(Boolean) would return "fireworks"; findLast(Boolean) keeps "kimi-k3".
  expect(modelName("fireworks/accounts/fireworks/models/kimi-k3")).not.toBe("fireworks");
  const src = readFileSync(join(VISUALIZER_ROOT, "src/lib/models.ts"), "utf8");
  expect(src).not.toMatch(/\.filter\(Boolean\)\.at\(-1\)/);
  expect(src).not.toMatch(/\.find\(Boolean\)/);
  expect(src).toMatch(/\.findLast\(Boolean\)/);
});
