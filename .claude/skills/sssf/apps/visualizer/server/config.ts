/**
 * Load observability settings from the target repo's sssf.config.yaml.
 *
 * The visualizer process often runs from the app dir (`just obs` cds there),
 * so a cwd-relative default would miss the roster. Resolution order:
 *   --config / SSSF_CONFIG, then the default roster next to the trace db,
 *   then cwd-relative adws/adw_sssf_config/sssf.config.yaml.
 *
 * Missing file or missing/invalid poll_ms falls back to the documented default
 * (500). The file is re-read on each call so a roster edit is picked up on
 * the next /api/config request.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { DEFAULT_POLL_MS, normalizePollMs } from "../shared/poll.ts";
import type { ObservabilityConfig } from "../shared/types.ts";

/** The documented default data layout — one definition, db.ts reads it too. */
export const DEFAULT_DB_RELATIVE = "adws/adw_data/sssf.db";
export const DEFAULT_CONFIG_RELATIVE = "adws/adw_sssf_config/sssf.config.yaml";

/** Where the roster sits relative to the directory holding the trace db. */
const CONFIG_FROM_DB_DIR = relative(dirname(DEFAULT_DB_RELATIVE), DEFAULT_CONFIG_RELATIVE);

export function resolveConfigPath(
  argv: string[] = Bun.argv,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
  dbPath?: string,
): string | null {
  const flagged = flagValue(argv, "--config") ?? env.SSSF_CONFIG;
  if (flagged && flagged.trim() !== "") {
    const resolved = isAbsolute(flagged) ? flagged : resolve(cwd, flagged);
    if (existsSync(resolved)) return resolved;
    // An explicit path that is not on disk is not "no config" — fall through
    // so a mangled SSSF_CONFIG (just obs used to prefix an absolute roster)
    // still finds the default roster instead of silently defaulting poll_ms.
    console.warn(`[sssf] config not found at ${resolved} — trying defaults`);
  }

  if (dbPath) {
    // Default layout: {data_dir}/sssf.db sits beside ../adw_sssf_config/.
    const besideDb = resolve(dirname(dbPath), CONFIG_FROM_DB_DIR);
    if (existsSync(besideDb)) return besideDb;
  }

  const fromCwd = resolve(cwd, DEFAULT_CONFIG_RELATIVE);
  return existsSync(fromCwd) ? fromCwd : null;
}

export function loadObservability(configPath: string | null): ObservabilityConfig {
  if (!configPath) {
    return { db: DEFAULT_DB_RELATIVE, poll_ms: DEFAULT_POLL_MS };
  }
  try {
    const raw = Bun.YAML.parse(readFileSync(configPath, "utf8"));
    const obs =
      raw && typeof raw === "object" && "observability" in raw
        ? (raw as { observability?: unknown }).observability
        : undefined;
    const obj = obs && typeof obs === "object" ? (obs as Record<string, unknown>) : {};
    const db = typeof obj.db === "string" && obj.db.trim() !== "" ? obj.db : DEFAULT_DB_RELATIVE;
    return { db, poll_ms: normalizePollMs(obj.poll_ms) };
  } catch (error) {
    console.warn(`[sssf] failed to read ${configPath}: ${(error as Error).message}`);
    return { db: DEFAULT_DB_RELATIVE, poll_ms: DEFAULT_POLL_MS };
  }
}

function flagValue(argv: string[], name: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : undefined;
}
