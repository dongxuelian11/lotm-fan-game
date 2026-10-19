import assert from 'node:assert/strict';
import { createWheelOfFortuneState } from '../../src/domain/wheel-of-fortune/index.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Pin every leaf of the sole schema223 addition before comparing older captures. */
export function assertEmptyWheelOfFortuneState(state: Pick<SliceState, 'wheelOfFortune'>): void {
  const empty: SliceState['wheelOfFortune'] = {
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    scene: null, materials: null, journal: [], promotionStability: { preparations: [] },
  };
  assert.deepEqual(createWheelOfFortuneState(), empty);
  assert.equal(Object.hasOwn(state, 'wheelOfFortune'), true);
  assert.deepEqual(state.wheelOfFortune, empty);
}

/** Independently pinned inactive public addition for other pathways' captures.
 * Only host resources, injuries and the living/dead reason vary. */
export function emptyWheelOfFortunePublic(state: SliceState): SliceProjection['wheelOfFortune'] {
  assert.notEqual(state.progression.pathwayId, 'wheel');
  return {
    title: '序列0 命运之轮', guidanceKnown: false, promoted: false,
    story: '先核对岔路交接站的原凭证、普通支撑与侧路。备妥同一成药后，两位成年人各自选择新去处，亲手交出同一凭证与货物，随后真实走到新目的地。准确契机无法提前占卜、预言或以其他办法锁定；只能排除干扰，亲身经历并继续寻觅。活着失败后仅余两项事先登记的独立委托，旧人物选择与费用永远保留。',
    nextStep: '实际取得三份原特性与同一唯一性，先备妥成药与本次准备，再见证两位成年人不可回退的交接和新去处；晋1满十二周后，在机会当周独立决定服药。',
    risk: '准确契机不能通过占卜、预言或预定手续提前锁定，必须在实际经历中察觉。准备后的实际成功率仍随当前意志变化；失败保留费用、伤势、污染和既成人物决定，严重失败可能死亡。同一残余须封存七日并付费回收，最多三只载体和三项独立委托。',
    resources: { health: state.health, maxHealth: 100, mind: state.mind, maxMind: 100,
      spirituality: state.spirituality, maxSpirituality: 120, cash: `${state.cash}便士`,
      actionsRemaining: state.actionsRemaining, weeklyBudget: state.weeklyBudget },
    injuries: state.injuries.map(injury => ({ id: injury.id, severity: injury.severity,
      treated: injury.treatedRevision !== null })), injuryRisk: state.injuryRisk,
    abilities: [], actions: [{ id: 'wheel-of-fortune:0:LEARN_GUIDANCE', label: '听取岔路与三份原特性指导',
      cost: '1行动、20便士', command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由仍活着的水银之蛇本人继续。' : '已经死亡或结束的角色不能继续行动。' }], sections: [], insideCase: false,
  };
}

export function assertEmptyWheelOfFortunePublic(projection: Pick<SliceProjection, 'wheelOfFortune'>, state: SliceState): void {
  assert.equal(Object.hasOwn(projection, 'wheelOfFortune'), true);
  assert.deepEqual(projection.wheelOfFortune, emptyWheelOfFortunePublic(state));
}
