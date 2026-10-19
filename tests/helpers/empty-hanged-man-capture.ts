import assert from 'node:assert/strict';
import { createHangedManState } from '../../src/domain/hanged-man/index.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Independently pinned schema220 addition. Validate every leaf before removing
 * this named root; never obtain an expected historical view from a projector. */
export function assertEmptyHangedManState(state: Pick<SliceState, 'hangedMan'>): void {
  const empty: SliceState['hangedMan'] = {
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    scene: null, materials: null, journal: [], promotionStability: { preparations: [] },
  };
  assert.deepEqual(createHangedManState(), empty);
  assert.equal(Object.hasOwn(state, 'hangedMan'), true);
  assert.deepEqual(state.hangedMan, empty);
}

/** Exact inactive public addition for the other pathways' immutable captures.
 * Only original host resources/injuries and the living/dead reason vary. */
export function emptyHangedManPublic(state: SliceState): SliceProjection['hangedMan'] {
  assert.notEqual(state.progression.pathwayId, 'hanged-man');
  return {
    title: '序列0 倒吊人', guidanceKnown: false, promoted: false,
    story: '薇拉与埃德温要结束短压廊的一班维护。先检查两段各三米的通路、普通绞盘和侧门，向42岁的短廊值守者伊文取得本次许可，分别征得两名工人的同意并支付本班工钱，再逐人记录实际行走和退出。原院的玛拉、原卡、旧封条和两位原灵仍保持各自真实状态。晋升后，可由你独自在已隔离的局部装置前练习有限承压和单灵贴封；没有人需要为展示能力重新置身危险。',
    nextStep: '先追回三份失败原特性中的同一份，实际成为暗天使；完成三案、报告和反思。其后核对另外两份原件与唯一性的保管链，让两位成人真实退出，成为暗天使满十二个实际周后，再独立决定是否饮用。',
    risk: '充分准备也不保证成功，概率随当前意志与本瓶本次实付准备变化。失败留下真实费用、重伤与污染，严重失败可能死亡。幸存者须封存实际残余、等待并付费回收同一原件；新药瓶不能增加第四份特性，死亡不能通过退出或重开撤销。',
    resources: { health: state.health, maxHealth: 100, mind: state.mind, maxMind: 100,
      spirituality: state.spirituality, maxSpirituality: 120, cash: `${state.cash}便士`,
      actionsRemaining: state.actionsRemaining, weeklyBudget: state.weeklyBudget },
    injuries: state.injuries.map(injury => ({ id: injury.id, severity: injury.severity,
      treated: injury.treatedRevision !== null })), injuryRisk: state.injuryRisk,
    abilities: [], actions: [{ id: 'hangedMan:0:LEARN_GUIDANCE', label: '听取泄压廊与三份原特性指导',
      cost: '1行动、100便士', command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由仍活着的暗天使本人继续。' : '已经死亡或结束的角色不能继续行动。',
      preferredAction: true }], sections: [], insideCase: false,
  };
}

export function assertEmptyHangedManPublic(projection: Pick<SliceProjection, 'hangedMan'>, state: SliceState): void {
  assert.equal(Object.hasOwn(projection, 'hangedMan'), true);
  assert.deepEqual(projection.hangedMan, emptyHangedManPublic(state));
}
