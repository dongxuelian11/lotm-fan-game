import { SAILOR_GUIDE } from '../sailor/content.js';
import type { RagerAbilityId } from './types.js';
export { RAGER_CASE_IDS } from './types.js';

/** Novel book one, ch65: anger can produce a strength/speed burst. Ch129:
 * an ordinary punch is not an automatic killing blow; the team's opportunity matters.
 * Mentor, finished supply, labour, dockside cases and all gameplay numbers are G.
 * Neither mandatory alcohol nor equating anger with madness is a progression rule.
 * The full recipe is unverified; S7 water magic is not granted at this stage. */
export const RAGER_GUIDE = SAILOR_GUIDE;
export const RAGER_PRICES = { guidance: 180, potion: 1210, labourCredit: 1050 } as const;
export const RAGER_MIN_SAILOR_WEEKS = 4;
export const RAGER_BOTTLE_IDS = ['rager-potion-1', 'rager-potion-2', 'rager-potion-3'] as const;
export const RAGER_SOURCE_STATUS = '能力边界据《诡秘之主》第一部第65章：怒意能使力量与速度爆发；第129章保留普通一拳并非必然致命、同伴把握空当的重要性。暴怒不等同疯狂，也不以饮酒作为晋升或施展的必需条件。导师、成品供给、抗冲击的具体结算、码头场景及全部数值均为本作玩法改编G；序列7水系法术不在本阶段。';
export const RAGER_POTION_SOURCES = RAGER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${RAGER_GUIDE}从新码头维修站交接渠道实际购入的第${index + 1}瓶序列8暴怒之民成品魔药，独立封存原瓶${id}；这批现货并非水手旧瓶改装，导师与成品供应为本作G原创。取得此瓶不建立风暴教会或其它组织身份。`,
}));
export const RAGER_FORMULA_STATUS = '暴怒之民完整配方尚未在现有原著核验中找到；目前未开放配方学习与制造，只能取得新渠道实际供应的序列8独立成品原瓶，不编造配方材料。';
export const RAGER_LABOUR_TASKS = ['核验维修站来货封记', '整理原吊具与修理记录', '复核维修站收货清单'] as const;
export const RAGER_ABILITIES: { id: RagerAbilityId; label: string; description: string }[] = [
  { id: 'tyrant.s8.fury', label: '怒意爆发', description: '第一部第65章所述怒意支持短时力量与速度爆发；本作按真实对象、清场与玩家选择结算。可保留怒意，等待同伴创造空当；普通一拳并非必然致命，爆发不等于自动命中或失去理智，也不要求饮酒。不得以此凭空施展序列7水系法术。' },
  { id: 'tyrant.s8.impact-resilience', label: '抗冲击', description: '以强化身体承受有限冲击的玩法G；仅减轻已实际结算的有限冲击，仍会受伤，需要支撑点、距离与同伴协作。不是刀枪不入、完全免伤或水压免疫，不能替代救援准备、现场清场与必要的撤离。' },
];
export const RAGER_CONSUMPTION_RISK = '服药必定消耗所选暴怒之民原瓶，0行动，意志难度12；水手扮演须达100且首次晋升水手后满4整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗与其它危险。所有金额、行动、成熟周数与判定数值均为本作G平衡设定。';
