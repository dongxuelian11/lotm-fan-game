import { DARKNESS_MATERIAL_LOCATIONS } from './material-content.js';
import { DARKNESS_EVACUATION_LOCATION } from './evacuation.js';
export { DARKNESS_ABILITY_IDS } from './types.js';
export { DARKNESS_CONSUMPTION, DARKNESS_STABILITY as DARKNESS_PROMOTION_STABILITY } from './material-content.js';
/** These are two limited original game techniques, not a complete canon S0
 * authority list, formula or ritual. No neighbouring pathway is inherited. */
export const DARKNESS_ABILITIES = [
  { id: 'darkness.s0.short-concealment', label: '短隐秘', description: '观察真实视线并取得同行许可后，短暂遮断这一道已知追踪视线30秒、最多10米。仍须亲走或搀扶，噪声、强照、抵抗与超时会使效果失效；本场只尝试一次，实际应用才增长掌握。' },
  { id: 'darkness.s0.bounded-misfortune-diversion', label: '有限厄难偏导', description: '亲见尚未释放的同一悬物和空置卸力区后，只影响随后10秒内的一次真实释放；受力不足或阻挡照常抵抗，不把危险转给未同意者，不抹除既有伤害。' },
] as const;
export const DARKNESS_GUIDANCE = { cash: 100, actions: 1 } as const;
export const DARKNESS_HOME = '贝克兰德原庭院';
export const DARKNESS_WORKSHOP = DARKNESS_MATERIAL_LOCATIONS.workshop;
export const DARKNESS_SUPPLIER = DARKNESS_MATERIAL_LOCATIONS.supplier;
export const DARKNESS_ARCHIVE = DARKNESS_MATERIAL_LOCATIONS.archive;
export const DARKNESS_VAULT = DARKNESS_MATERIAL_LOCATIONS.vault;
export const DARKNESS_CITY_PLACES = [
  { id: DARKNESS_HOME, title: '原庭院' }, { id: DARKNESS_EVACUATION_LOCATION, title: '黑夜街区登记处' },
  { id: DARKNESS_SUPPLIER, title: '原房间旁交接处' }, { id: DARKNESS_ARCHIVE, title: '长夜保管档案室' },
  { id: DARKNESS_VAULT, title: '长夜封存室' }, { id: DARKNESS_WORKSHOP, title: '长夜调配室' },
];
export const DARKNESS_STORY = '原庭院里的人和物仍在原处。步行前往新街区，在白昼查路、问过四位成年人的意愿，入夜后用普通灯、原绳和亲身搀扶完成长夜撤离。';
export const DARKNESS_GOAL = '四人逐一在真实夜间抵达，再亲走返程；核清三份原特性，等待1353年真实事件后才交接同一唯一性，并为同一瓶付费准备。';
export const DARKNESS_RISK = '完整准备按本人实际意志计算成功率，不改骰子。失败会留下伤势、污染并可能死亡。幸存者须原地封存、隔周付费回收，另购有限载体重新准备。';
export const DARKNESS_EPILOGUE_BONUS = 30;
export const DARKNESS_SPIRITUALITY_CAP = 150;
