import assert from 'node:assert/strict';
import { createChainedState } from '../../src/domain/chained/index.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Independently pinned schema222 addition. Validate every leaf before removing
 * this named root; never obtain an expected historical view from a projector. */
export function assertEmptyChainedState(state: Pick<SliceState, 'chained'>): void {
  const empty: SliceState['chained'] = {
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    scene: null, materials: null, journal: [], promotionStability: { preparations: [] },
  };
  assert.deepEqual(createChainedState(), empty);
  assert.equal(Object.hasOwn(state, 'chained'), true);
  assert.deepEqual(state.chained, empty);
}

/** Exact inactive public addition for the other pathways' immutable captures.
 * Only original host resources/injuries and the living/dead reason vary. */
export function emptyChainedPublic(state: SliceState): SliceProjection['chained'] {
  assert.notEqual(state.progression.pathwayId, 'chained');
  return {
    title: '序列0 被缚者', guidanceKnown: false, promoted: false,
    story: '短闸廊两道货闸的原销需要普通拆检。先查明永远可用的绞盘、支撑和侧路，实购工具，让35岁的薇拉与43岁的埃德温分别同意本班搬运、领取工钱，携各自原货物实际通过两段三米通道，再沿普通出口交货。晋升后由你独自检查同一后闸原绳的有限载荷与一只已见箱件，两位成年人留在廊外。埃尔莎、哈伦、原衣包盘纸，以及罗德里克的投降与未治疗重伤保持原状。',
    nextStep: '核对本体内的一份神孽特性，实际取得另外两份原件与同一唯一性，完成闸廊两人的真实搬运退出。成为神孽满十二个实际周后，可实付准备并独立决定饮用；每周工作和生活费照常。',
    risk: '充分准备也不保证成功，概率随当前意志与本瓶本次准备变化。失败留下真实费用、重伤、精神损耗与污染，严重失败可能死亡。存活失败须封存、等待七日并付费回收同一残余；载体不能创造第四份特性，退出或重开不能撤销死亡。',
    resources: { health: state.health, maxHealth: 100, mind: state.mind, maxMind: 100,
      spirituality: state.spirituality, maxSpirituality: 120, cash: `${state.cash}便士`,
      actionsRemaining: state.actionsRemaining, weeklyBudget: state.weeklyBudget },
    injuries: state.injuries.map(injury => ({ id: injury.id, severity: injury.severity,
      treated: injury.treatedRevision !== null })), injuryRisk: state.injuryRisk,
    abilities: [], actions: [{ id: 'chained:0:LEARN_GUIDANCE', label: '听取闸廊与三份原特性指导',
      cost: '1行动、100便士', command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由仍活着的神孽本人继续。' : '已经死亡或结束的角色不能继续行动。' }], sections: [], insideCase: false,
  };
}

export function assertEmptyChainedPublic(projection: Pick<SliceProjection, 'chained'>, state: SliceState): void {
  assert.equal(Object.hasOwn(projection, 'chained'), true);
  assert.deepEqual(projection.chained, emptyChainedPublic(state));
}
