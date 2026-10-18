import { MARAUDER_GUIDE } from '../marauder/content.js';
import type { SwindlerAbilityId } from './types.js';
export { SWINDLER_CASE_IDS } from './types.js';

/** Book one ch65/ch175 support deception and fraudulent tendencies; book eight
 * ch19 supports eloquence. No sourced mandatory trust or memory rewriting.
 * Eloquence/planning remain one S8 deceit mastery, not separate invented powers.
 * Mentor, independent advanced finished supply, cases and numeric rules are G. */
export const SWINDLER_GUIDE = MARAUDER_GUIDE;
export const SWINDLER_PRICES = { guidance: 180, potion: 1210, labourCredit: 1050 } as const;
export const SWINDLER_MIN_MARAUDER_WEEKS = 4;
export const SWINDLER_BOTTLE_IDS = ['swindler-potion-1', 'swindler-potion-2', 'swindler-potion-3'] as const;
export const SWINDLER_SOURCE_STATUS = '诈骗师的骗术与欺诈倾向据《诡秘之主》第一部第65、175章，口才表现据第八部第19章；口才与谋划均归入同一项骗术掌握，不拆成额外超能力。已核内容没有证明强制信任或改写记忆，目标仍可质疑、核对事实或拒绝配合。艾德温·洛克沿用本作原创成年独立导师身份，新进阶成品交接渠道、有限生活情境、战斗骗局的两阶段与时间转移，以及所有数值均为本作玩法G，不声称来自原著。继承三项偷盗者能力及其原ID；不提前开放更高序列的非凡能力偷取，也不建立家族或组织身份。';
export const SWINDLER_POTION_SOURCES = SWINDLER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${SWINDLER_GUIDE}从新进阶成品交接渠道实际购入的第${index + 1}瓶序列8诈骗师成品魔药，独立封存原瓶${id}；这批现货并非偷盗者旧瓶改装，成年导师与独立成品供应为本作G原创，未声称掌握完整配方或现场配制。取得此瓶不建立任何家族或组织身份。`,
}));
export const SWINDLER_FORMULA_STATUS = '错误途径序列9偷盗者、序列8诈骗师与序列7解密学者的完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前诈骗师只开放本作G的新渠道独立成品原瓶；用药指导不构成完整制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const SWINDLER_LABOUR_TASKS = ['核验进阶原瓶来货封记', '整理独立成品交接记录', '复核失物登记处收货清单'] as const;
export const SWINDLER_ABILITIES: { id: SwindlerAbilityId; label: string; description: string }[] = [
  { id: 'error.s8.deceit', label: '骗术', description: '围绕实际已知情境运用口才与谋划实施有限骗术，两者共用同一项掌握。对方可能暂时接受说法，也能质疑、核对和拒绝；不能强制信任或改写记忆。准备、误导、揭示结果与战斗时间转移的具体步骤和数值是本作玩法G，不自动生成证据、物品、他人的秘密或更高序列的非凡能力偷取。' },
];
export const SWINDLER_CONSUMPTION_RISK = '服药必定消耗所选诈骗师原瓶，0行动，意志难度12；偷盗者扮演须达100且首次晋升偷盗者后满4整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗与其它危险。所有金额、行动、成熟周数与判定数值均为本作G平衡设定。';
