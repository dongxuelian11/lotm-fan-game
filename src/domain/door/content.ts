import { DOOR_MATERIAL_LOCATIONS } from './material-content.js';
export { DOOR_ABILITY_IDS } from './types.js';
export { DOOR_CONSUMPTION, DOOR_STABILITY as DOOR_PROMOTION_STABILITY } from './material-content.js';
/** Quantitative scene limits are authored balance, not a complete canonical power list. */
export const DOOR_ABILITIES = [
 { id: 'door.s0.bounded-conceptual-escape', label: '有限概念化脱身', description: '对现场已声明、尚未落定的一次合格冲击，支付1行动、8便士、14灵性与8精神，尝试让同一本人短暂脱身。窗口只有3秒，须随后实际避过该次冲击才增长掌握；不复制物品，不抵消既成伤害，也不保护其他人。' },
 { id: 'door.s0.single-exit-seal', label: '单出口短封', description: '支付1行动、6便士、12灵性与6精神，尝试封住亲见的一个出口20秒。原机构可抵抗或破坏联系，随后真实拦下合格冲击才增长掌握；失效、撤回与失败保留费用。手动停机与普通侧路始终可用。' },
] as const;
export const DOOR_GUIDANCE = { cash: 100, actions: 1 } as const;
export const DOOR_HOME = 'DR0-RECEPTION';
export const DOOR_WORKSHOP = DOOR_MATERIAL_LOCATIONS.workshop;
export const DOOR_SUPPLIER = DOOR_MATERIAL_LOCATIONS.supplier;
export const DOOR_ARCHIVE = DOOR_MATERIAL_LOCATIONS.archive;
export const DOOR_VAULT = DOOR_MATERIAL_LOCATIONS.vault;
export const DOOR_GATE = 'DR0-HOIST-SHED';
export const DOOR_CITY_PLACES = [
 { id: DOOR_HOME, title: '街区接待处' }, { id: DOOR_SUPPLIER, title: '原供货交接处' },
 { id: DOOR_MATERIAL_LOCATIONS.originalRoom, title: '原准备处调查室' },
 { id: DOOR_WORKSHOP, title: '门调配室' }, { id: DOOR_ARCHIVE, title: '封存档案室' },
 { id: 'DR0-LEDGER-HOUSE', title: '账册所门槛' }, { id: 'DR0-COURTYARD-STAIR', title: '邻院阶梯' },
 { id: 'DR0-WAREHOUSE-YARD', title: '仓库原门' }, { id: DOOR_GATE, title: '起重棚事故现场' },
];
export const DOOR_STORY = '旧通行室与玛拉、入口架上的原包、异星封包和已经归档的保护装具各留原处。街区有三处被损坏门槛、空车和门销阻断的日常通路：先问过原人、查看两端，用普通器具修通，再把同一人或货送到接收人面前。';
export const DOOR_GOAL = '完成三处真实通行与彼端核收，核清本人融合的原份、另一原供应瓶与失败残余的去向，再取得同一封存唯一性；晋1满十二周并完成同瓶有价准备后，才能独立确认服药。';
export const DOOR_RISK = '服药按实际意志和同瓶准备检定，不能重掷。失败可致重伤、污染或死亡；幸存者只可在原处封存同一残余，隔周付费回收，用剩余有限载体重新调配。旧死者不会复活，也不产生第四份特性。';
export const DOOR_EPILOGUE_BONUS = 30;
export const DOOR_SPIRITUALITY_CAP = 150;
