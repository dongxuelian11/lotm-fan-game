import type { MarauderAbilityId, MarauderOriginal } from './types.js';
export { MARAUDER_CASE_IDS, MARAUDER_ORIGINAL_IDS } from './types.js';

/** Canon supports ordinary-property theft, speed/agility and dexterous fingers.
 * Mentor, supply, training categories, cases and numerical rules are original G content. */
export const MARAUDER_GUIDE = '独立失物登记员艾德温·洛克';
export const MARAUDER_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const MARAUDER_BOTTLE_IDS = ['marauder-potion-1', 'marauder-potion-2', 'marauder-potion-3'] as const;
export const MARAUDER_SOURCE_STATUS = '能力边界据《诡秘之主》第一部第65章的普通财物偷取、第二部第74章的速度与敏捷表现，以及对应序列9封印物“断指”所体现的灵巧、稳定手指。“断指”的偷窃冲动属于该物品的负面效果，不写成所有偷盗者的固有症状。敏捷、灵巧与偷取是本作原创G的三个训练分类，不是额外发明的超能力。序列9只处理眼前实际可接触的普通原物，不能远程读取库存、隔空取得物品，也不能偷取非凡能力或灵性；本阶段没有已核实的序列9宝物感应。艾德温·洛克为本作原创成年独立导师，失物登记员身份、成品供给、场景及数值均为本作原创G，不强制加入任何家族或组织。';
export const MARAUDER_POTION_SOURCES = MARAUDER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${MARAUDER_GUIDE}独立保管的第${index + 1}瓶偷盗者成品魔药，原瓶独立封存；导师与失物登记处的独立供给为本作原创G，未声称现场配制。取得此瓶不建立任何家族或组织身份。`,
}));
export const MARAUDER_FORMULA_STATUS = '偷盗者完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成完整制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const MARAUDER_ABILITIES: { id: MarauderAbilityId; label: string; description: string }[] = [
  { id: 'error.s9.agility', label: '敏捷', description: '速度与敏捷的序列9训练分类，本作原创G分别记录掌握度。实际移动和避让仍受眼前距离、障碍与身体状态影响，不提供瞬移、远程取物或宝物感应。' },
  { id: 'error.s9.dexterity', label: '灵巧', description: '灵巧、稳定手指的序列9训练分类；对应封印物“断指”提供能力边界参考，其偷窃冲动不视为偷盗者固有症状。只能在原物实际可接触的位置操作，不穿透封套或凭空读取内容。' },
  { id: 'error.s9.theft', label: '偷取', description: '在眼前实际接触普通财物并尝试取走的序列9训练分类。成功只改变原物的持有者和位置，不转移所有权；被注意、归还与关系后果分别记录。不能远程读取库存、偷取非凡能力或灵性，不把宝物感应当作已核实的序列9能力。' },
];
export const MARAUDER_ORIGINALS: readonly MarauderOriginal[] = [
  { id: 'training-token', owner: '艾德温·洛克', custodian: 'HOLDER', location: 'training-purse', version: 1, sealed: false },
  { id: 'brass-token', owner: '维修员露茜', custodian: 'SITE', location: 'bench-gap', version: 1, sealed: false },
  { id: 'sealed-letter', owner: '委托人安娜', custodian: 'HOLDER', location: 'dispatch-counter', version: 1, sealed: true },
];
export const MARAUDER_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗与其它危险。';
