import { HUNTER_GUIDE } from '../hunter/content.js';
import type { ProvokerAbilityId } from './types.js';

/** The two abilities follow the verified sequence-8 boundary; fire remains sequence 7.
 * This separate finished-potion channel, mentor, supply, labour, prices and effects are original G rules.
 * No complete sequence-8 recipe has been verified, so no ingredients or manufacturing are invented. */
export const PROVOKER_GUIDE = HUNTER_GUIDE;
export const PROVOKER_PRICES = { guidance: 180, potion: 1370, labourCredit: 1200 } as const;
export const PROVOKER_MIN_HUNTER_WEEKS = 6;
export const PROVOKER_BOTTLE_IDS = ['provoker-potion-1', 'provoker-potion-2', 'provoker-potion-3'] as const;
export const PROVOKER_POTION_SOURCES = PROVOKER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${PROVOKER_GUIDE}从新的仓库供货渠道实际购入的第${index + 1}瓶序列8挑衅者成品魔药，独立封存原瓶${id}；这批现货并非猎人旧瓶改装，导师与成品供应为本作G原创。`,
}));
export const PROVOKER_FORMULA_STATUS = '挑衅者完整配方资料待核；目前未开放配方学习与制造，只能取得新渠道实际供应的序列8独立成品原瓶。';
export const PROVOKER_LABOUR_TASKS = ['核验仓库交货封记', '护送实际到仓货物', '复核仓库交接清单'] as const;
export const PROVOKER_ABILITIES: { id: ProvokerAbilityId; label: string; description: string }[] = [
  { id: 'hunter.s8.provocation', label: '挑衅', description: '依据实际观察到的情绪弱点，以言语和举止激化目标、诱导其反应；须主动选择并承担敌意与报复风险，不能读心或保证目标服从。' },
  { id: 'hunter.s8.hostility-aura', label: '敌意吸引', description: '主动以自身气息吸引附近具有相应反应能力的目标注意与敌意，为他人争取行动窗口；可能招来真实攻击，不会凭空控制人格或无条件保护同伴。' },
];
export const PROVOKER_CONSUMPTION_RISK = '服药必定消耗所选挑衅者原瓶，0行动，意志难度12；猎人扮演须达100且首次晋升猎人后满6整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗与其它危险。';
