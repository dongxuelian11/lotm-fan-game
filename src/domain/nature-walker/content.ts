import { BARREN_MATRIARCH_ABILITIES, BARREN_MATRIARCH_INHERITED_ABILITIES, BARREN_MATRIARCH_GUIDE } from '../barren-matriarch/content.js';
import type { NatureWalkerAbilityId, NatureWalkerPreparationId, NatureWalkerPrices } from './types.js';

/** L231911 directly names Mother S1 自然行者; L228627 names Mother S0.
 * Neither establishes the complete S1 potion formula or ritual. All finite
 * response/impact windows, costs, checks, materials and procedures below are
 * original game design. Higher-divinity or artifact resurrection is not S1.
 * The S2 body transformation already occurred and is never repeated here. */
export const NATURE_WALKER_GUIDE = `${BARREN_MATRIARCH_GUIDE}介绍的专业交接处`;
export const NATURE_WALKER_PRICES = { guidance: 500, potion: 7200, labourCredit: 6000, labourBalance: 1200, preparation: 180, resupply: 100 } as const;
export const natureWalkerPrices = (): NatureWalkerPrices => NATURE_WALKER_PRICES;
export const natureWalkerSourceLabel = (): string => `${NATURE_WALKER_GUIDE}的独立自然行者成品渠道`;
export const NATURE_WALKER_MIN_BARREN_MATRIARCH_WEEKS = 12;
export const NATURE_WALKER_LABOUR_STEPS = 5;
export const NATURE_WALKER_BOTTLE_IDS = ['nature-walker-potion-1', 'nature-walker-potion-2', 'nature-walker-potion-3'] as const;
export const NATURE_WALKER_POTION_SOURCES = NATURE_WALKER_BOTTLE_IDS.map(id => ({ id, source: `尚未当面登记来源的自然行者独立封存原瓶${id}；原瓶分别交付和耗用。` }));
export const natureWalkerPotionSource = (number: number, week: number): string => `${natureWalkerSourceLabel()}第${Math.ceil(number / 3)}批、第${week}周实际登记的第${number}瓶序列1成品，独立封存编号nature-walker-potion-${number}；本瓶独立劳动、交付与耗用，不补回旧瓶。`;
export const NATURE_WALKER_FORMULA_STATUS = '交接处只交付独立封存的自然行者成品，不提供完整配方或自行调配方案。先核对耕种者至荒芜主母八阶真实经历与同一原人原物，检查原活苗回应及本人可见冲量的有限边界，再走查停止与普通返程。三项准备完成后，另付费用检查本周服药场地，再独立确认饮用所选原瓶。已有女性身体保持，不发生新的性别变化，也可以继续作为荒芜主母生活。';
export const NATURE_WALKER_SOURCE_STATUS = '仍是同一原苗圃、46岁艾达、39岁莉娜、两株原活苗、已自然枯萎的原样、唯一原转运匣、原牌、原纸、旧护腕和唯一原根垫。本人从门口实际走四米到室外，另付40便士与1行动设置近旁相距四米的两处新标记，并取得三片有限支撑材料。原人原物须沿实路携行。逐案取得当前许可，协作每案实际耗力3、精神1；撤回立即停止新施术，可以普通照料或停止并归还原物，不倒退时间、成本和磨损。两位成年人实际离开后才可处理新的独立遭遇。原诺兰、马丁的伤势、意愿、投降与旧记录保留。';
export const NATURE_WALKER_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const NATURE_WALKER_PREPARATIONS: { id: NatureWalkerPreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_ORIGINALS', title: '核对八阶经历与同一原物', description: '核对耕种者至荒芜主母八阶真实晋升、已耗原瓶、旧报告与反思，以及同一艾达、莉娜、原活苗、原枯样、原匣、原牌、原纸、护腕和原根垫。逐一记下当前活性、原垫完整度与旧护腕各段去向，既有伤势、死亡、拒绝和投降不改写。' },
  { id: 'CHECK_LIMITS', title: '检查活苗回应与可见冲量边界', description: '生机辨应须重新观察仍活的同一原苗并核对原纸，只为本人下一次照料检定提供一次帮助。根系承冲须接触真实原根垫，只缓冲本人接下来一次可见身体或弧光冲击，最多二十秒。每次尝试支付灵性、精神与一片已购材料，失败照耗，根垫实际受力另磨损15。原活性不增加，枯样不复活，旧伤不治疗；原人保持独立意愿，撤回后停止新输入。' },
  { id: 'CHECK_RETURN', title: '走查邻近标记与普通归途', description: '核对原苗圃门口至室外四米的真实路线；近旁两处标记须另付费用并实际设置，原苗和原物由真实持有人步行携带。本人取回并当面归还原匣、牌、纸与原样，再普通离场；在购买前、灵性不足或许可撤回后都能停止、归还和步行返回。已付成本不退，服药照护只处理本次排异。' },
];
export const NATURE_WALKER_ABILITIES: { id: NatureWalkerAbilityId; label: string; description: string }[] = [
  { id: 'mother.s1.living-response', label: '生机辨应', description: '生活施术花1行动，对刚实际观察、仍活且当前许可有效的同一原苗，支付8灵性、2精神和一片已购支撑材料作知识18检定；失败总计损4精神，材料照耗。成功形成二十秒一次回应，只使本人接下来一次知识20照料检定贡献+35，真实应用才有掌握。必须核对原纸并实际照料，不让植物替人行动，不提高活性、不治疗或复活；到期、停止、换对象或撤回后不能再用。' },
  { id: 'mother.s1.root-bearing', label: '根系承冲', description: '生活施术花1行动，接触由本人实际持有的唯一原根垫，支付8灵性、2精神和一片已购材料作意志18检定；失败总计损4精神。成功只为接下来二十秒内一次可见身体或弧光冲击减少30贡献，不处理精神作用。真实受力使同一原垫磨损15；生活受控冲量由5健康损失降至2。普通承托同样损2健康与15完整度，无能力掌握；可直接取消冲量而不受伤。原垫不足15不能施术，不恢复活性、原垫或旧伤。' },
];
export const NATURE_WALKER_INHERITED_ABILITIES = [...BARREN_MATRIARCH_INHERITED_ABILITIES, ...BARREN_MATRIARCH_ABILITIES].map(ability => ability.id === 'mother.s2.root-buffer'
  ? { ...ability, description: '保留既有根系缓冲的有限范围、真实掌握和消耗。继续使用本人同一原根垫及其当前完整度，原获取费用不重算，也不补发新垫；每次真实受力继续磨损15，不足时不能使用。既有三十秒单次可见实体冲量边界不变，成本、失败和旧伤保留；晋升不修复根垫或重新开放旧现场。' } : ability);
