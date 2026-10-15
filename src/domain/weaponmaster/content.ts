import { WARRIOR_GUIDE } from '../warrior/content.js';
import type { WeaponmasterAbilityId } from './types.js';
export { WEAPONMASTER_CASE_IDS } from './types.js';

/** B1 ch138 names S7 Weaponmaster. Joshua's fireball in B3 ch184 comes from
 * a magical glove, not the class. The two practice categories, mentor, supply,
 * cases and numerical rules below are G; S6 dawn abilities remain unavailable. */
export const WEAPONMASTER_GUIDE = WARRIOR_GUIDE;
export const WEAPONMASTER_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800 } as const;
export const WEAPONMASTER_MIN_GLADIATOR_WEEKS = 8;
export const WEAPONMASTER_BOTTLE_IDS = ['weaponmaster-potion-1', 'weaponmaster-potion-2', 'weaponmaster-potion-3'] as const;
export const WEAPONMASTER_SOURCE_STATUS = '序列7武器大师之名据《诡秘之主》第一部第138章；第三部第184章约书亚的火球来自神奇手套，不能将物品效果算作武器大师自带能力，也不能由序列名称推导自动精通所有武器。本阶段仅增加兵器运用与弱点观察两项本作原创G实践分类：围绕实际借用的原短棍、可见垫靶标记与有限守望交接，按原物、眼前信息和普通配合练习；弱点观察不揭示不可见弱点、不保证命中或造成致命伤。奥斯温·布莱克特沿用本作原创成年独立导师身份，新兵器训练成品渠道、三段有限情境与全部数值均为本作原创G。三项战士训练分类和格斗技巧按原ID继承，借用原物的所有权不转移，不建立战神教会或其它组织身份，不提前开放序列6晨曦铠甲、能量长剑或光之风暴。';
export const WEAPONMASTER_POTION_SOURCES = WEAPONMASTER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${WEAPONMASTER_GUIDE}从新兵器训练成品交接渠道实际购入的第${index + 1}瓶序列7武器大师成品魔药，独立封存原瓶${id}；这批现货并非战士或格斗家旧瓶改装，成年导师与独立成品供应为本作G原创，未声称掌握完整配方或现场配制。取得此瓶不建立战神教会或其它组织身份。`,
}));
export const WEAPONMASTER_FORMULA_STATUS = '战士途径序列7武器大师的完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作G的新渠道独立成品原瓶；用药指导不构成完整制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const WEAPONMASTER_LABOUR_TASKS = ['核验兵器训练原瓶封记', '逐瓶登记独立成品编号', '整理本批训练场收货记录', '复核本瓶交付清单'] as const;
export const WEAPONMASTER_ABILITIES: { id: WeaponmasterAbilityId; label: string; description: string }[] = [
  { id: 'warrior.s7.weapons', label: '兵器运用', description: '本作G实践分类：对实际获准借用的原短棍核验握持、距离与适配，通过有限动作和普通协作积累掌握；不自动精通所有武器，不改变借用器物所有权，也不复制神奇手套的火球或其它物品能力。' },
  { id: 'warrior.s7.weak-point', label: '弱点观察', description: '本作G实践分类：根据眼前可见的垫靶标记、距离与动作变化形成有限判断，并实际复核；不能发现不可见弱点，不保证命中、必杀或无视防御。不得据此获得序列6晨曦铠甲、能量长剑或光之风暴。' },
];
export const WEAPONMASTER_CONSUMPTION_RISK = '服药必定消耗所选武器大师原瓶，0行动，意志难度18；格斗家扮演须达100且晋升格斗家后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗与其它危险。所有金额、行动、成熟周数与判定数值均为本作G平衡设定。';
