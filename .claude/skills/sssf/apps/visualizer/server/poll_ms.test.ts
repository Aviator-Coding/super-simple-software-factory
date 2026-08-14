/**
 * Operator-path regression: observability.poll_ms in sssf.config.yaml is the
 * visualizer's live-poll cadence (references/config.md, observability.md,
 * cookbooks/create_config.md). The server must expose it, and the three
 * live-refresh sites must read it instead of hardcoding 500.
 *
 * Reproduction: point the visualizer at a target repo whose config says
 * poll_ms: 2500, then GET /api/config and inspect the Vue poll sites.
 */
import { afterEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VISUALIZER_ROOT = dirname(fileURLToPath(import.meta.url)) + "/..";
const VUE_POLL_SITES = [
  "src/components/SessionTrace.vue",
  "src/components/SessionsList.vue",
  "src/components/SessionCard.vue",
];

const children: Bun.Subprocess[] = [];

afterEach(() => {
  for (const child of children.splice(0)) {
    child.kill();
  }
});

function makeTarget(pollMs: number): { dbPath: string; configPath: string } {
  const root = mkdtempSync(join(tmpdir(), "sssf-poll-ms-"));
  mkdirSync(join(root, "adws", "adw_data"), { recursive: true });
  mkdirSync(join(root, "adws", "adw_sssf_config"), { recursive: true });
  const configPath = join(root, "adws", "adw_sssf_config", "sssf.config.yaml");
  writeFileSync(
    configPath,
    [
      "defaults:",
      "  coding_agent: pi",
      "observability:",
      "  db: adws/adw_data/sssf.db",
      `  poll_ms: ${pollMs}`,
      "agents: []",
      "",
    ].join("\n"),
  );
  const dbPath = join(root, "adws", "adw_data", "sssf.db");
  const db = new Database(dbPath);
  db.exec("PRAGMA journal_mode=WAL");
  db.exec("CREATE TABLE sessions (adw_id TEXT PRIMARY KEY)");
  db.close();
  return { dbPath, configPath };
}

/** Generous: a cold bun start on a busy machine is slow, but never minutes. */
const READY_TIMEOUT_MS = 30_000;

async function withTimeout<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The server logs its bound port once Bun.serve is listening, so reading that
 * line is both the port lookup and the readiness signal — no port guessing, so
 * no collision with whatever else is on the machine.
 */
async function readBoundPort(child: Bun.Subprocess): Promise<number> {
  const reader = (child.stdout as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let out = "";
  try {
    for (;;) {
      // Sequential on purpose: chunks arrive in order until the port line does.
      // oxlint-disable-next-line no-await-in-loop
      const { value, done } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
      const match = out.match(/visualizer api\s+http:\/\/localhost:(\d+)/);
      if (match) return Number(match[1]);
    }
  } finally {
    reader.releaseLock();
  }
  const stderr = await new Response(child.stderr as ReadableStream<Uint8Array>).text();
  throw new Error(`visualizer server exited before binding a port:\n${out}\n${stderr}`);
}

async function startServer(env: Record<string, string>): Promise<string> {
  const child = Bun.spawn(["bun", "run", "server/index.ts"], {
    cwd: VISUALIZER_ROOT,
    // PORT=0 lets the kernel pick a free port; the child reports which.
    env: { ...process.env, PORT: "0", ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  children.push(child);
  const port = await withTimeout(readBoundPort(child), READY_TIMEOUT_MS, "visualizer server start");
  return `http://127.0.0.1:${port}`;
}

async function getPollMs(origin: string): Promise<number> {
  const res = await fetch(`${origin}/api/config`);
  expect(res.ok).toBe(true);
  const body = (await res.json()) as { observability?: { poll_ms?: unknown } };
  return body.observability?.poll_ms as number;
}

// Spawning bun and waiting for it to listen outruns the 5s default.
const SERVER_TEST_TIMEOUT_MS = 60_000;

test(
  "GET /api/config serves observability.poll_ms from the target config",
  async () => {
    const { dbPath, configPath } = makeTarget(2500);
    const origin = await startServer({
      SSSF_DB: dbPath,
      SSSF_CONFIG: configPath,
    });
    expect(await getPollMs(origin)).toBe(2500);
  },
  SERVER_TEST_TIMEOUT_MS,
);

test(
  "GET /api/config finds the default roster next to the trace db",
  async () => {
    const { dbPath } = makeTarget(1800);
    const origin = await startServer({ SSSF_DB: dbPath, SSSF_CONFIG: "" });
    expect(await getPollMs(origin)).toBe(1800);
  },
  SERVER_TEST_TIMEOUT_MS,
);

test("live Vue refresh sites poll on the configured cadence, never a literal", () => {
  for (const rel of VUE_POLL_SITES) {
    const src = readFileSync(join(VISUALIZER_ROOT, rel), "utf8");
    // Cadence ownership lives in usePolling now, so a refresh site scheduling
    // its own interval is the regression, whatever number it picked.
    expect(src, rel).not.toMatch(/setInterval\(/);
    expect(src, rel).toMatch(/usePolling/);
  }
  const composable = readFileSync(join(VISUALIZER_ROOT, "src/lib/usePolling.ts"), "utf8");
  expect(composable).toMatch(/fetchPollMs/);
  expect(composable).not.toMatch(/setInterval\([^)]*,\s*\d+\s*\)/);
});

/**
 * The other half of the operator path: `just obs` hands the roster to the
 * server. just's `/` is a plain slash-join ("a `/` is added even if one is
 * already present"), so `justfile_directory() / config` turns an absolute
 * SSSF_CONFIG into /repo//abs/roster.yaml and the override is silently lost.
 * `join` is the one with PathBuf semantics.
 */
test("just obs forwards an absolute SSSF_CONFIG untouched", () => {
  const justfile = readFileSync(
    join(VISUALIZER_ROOT, "..", "..", "templates", "justfile"),
    "utf8",
  );
  const obs = justfile.slice(justfile.indexOf("\nobs:"));
  expect(obs).not.toMatch(/justfile_directory\(\)\s*\/\s*config/);
  expect(obs).toContain('SSSF_CONFIG="{{ join(justfile_directory(), config) }}"');
  expect(obs).toContain('SSSF_DB="{{ join(justfile_directory(), db) }}"');
});
