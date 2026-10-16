import { describe, expect, it, vi } from "vitest";

import { R2_FIXTURE_DEFAULT_SELECTION, R2_FIXTURE_CATALOGUE } from "../../src/content/r2-catalogue.js";
import { MysteryGameBridge } from "../../src/simulation/browser-bridge.js";
import {
  CONTRACT_VERSION,
  type BridgeResult,
  type IntentEnvelope,
} from "../../src/shared/contracts.js";

function okValue<T>(result: BridgeResult<T>): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

function createIntent(intentId: string, displayName = R2_FIXTURE_DEFAULT_SELECTION.displayName): IntentEnvelope {
  return {
    contractVersion: CONTRACT_VERSION,
    intentId,
    runId: null,
    expectedRevision: 0,
    payload: {
      kind: "CREATE_CHARACTER_RUN",
      selection: { ...R2_FIXTURE_DEFAULT_SELECTION, displayName },
    },
  };
}

function actionIntent(intentId: string, runId: string, expectedRevision: number, action: "WORK" | "LEARN" | "INVESTIGATE" | "REST"): IntentEnvelope {
  return {
    contractVersion: CONTRACT_VERSION,
    intentId,
    runId,
    expectedRevision,
    payload: { kind: "PERFORM_WEEKLY_ACTION", action },
  };
}

