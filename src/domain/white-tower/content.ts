import { WHITE_TOWER_MATERIAL_LOCATIONS } from './material-content.js';
export { WHITE_TOWER_ABILITY_IDS } from './types.js';
export { WHITE_TOWER_CONSUMPTION, WHITE_TOWER_STABILITY as WHITE_TOWER_PROMOTION_STABILITY } from './material-content.js';
export const WHITE_TOWER_ABILITIES = [
  { id: 'reader.s0.structural-insight', label: '结构洞察', description: '支付12灵性与8精神，亲见同一非生命机械结构后，尝试在随后30秒内帮助一次独立核验。遮挡、条件版本改变和对手重构会使旧窗口失效；成功后实际核验才增长掌握，本场只尝试一次。' },
  { id: 'reader.s0.bounded-weak-point', label: '有限弱处', description: '支付16灵性与10精神，只在本人已核实的同一非生命机械结构上尝试制造一个10秒弱处。对手可重构抵抗，须随后实际利用才增长掌握；不保证破防，不影响活人，本场只尝试一次。' },
] as const;
export const WHITE_TOWER_GUIDANCE = { cash: 100, actions: 1 } as const;
export const WHITE_TOWER_HOME = 'WT0-RECEPTION';
export const WHITE_TOWER_WORKSHOP = WHITE_TOWER_MATERIAL_LOCATIONS.workshop;
export const WHITE_TOWER_SUPPLIER = WHITE_TOWER_MATERIAL_LOCATIONS.supplier;
export const WHITE_TOWER_ARCHIVE = WHITE_TOWER_MATERIAL_LOCATIONS.archive;
export const WHITE_TOWER_VAULT = WHITE_TOWER_MATERIAL_LOCATIONS.vault;
export const WHITE_TOWER_GATE = 'WT0-GATE';
export const WHITE_TOWER_CITY_PLACES = [
  { id: WHITE_TOWER_HOME, title: '街区接待处' }, { id: WHITE_TOWER_SUPPLIER, title: '原供货交接处' },
  { id: WHITE_TOWER_MATERIAL_LOCATIONS.originalRoom, title: '原资料室出口' },
  { id: WHITE_TOWER_WORKSHOP, title: '白塔调配室' }, { id: WHITE_TOWER_ARCHIVE, title: '封存档案室' },
  { id: 'WT0-MARKET', title: '市场台阶' }, { id: 'WT0-CANAL', title: '运河检修廊' },
  { id: 'WT0-ALLEY', title: '公寓后巷' }, { id: WHITE_TOWER_GATE, title: '旧机械闸通路' },
];
export const WHITE_TOWER_STORY = '原资料室、埃德温的庭院、两张原纸与停止的器材留在原处。街区接待处收到市场台阶、运河检修廊和公寓后巷三处阻路求助；分别亲自问过居民、实勘、修补和验收，再让本人真实通过，并于下一周回来复核。';
export const WHITE_TOWER_GOAL = '完成三处原居民的真实通过与隔周复核；核清本人已有的一份和另外两份原特性，实地确认同一唯一性空位，再为同一本人的同一瓶付费准备。';
export const WHITE_TOWER_RISK = '成功率按本人实际意志与本瓶付费准备计算，不重掷。失败留下真实重伤和污染并可能死亡。幸存者只能在原处封存同一残余，隔周付费回收，再用剩余有价载体重配；总共只有三件载体。';
export const WHITE_TOWER_EPILOGUE_BONUS = 30;
export const WHITE_TOWER_SPIRITUALITY_CAP = 150;
