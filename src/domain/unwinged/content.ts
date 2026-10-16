import type { UnwingedAbilityId } from './types.js';
export { UNWINGED_CASE_IDS } from './types.js';

/** Verified chapter summary only. Guidance, supply, restraint scenes and numbers are original G. */
export const UNWINGED_GUIDE = '旧货管理员罗安·费里';
export const UNWINGED_PRICES = { guidance: 180, potion: 1210, labourCredit: 1050 } as const;
export const UNWINGED_MIN_CRIMINAL_WEEKS = 4;
export const UNWINGED_BOTTLE_IDS = ['unwinged-potion-1', 'unwinged-potion-2', 'unwinged-potion-3'] as const;
export const UNWINGED_CHANGE_WARNING = '成功晋升折翼天使后，这名虚构角色将失去原有良知，恶欲加剧；这是角色在故事中的不可撤回变化，不描述或改变现实玩家的人格。只有实际服用本次选定原瓶并成功晋升才记录该变化，学习说明、领药、取消和服药失败都不会触发。请独立接受这瓶魔药的变化风险；不能用先前确认代替本次接受。系统不会替玩家实施犯罪、强制杀人、入会或背叛。玩家仍能选择停手、尊重拒绝及如实更正，但这些本作G约束选择有实际成本，不能恢复原有良知，也不保证后续序列可以善良或无代价地消化。';
export const UNWINGED_SOURCE_STATUS = '《诡秘之主》第二部第45章《杀人案》支持序列8折翼天使进一步非人化的身体、开始掌握一些恶魔法术，以及丧失原有良知、恶欲加剧的代价。当前已核段落没有逐一列明这些序列8法术，因此本阶段只新增“非人身体”这一稳定掌握分类，不自动填入具体恶魔法术清单，也不把良知代价删成纯粹免费强化。三项罪犯能力及原ID掌握完整继承；不下放序列6危险预知、巨大化与坚硬皮肤、毒素免疫、火焰或诅咒能力。罗安·费里为本作原创成年旧货管理员；沿同一已认识的指导渠道继续，新进阶成品原瓶、三项克制实践、劳务、金额和全部数值均为本作原创G，不建立拜血教或其它组织身份。克制与如实处理的成长属于本作G扮演适配，不是原著保证善举可以无害、无痛地完整消化，不替代后续序列7的原著要求。只呈现虚构角色的选择与后果，不提供现实犯罪手法。';
export const UNWINGED_POTION_SOURCES = UNWINGED_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${UNWINGED_GUIDE}从独立进阶成品渠道实际取得的第${index + 1}瓶序列8折翼天使成品魔药，独立封存原瓶${id}；管理员与供给均为本作原创G，不是罪犯旧瓶改装，也未声称在旧货库配制。取得此瓶不建立拜血教或其它组织身份。`,
}));
export const UNWINGED_FORMULA_STATUS = '深渊途径序列8折翼天使的完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const UNWINGED_LABOUR_TASKS = ['核验进阶原瓶封记', '整理独立成品交接记录', '复核旧货库实收清单'] as const;
export const UNWINGED_ABILITIES: { id: UnwingedAbilityId; label: string; description: string }[] = [
  { id: 'abyss.s8.inhuman-body', label: '非人身体', description: '进一步增强的非人身体只作用于眼前真实物体与有限作业，仍需核对旁人位置、许可与停手要求。不是巨大化、坚硬皮肤、毒素免疫或无敌，也不是危险预知。原文提到一些恶魔法术但未给出已核完整清单，本阶段不自动获授具体法术；强化伴随角色良知丧失与恶欲加剧，不因选择克制而恢复原有良知。' },
];
export const UNWINGED_CONSUMPTION_RISK = `服药必定消耗本次选定折翼天使原瓶，0行动，意志难度12；罪犯扮演须达100且首次晋升罪犯后满4整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。罗安在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、恶欲选择或其它危险。服药失败保留原有良知、罪犯消化和三项掌握。金额、行动、成熟周数、克制代价与判定数值均为本作原创G平衡设定。${UNWINGED_CHANGE_WARNING}`;
