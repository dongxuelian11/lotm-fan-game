import { WITCH_GUIDE } from '../witch/content.js';
import type { PleasureAbilityId } from './types.js';
export { PLEASURE_CASE_IDS } from './types.js';

export const PLEASURE_GUIDE = WITCH_GUIDE;
export const PLEASURE_VOLUNTEER = '成年自愿参与者艾妲';
export const PLEASURE_PRICES = { formula: 360, mainMaterials: 3000, auxiliaryMaterials: 240, brewing: 80 } as const;
export const PLEASURE_BATCH_IDS = ['pleasure-batch-1', 'pleasure-batch-2', 'pleasure-batch-3'] as const;
export const PLEASURE_MIN_WITCH_WEEKS = 12;
export const PLEASURE_LABOUR_STEPS = 5;
export const PLEASURE_LABOUR_TASKS = ['核对七项原料清单', '检查两项主材封签', '量记五项辅材', '整理独立批次记录', '清理原调配台'] as const;
/** Canonical quantities and physical G supply portions remain separate. */
export const PLEASURE_FORMULA = [
  { id: 'succubus-eyes', name: '魅欲女妖眼睛', quantity: 1, unit: '对', supplyQuantity: 1, supplyUnit: '对' },
  { id: 'adult-widow-spider-silk-gland', name: '成年寡妇巨蛛丝腺', quantity: 1, unit: '个', supplyQuantity: 1, supplyUnit: '个' },
  { id: 'pure-water', name: '纯水', quantity: 100, unit: 'mL', supplyQuantity: 100, supplyUnit: 'mL' },
  { id: 'black-datura-juice', name: '黑色曼陀罗汁', quantity: 5, unit: '滴', supplyQuantity: 5, supplyUnit: '滴' },
  { id: 'succubus-remaining-hair', name: '魅欲女妖残留全部毛发', quantity: null, unit: '全部', supplyQuantity: 1, supplyUnit: '份', note: '必须是残留的全部毛发；1份仅为本作交付单位，原著未给克数。' },
  { id: 'fenepot-fly-powder', name: '费内波特苍蝇粉', quantity: 10, unit: 'g', supplyQuantity: 10, supplyUnit: 'g' },
  { id: 'genuine-mummy-ashes', name: '真正木乃伊骨灰', quantity: 5, unit: 'g', supplyQuantity: 5, supplyUnit: 'g' },
] as const;
export const PLEASURE_FORMULA_SOURCE = '《诡秘之主》第一部第200章已核欢愉魔女七项配方：主材为魅欲女妖眼睛1对、成年寡妇巨蛛丝腺1个；辅材为纯水100mL、黑色曼陀罗汁5滴、魅欲女妖残留全部毛发、费内波特苍蝇粉10g、真正木乃伊骨灰5g。毛发取残留全部，不编造重量；每批1份仅为本作G交付单位。清单排列不是对原著投料顺序的主张；导师操作规程、批次、价格、五次劳动、成熟周数、判定与属性数值均为本作G。';
export const PLEASURE_SOURCE_STATUS = '欢愉魔女序列6以真实蛛丝接触、有限束缚与魅惑为新增能力，保留原刺客、教唆者、女巫的全部能力。魅惑不是同意，不读心、不消除本人拒绝，也不建立亲密关系。原女巫身体与性别变化记录保留，本次不发生新的强制转变。三项成年自愿的非露骨练习和和平扮演100是本作原创G替代路线，不宣称等同原著完整亲密扮演；不提前开放疾病、大范围灾难或无限镜替。';
export const PLEASURE_ABILITIES: { id: PleasureAbilityId; label: string; description: string }[] = [
  { id: 'assassin.s6.silk-binding', label: '真实蛛丝与有限束缚', description: '先实际生成并准备本次蛛丝，只有丝线真实接触才可有限束缚；断丝即失效。练习仅限成年人明确自愿的轻度手腕演示，并始终提供0行动主动松开或普通解开；实战另行真实布丝与抵抗结算，不借用日常练习的丝线。不是强制同意、永久控制或无限范围。' },
  { id: 'assassin.s6.charm', label: '有限魅惑', description: '影响可感知表现的目标注意，仍允许抵抗和明确拒绝。能力永远不能构成同意，不能把一次拒绝改写成愿意；日常只有本人明确接受修订后的窄提议，才可作已约定的短时表现比较。非亲密社交不建立关系或改变身份。' },
];
export const PLEASURE_CONSUMPTION_RISK = '本段数值为本作玩法G：服药必定消耗所选欢愉魔女原瓶，0行动，意志难度24；女巫扮演须达100且晋升后满12整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。原导师在场处理本次排异，不随机即死；休养每次消退至多10排异，原瓶不恢复。这项保护不适用于战斗或其它危险。晋升四属性各+1，灵性上限80但当前灵性不补满。保留原女巫身体与性别结果，不再强制改变。';
export const PLEASURE_FRAME_SOURCE = '原独立练习场内固定的空木框（PL6-FRAME-1），属于原场地；框上没有人、动物或其它物品';
