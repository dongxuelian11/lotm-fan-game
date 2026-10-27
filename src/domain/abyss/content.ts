/** Stage224 authored mechanics. Canonical complete S0 formula/ritual and a new
 * god's full powers are unknown. This independent warehouse, custody chain,
 * costs and two narrowly bounded applications are original game content. */
export const ABYSS_ORIGINAL_IDS = ['unclean-monarch-potion-1', 'unclean-monarch-potion-2', 'unclean-monarch-potion-3'] as const;
export const ABYSS_ABILITY_IDS = ['abyss.s0.contact-corrosion', 'abyss.s0.brief-danger-sense'] as const;
export type AbyssOriginalId = typeof ABYSS_ORIGINAL_IDS[number];
export type AbyssAbilityId = typeof ABYSS_ABILITY_IDS[number];
export type AbyssPosition = 'ORIGINAL_ENTRY' | 'OUTSIDE' | 'ENTRY' | 'MIDPOINT' | 'GATE';
export type AbyssWorkerId = 'AB224-CORA' | 'AB224-OSWALD';
export type AbyssSegmentId = 'A' | 'B';
export type AbyssConsent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
export const ABYSS_PLACES = [
  { id: 'AB224-COURT-ENTRY', title: '原安静室入口' },
  { id: 'AB224-COURT-OUTSIDE', title: '原安静室外' },
  { id: 'AB224-WAREHOUSE', title: '河岸货栈交接处' },
  { id: 'AB224-RECOVERY', title: '原服药交接处' },
  { id: 'AB224-VAULT', title: '唯一性保管室' },
  { id: 'AB224-WORKSHOP', title: '封闭调配室' },
] as const;
export type AbyssPlaceId = typeof ABYSS_PLACES[number]['id'];
export const ABYSS_WORKERS = [
  { id: 'AB224-CORA', name: '科拉', age: 35 },
  { id: 'AB224-OSWALD', name: '奥斯瓦尔德', age: 43 },
] as const;
export const ABYSS_EXIT_METRES = { ORIGINAL_ENTRY: 2, OUTSIDE: 0, ENTRY: 2, MIDPOINT: 5, GATE: 8 } as const;
export const ABYSS_MIN_UNCLEAN_MONARCH_WEEKS = 12;
export const ABYSS_SPIRITUALITY_CAP = 150;
export const ABYSS_GUIDANCE = { actions: 1, cash: 100 } as const;
export const ABYSS_PRICES = {
  workerService: 20, ordinaryTools: 30, residueInspection: 120, originalRecovery: 30,
  uniquenessVerification: 100, uniquenessHandover: 150, carrier: 50, compose: 40, sealedRecovery: 60,
} as const;
export const ABYSS_PREPARATION = { actions: 1, cash: 150, spirituality: 12, mind: 8, seconds: 3600, validSeconds: 604800 } as const;
/** Actual S1 will23 gives 70% with this bottle's paid +40 preparation. */
export const ABYSS_CONSUMPTION = {
  difficulty: 53, preparedBonus: 40, actions: 1, spirituality: 30, successMind: 12,
  minimumHealth: 80, minimumMind: 70, maximumPollution: 0,
  failureHealth: 45, failureMind: 40, failurePollution: 35,
  greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70,
} as const;
/** Actual will23/perception25 yield74%; no fixed success or future-roll peek. */
export const ABYSS_PRACTICE_COSTS = {
  corrosion: { actions: 1, spirituality: 12, mind: 5, validSeconds: 20, difficulty: 11, integrityLoss: 25 },
  dangerSense: { actions: 1, spirituality: 12, mind: 5, validSeconds: 20, difficulty: 13, impact: 8, reducedImpact: 3 },
  report: { actions: 1, seconds: 30 },
} as const;
/** Independent succession predates the actual first guidance at1352-12-09.
 * It is evidence attached to the new chapter, never an edited old receipt. */
export const ABYSS_SUCCESSION = {
  branchId: 'abyss-independent-original-1352', formerOwnerId: 'AB224-PRIOR-OWNER', formerOwnerAlive: false,
  death: { id: 'AB224-PRIOR-DEATH', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 12, day: 1 } },
  separation: { id: 'AB224-SEPARATION', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 12, day: 1 } },
  custody: { id: 'AB224-UNIQUENESS-CUSTODY', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 12, day: 2 }, custodianId: 'AB224-CUSTODIAN', custodyOnly: true },
  originalIds: [...ABYSS_ORIGINAL_IDS], uniquenessId: 'AB224-UNIQUENESS', objectCount: 1, currentIncumbent: null,
} as const;
export const ABYSS_ABILITIES = [
  { id: ABYSS_ABILITY_IDS[0], label: '有限接触侵蚀', description: '本人独自在检修台持续接触眼前同一枚原轴销，实付1行动、12灵性和5精神，开启20秒单次短窗。实际应用按当前意志检定；成功才使这一枚轴销完整度减少25并留下磨损，失败仍保留费用。松手、移位、撤回、目标变化或到期失效。仅限这件已查明的货闸原销，不能侵蚀远处、活人或全域环境。普通工具仍能完成拆检。' },
  { id: ABYSS_ABILITY_IDS[1], label: '短危险感应', description: '本人独自在检修台查明眼前箱件的滑动方向和实际冲击后，实付1行动、12灵性和5精神，开启20秒单次短窗。下一次亲手短距搬运时按当前感知检定，成功将本人实际8健康冲击减至3，失败仍承受8。不能查看未来掷数、保证命中、预知未知危险或代替他人承受。普通工具固定后搬运仍可使用，停止不退成本。' },
] as const;
export const ABYSS_STORY = '河岸货栈的两道货闸被原轴销卡住。先查明普通侧路，实购工具拆销，让35岁的科拉与43岁的奥斯瓦尔德分别同意本班搬运、领取工钱，带着各自的货物实际走过两段三米通道，再沿普通出口交货。晋升后，你可独自回到检修台处理同一枚已拆原销和一只已见箱件，两位搬运工留在栈外。诺拉、罗安、原卡铃纸、旧刻片和哈兰的真实结果仍留在原处。';
export const ABYSS_GOAL = '核对本体内的一份污秽君王特性，实际取得另外两份原件与同一唯一性，完成货栈两人的真实搬运退出。成为污秽君王满十二个实际周后，可实付准备并独立决定饮用；每周工作和生活费照常。';
export const ABYSS_RISK = '充分准备也不保证成功，概率随当前意志与本瓶本次准备变化。失败留下真实费用、重伤、精神损耗与污染，严重失败可能死亡。存活失败须封存、等待七日并付费回收同一残余；载体不能创造第四份特性，退出或重开不能撤销死亡。';
export const ABYSS_STOP_TEXT = '结束短窗并松手，按每个人和货物的实际位置沿已查明普通侧路退出，再关闭货闸与侧门。已付工钱、行动、磨损、伤势和货物路程全部保留。';
