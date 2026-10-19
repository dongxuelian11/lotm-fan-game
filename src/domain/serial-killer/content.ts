import type { SerialKillerAbilityId } from './types.js';
export { SERIAL_KILLER_CASE_IDS } from './types.js';

/** Verified source summaries only. The adult guide, finished supply, non-harmful study scenes
 * and all numerical rules are original G; they do not prove a canon-safe digestion route. */
export const SERIAL_KILLER_GUIDE = '旧货管理员罗安·费里';
export const SERIAL_KILLER_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800 } as const;
export const SERIAL_KILLER_MIN_UNWINGED_WEEKS = 8;
export const SERIAL_KILLER_BOTTLE_IDS = ['serial-killer-potion-1', 'serial-killer-potion-2', 'serial-killer-potion-3'] as const;
export const SERIAL_KILLER_SOURCE_STATUS = '《诡秘之主》第二部第45章《杀人案》（核验定位L46883–L46893）支持序列7连环杀手获得恶魔知识与仪式能力，当前只新增这两项稳定掌握分类。第二部第92章《侦探交流会》（L55170–L55178）中，克莱恩推断相似的连续犯罪通常与消化有关；单靠时间推进不能视为安全消化。此处非伤害性的知识核对、接触约束与如实报告路线属于本作原创G扮演适配，有精神、灵性、排异与判断失误的实际成本，不是原著保证的善良或无害消化路线，也不保证后续序列可依此晋升。罪犯三项能力与折翼天使非人身体及其原ID掌握完整继承，角色已经失去原有良知的事实与恶欲风险永久保留，克制不恢复良知。本阶段没有已核的具体序列7战斗法术清单，不凭名称补齐；第二部第98章所述序列6恶魔的危险预知、巨大化、坚硬皮肤、毒素免疫、火焰及诅咒能力不下放，序列5欲望操纵也不下放。罗安·费里仍为本作原创成年旧货管理员，沿已认识的折翼天使渠道提供独立成品用药指导；供给、封存索引、空置仪式圈、错误奉献记录三段有限实践、劳务、金额和全部游戏数值均为本作原创G，不建立拜血教或其它组织身份，不自动实施犯罪。';
export const SERIAL_KILLER_POTION_SOURCES = SERIAL_KILLER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${SERIAL_KILLER_GUIDE}经已有折翼天使渠道、从独立连环杀手成品交接渠道实际取得的第${index + 1}瓶序列7连环杀手成品魔药，独立封存原瓶${id}；管理员与供给均为本作原创G，不是罪犯或折翼天使旧瓶改装，也未声称在旧货库配制。取得此瓶不建立拜血教或其它组织身份。`,
}));
export const SERIAL_KILLER_FORMULA_STATUS = '深渊途径序列7连环杀手的完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const SERIAL_KILLER_LABOUR_TASKS = ['核验连环杀手原瓶封记', '整理独立成品交接记录', '复核旧货库实际收货清单', '归档该瓶保管与领取凭证'] as const;
export const SERIAL_KILLER_ABILITIES: { id: SerialKillerAbilityId; label: string; description: string }[] = [
  { id: 'abyss.s7.demonic-lore', label: '恶魔知识', description: '核对眼前已知的有限恶魔学索引与仪式记录，区分原记录、推断和无法证实的断言。知识不等于全知、鉴定保证或免疫污染；不自动获知未知真名、配方或完整法术表。实际学习与克制仍有成本，既有良知丧失不会恢复。' },
  { id: 'abyss.s7.ritual-practice', label: '仪式实践', description: '在本作G限定的真实场地与已核记录间进行有限接触和结束操作，保留普通核对与实际退出。仪式可能失败并留下精神、灵性或排异代价；关闭接触不抹去后果，不凭空召唤恶魔、制造战斗法术或保证安全消化。' },
];
export const SERIAL_KILLER_CONSUMPTION_RISK = '服药必定消耗本次选定连环杀手原瓶，0行动，意志难度18；折翼天使扮演须达100且晋升折翼天使后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。罗安在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、异常接触、恶欲选择或其它危险。成功后体质+1、感知+1、意志+1、知识+2，灵性上限60，当前灵性不补满；只新增恶魔知识与仪式实践两项掌握。本次不引入新的身体变化，角色在折翼天使阶段已经失去原有良知的事实永久保留，无论晋升成功或失败均不恢复；进阶与后续接触仍有风险。非伤害性的学习与约束路线是有成本的本作G适配，不是原著保证的无害消化路线。金额、行动、成熟周数与判定数值均为本作原创G平衡设定。';
