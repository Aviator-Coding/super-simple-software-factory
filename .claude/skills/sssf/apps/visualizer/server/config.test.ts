import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_POLL_MS,
  loadObservability,
  normalizePollMs,
  resolveConfigPath,
} from "./config.ts";

function writeConfig(contents: string): { root: string; configPath: string; dbPath: string } {
  const root = mkdtempSync(join(tmpdir(), "sssf-cfg-"));
  const configDir = join(root, "adws", "adw_sssf_config");
  const dataDir = join(root, "adws", "adw_data");
  mkdirSync(configDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  const configPath = join(configDir, "sssf.config.yaml");
  writeFileSync(configPath, contents);
  return { root, configPath, dbPath: join(dataDir, "sssf.db") };
}

test("loadObservability reads poll_ms from yaml", () => {
  const { configPath } = writeConfig("observability:\n  poll_ms: 2500\n");
  expect(loadObservability(configPath).poll_ms).toBe(2500);
});

test("loadObservability defaults when the file or key is missing", () => {
  expect(loadObservability(null).poll_ms).toBe(DEFAULT_POLL_MS);
  const { configPath } = writeConfig("observability:\n  db: elsewhere.db\n");
  expect(loadObservability(configPath)).toEqual({ db: "elsewhere.db", poll_ms: DEFAULT_POLL_MS });
});

test("normalizePollMs rejects zero, negative, and non-numeric values", () => {
  expect(normalizePollMs(0)).toBe(DEFAULT_POLL_MS);
  expect(normalizePollMs(-10)).toBe(DEFAULT_POLL_MS);
  expect(normalizePollMs("nope")).toBe(DEFAULT_POLL_MS);
  expect(normalizePollMs(undefined)).toBe(DEFAULT_POLL_MS);
  expect(normalizePollMs("1800")).toBe(1800);
});

test("resolveConfigPath prefers --config, then SSSF_CONFIG, then the db sibling", () => {
  const { root, configPath, dbPath } = writeConfig("observability:\n  poll_ms: 9\n");
  const other = join(root, "other.yaml");
  writeFileSync(other, "observability:\n  poll_ms: 42\n");

  expect(
    resolveConfigPath(["--config", other], { SSSF_CONFIG: configPath }, root, dbPath),
  ).toBe(other);
  expect(resolveConfigPath([], { SSSF_CONFIG: configPath }, "/no/such/cwd", dbPath)).toBe(
    configPath,
  );
  expect(resolveConfigPath([], {}, "/no/such/cwd", dbPath)).toBe(configPath);
  expect(resolveConfigPath([], {}, "/no/such/cwd")).toBeNull();
});
