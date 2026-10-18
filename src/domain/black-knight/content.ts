import { SHEPHERD_GUIDE, SHEPHERD_VOLUNTEER } from '../shepherd/content.js';
import type { BlackKnightAbilityId } from './types.js';

/** All preparation, numbers, original people and scene objects below are game-original G. */
export const BLACK_KNIGHT_GUIDE = SHEPHERD_GUIDE;
export const BLACK_KNIGHT_VOLUNTEER = SHEPHERD_VOLUNTEER;
export const BLACK_KNIGHT_PRICES = { guidance: 540, potion: 6800, labourCredit: 5300 } as const;
export const BLACK_KNIGHT_MIN_SHEPHERD_WEEKS = 12;
export const BLACK_KNIGHT_LABOUR_STEPS = 5;
export const BLACK_KNIGHT_BOTTLE_IDS = ['black-knight-potion-1', 'black-knight-potion-2', 'black-knight-potion-3'] as const;
export const BLACK_KNIGHT_SOURCE_STATUS = '黑骑士是倒吊人途径序列4，下一序列3为三首圣堂。灵肉之刃必须实际命中，不能因能力名称宣告必杀；统御阴影须作用于目标实际存在的阴影，有限束缚身体，不读取思想或凭空操纵穿墙目标。剥离自身堕落之影会生成独立且不受本人控制的生物，不是受控宠物、免费战友，也不保证清除所有人格或精神问题。序列4同一时刻仍只驱使1个放牧原灵；本切片保留原7灵容量、每灵至多3项已选实际能力，未知增长值不另行捏造。只有实际取得的半神原灵才可能外放，当前原来源没有半神，不能把低阶原灵外放或凭空填充法术库。实际原灵的取得、所选能力、驱使与永久释放历史全部保留，已释放者不能重新取得；不赠送巫王能力、不开放序列3多灵同时驱使或三位一体。原成年导师伊森·洛弗和明确同意本次实践的成年文森沿用同一人。原灯BK4-LAMP-1、练习隔板BK4-PANEL-1、原卡BK4-CARD-1、原桶BK4-CASK-1、有限封签与独立影体BK4-SHADE-1，以及新成年对手加里克·诺尔和所有场景、距离、费用、持续时间与判定数值均为本作原创G。三项和平实践各有普通方法，不要求伤害或放牧他人以取得扮演进度。';
export const BLACK_KNIGHT_FORMULA_STATUS = '黑骑士完整配方与晋升仪式细节尚未核实；不能据未知细节断言无需仪式。材料、用量、调配顺序及仪式步骤保持未知。本作原创G渠道只提供独立成品原瓶；原成年导师伊森·洛弗实际核对本次原瓶、准备原旧物间安静服药位置并在场照护，再指导本次服药。这是明确的G专业准备流程，不冒充已还原原著仪式，不解锁完整配方、材料采购或魔药调配。秘祈人、倾听者、隐修士、蔷薇主教与牧羊人的原瓶、原动物来源份额、储备、真实原灵及实践历史完整保留。';
export const BLACK_KNIGHT_POTION_SOURCES = BLACK_KNIGHT_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${BLACK_KNIGHT_GUIDE}经独立黑骑士成品交接渠道实际取得的第${index + 1}瓶序列4黑骑士成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非秘祈人、倾听者、隐修士、蔷薇主教或牧羊人旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const BLACK_KNIGHT_LABOUR_TASKS = ['核对本瓶独立封签', '整理原旧物间公开交接册', '清点原附室普通器具', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const BLACK_KNIGHT_ABILITIES: { id: BlackKnightAbilityId; label: string; description: string }[] = [
  { id: 'hanged-man.s4.flesh-soul-blade', label: '灵肉之刃', description: '自身能力，实际施用支付5灵性。和平练习必须真正触及同一隔板，留下真实切口，停止能力不修复物件。实战只有实付并产生正贡献的攻击才能对本场已确定怀有恶意的原对手有限突破一项防护；仍须共同胜负与伤势结算，不承诺命中、必杀或扫描所有人的道德。' },
  { id: 'hanged-man.s4.shadow-command', label: '统御真实阴影', description: '自身能力，4灵性、知识18，本有限G现场须原灯实际点亮、同一身体与阴影确实在范围内。成功有限束缚，抵抗会失败且成本照付；和平实践60秒并须明确解除，实战只减半本轮下一次正贡献身体攻击。不是精神控制、无限距离或穿墙操作。' },
  { id: 'hanged-man.s4.fallen-shadow', label: '独立堕落之影', description: '可选原创G支线中，先实际取得180便士的有限容器与封签、普通步行进入原空室，并独立确认本次角色冲动；花1行动、5灵性、5精神后只生成一次同一独立影体。它自主移动并熄灭原灯，不听命令。必须实际封入同一原桶、本人走回再交给导师，或普通步行出门后耗唯一紧急封签永久隔离原房；失败、破损与影体都持续存在。不会自动消失或保证人格净化，不加入战斗宠物栏。' },
];
export const BLACK_KNIGHT_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年导师在场核对本次原瓶、实际准备原旧物间安静位置并照护；服药必耗选定原瓶，0行动，意志难度28。服药前健康须高于20、精神须高于40，牧羊人消化100且晋升后满12整周，并先结束旧实践、新接触、事件和战斗。大成功：晋升、精神−4；成功：晋升、精神−8、灵性−15（最低0）；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。仅本次G指导服药的健康与精神最低保留1，导师照护后仍须休养；原瓶不会复原，此保护不适用于战斗或其它危险。失败保留牧羊人消化与全部旧掌握；成功四属性各+1，只新增灵肉之刃、统御阴影、堕落之影三项0掌握，扮演从0开始，牧羊人消化100快照保留，灵性上限120且当前灵性不补满。身体与性别不变化；全部旧ID、原瓶、已放牧原灵、当前一灵选择、永久释放、原份额与储备和旧敌人生死完整保留。不赠半神原灵、外放身体、额外食物、巫王法术或序列3能力。';
