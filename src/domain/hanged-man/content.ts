/** Stage223 static candidate. Parent owns integration and all validation.
 * Three original S1 characteristics + one uniqueness follow the ordinary S0
 * boundary; complete canonical formula/ritual remains unknown. The corridor,
 * provenance, costs and two bounded applications below are original gameplay.
 */
export const HANGED_MAN_ORIGINAL_IDS = ['dark-angel-potion-1', 'dark-angel-potion-2', 'dark-angel-potion-3'] as const;
export const HANGED_MAN_ABILITY_IDS = ['hanged-man.s0.finite-pressure-bearing', 'hanged-man.s0.single-spirit-seal'] as const;
export type HangedManOriginalId = typeof HANGED_MAN_ORIGINAL_IDS[number];
export type HangedManAbilityId = typeof HANGED_MAN_ABILITY_IDS[number];
export type HangedManPosition = 'ORIGINAL_ENTRY' | 'OUTSIDE' | 'ENTRY' | 'MIDPOINT' | 'GATE';
export type HangedManWorkerId = 'HM223-VERA' | 'HM223-EDWIN';
export type HangedManSegmentId = 'A' | 'B';
export type HangedManConsent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
export const HANGED_MAN_PLACES = [
  { id: 'HM223-COURT-ENTRY', title: '原封存院入口' },
  { id: 'HM223-COURT-OUTSIDE', title: '原封存院外' },
  { id: 'HM223-CORRIDOR', title: '短压廊交接处' },
  { id: 'HM223-RECOVERY', title: '原服药准备处' },
  { id: 'HM223-VAULT', title: '唯一性封存室' },
  { id: 'HM223-WORKSHOP', title: '封闭调配室' },
] as const;
export type HangedManPlaceId = typeof HANGED_MAN_PLACES[number]['id'];
export const HANGED_MAN_WORKERS = [
  { id: 'HM223-VERA', name: '薇拉', age: 36 },
  { id: 'HM223-EDWIN', name: '埃德温', age: 44 },
] as const;
export const HANGED_MAN_SEGMENTS = [
  { id: 'A', from: 'ENTRY', to: 'MIDPOINT', metres: 3 },
  { id: 'B', from: 'MIDPOINT', to: 'GATE', metres: 3 },
] as const;
export const HANGED_MAN_EXIT_METRES = { ORIGINAL_ENTRY: 2, OUTSIDE: 0, ENTRY: 2, MIDPOINT: 5, GATE: 8 } as const;
export const HANGED_MAN_MIN_DARK_ANGEL_WEEKS = 12;
export const HANGED_MAN_GRAZING_CAPACITY = 7;
export const HANGED_MAN_SPIRITUALITY_CAP = 150;
export const HANGED_MAN_GUIDANCE = { actions: 1, cash: 100 } as const;
/** Upstream S2→S1 recovery bridge; original180p preparation is not replaced. */
export const HANGED_MAN_S1_RECOVERY = {
  investigation: { actions: 1, cash: 120 }, custody: { actions: 1, cash: 30 },
  minimumWeeks: 1, labourSteps: 5, labourBalance: 90, preparationCash: 180,
  optionalSupport: { cash: 60, spirituality: 8, mind: 6, willBonus: 13, sameBottle: true, sameWeek: true, uses: 1 },
} as const;
export const HANGED_MAN_PRICES = {
  workerService: 20, seal: 20, ordinaryBrace: 30, residueInspection: 120, originalRecovery: 30,
  uniquenessVerification: 100, uniquenessHandover: 150, carrier: 50, compose: 40, sealedRecovery: 60,
} as const;
export const HANGED_MAN_PREPARATION = { actions: 1, cash: 150, spirituality: 12, mind: 8, seconds: 3600, validSeconds: 604800 } as const;
/** computeCheckChance(will,58,+40), not a fixed70% result. S1 will28 gives70%; actual +1 verified in dark-angel/index.ts:218. */
export const HANGED_MAN_CONSUMPTION = {
  difficulty: 58, preparedBonus: 40, actions: 1, spirituality: 30, successMind: 12,
  minimumHealth: 80, minimumMind: 70, maximumPollution: 0,
  failureHealth: 45, failureMind: 40, failurePollution: 35,
  greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70,
} as const;
export const HANGED_MAN_PRACTICE_COSTS = {
  pressureBearing: { actions: 1, spirituality: 12, mind: 5, validSeconds: 20, appliedHealth: 3 },
  cooperativeSeal: { actions: 1, spirituality: 12, mind: 5, spiritSpirituality: 3, validSeconds: 20, sealUses: 1 },
  report: { actions: 1, seconds: 30 }, walkSecondsPerMetre: 1, workerEnergyPerMetre: 1,
} as const;
/** Independent branch provenance; all dates must precede the first actual
 * Dark Angel guidance receipt (source723:1352-04-15). Not a rewritten receipt. */
