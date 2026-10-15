import { APOTHECARY_GUIDE } from '../apothecary/content.js';
import type { TamerAbilityId } from './types.js';
export { TAMER_ANIMAL_IDS } from './types.js';

/** S8 strengthens the body, tames living animals (including supernatural species), and
 * understands animal intentions. This slice only uses three ordinary, actually present animals.
 * Mentor, separate finished supply, prices and numerical effects are original G rules.
 * The complete potion recipe is unverified: no invented ingredients or brewing route. */
export const TAMER_GUIDE = APOTHECARY_GUIDE;
export const TAMER_PRICES = { guidance: 180, potion: 1370, labourCredit: 1200 } as const;
export const TAMER_MIN_APOTHECARY_WEEKS = 6;
export const TAMER_BOTTLE_IDS = ['tamer-potion-1', 'tamer-potion-2', 'tamer-potion-3'] as const;
export const TAMER_POTION_SOURCES = TAMER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${TAMER_GUIDE}从新照护站交接渠道实际购入的第${index + 1}瓶序列8驯兽师成品魔药，独立封存原瓶${id}；这批现货并非药师旧瓶改装，导师与成品供应为本作G原创。`,
}));
export const TAMER_FORMULA_STATUS = '驯兽师完整配方资料待核；目前未开放配方学习与制造，只能取得新渠道实际供应的序列8独立成品原瓶，不编造配方材料。';
export const TAMER_LABOUR_TASKS = ['核验照护站来货封记', '清点已清洁的动物照护器具', '复核照护站交接清单'] as const;
export const TAMER_ABILITIES: { id: TamerAbilityId; label: string; description: string }[] = [
  { id: 'moon.s8.taming', label: '驯兽', description: '能驯服真实存在的活体动物，能力范围包括非凡物种；当前只开放三只普通动物的有限训练，须亲自接触、尊重动物意愿并取得原主人的配合。不能凭空召唤兽群或把它们当作必然服从的军队。' },
  { id: 'moon.s8.animal-intent', label: '理解动物意图', description: '亲自观察并接触动物后，理解其当下的简单意图，再以实际行为核实；不是全知读心，不能获得动物没有感知的事实、人的秘密或完整语言记忆。' },
  { id: 'moon.s8.physical-enhancement', label: '强健体魄', description: '晋升带来更强健的身体，能够完成相应的有限搬运与照护活动；仍会疲惫、受伤，没有提前获得血族再生或不死能力。动物始终属于原主人；喂食只使用针对该动物交付的适宜原封饲料，不把药师药剂当作饲料。' },
];
export const TAMER_CONSUMPTION_RISK = '服药必定消耗所选驯兽师原瓶，0行动，意志难度12；药师扮演须达100且首次晋升药师后满6整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗与其它危险。';
