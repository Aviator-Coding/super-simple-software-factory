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

async function startServer(env: Record<string, string>): Promise<string> {
  const port = String(20_000 + Math.floor(Math.random() * 10_000));
  const child = Bun.spawn(["bun", "run", "server/index.ts"], {
    cwd: VISUALIZER_ROOT,
    env: { ...process.env, PORT: port, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  children.push(child);
  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 5000;
  let last = "";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${origin}/api/health`);
      if (res.ok) return origin;
      last = `health ${res.status}`;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await Bun.sleep(40);
  }
  throw new Error(`visualizer server did not become ready: ${last}`);
}

test("GET /api/config serves observability.poll_ms from the target config", async () => {
  const { dbPath, configPath } = makeTarget(2500);
  const origin = await startServer({
    SSSF_DB: dbPath,
    SSSF_CONFIG: configPath,
  });
  const res = await fetch(`${origin}/api/config`);
  expect(res.ok).toBe(true);
  const body = (await res.json()) as {
    observability?: { poll_ms?: unknown; db?: unknown };
  };
  expect(body.observability?.poll_ms).toBe(2500);
});

test("live Vue refresh sites read poll_ms instead of hardcoding 500ms", () => {
  for (const rel of VUE_POLL_SITES) {
    const src = readFileSync(join(VISUALIZER_ROOT, rel), "utf8");
    expect(src, rel).not.toMatch(/setInterval\([^)]*,\s*500\s*\)/);
    expect(src, rel).toMatch(/fetchPollMs/);
  }
});
