import electron from "electron";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
const directory =
  process.env.LOTM_QA_DIR || mkdtempSync(join(tmpdir(), "lotm-slice-electron-"));
mkdirSync(directory, { recursive: true });
for (const phase of ["create", "recover", "fixtures", "verify-fixtures"]) {
  const p = spawnSync(
    electron,
    [
      resolve("tests/integration/slice-electron-smoke.cjs"),
      `--phase=${phase}`,
      `--database=${join(directory, "slice.sqlite")}`,
      `--evidence=${join(directory, phase.includes("fixtures") ? "fixtures.json" : "opening.json")}`,
    ],
    { stdio: "inherit", env: { ...process.env } },
  );
  if (p.error) throw p.error;
  if (p.status !== 0)
    throw new Error(
      `Electron ${phase} failed: ${p.status}; evidence retained ${directory}`,
    );
}
console.log(`SLICE_FOUR_BOUNDARY_RESTART_PASS ${directory}`);
