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

function chooseCreationSelection(catalogue, displayName = "Ada") {
  assert(catalogue.fixtureContent === true, "R2 catalogue must be visibly marked as fixture content");
  assert(catalogue.origins.length === 10, "R2 catalogue must expose exactly 10 origin prototypes");
  assert(catalogue.professions.length === 12, "R2 catalogue must expose exactly 12 profession prototypes");

  const origin = catalogue.origins[0];
  const compatibility = catalogue.compatibility.find(
    (entry) => entry.originId === origin.id && entry.status === "DIRECT",
  );
  assert(compatibility !== undefined, "Smoke catalogue has no direct origin/profession pair");
  const profession = catalogue.professions.find(
    (entry) => entry.id === compatibility.professionId,
  );
  assert(profession !== undefined, "Compatibility references a missing profession");

  const firstTrait = catalogue.traits[0];
  const secondTrait = catalogue.traits.find(
    (entry) =>
      entry.id !== firstTrait.id &&
      !firstTrait.incompatibleTraitIds.includes(entry.id) &&
      !entry.incompatibleTraitIds.includes(firstTrait.id),
  );
  assert(secondTrait !== undefined, "Smoke catalogue has no compatible trait pair");

  const specialization = catalogue.specializations.find(
    (entry) =>
      entry.eligibleOriginIds.includes(origin.id) &&
      entry.eligibleProfessionIds.includes(profession.id),
  );
  assert(specialization !== undefined, "Smoke catalogue has no eligible specialization");

  return {
    displayName,
    sex: "FEMALE",
    age: 26,
    birthplaceId: catalogue.birthplaces[0].id,
    portraitId: catalogue.portraits[0].id,
    originId: origin.id,
    professionId: profession.id,
    traitIds: [firstTrait.id, secondTrait.id],
    flawId: catalogue.flaws[0].id,
    specializationId: specialization.id,
    acceptedConditionIds: [],
  };
}

function createCharacterIntent(intentId, selection) {
  return {
    contractVersion: "r2-v1",
    intentId,
    runId: null,
    expectedRevision: 0,
    payload: {
      kind: "CREATE_CHARACTER_RUN",
      selection,
    },
  };
}

function weeklyActionIntent(intentId, runId, expectedRevision, action) {
  return {
    contractVersion: "r2-v1",
    intentId,
    runId,
    expectedRevision,
    payload: { kind: "PERFORM_WEEKLY_ACTION", action },
  };
}

async function createPhase() {
  const bootstrap = await invokeBridge(mainWindow, "getBootstrap");
  assert(bootstrap.ok === true, "Fresh Electron bootstrap failed");
  assert(bootstrap.value.contractVersion === "r2-v1", "Fresh bootstrap has the wrong contract");
  assert(bootstrap.value.storageSchemaVersion === 2, "Fresh bootstrap has the wrong schema");
  assert(bootstrap.value.lifecycle === "NO_RUN", "Fresh bootstrap unexpectedly has an active run");
  assert(bootstrap.value.activeState === null, "Fresh bootstrap exposed an active state");

  const selection = chooseCreationSelection(bootstrap.value.characterCreation);
  const createIntent = createCharacterIntent("electron-smoke-create", selection);
  const first = await invokeBridge(mainWindow, "submitIntent", createIntent);
  assert(first.ok === true, "First Electron intent did not commit");
  assert(first.value.replayed === false, "First Electron receipt was incorrectly replayed");
  assert(first.value.previousRevision === 0, "First Electron receipt has the wrong previous revision");
  assert(first.value.newRevision === 1, "First Electron receipt has the wrong new revision");

  const replay = await invokeBridge(mainWindow, "submitIntent", createIntent);
  assert(replay.ok === true, "Identical Electron intent did not replay");
  assertDeep(
    replay.value,
    { ...first.value, replayed: true },
    "Idempotent Electron replay changed committed identity or state",
  );

  const conflict = await invokeBridge(
    mainWindow,
    "submitIntent",
    createCharacterIntent("electron-smoke-create", {
      ...selection,
      displayName: "Beatrice",
    }),
  );
  assert(
    conflict.ok === false && conflict.error.code === "DUPLICATE_INTENT_CONFLICT",
    "Same-id/different-payload Electron replay was not rejected",
  );

  const actions = ["WORK", "LEARN", "INVESTIGATE"];
  const actionReceipts = [];
  let currentRevision = first.value.newRevision;
  for (let index = 0; index < actions.length; index += 1) {
    const actionIntent = weeklyActionIntent(
      `electron-smoke-action-${index + 1}`,
      first.value.runId,
      currentRevision,
      actions[index],
    );
    const actionReceipt = await invokeBridge(mainWindow, "submitIntent", actionIntent);
    assert(actionReceipt.ok === true, `Electron action ${actions[index]} did not commit`);
    actionReceipts.push({ intent: actionIntent, receipt: actionReceipt.value });
    currentRevision = actionReceipt.value.newRevision;
  }

  const latest = actionReceipts.at(-1).receipt;
  assert(latest.publicState.week === 2, "Third R2 action did not advance to week two");
  assert(latest.publicState.availableActions === 3, "Week advance did not restore three actions");
  assert(latest.publicState.lastAction.weekAdvanced === true, "Week advance was not disclosed in the action result");

  const replayAction = await invokeBridge(
    mainWindow,
    "submitIntent",
    actionReceipts[1].intent,
  );
  assert(replayAction.ok === true, "Committed action could not be replayed");
  assertDeep(
    replayAction.value,
    { ...actionReceipts[1].receipt, replayed: true },
    "Action replay changed durable identity or state",
  );

  const stale = await invokeBridge(
    mainWindow,
    "submitIntent",
    weeklyActionIntent("electron-smoke-stale", first.value.runId, 1, "REST"),
  );
  assert(stale.ok === false && stale.error.code === "REVISION_CONFLICT" && stale.error.currentRevision === 4, "Stale action was not rejected with revision four");

  writeFileSync(receiptPath, JSON.stringify({ createIntent, createReceipt: first.value, actionReceipts, latest }), {
    encoding: "utf8",
    flag: "wx",
  });

  await mainWindow.loadFile(path.join(workspaceRoot, "dist/renderer/index.html"));
  await waitForBodyText(mainWindow, ["第 2 周", "Ada", "3 次", "0 镑 0 苏勒 0 便士"]);
  console.log(
    `ELECTRON_CREATE_AND_ACTIONS_PASS runId=${latest.runId} revision=${latest.newRevision} checksum=${latest.stateChecksum}`,
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
    expected.latest.publicState,
    "Restarted Electron recovered a different public state",
  );

  const replay = await invokeBridge(mainWindow, "submitIntent", expected.createIntent);
  assert(replay.ok === true, "Restarted Electron could not replay the committed intent");
  assertDeep(
    replay.value,
    { ...expected.createReceipt, replayed: true },
    "Restarted Electron changed the durable commit receipt",
  );

  const lastAction = expected.actionReceipts.at(-1);
  const replayLastAction = await invokeBridge(mainWindow, "submitIntent", lastAction.intent);
  assert(replayLastAction.ok === true, "Restarted Electron could not replay the last action");
  assertDeep(replayLastAction.value, { ...lastAction.receipt, replayed: true }, "Restarted action replay changed the durable receipt");

  await waitForBodyText(mainWindow, ["第 2 周", "Ada", "3 次", "0 镑 0 苏勒 0 便士"]);
  console.log(
    `ELECTRON_RECOVERY_PASS runId=${expected.latest.runId} revision=${expected.latest.newRevision} checksum=${expected.latest.stateChecksum}`,
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
