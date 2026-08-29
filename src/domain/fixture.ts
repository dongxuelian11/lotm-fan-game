import {
  CONTENT_VERSION,
  CONTRACT_VERSION,
  R1_FIXTURE_DEFAULTS,
  RULE_VERSION,
  type PublicGameState,
  type PublicGameState as PublicState,
} from "../shared/contracts.js";
import { computeStateChecksum, type PublicGameStateWithoutChecksum } from "./checksum.js";

const FIXTURE_CHRONICLE = {
  id: "r1-fixture-created",
  week: 1,
  title: "R1 工程周目",
  summary: "仅用于验证桌面壳、权威存档与重启恢复。",
} as const;

export function createR1FixtureState(runId: string, displayName: string): PublicGameState {
  const state: PublicGameStateWithoutChecksum = {
    contractVersion: CONTRACT_VERSION,
    ruleVersion: RULE_VERSION,
    contentVersion: CONTENT_VERSION,
    runId,
    lifecycle: "ACTIVE",
    revision: 1,
    week: R1_FIXTURE_DEFAULTS.week,
    availableActions: R1_FIXTURE_DEFAULTS.availableActions,
    cashPence: R1_FIXTURE_DEFAULTS.cashPence,
    character: {
      displayName,
      origin: "LOEN",
      sequence: "ORDINARY",
      coreStats: {
        physique: R1_FIXTURE_DEFAULTS.coreStats.physique,
        perception: R1_FIXTURE_DEFAULTS.coreStats.perception,
        will: R1_FIXTURE_DEFAULTS.coreStats.will,
        knowledge: R1_FIXTURE_DEFAULTS.coreStats.knowledge,
      },
      resources: {
        health: {
          current: R1_FIXTURE_DEFAULTS.resources.health.current,
          max: R1_FIXTURE_DEFAULTS.resources.health.max,
        },
        mind: {
          current: R1_FIXTURE_DEFAULTS.resources.mind.current,
          max: R1_FIXTURE_DEFAULTS.resources.mind.max,
        },
        spirituality: {
          current: R1_FIXTURE_DEFAULTS.resources.spirituality.current,
          max: R1_FIXTURE_DEFAULTS.resources.spirituality.max,
        },
        pollution: R1_FIXTURE_DEFAULTS.resources.pollution,
      },
    },
    chronicle: [FIXTURE_CHRONICLE],
  };

  return {
    ...state,
    stateChecksum: computeStateChecksum(state),
  };
}

export function stateWithoutChecksum(state: PublicState): PublicGameStateWithoutChecksum {
  const { stateChecksum: _stateChecksum, ...withoutChecksum } = state;
  return withoutChecksum;
}

export function hasValidStateChecksum(state: PublicState): boolean {
  return state.stateChecksum === computeStateChecksum(stateWithoutChecksum(state));
}
