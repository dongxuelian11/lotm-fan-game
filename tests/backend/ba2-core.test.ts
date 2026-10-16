import { describe, expect, it } from "vitest";

import {
  BA2_EVENT_DEFINITIONS,
  BA2_FIXTURE_CHAIN,
  validateBA2EventPack,
} from "../../src/content/ba2-events.js";
import {
  BROWSER_ALPHA_CANDIDATE,
  createR2CharacterRunState,
} from "../../src/domain/fixture.js";
import { applyBrowserAlphaAction } from "../../src/domain/action-resolution.js";
import { computeStateChecksum } from "../../src/domain/checksum.js";
import { R2_FIXTURE_CATALOGUE, R2_FIXTURE_DEFAULT_SELECTION } from "../../src/content/r2-catalogue.js";
import { DeterministicActionRandomStream, type ActionRandomStream } from "../../src/resolution/deterministic-random.js";
import { MysteryGameBridge } from "../../src/simulation/browser-bridge.js";
import {
  CONTRACT_VERSION,
  type BridgeResult,
  type IntentEnvelope,
  type PublicActionKind,
  type PublicGameState,
} from "../../src/shared/contracts.js";

function valueOf<T>(result: BridgeResult<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

function createIntent(intentId: string, appVersion = "ba2-test-seed"): IntentEnvelope {
  return {
    contractVersion: CONTRACT_VERSION,
    intentId,
    runId: null,
    expectedRevision: 0,
    payload: {
      kind: "CREATE_CHARACTER_RUN",
      selection: { ...R2_FIXTURE_DEFAULT_SELECTION, displayName: appVersion },
    },
  };
}

function actionIntent(
  intentId: string,
  state: PublicGameState,
  action: PublicActionKind,
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
  if (state.activeEvent === null) throw new Error("event is not active");
  const choice = state.activeEvent.choices[0];
  if (choice === undefined || choice.unavailableReason !== undefined) throw new Error("event has no usable choice");
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

class SequenceRandom implements ActionRandomStream {
  public readonly seed = "test-sequence";
  private position = 0;

  public constructor(private readonly values: readonly number[]) {}

  public get cursor(): number {
    return this.position;
  }

  public nextInt(minimum: number, maximum: number): number {
    const value = this.values[this.position];
    this.position += 1;
    if (value === undefined || value < minimum || value > maximum) {
      throw new Error(`unexpected random range ${minimum}-${maximum}`);
    }
    return value;
  }
}

describe("BA2 core resolution and event fixtures", () => {
  it("validates exactly twelve playtest definitions and the three-stage chain", () => {
    expect(BA2_EVENT_DEFINITIONS).toHaveLength(12);
    expect(BA2_FIXTURE_CHAIN.stages).toEqual([
      "ba2-event-chain-ledger",
      "ba2-event-chain-contact",
      "ba2-event-chain-close",
    ]);
    expect(validateBA2EventPack()).toBe(true);
    const malformed = JSON.parse(JSON.stringify(BA2_EVENT_DEFINITIONS)) as Array<Record<string, unknown>>;
    (malformed[0]!.choices as Array<Record<string, unknown>>)[0]!.target = "PRIVATE_STATE";
    expect(validateBA2EventPack(malformed, BA2_FIXTURE_CHAIN)).toBe(false);
  });

  it("applies learning and investigation facts once, then replays the exact receipt", async () => {
    const bridge = new MysteryGameBridge("ba2-acceptance-seed");
    const created = valueOf(await bridge.submitIntent(createIntent("core-create", "Ada")));
    let state = created.publicState;
    const knowledgeBefore = state.character.coreStats.knowledge;

    const learnEnvelope = actionIntent("core-learn", state, "LEARN");
    const learn = valueOf(await bridge.submitIntent(learnEnvelope));
    state = learn.publicState;
    expect(state.character.coreStats.knowledge).toBe(knowledgeBefore + 5);
    expect(state.knowledgeRecords).toHaveLength(1);
    expect(state.lastAction?.resolution?.tier).toBe("SUCCESS");
    expect(state.lastAction?.consequences.some((item) => item.target === "KNOWLEDGE" && item.applied)).toBe(true);

    const learnReplay = valueOf(await bridge.submitIntent(learnEnvelope));
    expect(learnReplay).toEqual({ ...learn, replayed: true });

    const investigate = valueOf(await bridge.submitIntent(actionIntent("core-investigate", state, "INVESTIGATE")));
    state = investigate.publicState;
    expect(state.clues).toHaveLength(1);
    expect(state.lastAction?.resolution).not.toBeNull();
    expect(state.activeEvent).not.toBeNull();
    expect(state.activeEvent?.choices.every((choice) => !Object.prototype.hasOwnProperty.call(choice, "consequences"))).toBe(true);
    expect(JSON.stringify(state.activeEvent)).not.toMatch(/numericValue|condition|private|secret/i);
  });

  it("blocks direct actions behind an event and resolves without spending an action", async () => {
    const bridge = new MysteryGameBridge("ba2-ui-event-seed");
    const created = valueOf(await bridge.submitIntent(createIntent("event-create", "Beatrice")));
    const investigation = valueOf(await bridge.submitIntent(actionIntent("event-investigate", created.publicState, "INVESTIGATE")));
    expect(investigation.publicState.activeEvent).not.toBeNull();
    const blocked = await bridge.submitIntent(actionIntent("event-blocked", investigation.publicState, "REST"));
    expect(blocked).toMatchObject({ ok: false, error: { code: "ACTION_UNAVAILABLE" } });

    const beforeActions = investigation.publicState.availableActions;
    const resolved = valueOf(await bridge.submitIntent(eventIntent("event-resolve", investigation.publicState)));
    expect(resolved.publicState.availableActions).toBe(beforeActions);
    expect(resolved.publicState.activeEvent).toBeNull();
    expect(resolved.publicState.lastEventResolution?.eventInstanceId).toBe(
      investigation.publicState.activeEvent?.eventInstanceId,
    );
    expect(valueOf(await bridge.submitIntent(eventIntent("event-resolve", investigation.publicState)))).toEqual({
      ...resolved,
      replayed: true,
    });
  });

  it("recovers resources, pays work once per week, and advances the public date with a pulse", () => {
    const initial = createR2CharacterRunState(
      "550e8400-e29b-41d4-a716-446655440000",
      R2_FIXTURE_DEFAULT_SELECTION,
      R2_FIXTURE_CATALOGUE,
      BROWSER_ALPHA_CANDIDATE,
    );
    const reduced: PublicGameState = {
      ...initial,
      character: {
        ...initial.character,
        resources: {
          ...initial.character.resources,
          health: { current: 80, max: 100 },
          mind: { current: 70, max: 100 },
          spirituality: { current: 10, max: 15 },
        },
      },
    };
    const reducedWithChecksum = {
      ...reduced,
      stateChecksum: computeStateChecksum((({ stateChecksum: _checksum, ...state }) => state)(reduced)),
    };
    const rested = applyBrowserAlphaAction(reducedWithChecksum, "REST");
    expect(rested.character.resources.health.current).toBe(90);
    expect(rested.character.resources.mind.current).toBe(80);
    expect(rested.character.resources.spirituality.current).toBe(15);

    const work = applyBrowserAlphaAction(initial, "WORK");
    const repeatedWork = applyBrowserAlphaAction(work, "WORK");
    expect(repeatedWork.cashPence).toBe(work.cashPence);

    const one = applyBrowserAlphaAction(initial, "WORK");
    const two = applyBrowserAlphaAction(one, "LEARN");
    const three = applyBrowserAlphaAction(two, "REST");
    expect(three.week).toBe(2);
    expect(three.availableActions).toBe(3);
    expect(three.currentDate).toEqual({ epoch: "FIFTH_EPOCH", year: 1349, month: 7, day: 5 });
    const pulse = three.worldFeedback.at(-1);
    expect(pulse).toMatchObject({
      kind: "WORLD_PULSE",
      date: three.currentDate,
      title: "公共告示换新",
      summary: "街区公共栏撤下了过期告示，换上新的招工、租屋与货运通知；你目前只能确认这些公开变化。",
    });
    expect(`${pulse?.title ?? ""}${pulse?.summary ?? ""}`).not.toMatch(/回响|回声|雾/);
    expect(three.lastAction?.dateAfter).toEqual(three.currentDate);
  });

  it("can open one world-pulse event without replacing an action event", () => {
    const initial = createR2CharacterRunState(
      "550e8400-e29b-41d4-a716-446655440000",
      R2_FIXTURE_DEFAULT_SELECTION,
      R2_FIXTURE_CATALOGUE,
      BROWSER_ALPHA_CANDIDATE,
    );
    const random = new SequenceRandom([4, 1]);
    const state = { ...initial, availableActions: 1 };
    const next = applyBrowserAlphaAction(state, "REST", { random });
    expect(next.activeEvent?.definitionId).toBe("ba2-event-distant-notice");
    expect(next.availableActions).toBe(3);
    expect(next.worldFeedback.at(-1)?.kind).toBe("WORLD_PULSE");
  });

  it("keeps deterministic random progress private to the bridge", async () => {
    const bridge = new MysteryGameBridge("private-seed");
    const created = valueOf(await bridge.submitIntent(createIntent("private-create", "Clara")));
    expect(JSON.stringify(created.publicState)).not.toMatch(/random|seed|cursor/i);
    expect(Object.keys(bridge)).not.toContain("randomCursor");
    const streamA = new DeterministicActionRandomStream("private-seed");
    const streamB = new DeterministicActionRandomStream("private-seed");
    expect(streamA.nextInt(1, 100)).toBe(streamB.nextInt(1, 100));
  });
});
