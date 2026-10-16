import { MIDNIGHT_GUIDE } from '../midnight/content.js';
import type { NightmareAbilityId } from './types.js';
export { NIGHTMARE_CASE_IDS } from './types.js';

/** Entering an already sleeping person's dream differs from gradually drawing an awake
 * target into one. An ordinary Nightmare cannot move their body while maintaining the
 * dream; exposed-body danger remains. Item-mediated exceptions are not player powers.
 * Dream stories can deceive and require waking cross-checks. Mature Dunn's city-scale or
 * beyond-100m feats are not a newly promoted S7's automatic range. No S6 stronger spirit
 * calming or S5 external spirits. The full recipe is unverified. Mentor, independent
 * finished originals, labour, prices, maturity, gains and four-tier safety are G rules. */
export const NIGHTMARE_GUIDE = MIDNIGHT_GUIDE;
export const NIGHTMARE_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800 } as const;
export const NIGHTMARE_MIN_MIDNIGHT_WEEKS = 8;
export const NIGHTMARE_BOTTLE_IDS = ['nightmare-potion-1', 'nightmare-potion-2', 'nightmare-potion-3'] as const;
export const NIGHTMARE_POTION_SOURCES = NIGHTMARE_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${NIGHTMARE_GUIDE}从新夜间协助交接渠道实际购入的第${index + 1}瓶序列7梦魇成品魔药，独立封存原瓶${id}；这批现货并非不眠者或午夜诗人旧瓶改装，导师与成品供应为本作G原创。人类服药晋升不自动建立教会或其它组织身份。`,
}));
export const NIGHTMARE_FORMULA_STATUS = '梦魇完整配方资料待核；目前未开放配方学习与制造，只能取得新渠道实际供应的序列7独立成品原瓶，不编造配方材料或剂量。';
export const NIGHTMARE_LABOUR_TASKS = ['核验夜间协助来货封记', '整理值班室普通遮光用品', '护送密封药箱回原值班室', '复核本批成品交接清单'] as const;
export const NIGHTMARE_ABILITIES: { id: NightmareAbilityId; label: string; description: string }[] = [
  { id: 'darkness.s7.dream-entry', label: '有限入梦', description: '进入已睡者的梦境，与把清醒目标逐步拉入梦境是不同过程；本阶段只对明确在场的有限对象使用。维持梦境时正常施术者本体不能移动，暴露的身体仍可被伤害，须先安排看守和退出条件；特殊物品的例外不自动成为玩家能力。清醒目标可以抵抗与打断，不会因一个念头必然入睡。邓恩成熟阶段的全城或百米之外表现，不是新晋序列7自动拥有的范围。' },
  { id: 'darkness.s7.dream-discernment', label: '梦境记录与核实', description: '在有限梦境中观察并记录实际经历，再醒来交叉核实。梦境故事可能混淆记忆、愿望和欺骗，不是真相神谕，不保证取得秘密或目标不知道的事实；不能把梦中结论直接当作现实指控或永久改写关系。没有序列6更强安魂与灵性诊断，也不能调用序列5的外部灵体。' },
];
export const NIGHTMARE_CONSUMPTION_RISK = '以下金额、时间与判定均为本作G游戏平衡：服药必定消耗所选梦魇原瓶，0行动，意志难度18；午夜诗人扮演须达100且晋升午夜诗人后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、本体暴露与其它危险。人类服药成为梦魇后仍须扮演并消化魔药，也不会自动加入教会或其它组织。';
