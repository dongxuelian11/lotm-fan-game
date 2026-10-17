import type { SeerAbilityId } from './types.js';

/** Ingredient names and amounts: 《诡秘之主》第一部，第31章《魔药》.
 * The club, teaching, three-batch supply rounds and prices below are original game content. */
export const SEER_FORMULA_SOURCE = '《诡秘之主》第一部，第31章《魔药》（材料名与用量）；俱乐部渠道、劳动与价格为本作原创。';
export const SEER_GUIDE = '占卜俱乐部指导者';
export const SEER_PRICES = { formula: 120, mainMaterials: 600, auxiliaryMaterials: 60, brewing: 60 } as const;
export const SEER_BATCH_IDS = ['seer-batch-1', 'seer-batch-2', 'seer-batch-3'] as const;
export const SEER_FORMULA = [
  { id: 'pure-water', name: '纯水', quantity: 100, unit: 'mL' },
  { id: 'night-herb', name: '夜香草汁液', quantity: 13, unit: '滴' },
  { id: 'gold-mint', name: '金薄荷叶', quantity: 7, unit: '片' },
  { id: 'poison-hemlock', name: '毒堇汁', quantity: 3, unit: '滴' },
  { id: 'dragon-blood-herb', name: '龙血草粉末', quantity: 9, unit: 'g' },
  { id: 'lava-octopus-blood', name: '拉瓦章鱼血', quantity: 10, unit: 'mL' },
  { id: 'star-crystal', name: '星水晶', quantity: 50, unit: 'g' },
] as const;
export const SEER_ABILITIES: { id: SeerAbilityId; label: string; description: string }[] = [
  { id: 'diviner.s9.spiritual-sight', label: '灵视', description: '辨认真实线索中的灵性残留；只在已有可见线索的调查中生效。' },
  { id: 'diviner.s9.divination', label: '占卜', description: '为已知首案准备预示：1行动、3灵性，知识难度12。成功后下一次首案判定难度降低5；预示只用一次。' },
  { id: 'diviner.s9.spiritual-intuition', label: '灵性直觉', description: '感到危险逼近；提示须来自实际情境，不能据此获知他人身份与秘密。' },
  { id: 'diviner.s9.mysticism-memory', label: '神秘学记忆', description: '理解并记住已经接触的神秘学材料；不凭空提供配方、仪式或知识。' },
];
export const SEER_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。指导者在场处置，不触发死亡。休养每次消退至多10排异；用过的原瓶不会恢复。';
