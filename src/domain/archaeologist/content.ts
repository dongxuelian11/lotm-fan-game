import { SAVANT_GUIDE } from '../savant/content.js';
import type { ArchaeologistAbilityId } from './types.js';

/** S8 improves ancient history, wilderness/ruin knowledge and physical robustness.
 * Limited rituals do not grant S7 supernatural-item appraisal or S6 enchanted crafting.
 * Mentor, independent finished supply, labour, prices and numerical effects are original G rules.
 * The complete potion recipe is unverified: no invented ingredients or brewing route. */
export const ARCHAEOLOGIST_GUIDE = SAVANT_GUIDE;
export const ARCHAEOLOGIST_PRICES = { guidance: 180, potion: 1370, labourCredit: 1200 } as const;
export const ARCHAEOLOGIST_MIN_SAVANT_WEEKS = 6;
export const ARCHAEOLOGIST_BOTTLE_IDS = ['archaeologist-potion-1', 'archaeologist-potion-2', 'archaeologist-potion-3'] as const;
export const ARCHAEOLOGIST_POTION_SOURCES = ARCHAEOLOGIST_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${ARCHAEOLOGIST_GUIDE}从新的考察队交接渠道实际购入的第${index + 1}瓶序列8考古学家成品魔药，独立封存原瓶${id}；这批现货并非通识者旧瓶改装，导师与成品供应为本作G原创。`,
}));
export const ARCHAEOLOGIST_FORMULA_STATUS = '考古学家完整配方资料待核；目前未开放配方学习与制造，只能取得新渠道实际供应的序列8独立成品原瓶，不编造配方材料。';
export const ARCHAEOLOGIST_LABOUR_TASKS = ['核验考察队交货封记', '整理实际交回的考察工具', '复核考察队交接清单'] as const;
export const ARCHAEOLOGIST_ABILITIES: { id: ArchaeologistAbilityId; label: string; description: string }[] = [
  { id: 'paragon.s8.ancient-history', label: '古代历史', description: '增强古代历史与遗迹知识，将亲自取得的碑文、档案和结构线索交叉比对；未接触的现场事实与隐藏历史仍须调查，不能凭空知道答案。' },
  { id: 'paragon.s8.wilderness', label: '野外考察', description: '以更强健的体魄和野外知识判断实际地形、旧路线与环境危险，选择可行的考察办法；不保证免受伤害，也不凭空产生工具或物资。' },
  { id: 'paragon.s8.ruin-caution', label: '遗迹禁忌', description: '结合遗迹知识辨认现场可见的禁忌与危险征兆，保留封记、选择谨慎路线；不是鉴定神奇物品，不会自动解除诅咒或制造非凡器物。有限仪式仍需真实知识与准备。' },
];
export const ARCHAEOLOGIST_CONSUMPTION_RISK = '服药必定消耗所选考古学家原瓶，0行动，意志难度12；通识者扮演须达100且首次晋升通识者后满6整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗与其它危险。';
