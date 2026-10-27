import assert from 'node:assert/strict';
import { createBlackEmperorState } from '../../src/domain/black-emperor/index.js';
import { BLACK_EMPEROR_STORY, BLACK_EMPEROR_GOAL, BLACK_EMPEROR_RISK } from '../../src/domain/black-emperor/content.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Pin every leaf of the sole schema224 addition before comparing older captures. */
export function assertEmptyBlackEmperorState(state: Pick<SliceState, 'blackEmperor'>): void {
  const empty: SliceState['blackEmperor'] = {
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    scene: null, materials: null, journal: [], promotionStability: { preparations: [] },
  };
  assert.deepEqual(createBlackEmperorState(), empty);
  assert.equal(Object.hasOwn(state, 'blackEmperor'), true);
  assert.deepEqual(state.blackEmperor, empty);
}

/** Exact inactive shape; only host resources, injuries and terminal reason vary. */
export function emptyBlackEmperorPublic(state: SliceState): SliceProjection['blackEmperor'] {
  assert.notEqual(state.progression.pathwayId, 'black-emperor');
  return {
    title: '序列0 黑皇帝', guidanceKnown: false, promoted: false,
    story: BLACK_EMPEROR_STORY, nextStep: BLACK_EMPEROR_GOAL, risk: BLACK_EMPEROR_RISK,
    resources: { health: state.health, maxHealth: 100, mind: state.mind, maxMind: 100,
      spirituality: state.spirituality, maxSpirituality: 120, cash: `${state.cash}便士`,
      actionsRemaining: state.actionsRemaining, weeklyBudget: state.weeklyBudget },
    injuries: state.injuries.map(injury => ({ id: injury.id, severity: injury.severity,
      treated: injury.treatedRevision !== null })), injuryRisk: state.injuryRisk,
    abilities: [], actions: [{ id: 'black-emperor:0:LEARN_GUIDANCE', label: '听取国度、九陵与三份原件指导',
      cost: '1行动、20便士', command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由仍活着的弑序亲王本人继续。' : '已经死亡或结束的角色不能继续行动。' }],
    sections: [], insideCase: false,
  };
}

export function assertEmptyBlackEmperorPublic(projection: Pick<SliceProjection, 'blackEmperor'>, state: SliceState): void {
  assert.equal(Object.hasOwn(projection, 'blackEmperor'), true);
  assert.deepEqual(projection.blackEmperor, emptyBlackEmperorPublic(state));
}
