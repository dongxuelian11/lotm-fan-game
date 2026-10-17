import { DAWN_PALADIN_GUIDE } from '../dawn-paladin/content.js';
import type { GuardianAbilityId } from './types.js';
export { GUARDIAN_CASE_IDS } from './types.js';

/** Canonical boundaries stay separate from this slice's original G people, costs and scenes. */
export const GUARDIAN_GUIDE = DAWN_PALADIN_GUIDE;
export const GUARDIAN_PRICES = { guidance: 460, potion: 4800, labourCredit: 4200 } as const;
export const GUARDIAN_MIN_DAWN_PALADIN_WEEKS = 12;
export const GUARDIAN_LABOUR_STEPS = 5;
export const GUARDIAN_BOTTLE_IDS = ['guardian-potion-1', 'guardian-potion-2', 'guardian-potion-3'] as const;
export const GUARDIAN_SOURCE_STATUS = '第二部第98章支持序列5守护者在放弃攻击时进入防御极强的守护状态，对各类攻击具有强大防护；主动攻击会降低防御，不能一边维持完整守护一边伤害敌人。守护者不被幻术迷惑，并能替附近同伴承担伤害；这不是读心、自动识别邪恶或任意远程替伤。原文未给出精确防御比例、伤害分担比例或距离，本段3灵性、3米范围、半数分担与全部判定均为原创G。晨曦、晨曦铠甲、晨曦武器与光之风暴继承序列6原能力ID和掌握，不另送光剑、光甲或永久无伤。序列4猎魔者的邪恶与污染辨识、隐藏意图识别、怪物弱点及材料知识、针对性药膏和神话形态不提前下放。原成年导师奥斯温·布莱克特、原成年院工维拉（Vera Edridge）、本人新同意、三处不同的原软垫摆锤、唯一原纸靶GD5-TARGET-1、实际2米到场与返程、成品渠道、成熟周数、费用和数值均为本作原创G。6健康仅是本次低强度安全探测的G基线，不代表真实武器的固定伤害。准备仅约定本次安排，维拉尚在相邻等待点；实施时才沿原2米标线走入现场，结束时实际沿原路走回。失败仍保留实际伤害，退出不治疗，也不补造原器具。旧战士、格斗家、武器大师与黎明骑士历史、借棍物权和已解决敌人的后果均保持。';
export const GUARDIAN_FORMULA_STATUS = '第三部第171章确认石巨人的核心为守护者魔药已知主材料；这一条目不是完整配方。完整配方、其余材料、辅助材料用量、调配顺序与晋升仪式细节尚未核实，不能据未知细节断言无需仪式。本作原创G渠道只提供独立成品原瓶；原成年导师奥斯温·布莱克特实际核对本次原瓶、准备原训练场安静服药位置并在场照护。这是明确的G准备流程，不冒充已还原原著仪式，也不解锁配方、材料采购或调配。';
export const GUARDIAN_POTION_SOURCES = GUARDIAN_BOTTLE_IDS.map((id, index) => ({
  id,
  source: `${GUARDIAN_GUIDE}经独立守护者成品交接渠道实际取得的第${index + 1}瓶序列5守护者成品魔药，独立封存原瓶${id}；渠道与供给均为本作原创G，非战士、格斗家、武器大师或黎明骑士旧瓶改装，未声称掌握完整配方或还原晋升仪式。`,
}));
export const GUARDIAN_LABOUR_TASKS = ['核对本瓶独立封签', '整理原训练场公开交接册', '清点原训练场普通隔栏', '复核本瓶原交付凭据', '完成本瓶供货记录核验'] as const;
export const GUARDIAN_ABILITIES: { id: GuardianAbilityId; label: string; description: string }[] = [
  { id: 'warrior.s5.guard-state', label: '放弃攻击的守护状态', description: '放弃攻击时获得对各类攻击的极强防御，攻击时防御降低。本段原低强度摆锤试验支付3灵性、意志14：守护成功将G基线6健康损失降为1，失败仍实际承受2；主动攻击原纸靶时实际受3健康损失。战斗选择防御表示本整轮放弃所有攻击，实付3灵性后仅对实际敌方直接攻击贡献作一次G防护；没有免费反击或无敌保证。不会被幻术迷惑是被动能力边界，不提供读心或自动邪恶标签。' },
  { id: 'warrior.s5.damage-sharing', label: '附近同伴伤害分担', description: '可替实际在附近的同伴承担伤害，不是远程治疗或凭空召来同伴。本段原创G仅对本次自愿到场、沿原路走入2米标记的成年维拉，以3灵性、意志14尝试分担原低强度6健康探测：成功由你承担3、她承担3，失败你不分担、她实际承担6。伤害与距离逐次保留，0行动结束让她实际沿原2米路线返回等待点，不恢复任何人的健康；无同伴的可选战斗不伪造分担。' },
];
export const GUARDIAN_CONSUMPTION_RISK = '以下准备、时间、代价与判定均为原创G：原成年导师在场核对本次原瓶、实际准备原训练场安静位置并照护；服药必耗选定原瓶，0行动，意志难度26。服药前健康须高于20、精神须高于40，不足时先休养；黎明骑士消化100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。奥斯温·布莱克特处理本次指导服药的排异，不随机即死；休养可恢复，原瓶不会复原。保护不适用于战斗或其它危险。失败保留黎明骑士消化及全部原掌握；成功只新增守护状态与附近同伴伤害分担两项0掌握，四属性各+1，灵性上限100但当前灵性不补满。全部旧ID、四项黎明骑士能力、原物权、原借还历史与已解决敌人记录保持不变。';
