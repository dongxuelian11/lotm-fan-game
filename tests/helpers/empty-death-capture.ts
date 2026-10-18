import assert from 'node:assert/strict';
import { createDeathState } from '../../src/domain/death/index.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Independently reviewed schema214 addition. Never obtain historical expected
 * output from the current projector or discard an unrecognized root. */
export function assertEmptyDeathState(state: Pick<SliceState, 'death'>): void {
  const empty: SliceState['death'] = {
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    services: null, materials: null, materialScene: null, epilogue: null, journal: [],
    promotionStability: { preparations: [] },
  };
  assert.deepEqual(createDeathState(), empty);
  assert.equal(Object.hasOwn(state, 'death'), true);
  assert.deepEqual(state.death, empty);
}

/** These historical captures are other pathways. Resource values are the
 * original host values; every other public leaf is pinned independently. */
export function emptyDeathPublic(state: SliceState): SliceProjection['death'] {
  assert.notEqual(state.progression.pathwayId, 'death');
  return {
    title: '序列0 死神', guidanceKnown: false, promoted: false,
    story: '街区保管室有一处有限残余泄漏，旧码头的两名活工人需要沿绳桥退出。亲自询问、查看原物与退路，再逐步处理和交接；两件事都能用普通办法完成。',
    nextStep: '保留本人已经融合的一份苍白皇帝特性，逐一查清另外两份的实际下落，核验同一唯一性的传承与空位。完成两件居民事务后，为同一本人的同一瓶作付费准备；实际晋升苍白皇帝满十二周才可服药。',
    risk: '成功率按当前意志和本瓶已付准备计算，只进行一次真实检定。失败留下真实重伤与污染，严重失败可能死亡。幸存者须在原处封存仍存在的同一残余，隔周付费回收后另购剩余载体；总共只有三件载体。',
    resources: { health: state.health, maxHealth: 100, mind: state.mind, maxMind: 100,
      spirituality: state.spirituality, maxSpirituality: 120, cash: `${state.cash}便士`,
      actionsRemaining: state.actionsRemaining, weeklyBudget: state.weeklyBudget },
    abilities: [], injuries: state.injuries.map(injury => ({ id: injury.id, severity: injury.severity,
      treated: injury.treatedRevision !== null })), injuryRisk: state.injuryRisk,
    sections: [], insideCase: false,
    actions: [{ id: 'death:0:LEARN_GUIDANCE', label: '听取原残响与旧码头交接指导', cost: '1行动、12便士',
      command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE'
        ? '须由仍活着的苍白皇帝本人继续；旧周期或历史视图不能复活身体。'
        : '已经死亡或结束的角色不能继续行动。', preferredAction: true }],
  };
}
export function assertEmptyDeathPublic(projection: Pick<SliceProjection, 'death'>, state: SliceState): void {
  assert.equal(Object.hasOwn(projection, 'death'), true);
  assert.deepEqual(projection.death, emptyDeathPublic(state));
}
