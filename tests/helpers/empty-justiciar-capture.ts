import assert from 'node:assert/strict';
import { createJusticiarState } from '../../src/domain/justiciar/index.js';
import { JUSTICIAR_STORY, JUSTICIAR_GOAL, JUSTICIAR_RISK } from '../../src/domain/justiciar/content.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Pin every leaf of the sole schema225 addition before comparing older captures. */
export function assertEmptyJusticiarState(state: Pick<SliceState, 'justiciar'>): void {
  const empty: SliceState['justiciar'] = {
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    scene: null, materials: null, journal: [], promotionStability: { preparations: [] },
  };
  assert.deepEqual(createJusticiarState(), empty);
  assert.equal(Object.hasOwn(state, 'justiciar'), true);
  assert.deepEqual(state.justiciar, empty);
}

/** Exact inactive shape; only host resources, injuries and terminal reason vary. */
export function emptyJusticiarPublic(state: SliceState): SliceProjection['justiciar'] {
  assert.notEqual(state.progression.pathwayId, 'justiciar');
  return {
    title: '序列0 审判者', guidanceKnown: false, promoted: false,
    story: JUSTICIAR_STORY, nextStep: JUSTICIAR_GOAL, risk: JUSTICIAR_RISK,
    resources: { health: state.health, maxHealth: 100, mind: state.mind, maxMind: 100,
      spirituality: state.spirituality, maxSpirituality: 120, cash: `${state.cash}便士`,
      actionsRemaining: state.actionsRemaining, weeklyBudget: state.weeklyBudget },
    injuries: state.injuries.map(injury => ({ id: injury.id, severity: injury.severity,
      treated: injury.treatedRevision !== null })), injuryRisk: state.injuryRisk,
    abilities: [], actions: [{ id: 'justiciar:0:LEARN_GUIDANCE', label: '听取码头与三份原特性指导',
      cost: '1行动、100便士', command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由仍活着的秩序之手本人继续。' : '已经死亡或结束的角色不能继续行动。' }],
    sections: [], insideCase: false,
  };
}

export function assertEmptyJusticiarPublic(projection: Pick<SliceProjection, 'justiciar'>, state: SliceState): void {
  assert.equal(Object.hasOwn(projection, 'justiciar'), true);
  assert.deepEqual(projection.justiciar, emptyJusticiarPublic(state));
}
