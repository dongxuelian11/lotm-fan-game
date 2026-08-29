import electronExecutable from "electron";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const integrationDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(integrationDirectory, "../..");
const harnessPath = path.join(integrationDirectory, "electron-smoke.cjs");
const evidenceDirectory = mkdtempSync(path.join(tmpdir(), "lotm-electron-smoke-"));
const databasePath = path.join(evidenceDirectory, "mystery-game.sqlite");
const receiptPath = path.join(evidenceDirectory, "first-process-receipt.json");
let passed = false;

function runPhase(phase) {
  const result = spawnSync(
    electronExecutable,
    [
      harnessPath,
      `--phase=${phase}`,
      `--database=${databasePath}`,
      `--receipt=${receiptPath}`,
    ],
    {
      cwd: workspaceRoot,
      env: { ...process.env },
      stdio: "inherit",
    },
  );

  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Electron smoke phase ${phase} exited with ${String(result.status)}`);
  }
}

try {
  runPhase("create");
  runPhase("recover");
  passed = true;
  console.log("ELECTRON_TWO_PROCESS_SMOKE_PASS");
} finally {
  if (passed) {
    rmSync(evidenceDirectory, { recursive: true, force: true });
  } else {
    console.error(`ELECTRON_SMOKE_ARTIFACTS_PRESERVED=${evidenceDirectory}`);
  }
}
