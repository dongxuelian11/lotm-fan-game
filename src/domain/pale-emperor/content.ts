import { FERRYMAN_PROVIDERS } from '../ferryman/content.js';
import type { PaleEmperorAbilityId, PaleEmperorPreparationId, PaleEmperorPrices, PaleEmperorSourceEra } from './types.js';

/** Formula-order correspondence at L236617–L236619 supports the S1 name.
 * Complete formula, ritual and individual powers remain unknown. The bounded
 * preparation, prices and two techniques below are original game design. */
export const PALE_EMPEROR_GUIDE = '当前时代的独立成品交接处';
export const PALE_EMPEROR_PRICES = {
  ORIGINAL: { guidance: 500, potion: 6600, labourCredit: 5500, labourBalance: 1100, preparation: 150, resupply: 100 },
  POST_CYCLE: { guidance: 120, potion: 1200, labourCredit: 1120, labourBalance: 80, preparation: 20, resupply: 20 },
} as const;
export const paleEmperorPrices = (era: PaleEmperorSourceEra): PaleEmperorPrices => PALE_EMPEROR_PRICES[era];
export const paleEmperorSourceLabel = (era: PaleEmperorSourceEra): string => `${FERRYMAN_PROVIDERS[era].name}（${FERRYMAN_PROVIDERS[era].id}）介绍的${era === 'POST_CYCLE' ? '当代' : '原时代'}独立苍白皇帝成品渠道`;
/** Save schema, not the release number. Old saves retain their exact shapes. */
export const PALE_EMPEROR_RECOVERY_SCHEMA_VERSION = 214;
export const PALE_EMPEROR_RECOVERY_PRICES = {
  ORIGINAL: { investigation: 100, full: 1100, afterLabour: 100 },
  POST_CYCLE: { investigation: 20, full: 120, afterLabour: 12 },
} as const;
/** Separate current adults and physical counters; neither is an old life NPC. */
export const PALE_EMPEROR_RECOVERY_SITES = {
  ORIGINAL: { id: 'DE1-S1-ORIGINAL-ROOM', location: 'DE1-S1-ORIGINAL-ROOM:COUNTER', custodianId: 'PE1-ORIGINAL-KEEPER', name: '马丁·格雷', age: 46 },
  POST_CYCLE: { id: 'DE0-S1-ORIGINAL-ROOM', location: 'DE0-S1-ORIGINAL-ROOM:COUNTER', custodianId: 'PE1-CURRENT-KEEPER', name: '艾达·莫尔', age: 39 },
} as const;
export const PALE_EMPEROR_MIN_DEATH_CONSUL_WEEKS = 12;
export const PALE_EMPEROR_LABOUR_STEPS = 5;
export const PALE_EMPEROR_BOTTLE_IDS = ['pale-emperor-potion-1', 'pale-emperor-potion-2', 'pale-emperor-potion-3'] as const;
export const PALE_EMPEROR_POTION_SOURCES = PALE_EMPEROR_BOTTLE_IDS.map(id => ({ id, source: `尚未当面登记来源的苍白皇帝独立封存原瓶${id}；不继承旧瓶、旧供应人或旧库存。` }));
export const paleEmperorPotionSource = (era: PaleEmperorSourceEra, number: number, week: number): string => `${paleEmperorSourceLabel(era)}第${Math.ceil(number / 3)}批、第${week}周实际登记的第${number}瓶序列1成品，独立封存编号pale-emperor-potion-${number}；本瓶独立劳动、交付与耗用，不补回旧瓶。`;
export const PALE_EMPEROR_FORMULA_STATUS = '苍白皇帝的当前渠道交付独立封存成品，不提供可自行调配的完整配方。先核对八阶实际经历和当前供应人的凭据，复核有限残响的处理边界，走查停止与普通返程。三项专业准备完成后，还须检查本周服药场地，再独立确认饮用所选原瓶。';
export const PALE_EMPEROR_SOURCE_STATUS = '沿当代接待处旁12米普通道路，首次到场认识42岁的保管员诺拉·贝尔。她保管的同一残响容器有原盖、原屏板、原门和相隔4米的两座台架；容器只承载非人格残留。每次重新取得参与和施术许可，两份封材须实付购买。短窗不会替人搬物、合盖、封存或返程，也不会改写旧人的死亡、伤势与离场。';
export const PALE_EMPEROR_LABOUR_TASKS = ['核验本瓶独立封存记录', '清点本瓶交接箱与封签', '整理本瓶批次供货清单', '核对本瓶运输与收货凭据', '完成本瓶独立交付复核'] as const;
export const PALE_EMPEROR_PREPARATIONS: { id: PaleEmperorPreparationId; title: string; description: string }[] = [
  { id: 'VERIFY_PROVENANCE', title: '核对原瓶、历史与当前来源', description: '逐一核对八阶真实晋升、失败原瓶、三份报告与反思，并核验当前时代独立供应人的交接凭据。旧死亡、伤势、周期、记忆和离场记录保留；历史供应人和旧库存不能复开。' },
  { id: 'VERIFY_RESIDUAL', title: '复核残响与有限作用边界', description: '复核同一非人格残响的登记与观察方法。残响安定只短暂缓和已有超自然躁动，灵迹阻隔只在已见短线上阻隔一次实际传播；开窗不等于应用，也不取得旁人的未来许可。' },
  { id: 'PLAN_RETURN', title: '走查停止、归物与普通返程', description: '亲自走查停止作用、人工屏蔽、合盖、归还同一原物和普通返程；撤回后照付已用成本。专业支持只处理本次服药排异，不治愈旧伤，不复活身体，也不重启六十年周期。' },
];
export const PALE_EMPEROR_ABILITIES: { id: PaleEmperorAbilityId; label: string; description: string }[] = [
  { id: 'death.s1.residual-quieting', label: '残响安定', description: '支付8灵性与2精神，意志18。对当面观察的同一有限残响开启20秒窗口，暂将躁动2降至0；须另外亲手合盖才计一次应用，窗口结束原躁动恢复。实战只将已见有限超自然压力的下一次实际战势贡献减少30；不影响身体、人的意志或已结算结果。' },
  { id: 'death.s1.spiritual-interdiction', label: '灵迹阻隔', description: '支付7灵性与2精神，知识18。对已见4米短线开启20秒窗口，仅在随后实际携带同一容器时阻隔一次指定残响传播；双方仍实际步行并消耗精力。实战只将随后一次合格超自然行动的战势贡献减少30，不防身体棍击、不退已结算后果；未实际应用不增掌握。' },
];
export const PALE_EMPEROR_INHERITED_ABILITIES = [
  ['death.s9.corpse-physique', '收尸人体质', '已有身体技巧保留实际掌握，不能消除伤势。'],
  ['death.s9.spiritual-sight', '灵视', '只能观察实际可见范围，不揭示未知对象。'],
  ['death.s9.undead-knowledge', '亡灵知识', '已有知识须结合真实材料，不能创造亡灵。'],
  ['death.s8.death-eye', '死亡之眼', '有限观察仍有实际成本和目标。'],
  ['death.s8.spirit-contact', '灵体接触', '须有当前在场并愿意接触的灵体，不凭旧约召回灰羽。'],
  ['death.s7.spirit-ritual', '通灵仪式', '须有真实场地与材料，旧仪式不自动重开。'],
  ['death.s7.spirit-communication', '灵体交流', '当前接触须得到实际对象的意愿，不替人作答。'],
  ['death.s7.spirit-borrowing', '灵体借力', '只使用已同意且有余力的实际对象，不凭空补充精力。'],
  ['death.s6.spirit-recruitment', '招募灵体', '需要真实对象和当前约定，旧已结束约定不复活。'],
  ['death.s6.dead-words', '亡者之语', '有限交流不制造已故亲人或恢复完整记忆。'],
  ['death.s5.inner-underworld', '体内冥界', '只保存实际登记的有限对象，不产生无穷灵体。'],
  ['death.s5.underworld-door', '冥界之门', '有限出入仍须真实对象、位置与当前约定。'],
  ['death.s4.underworld-seal', '冥界封存', '旧封存原物与材料保留实际存量，不获得即时复生。'],
  ['death.s3.bounded-ferry', '有限摆渡', '仍须实际端点、对象与意愿，里德原精力不恢复。'],
  ['death.s3.departure-ward', '离行护持', '只处理当前已声明的有限离行风险。'],
  ['death.s2.pale-flame', '苍白焰', '对实际可见的有限残余物付费结算，旧罐灼痕不消失。'],
  ['death.s2.spirit-passage', '灵界短渡', '需要真实已查短线及当前同意；旧薇拉不随新场景移动。'],
].map(([id, label, description]) => ({ id: id!, label: label!, description: description! }));
export function paleEmperorConsumptionRisk(era: PaleEmperorSourceEra): string {
  const p = paleEmperorPrices(era);
  return `死亡执政官消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与${p.preparation}便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与准备均耗尽，专业支持只将本次排异后的健康精神保底到1。成功四属性各+1，17项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满。姓名、性别、身体与旧伤保留。三份原特性全部真实失败后，只能调查最后失败留下的同一份原物：1行动与${PALE_EMPEROR_RECOVERY_PRICES[era].investigation}便士，至少七天后的真实下一周再花1行动原处交接；本次普通新药另付${PALE_EMPEROR_RECOVERY_PRICES[era].full}便士，或五次新劳务后${PALE_EMPEROR_RECOVERY_PRICES[era].afterLabour}便士。旧费用不退，旧劳动不抵新药；新容器不增加第四份特性。`;
}
