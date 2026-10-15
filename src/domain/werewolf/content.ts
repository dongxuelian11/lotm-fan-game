import type { WerewolfAbilityId } from './types.js';
export { WEREWOLF_CASE_IDS } from './types.js';

/** Verified chapter summaries. Guide, supply, practice, finite moon notices and numerical rules are original G. */
export const WEREWOLF_GUIDE = '旧工坊管理员哈伦·维斯';
export const WEREWOLF_PRICES = { guidance: 240, potion: 2010, labourCredit: 1800 } as const;
export const WEREWOLF_MIN_MADMAN_WEEKS = 8;
export const WEREWOLF_BOTTLE_IDS = ['werewolf-potion-1', 'werewolf-potion-2', 'werewolf-potion-3'] as const;
/** Finite authored events, announced in advance; not a derived or recurring lunar calendar. */
export const WEREWOLF_MOON_EVENTS = [
  { id: 'wolf-moon-01', week: 32, title: '旧工坊月相告示·第一场满月', source: '本作原创城市月相告示事件' },
  { id: 'wolf-moon-02', week: 37, title: '旧工坊月相告示·第二场满月', source: '本作原创城市月相告示事件' },
  { id: 'wolf-moon-03', week: 41, title: '旧工坊月相告示·第三场满月', source: '本作原创城市月相告示事件' },
  { id: 'wolf-moon-04', week: 46, title: '旧工坊月相告示·第四场满月', source: '本作原创城市月相告示事件' },
  { id: 'wolf-moon-05', week: 51, title: '旧工坊月相告示·第五场满月', source: '本作原创城市月相告示事件' },
  { id: 'wolf-moon-06', week: 55, title: '旧工坊月相告示·第六场满月', source: '本作原创城市月相告示事件' },
  { id: 'wolf-moon-07', week: 60, title: '旧工坊月相告示·第七场满月', source: '本作原创城市月相告示事件' },
  { id: 'wolf-moon-08', week: 65, title: '旧工坊月相告示·第八场满月', source: '本作原创城市月相告示事件' },
] as const;
export const WEREWOLF_SOURCE_STATUS = '《诡秘之主》第二部第118章《被诅咒者》（已核L59584–59620）支持序列7狼人拥有强大愈合力、身体力量、速度与敏捷，以及有毒利爪和牙齿，并掌握少数黑暗类法术；具体法术名称尚未核实，本阶段不凭类别编造命名法术。每逢满月会失去大部分理智，长出黑毛，产生强烈嗜血冲动，节制或消化不能消除这一诅咒。原文提及毒素须在体内持续一定时间才能产生转化，转化后代寿命短暂；当前不实现感染、转化或后代控制。序列6活尸的钢铁身体、抵挡手枪和操纵尸体，以及序列5怨魂附身不下放；马里奇满月时的剧痛及丧失战斗能力也不能当作序列7的统一公式。第二部第117章《莎伦和马里奇的理念》（已核L59463–59481）支持节制、不伤害他人的真实分支；本作有限和平实践及成长是原创G解释，不保证成长就能免除诅咒。三项囚犯与两项疯子能力及原ID掌握完整继承。哈伦·维斯仍为已认识的本作原创成年旧工坊管理员，沿同一指导渠道提供独立狼人原瓶；供给、劳务、金额、既有伤势/爪痕/夜路实践、提前公示的八场有限城市月相告示事件及全部数值均为本作原创G，不冒称原著精确月相历法，不自动加入玫瑰学派或其它组织。';
export const WEREWOLF_POTION_SOURCES = WEREWOLF_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${WEREWOLF_GUIDE}经已有疯子指导渠道、从独立狼人成品交接渠道实际取得的第${index + 1}瓶序列7狼人成品魔药，独立封存原瓶${id}；管理员与供给均为本作原创G，不是囚犯或疯子旧瓶改装，也未声称在旧工坊配制。取得此瓶不建立玫瑰学派或其它组织身份。`,
}));
export const WEREWOLF_FORMULA_STATUS = '被缚者途径序列7狼人的完整配方尚未核实，材料名称、主辅分类、数量与投料顺序均不作为已知内容。当前只开放本作原创G的独立成品原瓶；用药指导不构成制造配方，不解锁配方学习、材料采购或调配，也不编造任何原料。';
export const WEREWOLF_LABOUR_TASKS = ['核验狼人原瓶封记', '整理独立成品交接记录', '复核旧工坊实际收货清单', '归档该瓶保管与领取凭证'] as const;
export const WEREWOLF_ABILITIES: { id: WerewolfAbilityId; label: string; description: string }[] = [
  { id: 'chained.s7.werewolf-body', label: '狼人身体', description: '获得更强的身体力量、速度与敏捷，在真实可达的路线与近身情境中发挥作用。不是活尸的钢铁身体，不保证抵挡手枪，不赋予附身；满月身体变化与嗜血冲动仍须实际处理，节制不消除诅咒。' },
  { id: 'chained.s7.regeneration', label: '强大愈合力', description: '对角色已经存在的身体损伤发挥有限愈合作用；具体可恢复范围、资源消耗和恢复量为本作G规则。没有伤势时不制造伤势或免费奖励；不治精神、污染、诅咒，不抹去既有后果、累计战斗风险，也不因退出场景而治疗。' },
  { id: 'chained.s7.toxic-claws', label: '有毒爪牙', description: '有毒的利爪与牙齿用于明确选择的实际接触，普通核实方法仍然可用。原文的转化有体内毒素持续时间条件，后代寿命短暂；当前不开放转化、感染或控制后代，不把一次命中视为必杀、必定中毒或远程操控。' },
];
export const WEREWOLF_CONSUMPTION_RISK = '服药必定消耗本次选定狼人原瓶，0行动，意志难度18；疯子扮演须达100且晋升疯子后满8整周。晋升将带来狼人身体变化和每月满月诅咒：满月时失去大部分理智、长出黑毛并产生强烈嗜血冲动，节制或消化不能免除。当前以八场提前公示的本作原创G城市月相告示事件处理月圆，不按四周自动推算，也不是原著精确历法；末场之后的月相事件尚未展开，不代表诅咒消失。须选择看守协助或独自隔离并支付实际精神代价，处理当次发作不治愈诅咒。请在确认本瓶服用前考虑这些持续代价。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。哈伦在场处理本次指导服药的严重排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护不适用于战斗、月圆发作、主动牺牲理智或其它危险。成功后体质+2、感知+1、意志+1、知识+0，灵性上限60，当前灵性不补满；五项囚犯/疯子掌握完整保留，只新增狼人身体、强大愈合力、有毒爪牙三项掌握。失败保留疯子消化与原掌握。节制、不伤害他人的实践成长为本作原创G解释，不保证消除诅咒；不自动伤害他人、感染或建立组织身份。金额、行动、成熟周数、有限月相事件及判定数值均为本作原创G平衡设定。';
