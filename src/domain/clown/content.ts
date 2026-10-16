import type { ClownAbilityId } from './types.js';

/** Formula facts: 《诡秘之主》第一部，第105章《通灵》、第168章《小丑魔药》.
 * The mentor channel, three-batch supply rounds, prices, work and numerical effects are original game rules. */
export const CLOWN_FORMULA_SOURCE = '《诡秘之主》第一部，第105章《通灵》、第168章《小丑魔药》（材料与调配顺序）；俱乐部渠道、劳动、价格与游戏数值为本作原创。';
export const CLOWN_GUIDE = '占卜俱乐部指导者';
export const CLOWN_PRICES = { formula: 180, mainMaterials: 1200, auxiliaryMaterials: 90, brewing: 80, paperSheet: 1 } as const;
export const CLOWN_BATCH_IDS = ['clown-batch-1', 'clown-batch-2', 'clown-batch-3'] as const;
export const CLOWN_PAPER_STOCK = 30;
export const CLOWN_MIN_SEER_WEEKS = 6;
/** Ingredient order is also the brewing order: five auxiliaries, whole rose, horn crystal. */
export const CLOWN_FORMULA = [
  { id: 'pure-water', name: '纯水', quantity: 80, unit: 'mL' },
  { id: 'mandrake-juice', name: '曼陀罗汁液', quantity: 5, unit: '滴' },
  { id: 'black-rim-sunflower', name: '黑边太阳花粉末', quantity: 7, unit: 'g' },
  { id: 'golden-cloak-grass', name: '金斗篷草粉末', quantity: 10, unit: 'g' },
  { id: 'poison-hemlock', name: '毒堇汁', quantity: 3, unit: '滴' },
  { id: 'human-faced-rose', name: '完整人脸玫瑰', quantity: 1, unit: '朵' },
  { id: 'hornacis-gray-goat-horn', name: '成年霍纳奇斯灰山羊独角结晶', quantity: 1, unit: '枚' },
] as const;
export const CLOWN_ABILITIES: { id: ClownAbilityId; label: string; description: string }[] = [
  { id: 'diviner.s8.body-control', label: '身体控制', description: '更准确地控制肌肉与表情，维持需要的姿态；不改变外貌，也不提供高序列伪装。' },
  { id: 'diviner.s8.balance', label: '平衡', description: '在已有支点与可用落点间保持平衡、借力；不会凭空制造落脚处或免除真实伤势。' },
  { id: 'diviner.s8.agility', label: '敏捷', description: '以灵活动作避让、翻跃和反击；只影响当前可行动的身体，不保证躲过所有攻击。' },
  { id: 'diviner.s8.danger-prediction', label: '危险预感', description: '从实际逼近的威胁中提前感到危险，辅助选择位置；不能直接读出敌人的身份、秘密或未来全貌。' },
  { id: 'diviner.s8.paper-dagger', label: '纸张飞刀', description: '将手中实际持有的纸张化作锋利的投掷武器；每次投掷消耗一张，纸张不会凭空恢复。' },
];
export const CLOWN_CONSUMPTION_RISK = '服药必定消耗所选小丑原瓶，0行动，意志难度12；占卜家扮演须达100且晋升后满6整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。本次指导者在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护仅适用于本次指导服药，不适用于战斗与其它危险。';
