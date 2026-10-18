import { TYRANT_MATERIAL_LOCATIONS } from './material-content.js';
import { TYRANT_COASTS } from './coasts.js';
import { TYRANT_CHALLENGE_LOCATION } from './challenge.js';
export { TYRANT_ABILITY_IDS } from './types.js';
export { TYRANT_CONSUMPTION, TYRANT_STABILITY as TYRANT_PROMOTION_STABILITY } from './material-content.js';
export const TYRANT_ABILITIES = [
  { id: 'tyrant.s0.bounded-storm', label: '有限风暴引流', description: '支付20灵性与8精神，尝试暂时分开同一救援现场的原水流；90秒窗口内仍须本人逐人真实救出，失败不退费用。' },
  { id: 'tyrant.s0.matter-energy', label: '有限物质能量转移', description: '支付16灵性与10精神，经当场核验后一次性尝试把原现场的有限能量转移至同一容器；耗用有价原载体，不制造新物品，不保证成功。' },
] as const;
export const TYRANT_GUIDANCE = { cash: 100, actions: 1 } as const;
export const TYRANT_HOME = 'TYRANT0-HARBOR';
export const TYRANT_WORKSHOP = TYRANT_MATERIAL_LOCATIONS.workshop;
export const TYRANT_SUPPLIER = TYRANT_MATERIAL_LOCATIONS.supplier;
export const TYRANT_ARCHIVE = TYRANT_MATERIAL_LOCATIONS.archive;
export const TYRANT_VAULT = TYRANT_MATERIAL_LOCATIONS.vault;
export const TYRANT_RESCUE = 'TYRANT0-RESCUE';
export const TYRANT_CITY_PLACES = [
  { id: TYRANT_HOME, title: '原港接待处' }, { id: TYRANT_SUPPLIER, title: '原供货交接处' },
  { id: TYRANT_MATERIAL_LOCATIONS.originalCove, title: '原小湾出口' },
  { id: TYRANT_WORKSHOP, title: '北岸集会调配场' }, { id: TYRANT_ARCHIVE, title: '封存档案室' },
  { id: TYRANT_VAULT, title: '原唯一性保管室' },
  ...TYRANT_COASTS.map(c => ({ id: c.location, title: c.title })),
  { id: TYRANT_CHALLENGE_LOCATION, title: '太阳真神敌对现场' }, { id: TYRANT_RESCUE, title: '有限海岸救援现场' },
];
export const TYRANT_STORY = '原小湾与旧人原物继续保留。三岸共二十七万原居民各有当前意愿与有限粮食；履约、隔周复核和真实航运不能用证书代替。另一位太阳真神独立敌对，单独挑战并真实存活才计入晋升经历。';
export const TYRANT_GOAL = '维持至少二十万同一在世居民同时恐惧、服从并信仰；本人单独挑战另一位真神后存活，取得原三份特性与同一唯一性，在当前氛围中完成同瓶付费准备。';
export const TYRANT_RISK = '晋升成功率按当前意志与本次付费准备计算；失败实际重伤、污染或死亡，没有免费重试。药液与普通载体耗用，原特性仍守恒，回收必须按真实原处和隔周条件完成。';
export const TYRANT_EPILOGUE_BONUS = 30;
export const TYRANT_SPIRITUALITY_CAP = 150;
