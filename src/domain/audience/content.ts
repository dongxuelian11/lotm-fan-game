import type { AudienceAbilityId } from './types.js';

/** Canonical ingredients and brewing order: 《诡秘之主》第一部，第34章.
 * The reading-room guide, supply batches, labour and prices are original game content. */
export const AUDIENCE_FORMULA_SOURCE = '《诡秘之主》第一部，第34章（材料名、用量与辅材→眼睛→血液的调配顺序）；阅览室渠道、劳动与价格为本作原创。';
export const AUDIENCE_GUIDE = '阅览室观察导师';
export const AUDIENCE_PRICES = { formula: 120, mainMaterials: 600, auxiliaryMaterials: 60, brewing: 60 } as const;
export const AUDIENCE_BATCH_IDS = ['audience-batch-1', 'audience-batch-2', 'audience-batch-3'] as const;
/** Keep auxiliary ingredients first, then the eyes and finally the blood. */
export const AUDIENCE_FORMULA = [
  { id: 'pure-water', name: '纯水', quantity: 80, unit: 'mL' },
  { id: 'colchicum-essence', name: '秋水仙精华', quantity: 5, unit: '滴' },
  { id: 'cow-tooth-peony', name: '牛齿芍药粉末', quantity: 13, unit: 'g' },
  { id: 'elf-flower', name: '精灵花', quantity: 7, unit: '瓣' },
  { id: 'manhar-fish-eyes', name: '成年曼哈尔鱼的眼睛', quantity: 1, unit: '对' },
  { id: 'horned-blackfish-blood', name: '羊角黑鱼血液', quantity: 35, unit: 'mL' },
] as const;
export const AUDIENCE_ABILITIES: { id: AudienceAbilityId; label: string; description: string }[] = [
  { id: 'audience.observation', label: '细节观察', description: '捕捉当面可见的表情、动作与环境细节；不会直接看到心声、身份或未呈现的事实。' },
  { id: 'audience.behavior-analysis', label: '行为分析', description: '把已经观察到的行为放回具体情境，提出可以核实的推断；紧张或回避本身不等于说谎。' },
  { id: 'audience.memory-deduction', label: '记忆与推演', description: '清晰记住已经接触的信息并比较前后说法；推演仍须证据核实，不能读心或操控他人的精神。' },
];
export const AUDIENCE_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。指导者在场处置，不触发死亡。休养每次消退至多10排异；用过的原瓶不会恢复。';
