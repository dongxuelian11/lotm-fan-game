import type { LuckyAbilityId } from './types.js';
export { LUCKY_CASE_IDS } from './types.js';

/** Chapter-supported ability boundary; guide, finished supply and numerical rules are original G. */
export const LUCKY_GUIDE = '报时铺记录员艾妲·芬恩';
export const LUCKY_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800 } as const;
export const LUCKY_MIN_MACHINE_WEEKS = 8;
export const LUCKY_BOTTLE_IDS = ['lucky-potion-1', 'lucky-potion-2', 'lucky-potion-3'] as const;
export const LUCKY_SOURCE_STATUS = '《诡秘之主》第四部第178章支持序列7幸运者的被动幸运：好运无法主动控制，会波动，有时也只是普通运气。当前结果仍不确定，不能指定下一次好运、保证成功或把幸运存起来；没有等量厄运偿还规则。三项怪物与两项机器能力及其原ID掌握完整继承，仅新增被动幸运，不下放序列6招灾、序列5幸运池与主动控运，也没有高位重启。艾妲·芬恩仍是已认识的本作原创成年报时铺记录员，沿同一指导渠道继续，不自动建立生命学派或其它组织身份。独立成品原瓶、劳务、价格、下一班车/散落收据/封闭小路实践，以及每次实际实施只抽一次1至100、25及以下出现被动帮助的具体判定，均为本作原创G，不是原著概率。';
export const LUCKY_POTION_SOURCES = LUCKY_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${LUCKY_GUIDE}从独立幸运者成品交接渠道实际取得的第${index + 1}瓶序列7幸运者成品魔药，独立封存原瓶${id}；记录员与供给均为本作原创G，不是怪物或机器旧瓶改装，也未声称在报时铺配制。取得此瓶不建立生命学派或其它组织身份。`,
}));
export const LUCKY_FORMULA_STATUS = '命运之轮途径序列7幸运者的完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const LUCKY_LABOUR_TASKS = ['核验幸运者原瓶封记', '整理独立成品交接记录', '对照报时铺收货清单', '复核本瓶交付凭据'] as const;
export const LUCKY_ABILITIES: { id: LuckyAbilityId; label: string; description: string }[] = [
  { id: 'wheel.s7.passive-luck', label: '被动幸运', description: '被动受到好运眷顾，但幸运无法主动控制、会波动，有时也只是普通运气。当前行为仍需实际准备与核实，不保证成功；不能指定时刻、储蓄好运、重抽结果或重启，也没有等量厄运偿还规则。' },
];
export const LUCKY_CONSUMPTION_RISK = '服药必定消耗本次选定幸运者原瓶，0行动，意志难度18；机器扮演须达100且晋升机器后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。艾妲在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、异常接触或其它危险。失败保留机器消化与全部原有掌握；成功只新增从0开始的被动幸运掌握，体质不增加、感知+1、意志+1、知识+1，灵性上限60且当前灵性不补满。幸运仍被动、不可控制、波动且可能普通，不保证之后成功，不退款、不重抽、不储蓄。金额、行动、成熟周数与判定数值均为本作原创G平衡设定。';
