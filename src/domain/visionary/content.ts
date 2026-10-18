export { VISIONARY_ABILITY_IDS } from './types.js';
/** Original bounded game modeling. Canonical stage names are retained; these
 * finite scenes, numerical costs, checks and civic events are not canon facts. */
export const VISIONARY_ABILITIES = [
  { id: 'audience.s0.bounded-support', label: '有限空想支撑', description: '在本人已观察的原支梁旁短时支撑既有结构，限本次搬运窗口；遮挡、结构抵抗和真实消耗仍可使其失效。不创造可交易物、永久物件或新生命。' },
  { id: 'audience.s0.finite-guidance', label: '待行心灵引导', description: '对眼前本已愿意救援的成年原队员作一次短时引导；本人须实际在场，对方可抵抗，遮挡或离开便失效，已发生结果不能改写。' },
] as const;
export const VISIONARY_GUIDANCE = { cash: 100, actions: 1 } as const;
export const VISIONARY_STORY = '四方六城正在面对公开灾报迟滞与救援断联。先真实观察、事前提出预想，再让各地亲自采用和检验共同制度；旧人物和原物仍留在自己的既有经历中。';
export const VISIONARY_GOAL = '用真实跨城行动推动公共救援制度转型，核清三份原作家特性与独立唯一性，在实际季度节点承担服药风险。';
export const VISIONARY_RISK = '预想不能改写过去，季度窗口会真实关闭。服药失败照实损失健康、精神和污染，可能死亡；只有活着且实际封存的同批原残余才能付费回收。';
export const VISIONARY_CONSUMPTION = { difficulty: 55, healthMinimum: 80, mindMinimum: 70, spirituality: 30,
  failureHealth: 45, failureMind: 40, failurePollution: 35, greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70 } as const;
// With the real predecessor's will 32: 50+2*(32+33-55)=70%. No roll is replaced.
export const VISIONARY_PROMOTION_STABILITY = { actions: 1, cash: 100, spirituality: 12, mind: 8, effectiveBonus: 33 } as const;
export const VISIONARY_EPILOGUE_BONUS = 23;
export const VISIONARY_HOME = 'backlund:public-relay-headquarters';
export const VISIONARY_CITY_PLACES = [
  { id: VISIONARY_HOME, title: '贝克兰德公共联络处' },
  { id: 'backlund:professional-handoff', title: '原专业交接处' },
  { id: 'backlund:custody-archive', title: '独立保管档案室' },
  { id: 'backlund:sealed-vault', title: '原封存库' },
  { id: 'backlund:ritual-workshop', title: '封闭调配室' },
] as const;
