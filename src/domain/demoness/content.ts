import type { DemonessPlace, DemonessSuccession } from './types.js';
import { DEMONESS_ORIGINAL_IDS } from './types.js';
export const DEMONESS_PLACES: { id: DemonessPlace; title: string }[] = [
  { id: 'DM221-GALLERY-EXIT', title: '原展廊出口' }, { id: 'DM221-RECEPTION', title: '街区接待处' },
  { id: 'DM221-ARCH', title: '六米旧石拱通道' }, { id: 'DM221-SUPPLIER', title: '原末日魔女交接处' },
  { id: 'DM221-VAULT', title: '伊妮德的封存保管室' }, { id: 'DM221-WORKSHOP', title: '封闭调配室' },
];
export const DEMONESS_GUIDANCE = { actions: 1, cash: 100 } as const;
export const DEMONESS_CONSUMPTION = { difficulty: 57, preparedBonus: 40, actions: 1, spirituality: 30, successMind: 12,
  failureHealth: 45, failureMind: 40, failurePollution: 35, greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70 } as const;
export const DEMONESS_PREPARATION = { actions: 1, cash: 150, spirituality: 12, mind: 8, seconds: 3600, validSeconds: 604800 } as const;
export const DEMONESS_PRICES = { support: 30, residentService: 20, returnKit: 50, supplyFull: 6600, supplyLabour: 1100,
  residueInspection: 120, originalRecovery: 30, uniquenessVerification: 100, uniquenessHandover: 150, carrier: 50, compose: 40, sealedRecovery: 60 } as const;
export const DEMONESS_SPIRITUALITY_CAP = 150;
/** Internal original branch. Exact ritual/auxiliaries are unknown; these are not novel claims.
 * Exit and custody predate the actual first S1 guidance on 1352-04-01. */
export const DEMONESS_SUCCESSION: DemonessSuccession = {
  branchId: 'demoness-independent-original-1352', formerOwnerId: 'DM221-PRIOR-ORIGINAL-OWNER', formerOwnerAlive: false,
  death: { id: 'DM221-PRIOR-DEATH', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 3, day: 24 } },
  separation: { id: 'DM221-ORIGINAL-SEPARATION', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 3, day: 24 } },
  custody: { id: 'DM221-ORIGINAL-CUSTODY', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 3, day: 25 }, custodianId: 'DM221-ENID', custodyOnly: true },
  originalIds: [...DEMONESS_ORIGINAL_IDS], uniquenessId: 'DM221-ORIGINAL-UNIQUENESS', objectCount: 1, currentIncumbent: null,
};
export const DEMONESS_ABILITIES = [
  { id: 'assassin.s0.finite-stone-petrification', label: '有限落石石化', description: '亲眼看清三米内同一块正从裂缝缓慢剥落的两公斤碎块，花1行动、12灵性、5精神和3精力尝试将松碎表面石化。只作用于这个原物，至多8秒；仍须用已购承接盘真实接住，落势不会停止。成功将当次碎屑伤害从8降到3，实际接住才增长掌握。遮挡、移位、目标变化、撤回或到期即失效。' },
  { id: 'assassin.s0.contact-strut-reshaping', label: '接触原撑整形', description: '本人贴近并持续触碰同一根损坏撑杆，花1行动、14灵性、6精神和6精力，尝试在20秒内局部整形。原杆的阻力计入实际检定；随后须实际装入已购木楔，并承受一次真实通行才增长掌握。松手、移位、目标变化或撤回即中断；旧裂痕、既有伤害和耗尽旧物不会复原。' },
] as const;
export const DEMONESS_STORY = '伊妮德与罗温住在一段六米旧石拱通道两端。两件实购支撑、每人的当前同意与有价协助，让两人逐段亲自走过，再沿普通侧路离开。原展廊、维瑞娜、马库斯和全部已耗物仍保留原来的实际记录。';
export const DEMONESS_GOAL = '带着三份真实末日魔女特性和同一唯一性，完成两位成人的实际通行与退出；成为末日魔女满十二个实际周后，可自行决定是否饮用。';
export const DEMONESS_RISK = '实际意志与可选的同瓶有价准备决定成功率。失败保留费用、重伤与污染，严重失败可以死亡。幸存者能封存同一残余、隔周付费回收，再使用剩余有限载体；没有第四份原特性、复活或身体重置。';
