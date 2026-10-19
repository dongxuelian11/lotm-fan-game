import assert from 'node:assert/strict';
import { createHermitState } from '../../src/domain/hermit/index.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Independently pinned schema219 addition. Validate every leaf before removing
 * this named root; never obtain an expected historical view from a projector. */
export function assertEmptyHermitState(state: Pick<SliceState, 'hermit'>): void {
  const empty: SliceState['hermit'] = {
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    scene: null, materials: null, journal: [], promotionStability: { preparations: [] },
  };
  assert.deepEqual(createHermitState(), empty);
  assert.equal(Object.hasOwn(state, 'hermit'), true);
  assert.deepEqual(state.hermit, empty);
}

/** Exact inactive public addition for the other pathways' immutable captures.
 * Only original host resources/injuries and the living/dead reason vary. */
export function emptyHermitPublic(state: SliceState): SliceProjection['hermit'] {
  assert.notEqual(state.progression.pathwayId, 'hermit');
  return {
    title: '序列0 隐者', guidanceKnown: false, promoted: false,
    story: '米拉与奈尔斯要把艾瑞丝保管的一份记录送过两段各三米的搬迁廊。艾瑞丝的许可、两人的到场与每一次接交都须当面确认，档案始终只有一份。搬迁结束后，一道卡住的检修挡板需要处理；你可以检查短缝、转录已读封签，也可以用工具清障、手写封签。最后由实际持箱的人沿普通侧廊把封箱带出去。',
    nextStep: '查明两次旧服药留下的特性去向，核对唯一性的保管链；第三份特性仍在你体内。完成两位档案员的实际通行、接交和退出，成为知识皇帝满十二个实际周后，自行决定是否饮用。',
    risk: '成功率取决于当前意志与这一次实付的稳定准备。失败保留费用、重伤和污染，严重失败可能死亡。幸存者须封存同一份残余，隔周付费回收后再配制；已耗封签不会恢复，也不会多出第四份特性。',
    resources: { health: state.health, maxHealth: 100, mind: state.mind, maxMind: 100,
      spirituality: state.spirituality, maxSpirituality: 120, cash: `${state.cash}便士`,
      actionsRemaining: state.actionsRemaining, weeklyBudget: state.weeklyBudget },
    injuries: state.injuries.map(injury => ({ id: injury.id, severity: injury.severity,
      treated: injury.treatedRevision !== null })), injuryRisk: state.injuryRisk,
    abilities: [], actions: [{ id: 'hermit:0:LEARN_GUIDANCE', label: '听取档案搬迁与三份原特性指导',
      cost: '1行动、100便士', command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由仍活着的知识皇帝本人继续。' : '已经死亡或结束的角色不能继续行动。',
      preferredAction: true }], sections: [], insideCase: false,
  };
}

export function assertEmptyHermitPublic(projection: Pick<SliceProjection, 'hermit'>, state: SliceState): void {
  assert.equal(Object.hasOwn(projection, 'hermit'), true);
  assert.deepEqual(projection.hermit, emptyHermitPublic(state));
}
