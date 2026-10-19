/** Stage228 authored mechanics. Canonical complete S0 formula/ritual and a new
 * god's full powers are unknown. This independent short gate corridor, custody chain,
 * costs and two narrowly bounded applications are original game content. */
export const JUSTICIAR_ORIGINAL_IDS = ['hand-of-order-potion-1', 'hand-of-order-potion-2', 'hand-of-order-potion-3'] as const;
export const JUSTICIAR_ABILITY_IDS = ['justiciar.s0.physical-gate-constraint', 'justiciar.s0.own-action-priority'] as const;
export type JusticiarOriginalId = typeof JUSTICIAR_ORIGINAL_IDS[number];
export type JusticiarAbilityId = typeof JUSTICIAR_ABILITY_IDS[number];
export type JusticiarPosition = 'ORIGINAL_ENTRY' | 'OUTSIDE' | 'ENTRY' | 'MIDPOINT' | 'GATE';
export type JusticiarWorkerId = 'JU228-ADA' | 'JU228-SIMON';
export type JusticiarSegmentId = 'A' | 'B';
export type JusticiarConsent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
export const JUSTICIAR_PLACES = [
  { id: 'JU228-COURT-ENTRY', title: '原练习室入口' },
  { id: 'JU228-COURT-OUTSIDE', title: '原练习室外' },
  { id: 'JU228-DOCK', title: '双道短码头交接处' },
  { id: 'JU228-RECOVERY', title: '原服药交接处' },
  { id: 'JU228-VAULT', title: '唯一性保管室' },
  { id: 'JU228-WORKSHOP', title: '封闭调配室' },
] as const;
export type JusticiarPlaceId = typeof JUSTICIAR_PLACES[number]['id'];
export const JUSTICIAR_WORKERS = [
  { id: 'JU228-ADA', name: '艾达', age: 35 },
  { id: 'JU228-SIMON', name: '西蒙', age: 43 },
] as const;
export const JUSTICIAR_EXIT_METRES = { ORIGINAL_ENTRY: 4, OUTSIDE: 0, ENTRY: 2, MIDPOINT: 5, GATE: 8 } as const;
export const JUSTICIAR_MIN_HAND_OF_ORDER_WEEKS = 12;
export const JUSTICIAR_SPIRITUALITY_CAP = 150;
export const JUSTICIAR_GUIDANCE = { actions: 1, cash: 100 } as const;
export const JUSTICIAR_PRICES = {
  workerService: 20, ordinaryTools: 30, residueInspection: 120, originalRecovery: 30,
  uniquenessVerification: 100, uniquenessHandover: 150, carrier: 50, compose: 40, sealedRecovery: 60,
} as const;
export const JUSTICIAR_PREPARATION = { actions: 1, cash: 150, spirituality: 12, mind: 8, seconds: 3600, validSeconds: 604800 } as const;
/** Actual S1 will26 gives 70% with this bottle's paid +40 preparation. */
export const JUSTICIAR_CONSUMPTION = {
  difficulty: 56, preparedBonus: 40, actions: 1, spirituality: 30, successMind: 12,
  minimumHealth: 80, minimumMind: 70, maximumPollution: 0,
  failureHealth: 45, failureMind: 40, failurePollution: 35,
  greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70,
} as const;
/** Actual will26 yields74%; no fixed success or future-roll peek. */
export const JUSTICIAR_PRACTICE_COSTS = {
  constraint: { actions: 1, spirituality: 12, mind: 5, validSeconds: 20, difficulty: 14, normalDropCentimetres: 8, boundDropCentimetres: 3 },
  priority: { actions: 1, spirituality: 12, mind: 5, validSeconds: 20, difficulty: 14, ordinarySeconds: 8, prioritySeconds: 2 },
  report: { actions: 1, seconds: 30 },
} as const;
/** Independent succession predates the actual first guidance at1352-01-29.
 * It is evidence attached to the new chapter, never an edited old receipt. */
export const JUSTICIAR_SUCCESSION = {
  branchId: 'justiciar-independent-original-1352', formerOwnerId: 'JU228-PRIOR-OWNER', formerOwnerAlive: false,
  death: { id: 'JU228-PRIOR-DEATH', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 1, day: 8 } },
  separation: { id: 'JU228-SEPARATION', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 1, day: 8 } },
  custody: { id: 'JU228-UNIQUENESS-CUSTODY', date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 1, day: 9 }, custodianId: 'JU228-CUSTODIAN', custodyOnly: true },
  originalIds: [...JUSTICIAR_ORIGINAL_IDS], uniquenessId: 'JU228-UNIQUENESS', objectCount: 1, currentIncumbent: null,
} as const;
export const JUSTICIAR_ABILITIES = [
  { id: JUSTICIAR_ABILITY_IDS[0], label: '有限闸约束', description: '本人独自在已查明的后闸旁，实付1行动、12灵性和5精神，对眼前同一物理货闸开启20秒单次约束。持续接触原绳后亲手用普通绞盘下放真实重量，按当前意志检定；成功把这一次下落从8厘米限为3厘米，失败仍落8厘米并额外损2精神。原闸留下磨损，并消耗一块实购缓冲垫；普通支撑接住闸体。移动、松手、撤回、目标变化或到期失效，不能约束远物、活人或任意规则。' },
  { id: JUSTICIAR_ABILITY_IDS[1], label: '本人动作优先', description: '先在检修台声明本人对同一可见箱件的一次待执行搬运动作，再实付1行动、12灵性和5精神开启20秒单次短窗。实际执行时按当前意志检定，成功使本人的这一动作先于本人原定的支撑调整步骤，亲手搬一米后再调整支撑，2秒完成；失败抵抗仍保留，按普通顺序8秒完成并额外损2精神。两种结果均消耗一块实购缓冲垫；可主动抵抗、取消或用普通绑带完成。不会自动移动物体、命令别人、提高其他检定、制定全域法律或改变生死。' },
] as const;
export const JUSTICIAR_STORY = '码头两段三米货道的原销需要普通拆检。先查明绞盘、支撑和普通侧门，实购工具与两块缓冲垫。35岁的艾达与43岁的西蒙各自拥有一份原货物，分别同意搬运并实收工钱，亲自携货走过两段，再沿普通侧门交货。晋升后由你独自处理同一后闸和可见箱件，两位货主留在码头外。薇娜、米拉、原包裹线纸、旧护板和旧对手的实际情况继续保留。';
export const JUSTICIAR_GOAL = '核对本体内的一份秩序之手特性，实际取得另外两份原件与同一唯一性，完成两位成年货主的真实搬运退出。成为秩序之手满十二个实际周后，可实付准备并独立决定饮用；每周工作和生活费照常。';
export const JUSTICIAR_RISK = '充分准备也不保证成功，概率随当前意志与本瓶本次准备变化。失败留下真实费用、重伤、精神损耗与污染，严重失败可能死亡。存活失败须封存、等待七日并付费回收同一残余；载体不能创造第四份特性，退出或重开不能撤销死亡。';
export const JUSTICIAR_STOP_TEXT = '结束短窗并松手，取消本人尚未执行的动作。每个人和货物从各自实际位置沿已查明普通侧路退出，再关闭货闸与侧门。已付工钱、行动、消耗、磨损、伤势和路程保留。';
