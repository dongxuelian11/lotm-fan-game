import { APPRENTICE_GUIDE } from '../apprentice/content.js';
import type { TrickmasterAbilityId } from './types.js';
export { TRICKMASTER_CASE_IDS } from './types.js';

/** The stomach has no explicit original count/weight. One portion is this game's supply unit. */
export const TRICKMASTER_FORMULA_SOURCE = '《诡秘之主》第二部第131章《一掷千金》已核戏法大师六项配方：主材为食灵者的胃袋、深海枪鱼血液20mL；辅材为鹅耳枥制作的精油5mL、线球草粉末10g、盛开的红栗花1朵、纯水80mL。原著未给胃袋的明确数量或重量，本作每批供货1份仅为玩法G计量，不能解读为原著精确数量。确切投料顺序未核定；此处材料排列及导师操作规程、供货、劳动、价格、成熟周数、掌握、判定与属性数值均为本作玩法改编G。';
export const TRICKMASTER_GUIDE = APPRENTICE_GUIDE;
export const TRICKMASTER_PRICES = { formula: 180, mainMaterials: 1050, auxiliaryMaterials: 100, brewing: 60 } as const;
export const TRICKMASTER_BATCH_IDS = ['trickmaster-batch-1', 'trickmaster-batch-2', 'trickmaster-batch-3'] as const;
export const TRICKMASTER_MIN_APPRENTICE_WEEKS = 4;
export const TRICKMASTER_LABOUR_STEPS = 3;
export const TRICKMASTER_LABOUR_TASKS = ['抄录六料清单', '核对原料封签', '清理调配场地'] as const;
/** quantity is the source quantity; supplyQuantity is the physical G manifest quantity. */
export const TRICKMASTER_FORMULA = [
  { id: 'spirit-eater-stomach', name: '食灵者的胃袋', quantity: null, supplyQuantity: 1, unit: '份', note: '原著未给明确数量或重量；本作G每批供货1份。' },
  { id: 'deep-sea-marlin-blood', name: '深海枪鱼血液', quantity: 20, supplyQuantity: 20, unit: 'mL' },
  { id: 'hornbeam-essential-oil', name: '鹅耳枥制作的精油', quantity: 5, supplyQuantity: 5, unit: 'mL' },
  { id: 'thread-ball-grass-powder', name: '线球草粉末', quantity: 10, supplyQuantity: 10, unit: 'g' },
  { id: 'blooming-red-chestnut-flower', name: '盛开的红栗花', quantity: 1, supplyQuantity: 1, unit: '朵' },
  { id: 'pure-water', name: '纯水', quantity: 80, supplyQuantity: 80, unit: 'mL' },
] as const;
export const TRICKMASTER_SOURCE_STATUS = '《诡秘之主》第三部第60章《戒严的拜亚姆》列举戏法大师喜欢使用的六种低威力戏法：造雾、造风、闪光、冻结、电击、绊倒；这只是文中列举的常用戏法，不是完整法术清单。冻结表现可让热杯液面结一层薄冰，并非把整杯冻透或成为强力元素施法者。本作将有限戏法记为一组共享掌握，具体场景、范围与数值为玩法G。保留学徒本人开门的原有限能力；不增加序列6记录法术、旅行或远距离传送。诺拉·维恩仍是同一位本作原创成年独立导师，晋升不建立家族或组织身份。';
export const TRICKMASTER_ABILITIES: { id: TrickmasterAbilityId; label: string; description: string }[] = [
  { id: 'door.s8.tricks', label: '有限戏法', description: '造雾、造风、闪光、冻结、电击、绊倒等已核常用低威力戏法共用这一组掌握；六种列举不是全部法术清单。只作用于现场已确认的小范围对象，例如让原热杯液面结薄冰。效果有限且可能失败，不把整杯冻透，不控制大范围天气、雷暴或任意人物。没有记录法术、旅行与远距离传送。具体范围、灵性及共享掌握为本作G。' },
];
export const TRICKMASTER_CONSUMPTION_RISK = '本段数值为本作玩法改编G：服药必定消耗所选戏法大师原瓶，0行动，意志难度12；学徒扮演须达100且学徒晋升后满4整周。大成功：晋升、精神−5；成功：晋升、精神−10；失败：未晋升、精神−20、健康−10、排异+25；灾难：中断晋升、精神−40、健康−20、排异+50。导师在场处理本次指导服药的排异，不随机即死；休养每次消退至多10排异，用过的原瓶不会恢复。这项保护只适用于本次指导服药，不适用于战斗与其它危险。';
