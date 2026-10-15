import { describe, expect, it } from "vitest";

import { BA2_EVENT_DEFINITIONS, BA2_FIXTURE_CHAIN } from "../../src/content/ba2-events.js";
import { R2_FIXTURE_DEFAULT_SELECTION } from "../../src/content/r2-catalogue.js";
import { addGameWeeks } from "../../src/domain/game-calendar.js";
import { computeCheckChance, resolveNormalCheck } from "../../src/resolution/normal-check.js";
import { MysteryGameBridge } from "../../src/simulation/browser-bridge.js";
import {
  CONTRACT_VERSION,
  type BridgeResult,
  type CommitReceipt,
  type IntentEnvelope,
  type PublicGameState,
} from "../../src/shared/contracts.js";

function okValue<T>(result: BridgeResult<T>): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

function createIntent(intentId: string): IntentEnvelope {
  return {
    contractVersion: CONTRACT_VERSION,
    intentId,
    runId: null,
    expectedRevision: 0,
    payload: {
      kind: "CREATE_CHARACTER_RUN",
      selection: {
        ...R2_FIXTURE_DEFAULT_SELECTION,
        appearanceDescription: "黑发，灰眼，衣着整洁。",
      },
    },
  };
}

function actionIntent(
  intentId: string,
  state: PublicGameState,
  action: "WORK" | "LEARN" | "INVESTIGATE" | "REST",
): IntentEnvelope {
  return {
    contractVersion: CONTRACT_VERSION,
    intentId,
    runId: state.runId,
    expectedRevision: state.revision,
    payload: { kind: "PERFORM_WEEKLY_ACTION", action },
  };
}

function eventIntent(intentId: string, state: PublicGameState): IntentEnvelope {
  if (state.activeEvent === null) {
    throw new Error("Expected an open event");
  }
  const choice = state.activeEvent.choices.find((candidate) => candidate.unavailableReason === undefined);
  if (choice === undefined) {
    throw new Error("Expected a reachable event choice");
  }
  return {
    contractVersion: CONTRACT_VERSION,
    intentId,
    runId: state.runId,
    expectedRevision: state.revision,
    payload: {
      kind: "RESOLVE_EVENT_CHOICE",
      eventInstanceId: state.activeEvent.eventInstanceId,
      choiceId: choice.id,
    },
  };
}

async function resolveOpenEvent(
  bridge: MysteryGameBridge,
  state: PublicGameState,
  intentId: string,
): Promise<PublicGameState> {
  if (state.activeEvent === null) return state;
  const receipt = okValue(await bridge.submitIntent(eventIntent(intentId, state)));
  expect(receipt.publicState.availableActions).toBe(state.availableActions);
  expect(receipt.publicState.lastEventResolution).not.toBeNull();
  return receipt.publicState;
}

function receiptState(receipt: CommitReceipt): PublicGameState {
  return receipt.publicState;
}

describe("BA2 normal resolution, events and world feedback acceptance RED", () => {
  it("implements the locked d100 formula and fixed extreme faces", () => {
    expect(computeCheckChance({ baseAbility: 15, difficulty: 15, modifiers: [] })).toBe(50);
    expect(computeCheckChance({ baseAbility: 40, difficulty: 15, modifiers: [] })).toBe(95);
    expect(computeCheckChance({ baseAbility: 1, difficulty: 40, modifiers: [] })).toBe(5);
    expect(computeCheckChance({ baseAbility: 15, difficulty: 15, modifiers: [{ source: "准备", value: 2 }, { source: "疲惫", value: -1 }] })).toBe(52);

    expect(resolveNormalCheck({ baseAbility: 15, difficulty: 15, modifiers: [], roll: 1 }).tier).toBe("GREAT_SUCCESS");
    expect(resolveNormalCheck({ baseAbility: 15, difficulty: 15, modifiers: [], roll: 50 }).tier).toBe("SUCCESS");
    expect(resolveNormalCheck({ baseAbility: 15, difficulty: 15, modifiers: [], roll: 51 }).tier).toBe("FAILURE");
    expect(resolveNormalCheck({ baseAbility: 15, difficulty: 15, modifiers: [], roll: 100 }).tier).toBe("GREAT_FAILURE");
  });

  it("advances the canon-era public date by the internal weekly pulse", () => {
    expect(addGameWeeks({ epoch: "FIFTH_EPOCH", year: 1349, month: 6, day: 28 }, 0)).toEqual({
      epoch: "FIFTH_EPOCH", year: 1349, month: 6, day: 28,
    });
    expect(addGameWeeks({ epoch: "FIFTH_EPOCH", year: 1349, month: 6, day: 28 }, 1)).toEqual({
      epoch: "FIFTH_EPOCH", year: 1349, month: 7, day: 5,
    });
  });

  it("loads the bounded playtest event pack without claiming formal content completion", () => {
    expect(BA2_EVENT_DEFINITIONS).toHaveLength(12);
    expect(BA2_EVENT_DEFINITIONS.every((event) => event.contentStatus === "PLAYTEST_FIXTURE")).toBe(true);
    expect(BA2_FIXTURE_CHAIN.stages).toHaveLength(3);
    expect(BA2_FIXTURE_CHAIN.contentStatus).toBe("PLAYTEST_FIXTURE");
  });

  it("turns learning into replay-safe numeric and concrete knowledge outcomes", async () => {
    const bridge = new MysteryGameBridge("ba2-acceptance-seed");
    let state = receiptState(okValue(await bridge.submitIntent(createIntent("ba2-create"))));
    expect(state.currentDate).toEqual({ epoch: "FIFTH_EPOCH", year: 1349, month: 6, day: 28 });
    expect(state.knowledgeRecords).toEqual([]);
    expect(state.clues).toEqual([]);

    const knowledgeBefore = state.character.coreStats.knowledge;
    const learnEnvelope = actionIntent("ba2-learn", state, "LEARN");
    const learn = okValue(await bridge.submitIntent(learnEnvelope));
    state = receiptState(learn);
    expect(state.lastAction?.resolution).not.toBeNull();
    expect(state.lastAction?.consequences.length).toBeGreaterThan(0);
    expect(state.character.coreStats.knowledge).toBeGreaterThan(knowledgeBefore);
    expect(state.knowledgeRecords).toHaveLength(1);
    expect(state.worldFeedback.at(-1)?.kind).toBe("ACTION");

    const learnReplay = okValue(await bridge.submitIntent(learnEnvelope));
    expect(learnReplay.replayed).toBe(true);
    expect(learnReplay.publicState.knowledgeRecords).toHaveLength(1);
  });

  it("turns investigation into a check, a clue and a reachable event outcome", async () => {
    const bridge = new MysteryGameBridge("ba2-investigation-seed");
    let state = receiptState(okValue(await bridge.submitIntent(createIntent("ba2-investigate-create"))));

    const investigate = okValue(await bridge.submitIntent(actionIntent("ba2-investigate", state, "INVESTIGATE")));
    state = receiptState(investigate);
    expect(state.lastAction?.resolution).not.toBeNull();
    expect(state.clues.length).toBeGreaterThan(0);
    expect(state.activeEvent !== null || state.pendingEvents.length > 0).toBe(true);
    expect(state.worldFeedback.at(-1)?.summary.trim().length).toBeGreaterThan(0);
    state = await resolveOpenEvent(bridge, state, "ba2-investigate-event");
    expect(state.lastEventResolution).not.toBeNull();
  });
});
