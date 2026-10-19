import { BLOOD_DUKE_ABILITIES, BLOOD_DUKE_INHERITED_ABILITIES } from '../blood-duke/content.js';
import type { UncleanMonarchAbilityId, UncleanMonarchPreparationId, UncleanMonarchPrices } from './types.js';

/** Canon names 污秽君王 at L236633–635, with a jointly inferred Abyss S1 mapping;
 * no independent numbered phrase, complete formula, ritual or ordinary skill
 * set is established. These finite game methods are original G, not global
 * corruption, blood control, resurrection or powers borrowed from a deity. */
export const UNCLEAN_MONARCH_GUIDE = '原安静室旁的专业交接处';
export const UNCLEAN_MONARCH_PRICES = { guidance: 500, potion: 7200, labourCredit: 6000, labourBalance: 1200, preparation: 180, resupply: 100 } as const;
export const uncleanMonarchPrices = (): UncleanMonarchPrices => UNCLEAN_MONARCH_PRICES;
export const uncleanMonarchSourceLabel = (): string => `${UNCLEAN_MONARCH_GUIDE}的独立污秽君王成品渠道`;
export const UNCLEAN_MONARCH_MIN_BLOOD_DUKE_WEEKS = 12;
export const UNCLEAN_MONARCH_LABOUR_STEPS = 5;
export const UNCLEAN_MONARCH_BOTTLE_IDS = ['unclean-monarch-potion-1', 'unclean-monarch-potion-2', 'unclean-monarch-potion-3'] as const;
export const UNCLEAN_MONARCH_POTION_SOURCES = UNCLEAN_MONARCH_BOTTLE_IDS.map(id => ({ id, source: `尚未当面登记来源的污秽君王独立封存原瓶${id}；原瓶分别交付和耗用。` }));
export const uncleanMonarchPotionSource = (number: number, week: number): string => `${uncleanMonarchSourceLabel()}第${Math.ceil(number / 3)}批、第${week}周实际登记的第${number}瓶序列1成品，独立封存编号unclean-monarch-potion-${number}；本瓶独立劳动、交付与耗用，不补回旧瓶。`;
export const UNCLEAN_MONARCH_FORMULA_STATUS = '专业交接处只交付独立封存的污秽君王成品，不提供完整配方或自行调配方案。先核对罪犯至鲜血大公八阶真实经历、同一原安静室与卡铃纸，检查自身冲动和当场情绪的有限边界，并亲自走查停止和普通返程。三项准备完成后，另付费用检查本周服药场地，再独立确认饮用所选原瓶。也可以停留在鲜血大公阶段。';
export const UNCLEAN_MONARCH_SOURCE_STATUS = '继续使用同一安静房间、46岁的诺拉、罗安、原卡、原铃与原记录。本人从入口走4米到诺拉，再走4米到原铃；原卡须当面借还，门始终可普通通行。每案重新取得当次可撤回许可，实际购入一件单次耗材。记录诺拉在这些事务中实际付出的协作耗力；单纯询问许可不耗力，实际协作每案耗3，累计至多12。原良知变化、恶魔紧绷、旧伤与对手结果继续保留。';
export const UNCLEAN_MONARCH_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const UNCLEAN_MONARCH_PREPARATIONS: { id: UncleanMonarchPreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_ORIGINALS', title: '核对八阶经历与同一原物', description: '逐一核对真实晋升、失败原瓶、鲜血大公三份报告与反思，以及同一原安静室、诺拉、罗安、原卡、原铃与原记录。原良知变化、恶魔紧绷、旧人物伤势与生死全部留存。' },
  { id: 'CHECK_LIMITS', title: '检查自身冲动与当场情绪边界', description: '冲动收束只作用于本人此刻实际存在的匆忙冲动；定向扰动只以当事人已表现且确认仍在的强烈情绪为入口。生活协作须另得当次明确许可，拒绝和撤回始终有效；不能凭空创造情绪、改写想法或强迫邀请。' },
  { id: 'CHECK_RETURN', title: '走查停止、归物与普通返程', description: '本人实查可撤回许可、停止短窗、当面归还原卡和新耗材，以及入口至诺拉4米、诺拉至原铃4米的普通路线。已用成本不退；服药照护只处理本次排异，不治疗旧伤。' },
];
export const UNCLEAN_MONARCH_ABILITIES: { id: UncleanMonarchAbilityId; label: string; description: string }[] = [
  { id: 'abyss.s1.impulse-binding', label: '冲动收束', description: '支付8灵性与2精神，先实际察觉本人在原卡任务中刚产生的匆忙冲动，再作意志18检定。成功开启20秒一次窗口，下一次知识20的原物核对按有限基础能力增加35，仍会失败；实战只增益下一次本人普通攻击35。实际应用才耗1耗材与1磨损，失败总计损4精神。移动、停止、撤回或到期会清除未用窗口，成本不退。' },
  { id: 'abyss.s1.focused-interference', label: '定向扰动', description: '支付8灵性与2精神，以当次自愿敲铃后已确认的强烈紧张为入口，作意志18检定。成功开启20秒一次窗口，将下一次已在进行、可观察的敲击或打断压力由45降到15，最多减少30；实战须面对目标抵抗，仅减少下一次可见身体或精神攻击30。实际应用才耗1耗材与1磨损；失败总计损4精神。不会改写想法、感情或邀请选择，撤回、遮挡、移动、普通冷静与到期均可结束作用。' },
];
export const UNCLEAN_MONARCH_INHERITED_ABILITIES = [...BLOOD_DUKE_INHERITED_ABILITIES, ...BLOOD_DUKE_ABILITIES];
export function uncleanMonarchConsumptionRisk(): string {
  return '鲜血大公消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与180便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与当次准备耗尽，专业照护只将本次排异后的健康精神保底到1。成功四属性各+1，16项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满，性别与既有身体保持。全批失败耗尽后，实付1行动与100便士申请独立三瓶，至少跨一真实周领取；每瓶另做五次劳动并付1200便士，或直接支付7200便士。';
}
export const UNCLEAN_MONARCH_CONSUMPTION_RISK = uncleanMonarchConsumptionRisk();

