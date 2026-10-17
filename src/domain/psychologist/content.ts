import { MINDREADER_GUIDE } from '../mindreader/content.js';
import type { PsychologistAbilityId } from './types.js';

/** Canon S7 ability boundaries: Book 3, ch.37.
 * Only a pair of mirror-dragon eyes is verified as a main ingredient quantity.
 * The cited 50 mL of blood is a purchase amount, not a verified recipe quantity;
 * elder-tree fruit quantity and auxiliaries remain unknown. No complete recipe is exposed.
 * This independent finished-bottle channel, jobs, prices, maturity and numerical effects
 * are original G game-balance rules. No S6 combat hypnosis, invisibility or dragon scales. */
export const PSYCHOLOGIST_GUIDE = MINDREADER_GUIDE;
export const PSYCHOLOGIST_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800 } as const;
export const PSYCHOLOGIST_MIN_MINDREADER_WEEKS = 8;
export const PSYCHOLOGIST_BOTTLE_IDS = ['psychologist-potion-1', 'psychologist-potion-2', 'psychologist-potion-3'] as const;
export const PSYCHOLOGIST_POTION_SOURCES = PSYCHOLOGIST_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${PSYCHOLOGIST_GUIDE}经新的阅览室联络渠道实际购入的第${index + 1}瓶序列7心理医生成品魔药，独立封存原瓶${id}；这批现货并非观众或读心者旧瓶改装，导师渠道与供应为本作G原创。`,
}));
export const PSYCHOLOGIST_FORMULA_STATUS = '心理医生完整配方资料待核；目前未开放配方学习与制造，只能取得新渠道实际供应的序列7独立成品原瓶。已知的部分材料不作为完整配方展示。';
export const PSYCHOLOGIST_LABOUR_TASKS = ['核验阅览室封存清单', '整理安静会谈室', '护送密封药箱到阅览室', '复核本批交接记录'] as const;
export const PSYCHOLOGIST_ABILITIES: { id: PsychologistAbilityId; label: string; description: string }[] = [
  { id: 'audience.s7.awe', label: '震慑', description: '向单个或多个目标施加心灵层面的威压，引发恐惧。是否奏效受目标精神状态与抵抗影响，不等于必然投降或直接控制。' },
  { id: 'audience.s7.frenzy', label: '狂乱', description: '扰动目标情绪与精神，造成精神伤害与混乱；可影响多个目标，但不能把每个目标自动判为失控。' },
  { id: 'audience.s7.suggestion', label: '心理暗示', description: '借助声音、动作或其他媒介植入有限暗示，影响目标的情绪与选择；不赋予无条件命令或序列6的战斗催眠。' },
  { id: 'audience.s7.soothe', label: '安抚', description: '安抚异常情绪与精神冲击，帮助目标恢复稳定；可能失败，也不能净化污染、消除一切精神问题或保证阻止失控。' },
  { id: 'audience.s7.mental-communication', label: '心理沟通', description: '借助媒介建立半催眠状态下的心理交流。需尊重参与意愿与防护边界，仍可能受抗拒、隐瞒或欺骗影响；不是强行搜取深层秘密、客观测谎或序列6的战斗催眠。' },
];
export const PSYCHOLOGIST_CONSUMPTION_RISK = '以下金额、时间与判定均为本作G游戏平衡：服药必定消耗所选心理医生原瓶，0行动，意志难度18；读心者扮演须达100且晋升读心者后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗与其它危险。';
