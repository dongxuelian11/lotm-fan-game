import assert from 'node:assert/strict';
import { createMotherState } from '../../src/domain/mother/index.js';
import { MOTHER_STORY, MOTHER_GOAL, MOTHER_RISK } from '../../src/domain/mother/content.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Pin every leaf of the sole schema226 addition before comparing older captures. */
export function assertEmptyMotherState(state: Pick<SliceState, 'mother'>): void {
  const empty: SliceState['mother'] = {
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    scene: null, materials: null, journal: [], promotionStability: { preparations: [] },
  };
  assert.deepEqual(createMotherState(), empty);
  assert.equal(Object.hasOwn(state, 'mother'), true);
  assert.deepEqual(state.mother, empty);
}

/** Exact inactive shape; only host resources, injuries and terminal reason vary. */
export function emptyMotherPublic(state: SliceState): SliceProjection['mother'] {
  assert.notEqual(state.progression.pathwayId, 'mother');
  return {
    title: '序列0 母亲', guidanceKnown: false, promoted: false,
    story: MOTHER_STORY, nextStep: MOTHER_GOAL, risk: MOTHER_RISK,
    resources: { health: state.health, maxHealth: 100, mind: state.mind, maxMind: 100,
      spirituality: state.spirituality, maxSpirituality: 120, cash: `${state.cash}便士`,
      actionsRemaining: state.actionsRemaining, weeklyBudget: state.weeklyBudget },
    injuries: state.injuries.map(injury => ({ id: injury.id, severity: injury.severity,
      treated: injury.treatedRevision !== null })), injuryRisk: state.injuryRisk,
    abilities: [], actions: [{ id: 'mother:0:LEARN_GUIDANCE', label: '听取温室与原特性指导',
      cost: '1行动、100便士；当前伤势如实承接', command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由仍活着的自然行者本人继续。' : '已经死亡或结束的角色不能继续行动。' }],
    sections: [], insideCase: false,
  };
}

export function assertEmptyMotherPublic(projection: Pick<SliceProjection, 'mother'>, state: SliceState): void {
  assert.equal(Object.hasOwn(projection, 'mother'), true);
  assert.deepEqual(projection.mother, emptyMotherPublic(state));
}