export const HANGED_MAN_SUCCESSION = {
  branchId: 'hanged-man-independent-original-1352', formerOwnerId: 'HM223-PRIOR-OWNER', formerOwnerAlive: false,
  death: { id: 'HM223-PRIOR-DEATH', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 4, day: 10 } },
  separation: { id: 'HM223-SEPARATION', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 4, day: 10 } },
  custody: { id: 'HM223-UNIQUENESS-CUSTODY', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 4, day: 12 }, custodianId: 'HM223-CUSTODIAN', custodyOnly: true },
  originalIds: [...HANGED_MAN_ORIGINAL_IDS], uniquenessId: 'HM223-UNIQUENESS', objectCount: 1, currentIncumbent: null,
} as const;
export const HANGED_MAN_ABILITIES = [
  {
    id: 'hanged-man.s0.finite-pressure-bearing', label: '有限承压',
    description: '本人在已检查的局部装置前支付1行动、12灵性与5精神，维持最多20秒的原位短窗。下一次实际测试由本人承担3健康的局部压力，把封闩稳住一轮实际检查，实际发生后才增长掌握。源压力仍为3，不能把旧伤、未知后果或他人的生命改写成已经承担。离位、停止、撤回或到期即失效；普通支撑和绞盘仍可使用。',
  },
  {
    id: 'hanged-man.s0.single-spirit-seal', label: '单灵协同封条',
    description: '持续接触已检查的局部封闩及一张实购封条，明确选择仍被放牧、内收且可用的一位原灵，只调用其实际已选短暂护持或遮护。本人支付1行动、12灵性、5精神，所选原灵支付3灵性，开启最多20秒的一次贴封短窗。实际贴上同一封条才用尽充能并增长掌握；移动、松手、撤回、到期或原灵失效立即结束短窗，已付费用保留。不外放、不扩容、不恢复原灵，也不改变原院旧残余。',
  },
] as const;
export const HANGED_MAN_STORY = '薇拉与埃德温要结束短压廊的一班维护。先检查两段各三米的通路、普通绞盘和侧门，向42岁的短廊值守者伊文取得本次许可，分别征得两名工人的同意并支付本班工钱，再逐人记录实际行走和退出。原院的玛拉、原卡、旧封条和两位原灵仍保持各自真实状态。晋升后，可由你独自在已隔离的局部装置前练习有限承压和单灵贴封；没有人需要为展示能力重新置身危险。';
export const HANGED_MAN_GOAL = '先追回三份失败原特性中的同一份，实际成为暗天使；完成三案、报告和反思。其后核对另外两份原件与唯一性的保管链，让两位成人真实退出，成为暗天使满十二个实际周后，再独立决定是否饮用。';
export const HANGED_MAN_RISK = '充分准备也不保证成功，概率随当前意志与本瓶本次实付准备变化。失败留下真实费用、重伤与污染，严重失败可能死亡。幸存者须封存实际残余、等待并付费回收同一原件；新药瓶不能增加第四份特性，死亡不能通过退出或重开撤销。';
export const HANGED_MAN_STOP_TEXT = '停止未用短窗并松开接触，用已检查的普通绞盘固定装置、打开侧门，按每个人的真实位置和剩余精力逐人走出。旧费用、受伤、封条耗用和原灵消耗全部保留，退出按钮不代替实际行走。';
