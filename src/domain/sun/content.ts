import { SUN_MATERIAL_LOCATIONS } from './material-content.js';
export { SUN_ABILITY_IDS } from './types.js';
export { SUN_CONSUMPTION, SUN_STABILITY as SUN_PROMOTION_STABILITY } from './material-content.js';
export const SUN_ABILITIES = [
  { id: 'sun.s0.directed-solar-radiance', label: '定向太阳辉光', description: '支付1行动、8便士、14灵性与8精神，耗用同一聚光插片，对亲见且光路畅通的同一原排气槽尝试30秒窗口。遮板、蒸汽、条件改变或超时都会使效果失效；随后实际中和那四份无生命残留才增长掌握，每次事故只有一次尝试。' },
  { id: 'sun.s0.bounded-radiance-ward', label: '有限辉光护持', description: '支付1行动、6便士、12灵性与6精神，耗用唯一隔热衬片，经同一居民当前同意后为其原隔热板尝试30秒一次性护持。须随后真实经过短路热冲击才证明抵挡8健康伤害并增长掌握；不保证成功，不消除精神损伤。普通停炉和侧道撤人始终可用。' },
] as const;
export const SUN_GUIDANCE = { cash: 100, actions: 1 } as const;
export const SUN_HOME = 'SU0-RECEPTION';
export const SUN_WORKSHOP = SUN_MATERIAL_LOCATIONS.workshop;
export const SUN_SUPPLIER = SUN_MATERIAL_LOCATIONS.supplier;
export const SUN_ARCHIVE = SUN_MATERIAL_LOCATIONS.archive;
export const SUN_VAULT = SUN_MATERIAL_LOCATIONS.vault;
export const SUN_GATE = 'SUN0-WASHHOUSE';
export const SUN_CITY_PLACES = [
  { id: SUN_HOME, title: '街区接待处' }, { id: SUN_SUPPLIER, title: '原供货交接处' },
  { id: SUN_MATERIAL_LOCATIONS.originalRoom, title: '原采光廊入口' },
  { id: SUN_WORKSHOP, title: '太阳调配室' }, { id: SUN_ARCHIVE, title: '封存档案室' },
  { id: 'SUN0-WASHHOUSE', title: '南街公共洗衣房' }, { id: 'SUN0-STAIR', title: '邻楼后阶' },
];
export const SUN_STORY = '玛拉与芦影、原采光廊和投降的西拉斯都留在原处，旧许可、伤势和耗料继续保留。街区接待处有洗衣房与邻楼后阶两件居民求助；须亲自问清情况、处理实际原物并完成交接，普通手段也能完成。';
export const SUN_GOAL = '完成两件居民服务与现场核验；核清本人已有的一份和另外两份原特性，实地确认同一太阳唯一性空位，再为同一本人的同一瓶付费准备。实际晋1满十二周才可服药。';
export const SUN_RISK = '成功率按本人实际意志与本瓶付费准备计算，不重掷。失败留下真实重伤和污染并可能死亡。幸存者只能在原处封存同一残余，隔周付费回收，再用剩余有价载体重配；总共只有三件载体。';
export const SUN_EPILOGUE_BONUS = 30;
export const SUN_SPIRITUALITY_CAP = 150;
