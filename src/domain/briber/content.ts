import { LAWYER_GUIDE } from '../lawyer/content.js';
import type { BriberAbilityId } from './types.js';
export { BRIBER_CASE_IDS } from './types.js';

/** Exact six source ingredients; unquantified crystal uses a separate G stock portion. */
export const BRIBER_FORMULA_SOURCE = '《诡秘之主》第二部第131章《一掷千金》已核贿赂者六项配方：主材为“哭泣婴儿”花1朵、怪脸大麻结晶；辅材为金色曼陀罗汁5滴、黑色曼陀罗汁5滴、迷幻草精油4滴、红葡萄酒80mL。原著未给怪脸大麻结晶的明确数量或重量，本作每批供货1份仅为玩法G计量，不能解读为原著精确数量。确切投料顺序未核定；此处材料排列及导师操作规程、供货、劳动、价格、成熟周数、掌握、判定与属性数值均为本作玩法改编G。';
export const BRIBER_GUIDE = LAWYER_GUIDE;
export const BRIBER_PRICES = { formula: 240, mainMaterials: 1800, auxiliaryMaterials: 150, brewing: 60, gifts: 60 } as const;
export const BRIBER_BATCH_IDS = ['briber-batch-1', 'briber-batch-2', 'briber-batch-3'] as const;
export const BRIBER_MIN_BARBARIAN_WEEKS = 8;
export const BRIBER_LABOUR_STEPS = 4;
export const BRIBER_LABOUR_TASKS = ['抄录六料清单', '核对原料封签', '整理逐批备料记录', '清理调配场地'] as const;
/** quantity is the source quantity; supplyQuantity is the physical G manifest quantity. */
export const BRIBER_FORMULA = [
  { id: 'weeping-baby-flower', name: '“哭泣婴儿”花', quantity: 1, supplyQuantity: 1, unit: '朵' },
  { id: 'strange-face-hemp-crystal', name: '怪脸大麻结晶', quantity: null, supplyQuantity: 1, unit: '份', note: '原著未给明确数量或重量；本作G每批供货1份。' },
  { id: 'golden-mandrake-juice', name: '金色曼陀罗汁', quantity: 5, supplyQuantity: 5, unit: '滴' },
  { id: 'black-mandrake-juice', name: '黑色曼陀罗汁', quantity: 5, supplyQuantity: 5, unit: '滴' },
  { id: 'hallucinogenic-herb-oil', name: '迷幻草精油', quantity: 4, supplyQuantity: 4, unit: '滴' },
  { id: 'red-wine', name: '红葡萄酒', quantity: 80, supplyQuantity: 80, unit: 'mL' },
] as const;
export const BRIBER_SOURCE_STATUS = '《诡秘之主》第三部第117章所示“贿赂”削弱：给予东西，使目标对施术者的攻击、防御与控制受到削弱；原文酒杯被躲开仍产生削弱，不能把目标接住物品或喝下酒液写成原著必需条件。本阶段只新增贿赂削弱这一组能力，保留律师三项能力与野蛮人非凡体能、精神抗性；不下放序列6扭曲或序列5混乱，也不依据较高序列物品把魅惑补成序列7新能力。三项生活实践、编号木牌、送出与去向、现场停止、效果期限、报告、能力分组及全部判定和数值均为本作玩法G。米蕾·沃德仍是同一位本作原创成年契约文书员，晋升不建立王室、教会或其它组织身份。';
export const BRIBER_ABILITIES: { id: BriberAbilityId; label: string; description: string }[] = [
  { id: 'black-emperor.s7.bribery-weakening', label: '贿赂削弱', description: '通过给予东西，有限削弱目标针对施术者的攻击、防御与控制。原著不要求目标一定接住或饮用；本作仍追踪真实送出物与去向，送出后不会因失败或结束接触自动归还。不能购买服从、强迫同意、扭曲规则或制造混乱；具体效果、期限、掌握与判定为本作G。' },
];
export const BRIBER_CONSUMPTION_RISK = '本段数值为本作玩法改编G：服药必定消耗所选贿赂者原瓶，0行动，意志难度18；野蛮人扮演须达100且野蛮人晋升后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。文书员在场处理本次指导服药的排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗、精神影响与其它危险。';
