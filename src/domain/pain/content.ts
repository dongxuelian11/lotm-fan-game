import { PLEASURE_GUIDE } from '../pleasure/content.js';
import type { PainAbilityId } from './types.js';
export { PAIN_CASE_IDS } from './types.js';

/** Verified supernatural boundaries are distinct from original G procedures and prices. */
export const PAIN_GUIDE = PLEASURE_GUIDE;
export const PAIN_VOLUNTEER = '成年演员拉维妮';
export const PAIN_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200 } as const;
export const PAIN_MIN_PLEASURE_WEEKS = 12;
export const PAIN_LABOUR_STEPS = 5;
export const PAIN_BOTTLE_IDS = ['pain-potion-1', 'pain-potion-2', 'pain-potion-3'] as const;
export const PAIN_SOURCE_STATUS = '第三部第97章支持序列5痛苦魔女在一定范围内施加并随战斗持续加深的超自然疾病，原有隐身、诅咒、镜子或魔杖替身、黑焰、冰霜与丝线继续继承。第四部第113章约50米、20至30秒严重及2至3分钟可能死亡，是蠕动的饥饿放牧能力的特定展示，不作为所有新晋序列5统一半径或必死计时。第三部第100章展示发热、肺部不适与咳嗽可妨碍准备中的攻击；本场普通持棍者没有法术，不伪造施法中断。完整无症状时长、穿墙与友军免疫没有核实，不作保证；离开施加范围不等于已感染者自动痊愈。第四部第177章有限治疗的情境不能变成万能免疫。序列4绝望的神话形态、污染与更大范围瘟疫不提前下放。原女巫身体与性别变化保留，本次不再发生第二次身体转变。原成年导师诺艾拉·温瑟、成年拉维妮、原练习场四米撤离路线、原木标PN5-MARKER-1、虚构情境卡PN5-CASE-NOTES-1、原纸张PN5-CARE-NOTE-1、成品渠道、费用、成熟周数与全部数值为本作原创G。三项和平实践只作双方明确同意的普通模拟，拉维妮未患病、不向她施加疾病、不冒充治疗或实际疾病能力掌握；和平扮演100是有限G替代路线，不宣称复原完整原著扮演。可选实战的真实疾病后果另行持久记录，停播散和离场不抹去既有病势。';
export const PAIN_FORMULA_STATUS = '痛苦魔女完整配方、主辅材料及其用量、调配顺序与晋升仪式细节尚未核实，不能据未知细节断言无需仪式；没有以片段材料拼成完整配方。本作原创G渠道只交付独立成品原瓶；同一位原成年导师诺艾拉·温瑟实际核对本次原瓶、准备原独立练习场安静服药位置并在场照护。这是明确的G准备流程，不冒充已还原原著仪式，也不解锁配方、材料采购或调配。此前欢愉魔女七项已知配方及其原材料、原瓶与调配历史完整保留。';
export const PAIN_POTION_SOURCES = PAIN_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${PAIN_GUIDE}经独立痛苦魔女成品交接渠道实际取得的第${index + 1}瓶序列5痛苦魔女成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非刺客、教唆者、女巫或欢愉魔女旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const PAIN_LABOUR_TASKS = ['核对本瓶独立封签', '整理原练习场公开交接册', '清点原练习场普通标记', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const PAIN_ABILITIES: { id: PainAbilityId; label: string; description: string }[] = [
  { id: 'assassin.s5.disease', label: '渐进的超自然疾病', description: '对确实位于当前有限现场的目标施加超自然疾病，持续接触可使其加深。本作G可选实战支付4灵性、知识14成功后才启动范围并使原对手病势1；之后每个新回合非防御姿态实付2灵性，病势最多3，对其实际正贡献身体攻击作一次病势修正。防御明确停止继续播散，现有病势保留；缺灵性、撤退或失去意识也停止维持，但没有免费治愈、直接扣血或自动死亡。空院确实无人旁观，不代表友军天然免疫。和平练习只比较纯虚构记录并实际撤离、递交纸张，不传播疾病、不提供现实病原体或医疗操作。' },
];
export const PAIN_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年导师在场核对本次原瓶、实际准备原独立练习场安静位置并照护；服药必耗选定原瓶，0行动，意志难度26。服药前健康须高于20、精神须高于40，不足时先休养；欢愉魔女消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。诺艾拉·温瑟处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留欢愉魔女消化及全部原掌握；成功仅新增assassin.s5.disease一项0掌握，四属性各+1，灵性上限100但当前灵性不补满。原女巫身体变化保持原样，不发生第二次身体转变；全部旧ID、原材料、原瓶、原粉剂与镜子、蛛丝练习、拒绝与已解决敌人记录完整保留。';
