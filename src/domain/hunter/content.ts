import type { HunterAbilityId } from './types.js';

/** Hunter abilities follow sequence 9's tracking, trap and physical-combat boundary.
 * This mentor, his finite stock, labour exchange, prices and effects are original game content.
 * The full original recipe has not been verified. No manufacturing route is provided. */
export const HUNTER_GUIDE = '退役追踪员索伦·里奇';
export const HUNTER_PRICES = { guidance: 120, potion: 660, labourCredit: 600, trapKit: 12 } as const;
export const HUNTER_BOTTLE_IDS = ['hunter-potion-1', 'hunter-potion-2', 'hunter-potion-3'] as const;
export const HUNTER_POTION_SOURCES = HUNTER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${HUNTER_GUIDE}退役时留存的第${index + 1}瓶深红色猎人魔药，原瓶独立封存；导师渠道与这批存药为本作原创。`,
}));
export const HUNTER_FORMULA_STATUS = '完整配方资料待核；目前未开放配方学习与制造，只能取得导师现有的独立原瓶。';
export const HUNTER_TRAP_STOCK = 3;
export const HUNTER_TRAP_KIT = '一条普通绳与一枚木楔';
export const HUNTER_ABILITIES: { id: HunterAbilityId; label: string; description: string }[] = [
  { id: 'hunter.s9.tracking', label: '追踪', description: '辨认眼前的足迹、擦痕与行进方向，沿真实留下的线索追查；不能从没有线索的地方得知目标去向。' },
  { id: 'hunter.s9.trapcraft', label: '陷阱布置', description: '利用实际持有的绳与木楔准备陷阱，须在对应现场提前放置；触发后消耗原件，未触发的原件可以回收。' },
  { id: 'hunter.s9.physical-enhancement', label: '身体与格斗强化', description: '以增强的身体素质完成格斗、压制与闪避；实际伤势和当前身体状态仍会限制行动。' },
  { id: 'hunter.s9.hunting-instinct', label: '猎杀直觉', description: '从现场的站位和动作寻找接近、拦截的时机；只依据实际可见情境，不读取未知身份或秘密。' },
];
export const HUNTER_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗与其它危险。';
