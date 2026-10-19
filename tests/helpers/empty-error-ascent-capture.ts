import assert from 'node:assert/strict';
import { createErrorAscentState } from '../../src/domain/error-ascent/index.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Independently pinned schema216 addition. Validate every leaf before removing
 * this named root from a historical view; never derive expectations by projection. */
export function assertEmptyErrorAscentState(state: Pick<SliceState, 'errorAscent'>): void {
  const empty: SliceState['errorAscent'] = {
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    ritual: null, materials: null, epilogue: null, journal: [],
    promotionStability: { preparations: [] },
  };
  assert.deepEqual(createErrorAscentState(), empty);
  assert.equal(Object.hasOwn(state, 'errorAscent'), true);
  assert.deepEqual(state.errorAscent, empty);
}

/** Exact inactive public view for the other pathways' immutable captures.
 * Only host resources/injuries and the living/dead reason vary with that source. */
export function emptyErrorAscentPublic(state: SliceState): SliceProjection['errorAscent'] {
  assert.notEqual(state.progression.pathwayId, 'error');
  const reason = state.status === 'ACTIVE'
    ? '须由仍活着的时之虫本人继续。' : '已经死亡或结束的角色不能继续行动。';
  return {
    title: '错误晋升 · 潮汐钟塔', guidanceKnown: false, promoted: false,
    story: '潮汐钟塔正在筹备伊德里克·维尔的成神仪式。他已经取得自己的原件、沿海追随者与真正挑战后的生还记录，并不打算与你分享机会。你可以调查原线路和普通退路，在自己准备好后决定是否夺走这一次位置。',
    nextStep: reason,
    risk: '这是夺走他人的成神机会。窗口只有一次，可能导致双方重伤或死亡；离开或失手不会让仪式重来。对方的三份雷神和唯一性不归你，原费用、伤势与人物后果永久保留。',
    resources: { health: state.health, maxHealth: 100, mind: state.mind, maxMind: 100,
      spirituality: state.spirituality, maxSpirituality: 120, cash: `${state.cash}便士`,
      actionsRemaining: state.actionsRemaining, weeklyBudget: state.weeklyBudget },
    injuries: state.injuries.map(injury => ({ id: injury.id, severity: injury.severity,
      treated: injury.treatedRevision !== null })), injuryRisk: state.injuryRisk,
    abilities: [], actions: [{ id: 'error-ascent:0:LEARN_GUIDANCE', label: '听取错误晋升与钟塔调查指导',
      cost: '1行动、100便士', command: { type: 'LEARN_GUIDANCE' }, enabled: false, reason }],
    sections: [], insideCase: false,
  };
}

export function assertEmptyErrorAscentPublic(projection: Pick<SliceProjection, 'errorAscent'>, state: SliceState): void {
  assert.equal(Object.hasOwn(projection, 'errorAscent'), true);
  assert.deepEqual(projection.errorAscent, emptyErrorAscentPublic(state));
}
