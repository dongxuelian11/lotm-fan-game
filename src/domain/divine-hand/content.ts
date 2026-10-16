import type { DivineHandAbilityId, DivineHandPreparationId } from './types.js';
import { GLORY_INHERITED_ABILITIES, GLORY_ABILITIES } from '../glory/content.js';

/** Internal source boundary: L236619 supports only the structural S1/pathway
 * mapping within the Eternal Darkness formula. No independent named-ability
 * passage, complete recipe or promotion ritual has been verified. The two
 * finite abilities, original repair-room scene, finished-bottle channel and
 * numerical preparations below are original gameplay, not canonical claims.
 * Divine crown, city-wide shielding, corpse manifestations and invincibility
 * are excluded. The inherited source can contain an explicitly DIRECTED S3
 * prefix; no continuation changes its historical provenance. */
export const DIVINE_HAND_GUIDE = '贝克兰德神明之手独立成品交接处';
export const DIVINE_HAND_PRICES = { guidance: 500, potion: 6600, labourCredit: 5500, labourBalance: 1100, preparation: 150, resupply: 100 } as const;
export const DIVINE_HAND_MIN_GLORY_WEEKS = 12;
export const DIVINE_HAND_LABOUR_STEPS = 5;
export const DIVINE_HAND_BOTTLE_IDS = ['divine-hand-potion-1', 'divine-hand-potion-2', 'divine-hand-potion-3'] as const;
export const DIVINE_HAND_FORMULA_STATUS = '交接处供应分别封存的神明之手成品魔药。服用前先核对战士至荣耀者的八阶原瓶、三份实际报告与反思，核实同一银甲的当前损耗与新负载来源，再走查停止和普通返回路线。三项专业准备分别完成后，另付费检查当周场地，再独立确认饮用所选原瓶。';
export const DIVINE_HAND_SOURCE_STATUS = '仍是原修护室、同一银甲、工作台与短桥。西莉娅和埃文保持各自真实位置与精力，每案须分别邀请、重新同意并亲自到场；每次只允许一个愿意参与的成人。原负载保留实际剩余与耗用记录，新冲击试验须单独付费取得有限负载并由物主准备。原垫片与护片保留原所有权、位置和剩余次数，领取、使用、停止与归还逐项记录。失败、到期或撤回不会退还成本或恢复损耗。';
export const DIVINE_HAND_POTION_SOURCES = DIVINE_HAND_BOTTLE_IDS.map((id, index) => ({ id, source: `${DIVINE_HAND_GUIDE}初始批次第${index + 1}瓶序列1神明之手成品魔药，独立封存编号${id}。本瓶单独交付与耗用，不改装旧荣耀者原瓶，也不补回以前耗尽的原瓶。` }));
export const DIVINE_HAND_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const DIVINE_HAND_PREPARATIONS: { id: DivineHandPreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_ORIGINALS', title: '核对八阶原瓶与当前银甲', description: '本人核对八阶真实晋升、失败原瓶、荣耀者三份报告与反思。同一银甲以当前实际完整度为准，旧银骑士记录只保留过去状态；旧伤、原人、投降者、死亡与遗物都不会因晋升重置。' },
  { id: 'PLAN_FINITE_LOAD', title: '核实有限负载与本人承受', description: '核对原负载的剩余次数，以及垫片与护片的实际位置。后续试验须另购一份独立有限负载，物主同意并真实准备；不会重填旧负载。只允许本人承受一次明确冲击或近处原桥构件的一次接触核验，失败、损伤与精力消耗保留。' },
  { id: 'CHECK_RETURN', title: '走查停手与普通返回路线', description: '本人核实原入口、工作台、短桥与普通侧路。每个成人保持独立身体与意愿，旧许可不自动延续。撤回须立即停止，物件按原所有权归还，所有人亲自步行离开；专业支持只处理当次服药排异，不退费用、不治疗旧伤。' },
];
export const DIVINE_HAND_ABILITIES: { id: DivineHandAbilityId; label: string; description: string }[] = [
  { id: 'warrior.s1.beam-stabilize', label: '接触稳持', description: '花8灵性与2精神，以知识18尝试稳定当前真实接触的原物；生活施术过1秒、实战动作过5秒，成功后作用最多20秒。生活中只辅助同一原桥构件的下一次手动检查：检查仍付1精力与1秒、知识16，得到8点辅助。实战中只辅助本人实际握持的原武器下一次普通打击30。不能远程控制、复制物件或永久加固；实际应用才计掌握，失败与到期均不退成本。' },
  { id: 'warrior.s1.armor-convergence', label: '护甲合势', description: '花8灵性与2精神，以意志18尝试协调身上同一件银甲；生活施术过1秒、实战动作过5秒，成功后最多20秒，只作用于下一次可见的实际身体冲击。有限试验将本人6健康冲击降低3，仍损耗5甲片完整度并耗1枚真实垫片。实战只削弱下一次身体作用30，同时损耗5完整度；不能保护精神、撤销既有损伤或恢复银甲。使用、停止、到期与撤回都保留实际成本。' },
];
/** Public inherited descriptions remain distinct from immutable old records. */
export const DIVINE_HAND_INHERITED_ABILITIES = [...GLORY_INHERITED_ABILITIES, ...GLORY_ABILITIES].map(a => ({ ...a }));
export const DIVINE_HAND_CONSUMPTION_RISK = '要求荣耀者消化100、从其实际晋升周起满12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动；另付1行动与150便士检查当周场地，再以0行动独立确认饮用所选原瓶，意志30。大成功晋升、精神−8；成功晋升、精神−15；失败仍为荣耀者、健康−15精神−25排异+30；严重排异仍为荣耀者、健康−25精神−45排异+60。原瓶与本次准备均耗尽；专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。成功四属性各+1，二十项旧掌握保持原值，两项新掌握从0开始，灵性上限120且当前不补满。姓名、性别、年龄、性格、取向、原伤势与旧人的结局不变。三瓶全部失败耗尽后，可花1行动与100便士申请下一批，至少跨一真实周再接收三瓶；各瓶费用与准备单独结算。';
