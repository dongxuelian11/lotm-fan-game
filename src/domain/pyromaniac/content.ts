import { HUNTER_GUIDE } from '../hunter/content.js';
import type { PyromaniacAbilityId } from './types.js';

/** Canon ability boundaries: Book 3, ch.26 (condensed fire and curved flight),
 * ch.29 (flame lance), ch.213 (sustained fire ravens for warmth at mature S7).
 * No full S7 recipe is verified. This mentor channel, stock, jobs, prices,
 * maturity, checks and numeric effects are original G game-balance rules.
 * Fire jumping belongs to another pathway; higher-sequence bullet interception is not supplied. */
export const PYROMANIAC_GUIDE = HUNTER_GUIDE;
export const PYROMANIAC_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800 } as const;
export const PYROMANIAC_MIN_PROVOKER_WEEKS = 8;
export const PYROMANIAC_BOTTLE_IDS = ['pyromaniac-potion-1', 'pyromaniac-potion-2', 'pyromaniac-potion-3'] as const;
export const PYROMANIAC_POTION_SOURCES = PYROMANIAC_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${PYROMANIAC_GUIDE}经新的防火货栈渠道实际购入的第${index + 1}瓶序列7纵火家成品魔药，独立封存原瓶${id}；这批现货并非猎人或挑衅者旧瓶改装，导师渠道与供应为本作G原创。`,
}));
export const PYROMANIAC_FORMULA_STATUS = '纵火家完整配方资料待核；目前未开放配方学习与制造，只能取得新渠道实际供应的序列7独立成品原瓶。';
export const PYROMANIAC_LABOUR_TASKS = ['核验防火货栈封记', '整理原货栈隔离通道', '护送到仓密封货箱', '复核本批交接清单'] as const;
export const PYROMANIAC_ABILITIES: { id: PyromaniacAbilityId; label: string; description: string }[] = [
  { id: 'hunter.s7.flame-control', label: '火焰操控', description: '能够生成并操纵火焰；实际施用仍受灵性、控制能力和环境限制。火焰会危及可燃物与旁人，不意味着火焰免疫。' },
  { id: 'hunter.s7.compressed-fireball', label: '压缩火球', description: '将火焰凝聚压缩为火球，以灵性控制其弧线并爆开；只能对实际可见情境作有限运用，不能凭空追踪未知目标。' },
  { id: 'hunter.s7.flame-lance', label: '火焰长枪', description: '凝聚火焰形成长枪状投射攻击，须顾及射线与周围可燃物；不是实体枪械，也不赋予无限射程或必中。' },
  { id: 'hunter.s7.fire-raven', label: '火鸦', description: '让火焰维持为鸦形；持续控制的火鸦可以供暖。它不是活体动物、独立同伴或无需付出灵性的永动火源。' },
];
export const PYROMANIAC_CONSUMPTION_RISK = '以下金额、时间与判定均为本作G游戏平衡：服药必定消耗所选纵火家原瓶，0行动，意志难度18；挑衅者扮演须达100且晋升挑衅者后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗与其它危险。';
