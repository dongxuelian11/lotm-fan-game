import { LAWYER_GUIDE } from '../lawyer/content.js';
import type { BarbarianAbilityId } from './types.js';
export { BARBARIAN_CASE_IDS } from './types.js';

/** The crystal quantity is unknown in the original; one portion is only the G supply unit. */
export const BARBARIAN_FORMULA_SOURCE = '《诡秘之主》第二部第121章《子弹》已核野蛮人六项配方：主材为狂化草1株、大地犀牛的实心独角结晶；辅材为深纹胡桃1个、香蜂草1株、杨树皮浸泡纯露10mL、烈酒100mL。原著未给实心独角结晶的明确数量或重量，本作每批供货1份仅为玩法G计量，不能解读为原著精确数量。确切投料顺序未核定；此处材料排列及导师操作规程、供货、劳动、价格、成熟周数、掌握、判定与属性数值均为本作玩法改编G。';
export const BARBARIAN_GUIDE = LAWYER_GUIDE;
export const BARBARIAN_PRICES = { formula: 180, mainMaterials: 1050, auxiliaryMaterials: 100, brewing: 60 } as const;
export const BARBARIAN_BATCH_IDS = ['barbarian-batch-1', 'barbarian-batch-2', 'barbarian-batch-3'] as const;
export const BARBARIAN_MIN_LAWYER_WEEKS = 4;
export const BARBARIAN_LABOUR_STEPS = 3;
export const BARBARIAN_LABOUR_TASKS = ['抄录六料清单', '核对原料封签', '清理调配场地'] as const;
/** quantity is the source quantity; supplyQuantity is the physical G manifest quantity. */
export const BARBARIAN_FORMULA = [
  { id: 'frenzy-grass', name: '狂化草', quantity: 1, supplyQuantity: 1, unit: '株' },
  { id: 'earth-rhino-horn-crystal', name: '大地犀牛的实心独角结晶', quantity: null, supplyQuantity: 1, unit: '份', note: '原著未给明确数量或重量；本作G每批供货1份。' },
  { id: 'deep-pattern-walnut', name: '深纹胡桃', quantity: 1, supplyQuantity: 1, unit: '个' },
  { id: 'lemon-balm', name: '香蜂草', quantity: 1, supplyQuantity: 1, unit: '株' },
  { id: 'poplar-bark-hydrosol', name: '杨树皮浸泡纯露', quantity: 10, supplyQuantity: 10, unit: 'mL' },
  { id: 'strong-liquor', name: '烈酒', quantity: 100, supplyQuantity: 100, unit: 'mL' },
] as const;
export const BARBARIAN_SOURCE_STATUS = '野蛮人的原著能力边界为强健身体、非凡力量与较高精神抗性；力量并非无限，精神抗性不等于精神影响免疫。律师原有规则分析、说服论证与弱点识别保留，不增加序列7贿赂者的贿赂、序列6腐化男爵的扭曲或其它高序列能力。三项生活实践、现场停止与报告、能力分组、全部判定和数值为本作玩法G。米蕾·沃德仍是同一位本作原创成年契约文书员，晋升不建立王室、教会或其它组织身份。';
export const BARBARIAN_ABILITIES: { id: BarbarianAbilityId; label: string; description: string }[] = [
  { id: 'black-emperor.s8.enhanced-body', label: '非凡体能', description: '强健身体与非凡力量可用于眼前可搬动的重物、有限推举与防守；须先确认落点、旁人位置和停止条件。不能无限增力、无视伤势或把普通物体凭空移走。具体范围、掌握与判定为本作G。' },
  { id: 'black-emperor.s8.mental-resistance', label: '精神抗性', description: '较高精神抗性帮助承受有限精神压力，仍可能受到影响或失败。不是免疫精神控制、恐惧、污染或一切异常；停止接触与普通退路仍然有效。具体范围、掌握与判定为本作G。' },
];
export const BARBARIAN_CONSUMPTION_RISK = '本段数值为本作玩法改编G：服药必定消耗所选野蛮人原瓶，0行动，意志难度12；律师扮演须达100且律师晋升后满4整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。文书员在场处理本次指导服药的排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗、精神影响与其它危险。';
