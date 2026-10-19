import { WARRIOR_GUIDE } from '../warrior/content.js';
import type { GladiatorAbilityId } from './types.js';
export { GLADIATOR_CASE_IDS } from './types.js';

/** B1 ch138 gives S8 格斗家 and its ancient name 角斗士. B3 ch118's
 * Ozire remains vulnerable to mental pressure and dragon fear and loses.
 * Combat skill is one original G training category; mentor, supply and numbers are G. */
export const GLADIATOR_GUIDE = WARRIOR_GUIDE;
export const GLADIATOR_PRICES = { guidance: 180, potion: 1210, labourCredit: 1050 } as const;
export const GLADIATOR_MIN_WARRIOR_WEEKS = 4;
export const GLADIATOR_BOTTLE_IDS = ['gladiator-potion-1', 'gladiator-potion-2', 'gladiator-potion-3'] as const;
export const GLADIATOR_SOURCE_STATUS = '序列8格斗家及其古称角斗士据《诡秘之主》第一部第138章；第三部第118章奥兹尔在精神影响与龙威恐惧下失利，不能由格斗家身份推导恐惧免疫、精神免疫或无敌。本阶段仅新增格斗技巧这一项本作原创G训练分类，围绕真实身体、距离、协作与停止信号记录掌握，并非原著额外列出的独立超能力。奥斯温·布莱克特沿用本作原创成年独立导师身份，新进阶成品渠道、有限训练情境、实际接触与松开步骤及全部游戏数值均为本作原创G，不声称来自原著。继承三项战士训练分类及原ID，不强制加入战神教会或其它组织，不提前开放序列6晨曦铠甲、晨曦武器或光之风暴。';
export const GLADIATOR_POTION_SOURCES = GLADIATOR_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${GLADIATOR_GUIDE}从新进阶成品交接渠道实际购入的第${index + 1}瓶序列8格斗家成品魔药，独立封存原瓶${id}；这批现货并非战士旧瓶改装，成年导师与独立成品供应为本作G原创，未声称掌握完整配方或现场配制。取得此瓶不建立战神教会或其它组织身份。`,
}));
export const GLADIATOR_FORMULA_STATUS = '战士途径序列8格斗家的完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作G的新渠道独立成品原瓶；用药指导不构成完整制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const GLADIATOR_LABOUR_TASKS = ['核验进阶原瓶来货封记', '整理独立成品交接记录', '复核训练场收货清单'] as const;
export const GLADIATOR_ABILITIES: { id: GladiatorAbilityId; label: string; description: string }[] = [
  { id: 'warrior.s8.combat-skill', label: '格斗技巧', description: '本作G训练分类：围绕本人身体与眼前真实对象练习距离、有限近身动作、协作及及时松开；训练伙伴明确同意才可接触，停止后必须实际解除接触。格斗家仍受精神影响与恐惧干扰，不免伤、不徒手防弹、不自动精通所有武器，也没有序列6晨曦铠甲或光之风暴。' },
];
export const GLADIATOR_CONSUMPTION_RISK = '服药必定消耗所选格斗家原瓶，0行动，意志难度12；战士扮演须达100且首次晋升战士后满4整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗与其它危险。所有金额、行动、成熟周数与判定数值均为本作G平衡设定。';
