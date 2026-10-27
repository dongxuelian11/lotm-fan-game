/** Stage225 authored mechanics. Canonical complete S0 formula/ritual and a new
 * god's full powers are unknown. This independent short gate corridor, custody chain,
 * costs and two narrowly bounded applications are original game content. */
export const CHAINED_ORIGINAL_IDS = ['abomination-potion-1', 'abomination-potion-2', 'abomination-potion-3'] as const;
export const CHAINED_ABILITY_IDS = ['chained.s0.local-binding', 'chained.s0.impact-burden'] as const;
export type ChainedOriginalId = typeof CHAINED_ORIGINAL_IDS[number];
export type ChainedAbilityId = typeof CHAINED_ABILITY_IDS[number];
export type ChainedPosition = 'ORIGINAL_ENTRY' | 'OUTSIDE' | 'ENTRY' | 'MIDPOINT' | 'GATE';
export type ChainedWorkerId = 'CH225-VERA' | 'CH225-EDWIN';
export type ChainedSegmentId = 'A' | 'B';
export type ChainedConsent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
export const CHAINED_PLACES = [
  { id: 'CH225-COURT-ENTRY', title: '原安静室入口' },
  { id: 'CH225-COURT-OUTSIDE', title: '原安静室外' },
  { id: 'CH225-CORRIDOR', title: '短闸廊交接处' },
  { id: 'CH225-RECOVERY', title: '原服药交接处' },
  { id: 'CH225-VAULT', title: '唯一性保管室' },
  { id: 'CH225-WORKSHOP', title: '封闭调配室' },
] as const;
export type ChainedPlaceId = typeof CHAINED_PLACES[number]['id'];
export const CHAINED_WORKERS = [
  { id: 'CH225-VERA', name: '薇拉', age: 35 },
  { id: 'CH225-EDWIN', name: '埃德温', age: 43 },
] as const;
export const CHAINED_EXIT_METRES = { ORIGINAL_ENTRY: 4, OUTSIDE: 0, ENTRY: 2, MIDPOINT: 5, GATE: 8 } as const;
export const CHAINED_MIN_ABOMINATION_WEEKS = 12;
export const CHAINED_SPIRITUALITY_CAP = 150;
export const CHAINED_GUIDANCE = { actions: 1, cash: 100 } as const;
export const CHAINED_PRICES = {
  workerService: 20, ordinaryTools: 30, residueInspection: 120, originalRecovery: 30,
  uniquenessVerification: 100, uniquenessHandover: 150, carrier: 50, compose: 40, sealedRecovery: 60,
} as const;
export const CHAINED_PREPARATION = { actions: 1, cash: 150, spirituality: 12, mind: 8, seconds: 3600, validSeconds: 604800 } as const;
/** Actual S1 will25 gives 70% with this bottle's paid +40 preparation. */
export const CHAINED_CONSUMPTION = {
  difficulty: 55, preparedBonus: 40, actions: 1, spirituality: 30, successMind: 12,
  minimumHealth: 80, minimumMind: 70, maximumPollution: 0,
  failureHealth: 45, failureMind: 40, failurePollution: 35,
  greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70,
} as const;
/** Actual will25/perception25 yield74%; no fixed success or future-roll peek. */
export const CHAINED_PRACTICE_COSTS = {
  binding: { actions: 1, spirituality: 12, mind: 5, validSeconds: 20, difficulty: 13, normalDropCentimetres: 8, boundDropCentimetres: 3 },
  impactBurden: { actions: 1, spirituality: 12, mind: 5, validSeconds: 20, difficulty: 13, impact: 8, reducedImpact: 3 },
  report: { actions: 1, seconds: 30 },
} as const;
/** Independent succession predates the actual first guidance at1352-04-22.
 * It is evidence attached to the new chapter, never an edited old receipt. */
export const CHAINED_SUCCESSION = {
  branchId: 'chained-independent-original-1352', formerOwnerId: 'CH225-PRIOR-OWNER', formerOwnerAlive: false,
  death: { id: 'CH225-PRIOR-DEATH', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 4, day: 1 } },
  separation: { id: 'CH225-SEPARATION', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 4, day: 1 } },
  custody: { id: 'CH225-UNIQUENESS-CUSTODY', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 4, day: 2 }, custodianId: 'CH225-CUSTODIAN', custodyOnly: true },
  originalIds: [...CHAINED_ORIGINAL_IDS], uniquenessId: 'CH225-UNIQUENESS', objectCount: 1, currentIncumbent: null,
} as const;
export const CHAINED_ABILITIES = [
  { id: CHAINED_ABILITY_IDS[0], label: '局部束缚', description: '本人持续接触后闸同一段原绳，实付1行动、12灵性和5精神，开启20秒单次短窗；随后亲手用普通绞盘受控下放原闸的真实重量时，按当前意志检定。成功限制绳段滑动，闸下降由8厘米减至3厘米，绳磨损加一；失败仍由普通支撑接住，闸真实下落8厘米并额外损2精神。一次载荷只发生一次，松手、移动、撤回、目标变化或到期失效。普通绞盘与支撑始终可完成，不束缚他人、远处或无限目标。' },
  { id: CHAINED_ABILITY_IDS[1], label: '有限冲击承担', description: '本人亲见同一待搬箱件及其下一米移动将产生的一次冲击后，实付1行动、12灵性和5精神开启20秒单次短窗。真实搬动时按当前感知检定，成功把本人这一次8健康冲击减至3，失败承受8并额外损2精神。箱件只移动一次，不能反复制造载荷；不会复活、免疫诅咒或替旁人无条件承伤。普通夹具绑带可预先固定箱件后完成搬运。' },
] as const;
export const CHAINED_STORY = '短闸廊两道货闸的原销需要普通拆检。先查明永远可用的绞盘、支撑和侧路，实购工具，让35岁的薇拉与43岁的埃德温分别同意本班搬运、领取工钱，携各自原货物实际通过两段三米通道，再沿普通出口交货。晋升后由你独自检查同一后闸原绳的有限载荷与一只已见箱件，两位成年人留在廊外。埃尔莎、哈伦、原衣包盘纸，以及罗德里克的投降与未治疗重伤保持原状。';
export const CHAINED_GOAL = '核对本体内的一份神孽特性，实际取得另外两份原件与同一唯一性，完成闸廊两人的真实搬运退出。成为神孽满十二个实际周后，可实付准备并独立决定饮用；每周工作和生活费照常。';
export const CHAINED_RISK = '充分准备也不保证成功，概率随当前意志与本瓶本次准备变化。失败留下真实费用、重伤、精神损耗与污染，严重失败可能死亡。存活失败须封存、等待七日并付费回收同一残余；载体不能创造第四份特性，退出或重开不能撤销死亡。';
export const CHAINED_STOP_TEXT = '结束短窗并松手，按每个人和货物的实际位置沿已查明普通侧路退出，再关闭货闸与侧门。已付工钱、行动、磨损、伤势和货物路程全部保留。';
