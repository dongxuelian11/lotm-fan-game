import type { PrisonerAbilityId } from './types.js';
export { PRISONER_CASE_IDS } from './types.js';

/** Verified chapter summaries only. Guide, supply, practice interpretation and numbers are original G. */
export const PRISONER_GUIDE = '旧工坊管理员哈伦·维斯';
export const PRISONER_PRICES = { guidance: 120, potion: 660, labourCredit: 600 } as const;
export const PRISONER_BOTTLE_IDS = ['prisoner-potion-1', 'prisoner-potion-2', 'prisoner-potion-3'] as const;
export const PRISONER_SOURCE_STATUS = '《诡秘之主》第二部第118章《被诅咒者》（已核L59584–59620）支持囚犯序列9拥有强壮身体、敏锐感知，以及利用普通物品战斗的能力。第二部第117章《莎伦和马里奇的理念》（已核L59463–59481）支持节制、不伤害他人的选择方向；本作的和平实践、消化进度与成长数值均为原创G解释，不保证成长就能消除诅咒。序列8以牺牲当前理智换取提升与精神抵抗的能力不下放；序列7狼人的愈合和利爪、序列6活尸的护甲与尸体控制也不下放。囚犯只是虚构序列名称，不自动判定玩家犯罪、将玩家关进监狱或赋予任何监狱身份。哈伦·维斯是本作原创成年旧工坊管理员，独立成品药渠道、普通劳务、三项实践及全部游戏数值均为本作原创G，不自动建立玫瑰学派或其它组织身份。';
export const PRISONER_POTION_SOURCES = PRISONER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${PRISONER_GUIDE}独立保管的第${index + 1}瓶囚犯成品魔药，原瓶独立封存；管理员与旧工坊供给为本作原创G，未声称现场配制。取得此瓶不建立任何监狱或组织身份。`,
}));
export const PRISONER_FORMULA_STATUS = '囚犯完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成完整制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const PRISONER_ABILITIES: { id: PrisonerAbilityId; label: string; description: string }[] = [
  { id: 'chained.s9.prisoner-body', label: '强壮身体', description: '以增强的身体力量处理眼前已观察的有限障碍，仍须留意旁人和原物；不徒手破开一切障碍，不获得狼人愈合、利爪或活尸护甲。' },
  { id: 'chained.s9.keen-perception', label: '敏锐感知', description: '更敏锐地注意已经在场的声音、气流与细节，再以普通事实核实；不读心、不预知、不把回声直接判为异常，也没有序列8的精神抵抗提升。' },
  { id: 'chained.s9.improvised-combat', label: '普通物品运用', description: '在有限冲突中更善于运用现场实际存在的普通物品，保留原所有权、借还与环境限制；不凭空产生武器，不自动伤害他人，不以牺牲理智换取高阶力量。' },
];
export const PRISONER_CONSUMPTION_RISK = '服药必定消耗所选原瓶，0行动，意志难度5。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。管理员在场处理严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗、异常接触及其它危险。节制、不伤害他人的实践与消化为本作G解释，不保证消除诅咒；序列名称不自动改变玩家法律身份或组织归属。';
