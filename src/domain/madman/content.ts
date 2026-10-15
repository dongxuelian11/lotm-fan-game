import type { MadmanAbilityId } from './types.js';
export { MADMAN_CASE_IDS } from './types.js';

/** Verified chapter summaries only. Guide, supply, practice interpretation and numbers are original G. */
export const MADMAN_GUIDE = '旧工坊管理员哈伦·维斯';
export const MADMAN_PRICES = { guidance: 180, potion: 1210, labourCredit: 1050 } as const;
export const MADMAN_MIN_PRISONER_WEEKS = 4;
export const MADMAN_BOTTLE_IDS = ['madman-potion-1', 'madman-potion-2', 'madman-potion-3'] as const;
export const MADMAN_BURST_MIND_COST = 10;
export const MADMAN_BURST_SPIRITUALITY_COST = 2;
export const MADMAN_SOURCE_STATUS = '《诡秘之主》第二部第118章《被诅咒者》（已核L59584–59620）支持序列8疯子主动牺牲当下理智以换取能力增强，并对部分精神干扰具有抵抗，仍存在失控风险；不是完全精神免疫，也不是无需付出代价的常驻强化。第二部第117章《莎伦和马里奇的理念》（已核L59463–59481）支持节制、不伤害他人的选择方向；本作三项和平实践、普通分支、消化与成长数值均为原创G解释，不保证成长就能消除诅咒。“疯子”只是虚构序列名称，不是现实精神健康诊断，也不描述现实玩家。三项囚犯能力及原ID掌握完整继承；不下放序列7狼人的愈合和利爪，不下放序列6活尸的护甲与尸体控制。哈伦·维斯为已认识的本作原创成年旧工坊管理员，沿同一指导渠道继续；新进阶成品原瓶、劳务、金额、铃声/栅门/字条实践及全部数值均为本作原创G，不自动建立玫瑰学派或其它组织身份。';
export const MADMAN_POTION_SOURCES = MADMAN_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${MADMAN_GUIDE}从独立进阶成品渠道实际取得的第${index + 1}瓶序列8疯子成品魔药，独立封存原瓶${id}；管理员与供给均为本作原创G，不是囚犯旧瓶改装，也未声称在旧工坊配制。取得此瓶不建立玫瑰学派或其它组织身份。`,
}));
export const MADMAN_FORMULA_STATUS = '被缚者途径序列8疯子的完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const MADMAN_LABOUR_TASKS = ['核验进阶原瓶封记', '整理独立成品交接记录', '复核旧工坊实收清单'] as const;
export const MADMAN_ABILITIES: { id: MadmanAbilityId; label: string; description: string }[] = [
  { id: 'chained.s8.reason-sacrifice', label: '牺牲当前理智', description: '只有玩家明确选择爆发并实际执行时，才牺牲当前精神换取短时增强。本作G每次消耗10精神、2灵性；观察、准备与选择普通方法不自动激活。停止不恢复已消耗精神、灵性，不抵消此前后果，失控风险仍在；不提供狼人愈合、利爪或活尸护甲。' },
  { id: 'chained.s8.mental-resistance', label: '部分精神抵抗', description: '序列8对部分精神干扰具有抵抗，具体受适用对象与情境约束；不是全精神免疫、不恢复精神、不免疫污染或失控。当前有限爆发中的应用仍须玩家选择并实际支付10精神与2灵性的共同激活成本，不另送一次免费强化或恢复。' },
];
export const MADMAN_CONSUMPTION_RISK = '服药必定消耗本次选定疯子原瓶，0行动，意志难度12；囚犯扮演须达100且首次晋升囚犯后满4整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。哈伦在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、主动牺牲理智或其它危险。服药失败保留囚犯消化和三项掌握。晋升本身不自动激活爆发；爆发须玩家选择，实际扣10精神与2灵性，停止不治疗、不退款。节制与不伤害他人的实践成长为本作G解释，不保证消除诅咒；“疯子”不是现实诊断。金额、行动、成熟周数、激活代价与判定数值均为本作原创G平衡设定。';
