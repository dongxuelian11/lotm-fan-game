const { app, BrowserWindow, ipcMain } = require("electron");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const { isDeepStrictEqual } = require("node:util");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "../..");
const { registerIpcHandlers } = require(path.join(workspaceRoot, "dist/main/ipc.js"));
const { resolveRendererLoadPlan } = require(path.join(
  workspaceRoot,
  "dist/main/renderer-source.js",
));
const { buildMainWindowOptions, installWindowSecurity } = require(path.join(
  workspaceRoot,
  "dist/main/window-security.js",
));
const { SqliteGameStore } = require(path.join(
  workspaceRoot,
  "dist/persistence/sqlite-store.js",
));

app.disableHardwareAcceleration();

function argument(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  if (value === undefined) {
    throw new Error(`Missing ${prefix}<value>`);
  }

  return value.slice(prefix.length);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertDeep(actual, expected, message) {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(
      `${message}\nEXPECTED=${JSON.stringify(expected)}\nACTUAL=${JSON.stringify(actual)}`,
    );
  }
}

async function waitForBodyText(window, requiredSnippets) {
  const deadline = Date.now() + 5_000;
  let lastText = "";

  while (Date.now() < deadline) {
    lastText = await window.webContents.executeJavaScript(
      "document.body?.innerText ?? ''",
      true,
    );
    if (requiredSnippets.every((snippet) => lastText.includes(snippet))) {
      return lastText;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(
    `Renderer did not expose expected text: ${requiredSnippets.join(", ")}\nBODY=${lastText}`,
  );
}

async function invokeBridge(window, method, argumentValue) {
  const serializedArgument =
    argumentValue === undefined ? "" : JSON.stringify(argumentValue);
  const call =
    argumentValue === undefined
      ? `window.mysteryGame.${method}()`
      : `window.mysteryGame.${method}(${serializedArgument})`;

  return window.webContents.executeJavaScript(`(async () => ${call})()`, true);
}

const phase = argument("phase");
const databasePath = path.resolve(argument("database"));
const receiptPath = path.resolve(argument("receipt"));
assert(phase === "create" || phase === "recover", `Unsupported phase: ${phase}`);

let mainWindow = null;
let store = null;
let disposeIpcHandlers = null;

function cleanup() {
  disposeIpcHandlers?.();
  disposeIpcHandlers = null;

  if (mainWindow !== null && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  mainWindow = null;

  store?.close();
  store = null;
}

async function openRealBridge() {
  const preloadPath = path.join(workspaceRoot, "dist/main/preload.js");
  const rendererPath = path.join(workspaceRoot, "dist/renderer/index.html");
  assert(existsSync(preloadPath), `Missing preload build: ${preloadPath}`);
  assert(existsSync(rendererPath), `Missing renderer build: ${rendererPath}`);

  store = new SqliteGameStore(databasePath, "electron-smoke");
  mainWindow = new BrowserWindow(buildMainWindowOptions(preloadPath));
  const loadPlan = resolveRendererLoadPlan({
    isPackaged: true,
    devServerUrl: "https://remote-code.invalid/",
    rendererPath,
  });
  assert(loadPlan.kind === "local-file", "Packaged smoke must select the local renderer");
  installWindowSecurity(mainWindow, loadPlan.allowedNavigationUrl);

  disposeIpcHandlers = registerIpcHandlers({
    ipcMain,
    getWindow: () => mainWindow,
    getStore: () => store,
    appVersion: "electron-smoke",
  });

  await mainWindow.loadFile(loadPlan.rendererPath);
  const bridgeShape = await mainWindow.webContents.executeJavaScript(
    `({
      bridgeKeys: Object.keys(window.mysteryGame ?? {}).sort(),
      requireType: typeof window.require,
      processType: typeof window.process
    })`,
    true,
  );
  assertDeep(
    bridgeShape,
    {
      bridgeKeys: ["getBootstrap", "submitIntent"],
      requireType: "undefined",
      processType: "undefined",
    },
    "Renderer trust boundary is wider than the shared bridge",
  );
}

function fixtureIntent(intentId, displayName = "Ada") {
  return {
    contractVersion: "r1-v1",
    intentId,
    runId: null,
    expectedRevision: 0,
    payload: {
      kind: "CREATE_R1_FIXTURE_RUN",
      fixtureId: "ordinary-week-one",
      displayName,
    },
  };
}

async function createPhase() {
  const bootstrap = await invokeBridge(mainWindow, "getBootstrap");
  assertDeep(
    bootstrap,
    {
      ok: true,
      value: {
        appVersion: "electron-smoke",
        contractVersion: "r1-v1",
        storageSchemaVersion: 1,
        storageStatus: "READY",
        lifecycle: "NO_RUN",
        runs: [],
        activeState: null,
      },
    },
    "Fresh Electron bootstrap is not the exact no-run projection",
  );

  const intent = fixtureIntent("electron-smoke-create");
  const first = await invokeBridge(mainWindow, "submitIntent", intent);
  assert(first.ok === true, "First Electron intent did not commit");
  assert(first.value.replayed === false, "First Electron receipt was incorrectly replayed");
  assert(first.value.previousRevision === 0, "First Electron receipt has the wrong previous revision");
  assert(first.value.newRevision === 1, "First Electron receipt has the wrong new revision");

  const replay = await invokeBridge(mainWindow, "submitIntent", intent);
  assert(replay.ok === true, "Identical Electron intent did not replay");
  assertDeep(
    replay.value,
    { ...first.value, replayed: true },
    "Idempotent Electron replay changed committed identity or state",
  );

  const conflict = await invokeBridge(
    mainWindow,
    "submitIntent",
    fixtureIntent("electron-smoke-create", "Beatrice"),
  );
  assert(
    conflict.ok === false && conflict.error.code === "DUPLICATE_INTENT_CONFLICT",
    "Same-id/different-payload Electron replay was not rejected",
  );

  const stale = await invokeBridge(
    mainWindow,
    "submitIntent",
    fixtureIntent("electron-smoke-stale"),
  );
  assert(
    stale.ok === false &&
      stale.error.code === "REVISION_CONFLICT" &&
      stale.error.currentRevision === 1,
    "Stale Electron intent was not rejected with the current revision",
  );

  writeFileSync(receiptPath, JSON.stringify({ intent, receipt: first.value }), {
    encoding: "utf8",
    flag: "wx",
  });

  await mainWindow.loadFile(path.join(workspaceRoot, "dist/renderer/index.html"));
  await waitForBodyText(mainWindow, ["第 1 周", "Ada", "3 次", "0 便士"]);
  console.log(
    `ELECTRON_CREATE_PASS runId=${first.value.runId} revision=${first.value.newRevision} checksum=${first.value.stateChecksum}`,
  );
}

async function recoverPhase() {
  assert(existsSync(receiptPath), `Missing first-process receipt: ${receiptPath}`);
  const expected = JSON.parse(readFileSync(receiptPath, "utf8"));

  const bootstrap = await invokeBridge(mainWindow, "getBootstrap");
  assert(bootstrap.ok === true, "Restarted Electron bootstrap failed");
  assert(bootstrap.value.lifecycle === "ACTIVE", "Restarted Electron did not recover an active run");
  assertDeep(
    bootstrap.value.activeState,
    expected.receipt.publicState,
    "Restarted Electron recovered a different public state",
  );

  const replay = await invokeBridge(mainWindow, "submitIntent", expected.intent);
  assert(replay.ok === true, "Restarted Electron could not replay the committed intent");
  assertDeep(
    replay.value,
    { ...expected.receipt, replayed: true },
    "Restarted Electron changed the durable commit receipt",
  );

  await waitForBodyText(mainWindow, ["第 1 周", "Ada", "3 次", "0 便士"]);
  console.log(
    `ELECTRON_RECOVERY_PASS runId=${replay.value.runId} revision=${replay.value.newRevision} checksum=${replay.value.stateChecksum}`,
  );
}

app
  .whenReady()
  .then(async () => {
    await openRealBridge();
    if (phase === "create") {
      await createPhase();
    } else {
      await recoverPhase();
    }
    cleanup();
    app.exit(0);
  })
  .catch((error) => {
    console.error("ELECTRON_SMOKE_FAIL", error);
    cleanup();
    app.exit(1);
  });