export function natureWalkerConsumptionRisk(): string {
  return '荒芜主母消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与180便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与当次准备耗尽，专业照护只将本次排异后的健康精神保底到1。成功四属性各+1，15项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满，已有性别与身体保持。全批失败耗尽后，实付1行动与100便士申请独立三瓶，至少跨一真实周领取；每瓶另做五次劳动并付1200便士，或直接支付7200便士。';
}
export const NATURE_WALKER_CONSUMPTION_RISK = natureWalkerConsumptionRisk();

/** Schema226 adds paid same-original recovery; the old risk string stays immutable for archived receipts. */
export const NATURE_WALKER_RECOVERY_SCHEMA_VERSION = 226;
export const NATURE_WALKER_RECOVERY_SITE_ID = 'BACKLUND_ORIGINAL_NATURE_WALKER_PREPARATION' as const;
export const NATURE_WALKER_RECOVERY_PRICES = { recovery: 120, recoveryHandover: 30, recoveryDrug: 900, recoveryLabourBalance: 90 } as const;
export const NATURE_WALKER_CURRENT_CONSUMPTION_RISK = NATURE_WALKER_CONSUMPTION_RISK.replace(
  '全批失败耗尽后，实付1行动与100便士申请独立三瓶，至少跨一真实周领取；每瓶另做五次劳动并付1200便士，或直接支付7200便士。',
  '最初三瓶全部失败耗尽后，只能在原服药准备与支持交接处以1行动和120便士调查同一原特性的归属与位置，经保管方本次许可实际核验封存；至少下一真实周以1行动和30便士当面交接。新普通药物与调配服务900便士，或五项新劳动后90便士；当周检查仍另付1行动和180便士。失败残留不会自动回收，旧瓶、原失败与旧成本不改写，不再供应第四份原特性。',
);
