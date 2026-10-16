import { ASSASSIN_GUIDE } from '../assassin/content.js';
import type { InstigatorAbilityId } from './types.js';
export { INSTIGATOR_CASE_IDS } from './types.js';

/** B1 ch65 bounds instigation to existing evil desires and conflicts.
 * The independent adult mentor, finished-potion supply, exercises and numbers are G. */
export const INSTIGATOR_GUIDE = ASSASSIN_GUIDE;
export const INSTIGATOR_PRICES = { guidance: 180, potion: 1210, labourCredit: 1050 } as const;
export const INSTIGATOR_MIN_ASSASSIN_WEEKS = 4;
export const INSTIGATOR_BOTTLE_IDS = ['instigator-potion-1', 'instigator-potion-2', 'instigator-potion-3'] as const;
export const INSTIGATOR_SOURCE_STATUS = '序列8教唆者据《诡秘之主》第一部第65章：能够影响已有恶欲与矛盾，使其更容易转成行动；这不是读心、催眠或绝对控制，不能凭空创造欲望，也不能保证对方服从。诺艾拉·温瑟沿用本作原创成年独立导师身份；新进阶成品渠道、排队争议、两份告示、排练竞争、真实升温与平息步骤及全部游戏数值均为本作原创G，不声称来自原著。四项刺客能力及原ID继承，不强制加入魔女教派或其它组织，不以伤害他人作为消化条件，不提前开放序列7的身体转变、隐形、黑焰或其它能力。';
export const INSTIGATOR_POTION_SOURCES = INSTIGATOR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${INSTIGATOR_GUIDE}从新进阶成品交接渠道实际购入的第${index + 1}瓶序列8教唆者成品魔药，独立封存原瓶${id}；这批现货并非刺客旧瓶改装，成年导师与独立成品供应为本作G原创，未声称掌握完整配方或现场配制。取得此瓶不建立魔女教派或其它组织身份。`,
}));
export const INSTIGATOR_FORMULA_STATUS = '刺客途径序列8教唆者的完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作G的新渠道独立成品原瓶；用药指导不构成完整制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const INSTIGATOR_LABOUR_TASKS = ['核验进阶原瓶来货封记', '逐瓶整理独立成品交接单', '复核练习场进阶收货清单'] as const;
export const INSTIGATOR_ABILITIES: { id: InstigatorAbilityId; label: string; description: string }[] = [
  { id: 'assassin.s8.instigation', label: '教唆', description: '抓住眼前已有的恶欲、动摇与矛盾施加有限影响，仍须观察原话、证据与真实反应；不凭空制造欲望，不读心、不催眠、不强制控制。升温后必须实际平息后果，普通说明与证据核对也能推进和平实践。继承刺客能力，尚无序列7的身体转变、隐形或黑焰。' },
];
export const INSTIGATOR_CONSUMPTION_RISK = '服药必定消耗所选教唆者原瓶，0行动，意志难度12；刺客扮演须达100且首次晋升刺客后满4整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。失败保留刺客消化与掌握；全部现货耗尽后可请求下一批，至少跨一真实周且仍须逐瓶支付。这项保护只适用于本次指导服药，不适用于战斗与其它危险。';
