import { JUDGE_GUIDE } from '../judge/content.js';
import type { PunishmentKnightAbilityId } from './types.js';
export { PUNISHMENT_KNIGHT_CASE_IDS } from './types.js';

/** Original G participants, objects and numeric procedures are not claims of official authority. */
export const PUNISHMENT_KNIGHT_GUIDE = JUDGE_GUIDE;
export const PUNISHMENT_KNIGHT_VOLUNTEER = '成年递件员阿伦';
export const PUNISHMENT_KNIGHT_PAD_ID = 'PK5-SOFT-PAD-1';
export const PUNISHMENT_KNIGHT_LINE_ID = 'PK5-LINE-1';
export const PUNISHMENT_KNIGHT_NOTE_ID = 'PK5-NOTE-1';
export const PUNISHMENT_KNIGHT_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200 } as const;
export const PUNISHMENT_KNIGHT_MIN_JUDGE_WEEKS = 12;
export const PUNISHMENT_KNIGHT_LABOUR_STEPS = 5;
export const PUNISHMENT_KNIGHT_BOTTLE_IDS = ['punishment-knight-potion-1', 'punishment-knight-potion-2', 'punishment-knight-potion-3'] as const;
export const PUNISHMENT_KNIGHT_SOURCE_STATUS = '惩戒骑士是审判者途径序列5，承接法官6，下一阶为律令法师4。第三部第217章的禁飞宣告并未让目标绝对服从，目标仍实际飞行；随后惩戒强化跃击速度和力量，命中只破开部分护甲，不保证穿透。第218章的死亡宣告针对同伴先前造成的实际肩伤，出现局部萎缩与撕裂；随后镜面法术另行扩大伤势，不能全归为一句宣告。第219章目标已遭合力重创并受控缓降，不支持无伤目标一句话必杀。原文囚禁有限且可以挣脱；书中世界的数值与效果不作为所有真实惩戒骑士的统一精度。仲裁人、治安官、审讯者与法官全部原能力、原ID掌握和实际历史保留，仅新增惩戒强化、有限囚禁与既有伤口裁决三项。民间调解文书员薇娜·贝尔、成年自愿递件员阿伦、成年迪恩、原调解处安全练习室、软练习垫PK5-SOFT-PAD-1、原地面线PK5-LINE-1及原纸PK5-NOTE-1均为本作原创G。练习故意减弱的非法律宣告、仅向原软垫尝试惩戒的应用范围，以及战斗双方同约束、单次判定、费用、距离、持续与贡献均是G，不是已核原著统一规定。阿伦保持当前选择并实际迈步才算观察到越线，不凭计划或指控奖励惩戒；不为练习制造真实伤势。本人同意只限本次练习，不是永久服从或魔法的普遍条件。和平100有真实行动、收束和报告代价，不保证一般安全消化；不获得官方身份或组织归属，也不取得序列4能力剥夺。';
export const PUNISHMENT_KNIGHT_FORMULA_STATUS = '惩戒骑士完整配方、主辅材料及其用量、调配顺序与6→5晋升仪式细节尚未核实，不能据未知细节断言无需仪式。本作原创G渠道只交付独立成品原瓶；同一位原成年民间调解文书员薇娜·贝尔实际核对本次原瓶、准备原调解处安静服药位置并在场照护。这是明确的G准备流程，不冒充已还原原著仪式，也不解锁配方、材料采购或调配。此前仲裁人、治安官、审讯者与法官的原瓶、晋升周、实践、原物去向、原能力和敌人结果完整保留。';
export const PUNISHMENT_KNIGHT_POTION_SOURCES = PUNISHMENT_KNIGHT_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${PUNISHMENT_KNIGHT_GUIDE}经独立惩戒骑士成品交接渠道实际取得的第${index + 1}瓶序列5惩戒骑士成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非仲裁人、治安官、审讯者或法官旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const PUNISHMENT_KNIGHT_LABOUR_TASKS = ['核对本瓶独立封签', '整理原调解处普通存放格', '清点原软垫与普通记录用品', '校对本瓶交接日期', '完成本瓶供货凭据复核'] as const;
export const PUNISHMENT_KNIGHT_ABILITIES: { id: PunishmentKnightAbilityId; label: string; description: string }[] = [
  { id: 'justiciar.s5.punishment', label: '惩戒强化', description: '实际违反宣告后有限强化对应打击的速度和力量，不保证命中、穿甲或服从。G练习中阿伦自愿且实际越过刻意减弱的非法律训练线后，只向同一原软垫尝试惩戒；耗1行动、3灵性，以知识14判定，失败仍付。战斗仅当前敌人本回合实际违反有限禁令并作出正贡献普通打击，才为后续一次H提供花3灵性的附加贡献；玩家自己违令、MISS与OPENING均不产生此条件，轮末到期。' },
  { id: 'justiciar.s5.confinement', label: '有限囚禁', description: '短暂限制当前目标动作，可失败或挣脱，不是永久禁锢、读心或人格控制。G练习由原成年阿伦同意短暂停步并约定停词；耗1行动、3灵性，以知识14判定，失败仍付。0行动、0灵性实际解除后，由同一阿伦沿原净空短路走回；不补健康或灵性。战斗成功只使本回合下一次实际未被禁令阻止的正贡献普通敌方打击乘0.6一次，已发生攻击不追补。' },
  { id: 'justiciar.s5.wound-verdict', label: '既有伤口裁决', description: '针对当前敌人已实际记录的伤口尝试有限死亡打击，不凭空造伤，不用玩家自己的伤口替代，不是无条件死亡宣告。G实战有敌方既有伤口且敌人仍活着时耗3灵性、知识14判定，成功才提供有限攻击贡献，并继续经过共同伤势与结局盘；失败付费零贡献。无合格伤口或灵性不足，诚实回退普通自保。和平伤情记录仅普通记录既有伤势或明确未观察到伤口，不执行裁决，不伪奖能力掌握。' },
];
export const PUNISHMENT_KNIGHT_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年薇娜在场核对本次原瓶、实际准备原调解处安静位置并照护；服药必耗选定原瓶，0行动，意志难度26。服药前健康须高于20、精神须高于40，不足时先休养；法官消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。薇娜处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留法官消化与全部原掌握；成功只新增惩戒强化、有限囚禁和既有伤口裁决三项0掌握，四属性各+1，灵性上限100但当前灵性不补满。全部旧ID、原瓶、原物、实践和已解决敌人保留，必须先结束旧接触。不生成官方身份，不取得序列4能力剥夺或一句话必杀。';
