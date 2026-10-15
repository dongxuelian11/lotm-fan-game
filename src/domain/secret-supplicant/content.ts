import type { SecretSupplicantAbilityId } from './types.js';
export { SECRET_SUPPLICANT_CASE_IDS } from './types.js';

/** Chapter summaries only. Mentor, supply, cases and numerical rules are original G. */
export const SECRET_SUPPLICANT_GUIDE = '旧物管理员伊森·洛弗';
export const SECRET_SUPPLICANT_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const SECRET_SUPPLICANT_BOTTLE_IDS = ['secret-supplicant-potion-1', 'secret-supplicant-potion-2', 'secret-supplicant-potion-3'] as const;
export const SECRET_SUPPLICANT_SOURCE_STATUS = '《诡秘之主》第一部第105章《通灵》支持秘祈人序列9能感知某些神秘恐怖存在，掌握少量祭祀与仪式知识；遭遇战不强是克莱恩在该情境下的判断，不是不能战斗的绝对规则。序列8倾听者才直接听到对应存在的耳语，可能获得的未知扭曲能力不能编成人人统一的技能表。西里斯的肉瘤与黑血处于失控异常情境，不能作为序列9稳定可用能力。序列6蔷薇主教的血肉能力、序列5牧羊人的放牧不下放。普通学习与现实心理症状不等于神秘污染；盖回原物的罩子只能结束本次主动接触，不能保证免受神秘影响。伊森·洛弗是本作原创成年旧物管理员；独立成品药渠道、三项实践、劳务及全部游戏数值为本作原创G，不建立极光会或其它组织身份。';
export const SECRET_SUPPLICANT_POTION_SOURCES = SECRET_SUPPLICANT_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${SECRET_SUPPLICANT_GUIDE}独立保管的第${index + 1}瓶秘祈人成品魔药，原瓶独立封存；管理员与旧物间供给为本作原创G，未声称现场配制。取得此瓶不建立极光会或其它组织身份。`,
}));
export const SECRET_SUPPLICANT_FORMULA_STATUS = '秘祈人完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成完整制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const SECRET_SUPPLICANT_ABILITIES: { id: SecretSupplicantAbilityId; label: string; description: string }[] = [
  { id: 'hanged-man.s9.secret-sense', label: '有限神秘感知', description: '在已观察的局部现场，尝试感知某些神秘恐怖存在留下的有限迹象。迹象不等于确认身份、意图或完整真相，更不是倾听者直接听取耳语；盖回本次原罩也不保证免疫未知影响。' },
  { id: 'hanged-man.s9.sacrificial-lore', label: '少量祭祀知识', description: '用已掌握的有限知识核对现成旧账与祭祀记载，区分记录、推测和未知。学习普通资料不自动产生污染；不凭空得到危险尊名、完整秘闻或未核实配方。' },
  { id: 'hanged-man.s9.ritual-practice', label: '有限仪式实践', description: '在给定条件下进行有限、可停止的本作G仪式核查。完成准备不保证存在回应；未得到回应就如实记录，不编造神谕、诅咒或稳定扭曲技能，不获得血肉操控或灵魂放牧。' },
];
export const SECRET_SUPPLICANT_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。管理员在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗、异常接触及其它危险。盖回本次原罩只结束本次主动接触，不能保证盖住原物就免受神秘影响。';
