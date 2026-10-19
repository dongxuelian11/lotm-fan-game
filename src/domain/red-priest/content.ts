import { RED_PRIEST_MATERIAL_LOCATIONS } from './material-content.js';
export { RED_PRIEST_ABILITY_IDS } from './types.js';
/** These bounded capabilities, auxiliary formula and numbers are original game
 * content. Neither grants other pathways, new soldiers or unconditional victory. */
export const RED_PRIEST_ABILITIES = [
  { id: 'hunter.s0.shared-standard', label: '同袍战旌', description: '让本次明确接受指挥、实际在场的一支原军团分队共同承担一段撤离任务；人数、距离、伤势与物资仍真实限制行动。' },
  { id: 'hunter.s0.bounded-flame', label: '赤焰界限', description: '在本人可见的一处原火场限制火势蔓延；消耗灵性与精神，环境抵抗仍可能造成失败和伤亡。' },
] as const;
export const RED_PRIEST_STORY = '北大陆四方的危机仍未成为全面战争。取得三方实际委托之后，你可以选择亲自发动，也可以拒绝、停战或保护撤离。旧日互助同伴始终保留原来的身份与经历。';
export const RED_PRIEST_GOAL = '核清三份原特性与独立唯一性，完成实际跨越北大陆三大战区的战争与五处独立胜利，再承担服药风险。';
export const RED_PRIEST_RISK = '战事会耗尽原军团、国库和补给，并留下伤亡与居民迁离。服药失败可能造成重伤、污染、失控或死亡；原件不能无条件找回。';
export const RED_PRIEST_FORMULA = [
  { name: '本人已融合的征服者特性', quantity: 1, unit: '份' },
  { name: '另外两份原征服者特性', quantity: 2, unit: '份' },
  { name: '红祭司唯一性', quantity: 1, unit: '件' },
] as const;
export const RED_PRIEST_CONSUMPTION = { difficulty: 55, healthMinimum: 80, mindMinimum: 70, spirituality: 30,
  failureHealth: 45, failureMind: 40, failurePollution: 35, greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70 } as const;
/** Paid, future-only game preparation, never a canonical faith source or item. */
export const RED_PRIEST_PROMOTION_STABILITY = {
  actions: 2, cash: 120, spirituality: 12, mind: 8, weeks: 1, effectiveBonus: 35,
} as const;
/** Only the explicit version-two aftermath uses this finite S0 capability. */
export const RED_PRIEST_EPILOGUE_CAPABILITY_BONUS = 25;
export const RED_PRIEST_CITY_PLACES: readonly { id: string; title: string }[] = [
  { id: 'loen-headquarters', title: '鲁恩联合协商处' },
  { id: RED_PRIEST_MATERIAL_LOCATIONS.archive, title: '职业交接档案处' },
  { id: RED_PRIEST_MATERIAL_LOCATIONS.firstSeal, title: '西侧隔离库' },
  { id: RED_PRIEST_MATERIAL_LOCATIONS.secondSeal, title: '河岸隔离库' },
  { id: RED_PRIEST_MATERIAL_LOCATIONS.thirdSeal, title: '南侧隔离库' },
  { id: RED_PRIEST_MATERIAL_LOCATIONS.relicArchive, title: '旧遗物保管档案室' },
  { id: RED_PRIEST_MATERIAL_LOCATIONS.relicVault, title: '铁冠封存库' },
  { id: RED_PRIEST_MATERIAL_LOCATIONS.workshop, title: '封闭调配室' },
];
