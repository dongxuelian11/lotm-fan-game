import { TWILIGHT_GIANT_MATERIAL_LOCATIONS } from './material-content.js';
export { TWILIGHT_GIANT_ABILITY_IDS } from './types.js';
/** The finite original bridge scene does not assert a canonical recipe or ritual. */
export const TWILIGHT_GIANT_ABILITIES = [
 { id: 'warrior.s0.giant-contact-hold', label: '巨人形接触稳梁', description: '本人站到近处原梁旁持续接触，付1行动、14灵性、6精神与6精力尝试稳持20秒。随后须在窗口内用4精力与8秒实际装好已购新支撑，才增长掌握。移位、松手、目标变化、插入其他动作或超时会中断；不保护远处人物，也不修复银甲。' },
 { id: 'warrior.s0.twilight-axle-easing', label: '黄昏减负', description: '亲眼观察三米以内同一根卡轴，付1行动、12灵性、5精神与3精力尝试开启15秒窗口。随后在3秒内实际应用，一次最多减少4点剩余推力和3点应变。旧损伤不消失，人车不会自动移动。' },
] as const;
export const TWILIGHT_GIANT_GUIDANCE = { cash: 100, actions: 1 } as const;
export const TWILIGHT_GIANT_HOME = 'TG220-RECEPTION';
export const TWILIGHT_GIANT_WORKSHOP = TWILIGHT_GIANT_MATERIAL_LOCATIONS.workshop;
export const TWILIGHT_GIANT_SUPPLIER = TWILIGHT_GIANT_MATERIAL_LOCATIONS.supplier;
export const TWILIGHT_GIANT_ARCHIVE = TWILIGHT_GIANT_MATERIAL_LOCATIONS.archive;
export const TWILIGHT_GIANT_VAULT = TWILIGHT_GIANT_MATERIAL_LOCATIONS.vault;
export const TWILIGHT_GIANT_BRIDGE = 'GL2-REPAIR-ROOM';
export const TWILIGHT_GIANT_CITY_PLACES = [
 { id: TWILIGHT_GIANT_HOME, title: '街区接待处' }, { id: TWILIGHT_GIANT_SUPPLIER, title: '原神明之手交接处' },
 { id: TWILIGHT_GIANT_MATERIAL_LOCATIONS.originalRoom, title: '原服药准备处' },
 { id: TWILIGHT_GIANT_WORKSHOP, title: '封闭调配室' }, { id: TWILIGHT_GIANT_ARCHIVE, title: '封存档案室' },
 { id: TWILIGHT_GIANT_VAULT, title: '原唯一性保管处' }, { id: TWILIGHT_GIANT_BRIDGE, title: '原修护室短桥' },
];
export const TWILIGHT_GIANT_STORY = '原修护室的六米短桥需要两段有价新支撑。玛拉与奥斯里克两位新成年工人各有意愿、工资、身体和位置，须亲自到场、走完两段，再沿普通侧路真正退出。西莉娅与埃文、原银甲和耗尽的旧物仍保持原记录。';
export const TWILIGHT_GIANT_GOAL = '查清原失败残余、供应瓶与体内原份的去向，核对同一唯一性保管链；完成原桥两次真实通行与退出、成为神明之手满十二周后，才能独立决定是否服药。';
export const TWILIGHT_GIANT_RISK = '实际意志与可选的同瓶有价准备共同决定成功率。失败保留耗费、重伤和污染，严重失败可以死亡。幸存者只可封存原残余、隔周付费回收，再用剩余有限载体重配；没有复活或第四份原特性。';
export const TWILIGHT_GIANT_SPIRITUALITY_CAP = 150;
export const TWILIGHT_GIANT_CONSUMPTION = { difficulty: 56, bonus: 40, actions: 1, spirituality: 30, successMind: 12,
 failureHealth: 45, failureMind: 40, failurePollution: 35, greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70 } as const;
export const TWILIGHT_GIANT_PROMOTION_STABILITY = { actions: 1, cash: 150, spirituality: 12, mind: 8, seconds: 3600, validSeconds: 604800 } as const;
