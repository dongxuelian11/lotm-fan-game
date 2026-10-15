import type { ShadowAsceticAbilityId } from './types.js';
export { SHADOW_ASCETIC_CASE_IDS } from './types.js';

/** B3 ch183 L119923 supports concealment without hiding spirit-body threads;
 * B2 ch72 demonstrates concealed attackers can be pulled down and shot.
 * The mentor, independent finished supply, cases and numerical rules are original G. */
export const SHADOW_ASCETIC_GUIDE = '旧物管理员伊森·洛弗';
export const SHADOW_ASCETIC_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800 } as const;
export const SHADOW_ASCETIC_MIN_LISTENER_WEEKS = 8;
export const SHADOW_ASCETIC_BOTTLE_IDS = ['shadow-ascetic-potion-1', 'shadow-ascetic-potion-2', 'shadow-ascetic-potion-3'] as const;
export const SHADOW_ASCETIC_SOURCE_STATUS = '《诡秘之主》第三部第183章（核验定位L119923）支持隐修士利用阴影藏匿，但灵体之线仍可被察觉；第二部第72章中，藏匿的袭击者仍能被拉下并遭射击。阴影藏匿不等于绝对隐形或伤害免疫，不能靠名称推导瞬移、分身或穿越封死的路线。当前只新增阴影藏匿一项稳定能力分类，三项秘祈人能力与有限耳语倾听及其原ID掌握完整继承；不编造完整法术表或额外仪式力量，不下放序列6蔷薇主教的血肉魔法与序列5牧羊人的放牧。伊森·洛弗仍为本作原创成年旧物管理员，经已有倾听者渠道继续提供独立成品用药指导；成品供给、灯位改变、堵塞壁龛和约定守望三段有限实践、劳务、金额及全部游戏数值均为本作原创G，不建立极光会或其它组织身份。';
export const SHADOW_ASCETIC_POTION_SOURCES = SHADOW_ASCETIC_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${SHADOW_ASCETIC_GUIDE}经已有倾听者渠道、从独立隐修士成品交接渠道实际取得的第${index + 1}瓶序列7隐修士成品魔药，独立封存原瓶${id}；管理员与供给均为本作原创G，不是秘祈人或倾听者旧瓶改装，也未声称在旧物间配制。取得此瓶不建立极光会或其它组织身份。`,
}));
export const SHADOW_ASCETIC_FORMULA_STATUS = '倒吊人途径序列7隐修士的完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const SHADOW_ASCETIC_LABOUR_TASKS = ['核验隐修士原瓶封记', '整理独立成品交接记录', '核对旧物间实际收货清单', '归档该瓶保管与领取凭证'] as const;
export const SHADOW_ASCETIC_ABILITIES: { id: ShadowAsceticAbilityId; label: string; description: string }[] = [
  { id: 'hanged-man.s7.shadow-concealment', label: '阴影藏匿', description: '利用当前实际存在的阴影作有限藏匿，保留真实光照、位置和普通退路。藏匿不保证无法被察觉，灵体之线仍可能暴露，身体仍可被攻击；不免疫、不瞬移、不分身，也不能越过封死的通路。离开阴影须实际执行，不抹去既有后果。' },
];
export const SHADOW_ASCETIC_CONSUMPTION_RISK = '服药必定消耗所选隐修士原瓶，0行动，意志难度18；倾听者扮演须达100且晋升倾听者后满8整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。伊森在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、异常接触或其它危险。成功后体质+1、感知+1、意志+2、知识+1，灵性上限60，当前灵性不补满；只新增阴影藏匿一项掌握。金额、行动、成熟周数与判定数值均为本作原创G平衡设定。';