describe("browser-alpha development bridge", () => {
  it("starts empty, creates once, replays exactly, and resets on refresh", async () => {
    const bridge = new MysteryGameBridge("browser-test");
    const empty = okValue(await bridge.getBootstrap());
    expect(empty.lifecycle).toBe("NO_RUN");
    expect(empty.storageStatus).toBe("READY");
    expect(empty.characterCreation).toEqual(R2_FIXTURE_CATALOGUE);

    const first = okValue(await bridge.submitIntent(createIntent("browser-create-1")));
    expect(first).toMatchObject({ previousRevision: 0, newRevision: 1, replayed: false });
    expect(first.publicState.cashPence).toBe(96);
    expect(first.publicState.character.coreStats).toEqual({ physique: 19, perception: 16, will: 16, knowledge: 15 });
    expect(Object.keys(first.publicState.character.profession).sort()).toEqual(["id", "label", "legality"]);
    expect(first.publicState.revision).toBe(1);
    expect(first.publicState.stateChecksum).toMatch(/^[0-9a-f]{64}$/);

    const replay = okValue(await bridge.submitIntent(createIntent("browser-create-1")));
    expect(replay).toEqual({ ...first, replayed: true });
    expect(replay.publicState).toEqual(first.publicState);

    const resetBridge = new MysteryGameBridge("browser-test");
    expect(okValue(await resetBridge.getBootstrap()).lifecycle).toBe("NO_RUN");
  });

  it("uses the same revision and weekly action semantics through week two", async () => {
    const bridge = new MysteryGameBridge("browser-test");
    const created = okValue(await bridge.submitIntent(createIntent("browser-week-create")));
    const runId = created.runId;

    const first = okValue(await bridge.submitIntent(actionIntent("browser-action-1", runId, 1, "WORK")));
    const second = okValue(await bridge.submitIntent(actionIntent("browser-action-2", runId, 2, "LEARN")));
    const third = okValue(await bridge.submitIntent(actionIntent("browser-action-3", runId, 3, "INVESTIGATE")));

    expect(first).toMatchObject({ previousRevision: 1, newRevision: 2, replayed: false });
    expect(first.publicState.cashPence).toBe(180);
    expect(second).toMatchObject({ previousRevision: 2, newRevision: 3, replayed: false });
    expect(third).toMatchObject({ previousRevision: 3, newRevision: 4, replayed: false });
    expect(third.publicState).toMatchObject({ week: 2, availableActions: 3, revision: 4 });
    expect(third.publicState.chronicle).toHaveLength(4);

    const bootstrap = okValue(await bridge.getBootstrap());
    expect(bootstrap.activeState).toEqual(third.publicState);
    expect(bootstrap.runs).toHaveLength(1);
    expect(bootstrap.runs[0]).toMatchObject({ runId, week: 2, revision: 4 });
  });

  it("rejects stale revisions, forbidden/conditional combinations, and conflicting intents", async () => {
    const bridge = new MysteryGameBridge("browser-test");
    const created = okValue(await bridge.submitIntent(createIntent("browser-conflict")));

    const conflict = await bridge.submitIntent(createIntent("browser-conflict", "Eve"));
    expect(conflict).toMatchObject({ ok: false, error: { code: "DUPLICATE_INTENT_CONFLICT" } });

    const stale = await bridge.submitIntent(actionIntent("browser-stale", created.runId, 0, "REST"));
    expect(stale).toMatchObject({ ok: false, error: { code: "REVISION_CONFLICT", currentRevision: 1 } });

    const conditionalRule = R2_FIXTURE_CATALOGUE.compatibility.find((rule) => rule.status === "CONDITIONAL");
    const forbiddenRule = R2_FIXTURE_CATALOGUE.compatibility.find((rule) => rule.status === "FORBIDDEN");
    expect(conditionalRule).toBeDefined();
    expect(forbiddenRule).toBeDefined();

    const conditionalSelection = {
      ...R2_FIXTURE_DEFAULT_SELECTION,
      originId: conditionalRule!.originId,
      professionId: conditionalRule!.professionId,
    };
    const conditionalResult = await new MysteryGameBridge("browser-test").submitIntent({
      ...createIntent("browser-conditional"),
      payload: { kind: "CREATE_CHARACTER_RUN", selection: conditionalSelection },
    });
    expect(conditionalResult).toMatchObject({ ok: false, error: { code: "CONTENT_SELECTION_INVALID" } });

    const forbiddenSelection = {
      ...R2_FIXTURE_DEFAULT_SELECTION,
      originId: forbiddenRule!.originId,
      professionId: forbiddenRule!.professionId,
    };
    const forbiddenResult = await new MysteryGameBridge("browser-test").submitIntent({
      ...createIntent("browser-forbidden"),
      payload: { kind: "CREATE_CHARACTER_RUN", selection: forbiddenSelection },
    });
    expect(forbiddenResult).toMatchObject({ ok: false, error: { code: "CONTENT_SELECTION_INVALID" } });
  });

  it("maps an unavailable secure identity source to a public error", async () => {
    const bridge = new MysteryGameBridge("browser-test");
    vi.stubGlobal("crypto", undefined);
    try {
      const result = await bridge.submitIntent(createIntent("browser-no-identity-source"));
      expect(result).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("does not invoke Math.random and returns only public errors for malformed input", async () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used by the browser bridge");
    });
    const bridge = new MysteryGameBridge("browser-test");
    const malformed = await bridge.submitIntent({
      ...createIntent("browser-malformed"),
      payload: { kind: "CREATE_CHARACTER_RUN", selection: { ...R2_FIXTURE_DEFAULT_SELECTION, secret: "hidden" } },
    });
    expect(malformed).toMatchObject({ ok: false, error: { code: "CONTENT_SELECTION_INVALID" } });
    expect(JSON.stringify(malformed)).not.toMatch(/hidden|stack|path|SQL/i);
    random.mockRestore();
  });

  it("replays action receipts with identical committed facts", async () => {
    const bridge = new MysteryGameBridge("browser-test");
    const created = okValue(await bridge.submitIntent(createIntent("browser-replay-create")));
    const action = actionIntent("browser-replay-action", created.runId, created.newRevision, "REST");
    const first = okValue(await bridge.submitIntent(action));
    const replay = okValue(await bridge.submitIntent(action));

    const { replayed: _firstReplayed, ...firstWithoutFlag } = first;
    const { replayed: _replayFlag, ...replayWithoutFlag } = replay;
    expect(replayWithoutFlag).toEqual(firstWithoutFlag);
    expect(replay).toMatchObject({ replayed: true });
  });
});
