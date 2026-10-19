import assert from 'node:assert/strict';
import { createTwilightGiantState } from '../../src/domain/twilight-giant/index.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Independently pinned schema217 addition. Validate every leaf before removing
 * this named root; never obtain an expected historical view from a projector. */
export function assertEmptyTwilightGiantState(state: Pick<SliceState, 'twilightGiant'>): void {
  const empty: SliceState['twilightGiant'] = {
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    works: null, materials: null, epilogue: null, journal: [],
    promotionStability: { preparations: [] },
  };
  assert.deepEqual(createTwilightGiantState(), empty);
  assert.equal(Object.hasOwn(state, 'twilightGiant'), true);
  assert.deepEqual(state.twilightGiant, empty);
}

/** Exact inactive public addition for the other pathways' immutable captures.
 * Only original host resources/injuries and the living/dead reason vary. */
export function emptyTwilightGiantPublic(state: SliceState): SliceProjection['twilightGiant'] {
  assert.notEqual(state.progression.pathwayId, 'warrior');
  return {
    title: '序列0 黄昏巨人', guidanceKnown: false, promoted: false,
    story: '原修护室的六米短桥需要两段有价新支撑。玛拉与奥斯里克两位新成年工人各有意愿、工资、身体和位置，须亲自到场、走完两段，再沿普通侧路真正退出。西莉娅与埃文、原银甲和耗尽的旧物仍保持原记录。',
    nextStep: '查清原失败残余、供应瓶与体内原份的去向，核对同一唯一性保管链；完成原桥两次真实通行与退出、成为神明之手满十二周后，才能独立决定是否服药。',
    risk: '实际意志与可选的同瓶有价准备共同决定成功率。失败保留耗费、重伤和污染，严重失败可以死亡。幸存者只可封存原残余、隔周付费回收，再用剩余有限载体重配；没有复活或第四份原特性。',
    resources: { health: state.health, maxHealth: 100, mind: state.mind, maxMind: 100,
      spirituality: state.spirituality, maxSpirituality: 120, cash: `${state.cash}便士`,
      actionsRemaining: state.actionsRemaining, weeklyBudget: state.weeklyBudget },
    injuries: state.injuries.map(injury => ({ id: injury.id, severity: injury.severity,
      treated: injury.treatedRevision !== null })), injuryRisk: state.injuryRisk,
    abilities: [], actions: [{ id: 'twilight-giant:0:LEARN_GUIDANCE', label: '听取原桥修护与三份原特性指导',
      cost: '1行动、100便士', command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由仍活着的神明之手本人继续。' : '已经死亡或结束的角色不能继续行动。',
      preferredAction: true }], sections: [], insideCase: false,
  };
}

export function assertEmptyTwilightGiantPublic(projection: Pick<SliceProjection, 'twilightGiant'>, state: SliceState): void {
  assert.equal(Object.hasOwn(projection, 'twilightGiant'), true);
  assert.deepEqual(projection.twilightGiant, emptyTwilightGiantPublic(state));
}
