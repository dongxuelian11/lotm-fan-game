import { ARCHAEOLOGIST_GUIDE } from '../archaeologist/content.js';
import type { AppraiserAbilityId } from './types.js';

/** Canon boundary: Book 1, ch.65 and Book 2, ch.4. Appraisers quickly and intuitively
 * understand most supernatural objects and minimize the danger in using them.
 * The three mastery tracks below split that same canon ability for G gameplay;
 * they do not confer perfect appraisal, side-effect immunity or copied enemy abilities.
 * Supernatural crafting belongs to S6; 2-081 is an external artifact, not an innate power.
 * The complete potion recipe remains unverified. Mentor supply, prices, jobs,
 * maturity, stat increases and resolution costs are original G game-balance rules. */
export const APPRAISER_GUIDE = ARCHAEOLOGIST_GUIDE;
export const APPRAISER_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800 } as const;
export const APPRAISER_MIN_ARCHAEOLOGIST_WEEKS = 8;
export const APPRAISER_BOTTLE_IDS = ['appraiser-potion-1', 'appraiser-potion-2', 'appraiser-potion-3'] as const;
export const APPRAISER_POTION_SOURCES = APPRAISER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${APPRAISER_GUIDE}从新的器物保管所交接渠道实际购入的第${index + 1}瓶序列7鉴定师成品魔药，独立封存原瓶${id}；这批现货并非通识者或考古学家旧瓶改装，导师渠道与供应为本作G原创。`,
}));
export const APPRAISER_FORMULA_STATUS = '鉴定师完整配方资料待核；目前未开放配方学习与制造，只能取得新渠道实际供应的序列7独立成品原瓶，不编造配方材料。';
export const APPRAISER_LABOUR_TASKS = ['核验保管所交货封记', '整理普通隔离工具', '护送密封药箱到工坊', '复核本批交接记录'] as const;
export const APPRAISER_ABILITIES: { id: AppraiserAbilityId; label: string; description: string }[] = [
  { id: 'paragon.s7.appraisal', label: '器物鉴定', description: '快速而直觉地辨认大多数神奇物品的用途与使用方式；鉴定仍可能失败，遇到遮蔽或超出能力的器物不能保证完整正确，不会解析或复制敌人的能力。' },
  { id: 'paragon.s7.hazard-insight', label: '隐患辨识', description: '在鉴定同一器物时察觉可能的负面效果与使用危险，分清已有发现和仍待核实之处；不是全知，不保证发现全部隐患，也不会自动解除诅咒。此项是同一鉴定能力的本作G掌握拆分。' },
  { id: 'paragon.s7.cautious-use', label: '谨慎使用', description: '依据实际鉴定结果谨慎使用已有神奇物品，尽量减少危险；不能免疫副作用或免除固有代价，不凭空生成器物，不提前获得序列6的非凡器物制造。此项是同一鉴定能力的本作G掌握拆分。' },
];
export const APPRAISER_CONSUMPTION_RISK = '以下金额、时间与判定均为本作G游戏平衡：服药必定消耗所选鉴定师原瓶，0行动，意志难度18；考古学家扮演须达100且晋升考古学家后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗与其它危险。';
