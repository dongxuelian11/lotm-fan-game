const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
const { SqliteSliceStore } = require(
  path.join(root, "dist/persistence/slice-store.js"),
);
const { registerSliceIpc } = require(path.join(root, "dist/main/slice-ipc.js"));
const { buildMainWindowOptions, installWindowSecurity } = require(
  path.join(root, "dist/main/window-security.js"),
);
const { sliceDefaultCreationSelection } = require(
  path.join(root, "dist/content/slice-creation.js"),
);
const { pathToFileURL } = require("node:url");
const args = Object.fromEntries(
  process.argv
    .filter((v) => v.startsWith("--") && v.includes("="))
    .map((v) => v.slice(2).split(/=(.*)/s).slice(0, 2)),
);
const database = args.database,
  phase = args.phase,
  evidence = args.evidence;
if (!database || !phase || !evidence)
  throw new Error("database, phase and evidence required");
app.disableHardwareAcceleration();
let store, win, dispose;
const unwrap = (r) => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
const invoke = (method, value) =>
  win.webContents.executeJavaScript(
    `window.sliceGame.${method}(${value === undefined ? "" : JSON.stringify(value)})`,
  );
let serial = 0;
function intent(state, payload) {
  return {
    intentId: `smoke-${phase}-${++serial}`,
    runId: state?.runId ?? null,
    expectedRevision: state?.revision ?? 0,
    payload,
  };
}
app
  .whenReady()
  .then(async () => {
    store = new SqliteSliceStore(database, {
      identity: (() => {
        let n = 0;
        return () => `electron-smoke-${++n}`;
      })(),
    });
    win = new BrowserWindow({
      ...buildMainWindowOptions(path.join(root, "dist/main/preload.js")),
      show: false,
    });
    dispose = registerSliceIpc({
      ipcMain,
      getWindow: () => win,
      getStore: () => store,
    });
    const html = path.join(root, "dist/renderer/index.html");
    installWindowSecurity(win, pathToFileURL(html).toString());
    await win.loadFile(html);
    const boot = unwrap(await invoke("getBootstrap"));
    assert.equal(boot.mode, "desktop");
    if (phase === "create") {
      const receipt = unwrap(
        await invoke(
          "submitIntent",
          intent(null, {
            type: "CREATE",
            selection: sliceDefaultCreationSelection,
          }),
        ),
      );
      assert(receipt.state.activeEvent);
      assert(!("random" in receipt.state));
      assert(!("world" in receipt.state));
      fs.writeFileSync(
        evidence,
        JSON.stringify({
          state: receipt.state,
          command: {
            intentId: receipt.intentId,
            runId: null,
            expectedRevision: 0,
            payload: {
              type: "CREATE",
              selection: sliceDefaultCreationSelection,
            },
          },
        }),
      );
    } else if (phase === "recover") {
      const prior = JSON.parse(fs.readFileSync(evidence, "utf8"));
      assert.deepEqual(boot.activeState, prior.state);
      const replay = unwrap(await invoke("submitIntent", prior.command));
      assert(replay.replayed);
      assert.deepEqual(replay.state, prior.state);
      const text = await win.webContents.executeJavaScript(
        "document.body.innerText",
      );
      assert(!text.includes("刷新页面会重置进度"));
      assert(text.includes("桌面版"));
    } else if (phase === "fixtures") {
      // New fixture slots model the exact domain commit boundaries, never user saves.
      const { createSliceRun, applySliceIntent, projectSliceState } = require(
        path.join(root, "dist/domain/slice/index.js"),
      );
      const states = [];
      const opening = createSliceRun(
        "fixture-opening",
        sliceDefaultCreationSelection,
        "fixture-seed",
      );
      states.push(opening);
      const bill = structuredClone(opening);
      bill.runId = "fixture-bill";
      bill.activeEvent = { id: "LIFE-BILL-01", instanceId: "fixture-bill:1" };
      bill.cash = 0;
      bill.actionsRemaining = 0;
      bill.pulse = "BILL";
      bill.billAmount = 120;
      states.push(bill);
      const combat = structuredClone(opening);
      combat.runId = "fixture-combat";
      combat.activeEvent = null;
      combat.arc.stage = "COMBAT";
      combat.arc.startWeek = 1;
      combat.arc.completedAWeek = 1;
      combat.world.bellFactKnown = true;
      combat.combat = {
        round: 1,
        enemyHealth: 100,
        enemyMind: 100,
        enemyInjuries: [],
        enemyRisk: 0,
        enemyStatus: "RESISTING",
        lastRound: null,
      };
      const afterRound = applySliceIntent(combat, {
        type: "COMBAT_ROUND",
        stance: "DEFEND",
      });
      states.push(afterRound);
      const conclusion = structuredClone(opening);
      conclusion.runId = "fixture-conclusion";
      conclusion.activeEvent = { id: "ARC-C", instanceId: "fixture-c:1" };
      conclusion.arc.stage = "C";
      conclusion.arc.startWeek = 1;
      conclusion.arc.completedAWeek = 1;
      conclusion.world.bellFactKnown = true;
      states.push(
        applySliceIntent(conclusion, {
          type: "EVENT_CHOICE",
          eventInstanceId: "fixture-c:1",
          choiceId: "C_EVACUATE",
        }),
      );
      for (const state of states)
        store.repository.transaction(() =>
          store.repository.put({
            state,
            updatedAt: "2026-10-10T00:00:00.000Z",
          }),
        );
      fs.writeFileSync(evidence, JSON.stringify(states.map(projectSliceState)));
    } else if (phase === "verify-fixtures") {
      const expected = JSON.parse(fs.readFileSync(evidence, "utf8"));
      for (const state of expected)
        assert.deepEqual(unwrap(await invoke("loadRun", state.runId)), state);
      assert(expected.some((s) => s.activeEvent?.id === "LIFE-BILL-01"));
      assert(expected.some((s) => s.lastCombatRound));
      assert(expected.some((s) => s.ending));
    } else throw new Error("Unknown phase");
    console.log(`SLICE_ELECTRON_${phase.toUpperCase()}_PASS`);
  })
  .then(() => {
    dispose?.();
    win?.destroy();
    store?.close();
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    try {
      dispose?.();
      win?.destroy();
      store?.close();
    } catch {}
    app.exit(1);
  });