/** Schema221 adds paid same-original recovery; the old risk string stays immutable for archived receipts. */
export const UNCLEAN_MONARCH_RECOVERY_SCHEMA_VERSION = 221;
export const UNCLEAN_MONARCH_RECOVERY_SITE_ID = 'BACKLUND_ORIGINAL_UNCLEAN_MONARCH_PREPARATION' as const;
export const UNCLEAN_MONARCH_RECOVERY_PRICES = { recovery: 120, recoveryHandover: 30, recoveryDrug: 900, recoveryLabourBalance: 90 } as const;
export const UNCLEAN_MONARCH_CURRENT_CONSUMPTION_RISK = UNCLEAN_MONARCH_CONSUMPTION_RISK.replace(
  '全批失败耗尽后，实付1行动与100便士申请独立三瓶，至少跨一真实周领取；每瓶另做五次劳动并付1200便士，或直接支付7200便士。',
  '最初三瓶全部失败耗尽后，只能在原服药准备与支持交接处以1行动和120便士调查同一原特性的归属与位置，经保管方本次许可实际核验封存；至少下一真实周以1行动和30便士当面交接。新普通药物与调配服务900便士，或五项新劳动后90便士；当周检查仍另付1行动和180便士。失败残留不会自动回收，旧瓶、原失败与旧成本不改写，不再供应第四份原特性。可另付60便士、8灵性、6精神为所选同瓶准备同场当周支持，0行动，意志临时+13；仍可能失败，换瓶、退出或跨周失效，已付成本不退。',
);

export const UNCLEAN_MONARCH_PROMOTION_SUPPORT = { cash: 60, spirituality: 8, mind: 6, bonus: 13 } as const;
