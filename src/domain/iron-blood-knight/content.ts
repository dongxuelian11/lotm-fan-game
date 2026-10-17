import { REAPER_GUIDE } from '../reaper/content.js';
import type { IronBloodKnightAbilityId } from './types.js';

export const IRON_BLOOD_KNIGHT_GUIDE = REAPER_GUIDE;
export const IRON_BLOOD_KNIGHT_PRICES = { guidance: 500, potion: 6200, labourCredit: 5400, rite: 120 } as const;
export const IRON_BLOOD_KNIGHT_MIN_REAPER_WEEKS = 12;
export const IRON_BLOOD_KNIGHT_LABOUR_STEPS = 5;
export const IRON_BLOOD_KNIGHT_BOTTLE_IDS = ['iron-blood-knight-potion-1', 'iron-blood-knight-potion-2', 'iron-blood-knight-potion-3'] as const;
export const IRON_BLOOD_KNIGHT_FORMULA_STATUS = '铁血骑士完整主辅材料、用量和完整调配安排尚未核实，保持未知。指导不解锁虚构配方、材料采购或调配；本次采用本作原创G渠道实际供应的序列4独立成品原瓶。已知至少30人共同成长的真实队伍仪式仍须完成，成品魔药不能替代仪式。';
export const IRON_BLOOD_KNIGHT_RITUAL_SOURCE = '《诡秘之主》第五部第177章已核：组建至少30人的队伍，与成员培养深厚战友情谊，令成员逐渐强大，凭眼神和动作密切配合、近于一体，由实际成员组成仪式。不能购买名册或以一次课堂替代共同成长。本作G使用30位独立原创成人、六个五人小组、多周救援、守望、无声信号及两次全队演练；次数、六整周成熟期和费用为G解释，不是原著固定参数。';
export const IRON_BLOOD_KNIGHT_BODY_CHANGE = '独立身体变化确认：本次真正晋升成功时，原女性身体会变为男性；原男性或其他已记录身体性别保持原样。服药失败不改变身体性别。原创建资料、旧人物关系与已有经历不会重写。所有角色都须另行明确接受本次身体变化规则，再确认饮药。';
export const IRON_BLOOD_KNIGHT_SOURCE_STATUS = '第五部第144章已核铁血骑士可操控多种火焰，令自身火焰化、钢铁化；原女性身体在晋升后变为男性。资深叶戈尔能汇聚建立真实联系的成员力量，并把负担分给实际成员、借联系交流及借用真实成员视野。初晋范围、连接数、分摊比例和成本尚无已核固定参数，本阶段均标本作G；仅有当前实际到场与同意的原成员参与。没有免疫、凭空军队、全军自动强化、传送或提前获得战争主教3。';
export const IRON_BLOOD_KNIGHT_POTION_SOURCES = IRON_BLOOD_KNIGHT_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${IRON_BLOOD_KNIGHT_GUIDE}从独立铁血骑士成品交接渠道实际取得的第${index + 1}瓶序列4成品魔药，独立封存原瓶${id}；渠道与供给为本作原创G，非猎人至收割者旧瓶改装，完整配方保持未知，真实队伍仪式另行完成。`,
}));
export const IRON_BLOOD_KNIGHT_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶原交接箱及旧封签', '整理原货栈本批到货清单', '核查本瓶运输与收货凭据', '完成本瓶独立供货复核'] as const;
export const IRON_BLOOD_KNIGHT_ABILITIES: { id: IronBloodKnightAbilityId; label: string; description: string }[] = [
  { id: 'hunter.s4.flame-steel', label: '火焰与钢铁形态', description: '令自己的同一具原身体进入火焰或钢铁形态。有限训练使用真实可达路段或可控重物，结束必须退出形态；没有免伤、传送、穿墙或自由飞行保证。具体成本与有限效果为G。' },
  { id: 'hunter.s4.comrade-link', label: '真实同伴联结', description: '与已建立关系、同意且实际到场的原成员建立联系，汇聚实际力量或按本作G有界规则分担实际伤害。成员真实支付健康和精力，解除联系不回满；30人仪式不等于随时拥有30名免费帮手。' },
];
export const IRON_BLOOD_KNIGHT_CONSUMPTION_RISK = '以下数值均为本作G：收割者扮演100、晋升收割者后12整周、健康>20且精神>40，以及当前30位合格原成员实际组成的仪式，才可0行动独立确认饮药与身体变化。意志难度28，所选原瓶与本次集合必消耗。大成功：晋升、精神−8；成功：晋升、精神−15；失败：未晋升、健康−15、精神−25、排异+30；灾难：中断晋升、健康−25、精神−45、排异+60。现场监督只将此次药物排异后的健康和精神保底到1，不保护实际战斗。失败保留队伍共同经历，但须另付1行动与120便士重新集合。成功四属性各+1，旧能力掌握全部保留，仅两项新掌握从0开始；灵性上限120，当前灵性不补满。';
