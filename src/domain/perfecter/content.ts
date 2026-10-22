export { PERFECTER_ABILITY_IDS } from './types.js';
/** The canonical name is retained. All finite scenes, costs, the preparation,
 * and mission qualification are original game rules, not a claimed full ritual. */
export const PERFECTER_ABILITIES = [
  { id: 'paragon.s0.civilization-page', label: '文明之页', description: '本人实际观察后，用临时文明之页收纳眼前同一股无生命目录回送信息，容量最多六段、至多维持之后三次现场行动。离场或时限到达便释放回原处；失败仍付费，不收纳生命、不改写过去，也不影响远处设施。' },
  { id: 'paragon.s0.finite-reconstruction', label: '有限重构', description: '依据亲自测得的既有模型，辅助眼前同一台检索机进行一次有限校准。须支付8便士购买真实垫片，并消耗灵性与精神；成功才安装垫片，失败留下损耗与损坏。不复制装置、不生成生命，也不补充原造物储能。' },
] as const;
export const PERFECTER_GUIDANCE = { cash: 100, actions: 1 } as const;
export const PERFECTER_STORY = '旧市档案馆、公共修理工坊与南岸中继站的装置已经老旧。亲自查出缺陷、备齐零件并修复，再让自愿参与的成年操作员独立试用，经过真实运行后核验用途与结果。';
export const PERFECTER_GOAL = '完成三站真实修理、独立操作试验与持续运行核验，取得三份文明启蒙者特性和独立唯一性，再在封闭调配室承担服药风险。';
export const PERFECTER_RISK = '服药可能造成重伤、精神损失、污染甚至死亡。准备只降低本次风险；失败后的同批残余必须仍在原处、由活着的本人实际封存，才可付费回收。';
export const PERFECTER_CONSUMPTION = { difficulty: 55, healthMinimum: 80, mindMinimum: 70, spirituality: 30,
  failureHealth: 45, failureMind: 40, failurePollution: 35, greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70 } as const;
// Normal formula: 50 + 2 * (25 + 40 - 55) = 70 with the real predecessor's will.
export const PERFECTER_PROMOTION_STABILITY = { actions: 1, cash: 100, spirituality: 12, mind: 8, effectiveBonus: 40 } as const;
export const PERFECTER_EPILOGUE_BONUS = 30;
export const PERFECTER_SPIRITUALITY_CAP = 150;
export const PERFECTER_HOME = 'backlund:civic-repair-workshop';
export const PERFECTER_CITY_PLACES = [
  { id: 'backlund:old-civic-archive', title: '旧市档案馆' },
  { id: PERFECTER_HOME, title: '公共修理工坊' },
  { id: 'backlund:south-bank-relay', title: '南岸中继站' },
  { id: 'backlund:professional-handoff', title: '专业交接处' },
  { id: 'backlund:custody-archive', title: '独立保管档案室' },
  { id: 'backlund:sealed-vault', title: '封存库' },
  { id: 'backlund:ritual-workshop', title: '封闭调配室' },
] as const;
