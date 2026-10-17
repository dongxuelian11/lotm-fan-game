import type { CombatScholarAbilityId } from './types.js';
export { COMBAT_SCHOLAR_CASE_IDS } from './types.js';

/** B1 ch81 L15063 confirms only the S8 name. The complete formula and a concrete
 * combat technique list are not verified. All training, people, supply and numbers are G. */
export const COMBAT_SCHOLAR_GUIDE = '训练室指导者塔文·里德';
export const COMBAT_SCHOLAR_PRICES = { guidance: 180, potion: 1210, labourCredit: 1050 } as const;
export const COMBAT_SCHOLAR_MIN_PRYER_WEEKS = 4;
export const COMBAT_SCHOLAR_BOTTLE_IDS = ['combat-scholar-potion-1', 'combat-scholar-potion-2', 'combat-scholar-potion-3'] as const;
export const COMBAT_SCHOLAR_SOURCE_STATUS = '《诡秘之主》第一部第81章（核验定位L15063）仅确认序列8格斗学者名称；具体动作表与完整配方尚未核实，不将该章前段对小丑敏捷的描述归给格斗学者。本阶段只新增格斗研习这一项本作原创G训练分类：以亲见动作、现场变化和同伴协作为有限练习，不声称自动识破所有招式或模仿其它途径。莉奈·安瑟介绍的塔文·里德为本作原创成年训练室指导者，训练室、独立成品渠道、劳务、三段实践与全部数值均为本作原创G。原三项窥秘人能力与掌握完整继承；不强制加入摩斯苦修会或其它组织，不提前开放巫师法术、高阶窥秘之眼、隔墙远视或神秘再现。';
export const COMBAT_SCHOLAR_POTION_SOURCES = COMBAT_SCHOLAR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `莉奈·安瑟介绍的${COMBAT_SCHOLAR_GUIDE}从独立进阶成品渠道实际取得的第${index + 1}瓶序列8格斗学者成品魔药，独立封存原瓶${id}；成年指导者与供应均为本作原创G，不是窥秘人旧瓶改装，也未声称在训练室配制。取得此瓶不建立摩斯苦修会或其它组织身份。`,
}));
export const COMBAT_SCHOLAR_FORMULA_STATUS = '隐者途径序列8格斗学者的完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const COMBAT_SCHOLAR_LABOUR_TASKS = ['核验训练室进阶原瓶封记', '整理独立成品交接记录', '复核训练室实收清单'] as const;
export const COMBAT_SCHOLAR_ABILITIES: { id: CombatScholarAbilityId; label: string; description: string }[] = [
  { id: 'hermit.s8.combat-study', label: '格斗研习', description: '本作G训练分类：将实际见到的有限动作与当前环境对照，在明确同意的练习中检验所学，并随真实停止信号结束演练。记住旧动作不等于适用于已变化的现场；不自动通晓所有招式、不复制其它途径能力、不提供小丑的敏捷，也不解锁巫师法术或高阶窥秘之眼。' },
];
export const COMBAT_SCHOLAR_CONSUMPTION_RISK = '服药必定消耗所选格斗学者原瓶，0行动，意志难度12；窥秘人扮演须达100且首次晋升窥秘人后满4整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。塔文在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、异常知识或其它危险。训练、金额、行动、成熟周数与判定数值均为本作原创G平衡设定。';
