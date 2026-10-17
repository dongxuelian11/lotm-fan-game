import { ANCIENT_EVIL_ABILITIES, ANCIENT_EVIL_INHERITED_ABILITIES } from '../ancient-evil/content.js';
import type { AbominationAbilityId, AbominationPreparationId, AbominationPrices } from './types.js';

/** Canon directly identifies Chained S1 神孽 at L183176/L217025. The source
 * supports an individual spiritual barrier (L216455), a cry with stiffening
 * (L216465), and a resisted possession attempt (L216572). The finite practice
 * below is original implementation, not universal control, a fixed 2000m
 * radius, a deity's authority, a faith system, or a complete formula/ritual. */
export const ABOMINATION_GUIDE = '原安静室旁的专业交接处';
export const ABOMINATION_PRICES = { guidance: 500, potion: 7200, labourCredit: 6000, labourBalance: 1200, preparation: 180, resupply: 100 } as const;
export const abominationPrices = (): AbominationPrices => ABOMINATION_PRICES;
export const abominationSourceLabel = (): string => `${ABOMINATION_GUIDE}的独立神孽成品渠道`;
export const ABOMINATION_MIN_ANCIENT_EVIL_WEEKS = 12;
export const ABOMINATION_LABOUR_STEPS = 5;
export const ABOMINATION_BOTTLE_IDS = ['abomination-potion-1', 'abomination-potion-2', 'abomination-potion-3'] as const;
export const ABOMINATION_POTION_SOURCES = ABOMINATION_BOTTLE_IDS.map(id => ({ id, source: `尚未当面登记来源的神孽独立封存原瓶${id}；原瓶分别交付和耗用。` }));
export const abominationPotionSource = (number: number, week: number): string => `${abominationSourceLabel()}第${Math.ceil(number / 3)}批、第${week}周实际登记的第${number}瓶序列1成品，独立封存编号abomination-potion-${number}；本瓶独立劳动、交付与耗用，不补回旧瓶。`;
export const ABOMINATION_FORMULA_STATUS = '专业交接处只交付独立封存的神孽成品，不提供完整配方或自行调配方案。先核对囚犯至古代邪物八阶真实经历、同一原安静室与原衣包盘纸，检查局部精神束障和短促震声的有限边界，并亲自走查停止与普通返程。三项准备完成后，另付费用检查本周服药场地，再独立确认饮用所选原瓶。也可以继续作为古代邪物生活。';
export const ABOMINATION_SOURCE_STATUS = '继续使用同一安静房间、43岁的埃尔莎、哈伦、原衣物、原包、原私密托盘与原记录。埃尔莎起初在室外，须先邀请，再由她实际沿室外、门口、四米处行走八米；原衣与包随同一主人移动。本人从门口走四米到原盘，再走四米到原纸，逐段普通返回。每案重新取得可撤回许可，实际购入一件单次耗材及其唯一测试来源；实际协作每案耗力3，只记录本阶段累计至多12。旧身体、伤势、木块耗尽、莱娜死亡与卡尔德投降继续留存。';
export const ABOMINATION_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const ABOMINATION_PREPARATIONS: { id: AbominationPreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_ORIGINALS', title: '核对八阶经历与同一原物', description: '逐一核对真实晋升、失败原瓶、古代邪物三份报告与反思，以及同一原安静室、原埃尔莎、哈伦、原衣物、原包、原盘与原纸。原身体、原伤、已耗尽的三块旧木块、莱娜死亡和卡尔德投降不改写。' },
  { id: 'CHECK_LIMITS', title: '检查局部束障与短促震声边界', description: '束障只用于下一次已知、可见的局部精神测试，不能抵挡身体攻击。震声只尝试延迟埃尔莎已明确同意、尚未执行的手势三秒，须经过真实抵抗；不能控制想法、信仰或整个身体。拒绝与撤回始终有效，已经施加的三秒仍须实际等待。' },
  { id: 'CHECK_RETURN', title: '走查停止、归物与普通返程', description: '本人实查门口至原盘四米、原盘至原纸四米的路线，确认停止输入、拿回并归还新耗材、逐段普通离场的次序。原衣与包仍随同一埃尔莎，不复制旧物；已用成本不退，服药照护只处理本次排异，不治疗旧伤。' },
];
export const ABOMINATION_ABILITIES: { id: AbominationAbilityId; label: string; description: string }[] = [
  { id: 'chained.s1.spirit-barrier', label: '灵性束障', description: '支付8灵性与2精神，意志18检定；失败总计损4精神。成功建立20秒一次局部精神窗口，下一次已知可见的精神压力由45降至15，最多减少30，身体攻击不受影响。生活试验须亲站原盘旁、亲读原纸并放好一件带唯一测试源的新耗材，实际应用才耗1束障充能与1磨损；移动、遮挡、撤回、停止或到期会清除未用窗口，成本不退。' },
  { id: 'chained.s1.brief-cry', label: '短促震声', description: '支付8灵性与2精神，意志18检定成功后还须经过当事人45%的真实抵抗；失败成本保留。须当次明确同意、亲见同一埃尔莎及她已准备但尚未执行的手势。成功只让这一手势实际延迟三秒，耗1声片充能与1磨损；可逐秒等待至手势执行一次。撤回阻止新输入，已施加的延迟不消失或退款；身体、位置、想法和信仰不改写。实战仅减少下一次可见精神行动贡献30，保留其行动与成本。' },
];
export const ABOMINATION_INHERITED_ABILITIES = [...ANCIENT_EVIL_INHERITED_ABILITIES, ...ANCIENT_EVIL_ABILITIES];
export function abominationConsumptionRisk(): string {
  return '古代邪物消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与180便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与当次准备耗尽，专业照护只将本次排异后的健康精神保底到1。成功四属性各+1，19项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满，性别与既有身体保持。全批失败耗尽后，实付1行动与100便士申请独立三瓶，至少跨一真实周领取；每瓶另做五次劳动并付1200便士，或直接支付7200便士。';
}
export const ABOMINATION_CONSUMPTION_RISK = abominationConsumptionRisk();
