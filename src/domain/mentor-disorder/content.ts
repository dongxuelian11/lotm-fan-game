import { CORRUPTION_BARON_GUIDE } from '../corruption-baron/content.js';
import type { MentorDisorderAbilityId } from './types.js';
export { MENTOR_DISORDER_CASE_IDS } from './types.js';

/** The named original objects, scenes and all numeric procedures are original G content. */
export const MENTOR_DISORDER_GUIDE = CORRUPTION_BARON_GUIDE;
export const MENTOR_DISORDER_CLERK = '核册员伊芙';
export const MENTOR_DISORDER_VOLUNTEER = '成年递送员赛恩';
export const MENTOR_DISORDER_RED_COUNTER_ID = 'MD5-RED-1';
export const MENTOR_DISORDER_BLUE_COUNTER_ID = 'MD5-BLUE-1';
export const MENTOR_DISORDER_ROUTE_MARKER_ID = 'MD5-ROUTE-MARKER';
export const MENTOR_DISORDER_NOTE_ID = 'MD5-NOTE-1';
export const MENTOR_DISORDER_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200 } as const;
export const MENTOR_DISORDER_MIN_CORRUPTION_BARON_WEEKS = 12;
export const MENTOR_DISORDER_LABOUR_STEPS = 5;
export const MENTOR_DISORDER_BOTTLE_IDS = ['mentor-disorder-potion-1', 'mentor-disorder-potion-2', 'mentor-disorder-potion-3'] as const;
export const MENTOR_DISORDER_SOURCE_STATUS = '混乱导师是黑皇帝途径序列5，承接腐化男爵6，下一阶为堕落伯爵4。第四部第76章末至第77章支持混乱已有移动方向与实际飞行轨迹；横向移动变为前向、风刃轨迹散乱，不等于任意改写世界规则、瞬移或无条件控制人格。原著一次尝试摆脱附身未能及时奏效，不能据此承诺自动免疫。第五部第87章区分6扭曲、5混乱与4赋予、放大、利用；建筑尺度改变和延长、终结或放大现有效果不作为本次序列5基础能力。三分钟后的自身混乱是特定手套负面效果，不是混乱导师通用代价；不继承其它封印物的随机魔法异变。律师、野蛮人、贿赂者和腐化男爵全部实际能力、原ID掌握与限制保留，仅新增black-emperor.s5.disorder。原契约铺米蕾·沃德、核册员伊芙、成年递送员赛恩、成年里斯、两原筹MD5-RED-1与MD5-BLUE-1、各自原封边软盘、原路线标记MD5-ROUTE-MARKER及原纸MD5-NOTE-1均为原创G。准备、距离、判定、持续、费用和减势比例均为G。本人同意只限本次有限练习，不是魔法的普遍条件；不生成组织身份。和平100有真实行动、收束和报告代价，不是原著保证的安全消化法。';
export const MENTOR_DISORDER_FORMULA_STATUS = '混乱导师完整配方、主辅材料及其用量、调配顺序与6→5晋升仪式细节尚未核实，不能据未知细节断言无需仪式。本作原创G渠道只交付独立成品原瓶；同一位原成年导师米蕾·沃德实际核对本次原瓶、准备原契约铺安静服药位置并在场照护。这是明确的G准备流程，不冒充已还原原著仪式，也不解锁配方、材料采购或调配。此前律师、野蛮人、贿赂者与腐化男爵的原瓶、晋升周、实践、原物去向、原能力和敌人结果完整保留。';
export const MENTOR_DISORDER_POTION_SOURCES = MENTOR_DISORDER_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${MENTOR_DISORDER_GUIDE}经独立混乱导师成品交接渠道实际取得的第${index + 1}瓶序列5混乱导师成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非律师、野蛮人、贿赂者或腐化男爵旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const MENTOR_DISORDER_LABOUR_TASKS = ['核对本瓶独立封签', '整理原契约铺公开交接册', '清点原封边软盘与普通记录用品', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const MENTOR_DISORDER_ABILITIES: { id: MentorDisorderAbilityId; label: string; description: string }[] = [
  { id: 'black-emperor.s5.disorder', label: '有限混乱', description: '短暂混乱已有动作方向与实际轨迹，范围和强度均有限，可失败。本次G原双筹练习与成年赛恩自愿路线练习各耗1行动、3灵性，以知识14判定；失败照付，原物仍留在各自原软盘，赛恩自行安全停止。0行动、0灵性可实际收回两原筹到原红蓝格，或停止影响、由赛恩自行普通走回原起点并收回原路线标记。普通方法仅是实际挡板操作或口头说明，不冒充非凡效果。实战花3灵性、知识14，成功只使本回合下一次实际正贡献普通身体打击乘0.6一次，失败无减势；已发生的攻击不追补，MISS或OPENING不消耗混乱，轮末及终局到期。不控制全部意愿、穿墙、自动消除其它能力或取得序列4赋予、放大、利用。' },
];
export const MENTOR_DISORDER_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年米蕾在场核对本次原瓶、实际准备原契约铺安静位置并照护；服药必耗选定原瓶，0行动，意志难度26。服药前健康须高于20、精神须高于40，不足时先休养；腐化男爵消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。米蕾处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留腐化男爵消化与全部原掌握；成功仅新增black-emperor.s5.disorder一项0掌握，四属性各+1，灵性上限100但当前灵性不补满。全部旧ID、原瓶、原物、实践和已解决敌人保留，必须先结束旧接触。不下放序列4赋予、放大、利用、建筑尺度变化或世界规则改写，也不把特定手套的三分钟负面当作通用序列代价。';
