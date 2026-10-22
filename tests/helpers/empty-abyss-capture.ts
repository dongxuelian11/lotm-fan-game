import assert from 'node:assert/strict';
import { createAbyssState } from '../../src/domain/abyss/index.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Independently pinned schema221 addition. Validate every leaf before removing
 * this named root; never obtain an expected historical view from a projector. */
export function assertEmptyAbyssState(state: Pick<SliceState, 'abyss'>): void {
  const empty: SliceState['abyss'] = {
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    scene: null, materials: null, journal: [], promotionStability: { preparations: [] },
  };
  assert.deepEqual(createAbyssState(), empty);
  assert.equal(Object.hasOwn(state, 'abyss'), true);
  assert.deepEqual(state.abyss, empty);
}

/** Exact inactive public addition for the other pathways' immutable captures.
 * Only original host resources/injuries and the living/dead reason vary. */
export function emptyAbyssPublic(state: SliceState): SliceProjection['abyss'] {
  assert.notEqual(state.progression.pathwayId, 'abyss');
  return {
    title: '序列0 深渊', guidanceKnown: false, promoted: false,
    story: '河岸货栈的两道货闸被原轴销卡住。先查明普通侧路，实购工具拆销，让35岁的科拉与43岁的奥斯瓦尔德分别同意本班搬运、领取工钱，带着各自的货物实际走过两段三米通道，再沿普通出口交货。晋升后，你可独自回到检修台处理同一枚已拆原销和一只已见箱件，两位搬运工留在栈外。诺拉、罗安、原卡铃纸、旧刻片和哈兰的真实结果仍留在原处。',
    nextStep: '核对本体内的一份污秽君王特性，实际取得另外两份原件与同一唯一性，完成货栈两人的真实搬运退出。成为污秽君王满十二个实际周后，可实付准备并独立决定饮用；每周工作和生活费照常。',
    risk: '充分准备也不保证成功，概率随当前意志与本瓶本次准备变化。失败留下真实费用、重伤、精神损耗与污染，严重失败可能死亡。存活失败须封存、等待七日并付费回收同一残余；载体不能创造第四份特性，退出或重开不能撤销死亡。',
    resources: { health: state.health, maxHealth: 100, mind: state.mind, maxMind: 100,
      spirituality: state.spirituality, maxSpirituality: 120, cash: `${state.cash}便士`,
      actionsRemaining: state.actionsRemaining, weeklyBudget: state.weeklyBudget },
    injuries: state.injuries.map(injury => ({ id: injury.id, severity: injury.severity,
      treated: injury.treatedRevision !== null })), injuryRisk: state.injuryRisk,
    abilities: [], actions: [{ id: 'abyss:0:LEARN_GUIDANCE', label: '听取货栈与三份原特性指导',
      cost: '1行动、100便士', command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由仍活着的污秽君王本人继续。' : '已经死亡或结束的角色不能继续行动。',
      preferredAction: true }], sections: [], insideCase: false,
  };
}

export function assertEmptyAbyssPublic(projection: Pick<SliceProjection, 'abyss'>, state: SliceState): void {
  assert.equal(Object.hasOwn(projection, 'abyss'), true);
  assert.deepEqual(projection.abyss, emptyAbyssPublic(state));
}
