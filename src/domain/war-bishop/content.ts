import { IRON_BLOOD_KNIGHT_GUIDE } from '../iron-blood-knight/content.js';
import type { WarBishopAbilityId, WarBishopPreparationId } from './types.js';

export const WAR_BISHOP_GUIDE = IRON_BLOOD_KNIGHT_GUIDE;
export const WAR_BISHOP_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 } as const;
export const WAR_BISHOP_MIN_IRON_BLOOD_WEEKS = 12;
export const WAR_BISHOP_LABOUR_STEPS = 5;
export const WAR_BISHOP_BOTTLE_IDS = ['war-bishop-potion-1', 'war-bishop-potion-2', 'war-bishop-potion-3'] as const;
export const WAR_BISHOP_FORMULA_STATUS = '战争主教的完整配方与晋升仪式尚未核实：材料、用量、调配顺序及仪式要求保持未知，不能断言无需仪式。本阶段仅采用本作原创G专业指导与独立序列3成品渠道，不解锁虚构材料或调配。三项专业准备和当次场地检查均为G支持流程，不冒充原著仪式，更不套用序列0的大陆战争仪式。';
export const WAR_BISHOP_SOURCE_STATUS = '已核原文支持战争主教发挥实际军队优势、以血铁联系让真实所属编队协同抵抗冲击。新晋人数、距离、时限与消耗没有已核固定参数；本次只使用原队G1五位成年成员，在有限场内真实到场、当前同意并付出健康与精力。所有具体数值与新情境为本作原创G；不凭空生成军队、复制成员、授予职业身份或预先开放天气术士的天气权柄。旧猎人至铁血骑士全部原ID掌握保留。';
export const WAR_BISHOP_POTION_SOURCES = WAR_BISHOP_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${WAR_BISHOP_GUIDE}的独立战争主教成品交接渠道本作G初始批次第${index + 1}瓶序列3成品魔药，独立封存原瓶${id}；非铁血骑士或更早原瓶改装，配方和原著仪式仍未知，专业准备另行实际完成。`,
}));
export const WAR_BISHOP_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const WAR_BISHOP_PREPARATIONS: { id: WarBishopPreparationId; title: string; description: string }[] = [
  { id: 'INSPECT_ROUTE', title: '亲自踏查原场撤离路线', description: '沿原货栈到训练院的普通路线实际步行核对入口、近端与退场通道，记录本人可达的位置；不传送、不取得远处未知事实。' },
  { id: 'CHECK_EQUIPMENT', title: '实际清点原场检查器材', description: '在原场逐件核对既有座椅、照明与封存箱的状态，确认可用后归位；不取得新装备、原瓶或队友。' },
  { id: 'PLAN_SUPPORT', title: '实际演练中止与求助安排', description: '亲自走完原场中止服药、沿普通出口离开及请求现有支持的流程，写下本次可执行步骤；这是G专业准备，不完成任何原著仪式。' },
];
export const WAR_BISHOP_ABILITIES: { id: WarBishopAbilityId; label: string; description: string }[] = [
  { id: 'hunter.s3.formation-link', label: '有限编队血铁联系', description: '联系真实所属、当前同意且实际到场的原成员，在本场有限范围内协同。联系5灵性、每位2精力、最多60秒与6米均为G；原成员各自受力和受伤，没有无损抵抗或免费军队。' },
  { id: 'hunter.s3.coordinated-action', label: '原成员协同执行', description: '实际在场原成员依位置与可见信号共同搬运、接应或抵抗有限冲击。作用于不同成员的真实动作，不把所有力量汇到本人；不传送物体、不凭空获知远处信息、不共享五套免费施法。具体效果为G。' },
];
export const WAR_BISHOP_CONSUMPTION_RISK = '以下全部具体规则为本作G：铁血骑士消化100、晋4后12整周、健康>20且精神>40、三项不同的1行动专业准备完成后，另付1行动与120便士进行当周场地检查；0行动独立确认服用所选原瓶。意志难度30。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。原瓶和当次准备均消耗，三项已有专业经历保留，休养后须重新检查场地并筹另一瓶。G专业支持仅将此次药物排异后的健康和精神保底到1，不保护实际战斗或普通死亡。成功四属性各+1，旧掌握与铁血消化100保留，两项新能力掌握0；灵性上限仍120且当前不补满，身体性别不再变化。';
