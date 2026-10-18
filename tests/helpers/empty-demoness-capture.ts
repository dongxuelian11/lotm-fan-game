import assert from 'node:assert/strict';
import { createDemonessState } from '../../src/domain/demoness/index.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Independently pinned schema218 addition. Validate every leaf before removing
 * this named root; never obtain an expected historical view from a projector. */
export function assertEmptyDemonessState(state: Pick<SliceState, 'demoness'>): void {
  const empty: SliceState['demoness'] = {
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    passage: null, materials: null, preparations: [], journal: [],
  };
  assert.deepEqual(createDemonessState(), empty);
  assert.equal(Object.hasOwn(state, 'demoness'), true);
  assert.deepEqual(state.demoness, empty);
}

/** Exact inactive public addition for the other pathways' immutable captures.
 * Only original host resources/injuries and the living/dead reason vary. */
export function emptyDemonessPublic(state: SliceState): SliceProjection['demoness'] {
  assert.notEqual(state.progression.pathwayId, 'demoness');
  return {
    title: '序列0 魔女', available: false, guidanceKnown: false, promoted: false,
    story: '伊妮德与罗温住在一段六米旧石拱通道两端。两件实购支撑、每人的当前同意与有价协助，让两人逐段亲自走过，再沿普通侧路离开。原展廊、维瑞娜、马库斯和全部已耗物仍保留原来的实际记录。',
    nextStep: '带着三份真实末日魔女特性和同一唯一性，完成两位成人的实际通行与退出；成为末日魔女满十二个实际周后，可自行决定是否饮用。',
    risk: '实际意志与可选的同瓶有价准备决定成功率。失败保留费用、重伤与污染，严重失败可以死亡。幸存者能封存同一残余、隔周付费回收，再使用剩余有限载体；没有第四份原特性、复活或身体重置。',
    resources: { health: state.health, maxHealth: 100, mind: state.mind, maxMind: 100,
      spirituality: state.spirituality, maxSpirituality: 120, cash: `${state.cash}便士`,
      actionsRemaining: state.actionsRemaining, weeklyBudget: state.weeklyBudget },
    injuries: state.injuries.map(injury => ({ id: injury.id, severity: injury.severity,
      treated: injury.treatedRevision !== null })), injuryRisk: state.injuryRisk,
    abilities: [], actions: [{ id: 'demoness:0:LEARN_GUIDANCE', label: '听取旧石拱通道与三份原特性指导',
      cost: '1行动、100便士', command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由已经真正晋升、仍活着的末日魔女本人继续。' : '已经死亡或结束的角色不能继续行动。',
      preferredAction: true }], sections: [], insideCase: false,
  };
}

export function assertEmptyDemonessPublic(projection: Pick<SliceProjection, 'demoness'>, state: SliceState): void {
  assert.equal(Object.hasOwn(projection, 'demoness'), true);
  assert.deepEqual(projection.demoness, emptyDemonessPublic(state));
}
