import { DEATH_ORIGINAL_IDS, DEATH_SERVICE_IDS, type DeathMaterialPolicy, type DeathSuccession } from './types.js';
export { DEATH_ABILITY_IDS } from './types.js';

export const DEATH_HOME = 'DE0-RECEPTION';
export const DEATH_MATERIAL_LOCATIONS = {
  supplier: 'DE0-SUPPLIER', originalRoom: 'DE0-S1-ORIGINAL-ROOM', workshop: 'DE0-WORKSHOP',
  archive: 'DE0-ARCHIVE', vault: 'DE0-UNIQUENESS-VAULT',
} as const;
export const DEATH_WORKSHOP = DEATH_MATERIAL_LOCATIONS.workshop;
export const DEATH_SUPPLIER = DEATH_MATERIAL_LOCATIONS.supplier;
export const DEATH_ARCHIVE = DEATH_MATERIAL_LOCATIONS.archive;
export const DEATH_VAULT = DEATH_MATERIAL_LOCATIONS.vault;
export const DEATH_CITY_PLACES = [
  { id: DEATH_HOME, title: '街区接待处' }, { id: DEATH_SUPPLIER, title: '原供货交接处' },
  { id: DEATH_MATERIAL_LOCATIONS.originalRoom, title: '原成品服药支持室' },
  { id: DEATH_WORKSHOP, title: '封存调配室' }, { id: DEATH_ARCHIVE, title: '传承档案室' },
  { id: DEATH_VAULT, title: '唯一性保管室' }, { id: 'DE0-RESIDUE-ROOM', title: '街区残余保管室' },
  { id: 'DE0-OLD-WHARF', title: '旧码头绳桥' },
] as const;
export const DEATH_GUIDANCE = { cash: 12, actions: 1 } as const;
/** Same current-era economy, never character.weeklyWage or the Sun wage. */
export const DEATH_CURRENT_ERA = {
  work: { actions: 1, cashGain: 24 },
  rest: { actions: 1, cash: 8, healthGain: 5, mindGain: 8, spiritualityGain: 10, pollutionReduction: 4 },
  clinic: { actions: 1, cash: 60, healthGain: 0, removeInjuries: false },
  nextWeek: { requiredRemainingActions: 0, cash: 24, days: 7, actions: 4 },
  emergencyWork: { maximumPerWeek: 1, cashBelow: 24, requiredRemainingActions: 0, cashGain: 24 },
  injuryRecoveryHealth: 80,
} as const;
/** Existing bottle prices and labour are historical, era-specific obligations.
 * Only the remaining five exact supplier tasks may be completed; no partial discount. */
export const DEATH_ORIGINAL_BOTTLE_PRICES = {
  ORIGINAL: { full: 6600, labourSteps: 5, afterLabour: 1100 },
  POST_CYCLE: { full: 1200, labourSteps: 5, afterLabour: 80 },
} as const;
/** Future S1 same-original recovery. This is not the cheaper S0 legacy-remains service. */
export const DEATH_S1_RECOVERY_PRICES = {
  ORIGINAL: { investigation: 100, investigateActions: 1, handoverActions: 1, full: 1100, labourSteps: 5, afterLabour: 100 },
  POST_CYCLE: { investigation: 20, investigateActions: 1, handoverActions: 1, full: 120, labourSteps: 5, afterLabour: 12 },
} as const;
export const DEATH_FUTURE_BRANCH = {
  id: 'death-original-future-1412', predecessorId: 'DE0-PREDECESSOR-1412',
  custodianId: 'DE0-UNIQUENESS-CUSTODIAN',
  terminationDate: { epoch: 'FIFTH_EPOCH', year: 1412, month: 9, day: 8 },
  transferDate: { epoch: 'FIFTH_EPOCH', year: 1412, month: 9, day: 9 },
  story: '档案记载，前任死神于1412年9月8日陨落，同一件唯一性与三份苍白皇帝特性随之分离。次日，三份特性分别交由原成品渠道封存，唯一性由从未容纳它的保管人单独保管。须逐项核验原交接、当前神位空缺和现地保管情况，再征得本次交接同意。',
} as const;
const branch = DEATH_FUTURE_BRANCH;
/** Private authored lineage. No permission is granted by reading this record.
 * Source admission must use compareGameDates against actual first S1 guidance,
 * and reject any declared conflicting incumbent or uniqueness holder. */
export const DEATH_SUCCESSION: DeathSuccession = {
  branchId: branch.id, uniquenessId: 'DE0-U1', seal: 'DE0-U1-ORIGINAL-SEAL', objectCount: 1,
  predecessorId: branch.predecessorId, predecessorStillEmbodied: false,
  termination: { eventId: 'DE0-TERMINATION-1412-0908', date: { ...branch.terminationDate }, cause: 'ACTUAL_DEATH', status: 'DEAD', health: 0 },
  separation: { eventId: 'DE0-SEPARATION-1412-0908', date: { ...branch.terminationDate }, objectId: 'DE0-U1' },
  transfer: { eventId: 'DE0-CUSTODY-1412-0909', date: { ...branch.transferDate }, objectId: 'DE0-U1', toActorId: branch.custodianId, custodyOnly: true },
  characteristicCustody: DEATH_ORIGINAL_IDS.map((originalBottleId, index) => ({
    originalBottleId, characteristicId: `${originalBottleId}:characteristic` as const,
    separation: { eventId: `DE0-S1-${index + 1}-SEPARATION-1412-0908`, date: { ...branch.terminationDate } },
    transfer: { eventId: `DE0-S1-${index + 1}-CUSTODY-1412-0909`, date: { ...branch.transferDate }, toActorId: 'DE0-ORIGINAL-SUPPLIER' },
  })),
  incumbentActorId: null, custodianActorId: branch.custodianId, custodianEmbodied: false,
  location: DEATH_VAULT, permission: null, conditionVersion: 1,
};
export const DEATH_MATERIAL_POLICY: DeathMaterialPolicy = {
  id: 'death-material-policy-v1', supplierLocation: DEATH_SUPPLIER, workshopLocation: DEATH_WORKSHOP,
  archiveLocation: DEATH_ARCHIVE, legacyLocation: DEATH_MATERIAL_LOCATIONS.originalRoom,
  carrierPrices: { 'death-carrier-1': 12, 'death-carrier-2': 16, 'death-carrier-3': 20 },
  investigateFee: 4, legacyRecoveryFee: 12, legacyLabourCredit: 8,
  uniquenessCheckFee: 4, uniquenessHandoverFee: 8, composeFee: 8, sealedRecoveryFee: 12,
  sealSeconds: 600, succession: DEATH_SUCCESSION, serviceIds: DEATH_SERVICE_IDS,
};
export const DEATH_CONSUMPTION = {
  difficulty: 57, bonus: 40, actions: 1, spirituality: 30, successMind: 12,
  failureHealth: 45, failureMind: 40, failurePollution: 35, failureInjuryRisk: 2,
  greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70,
  minimumS1Weeks: 12, minimumHealth: 80, minimumMind: 70, requiredActing: 100,
} as const;
export const DEATH_PROMOTION_STABILITY = {
  actions: 1, cash: 12, spirituality: 12, mind: 8, validSeconds: 604800,
  minimumMindBefore: 78, minimumSpiritualityBefore: 42, minimumActionsBefore: 2,
} as const;
export const DEATH_SPIRITUALITY_CAP = 150;
/** Static budgeting example, not awarded cash and not a guaranteed successful roll. */
export const DEATH_FIRST_ROUND_CURRENT195 = {
  guidance: 12, residueService: 4, wharfService: 4, twoFailedOriginalsWithLabour: 16,
  twoUniquenessChecks: 8, uniquenessHandover: 8, firstCarrier: 12, compose: 8, stabilize: 12,
  total: 84, excludesLivingExpenses: true,
} as const;
export const DEATH_ABILITIES = [
  { id: 'death.s0.partial-spirit-passage', label: '局部灵界通路',
    description: '查明两端和同一条短路，得到一名在场活人的本次同意后，尝试开启20秒通路。须另行带领本人走完，才算实际应用；端点移位、同意撤回、遮挡或超时都会中断。普通绳桥退路始终保留。' },
  { id: 'death.s0.residual-propagation-barrier', label: '残余传播阻隔',
    description: '对已亲见的同一条有限残余传播线，尝试开启20秒阻隔窗口。须随后确实拦下一次传播才算应用；遮屏落下、目标改变或超时都会失效。它不收取灵魂，不控制活人，也不抹去已经发生的伤势。' },
] as const;
export const DEATH_EPILOGUE_BOUNDARIES = {
  incidentId: 'death-original-wharf-aftershock', windowSeconds: 20,
  maximumCompanions: 1, maximumPropagationLines: 1, attemptsPerAbility: 1,
  repeatIncident: false, revive: false, harvestSouls: false, resetCompletedServices: false,
  ordinaryExitRequired: true, masteryRequiresApplication: true,
} as const;
export const DEATH_STORY = '街区保管室有一处有限残余泄漏，旧码头的两名活工人需要沿绳桥退出。亲自询问、查看原物与退路，再逐步处理和交接；两件事都能用普通办法完成。';
export const DEATH_GOAL = '保留本人已经融合的一份苍白皇帝特性，逐一查清另外两份的实际下落，核验同一唯一性的传承与空位。完成两件居民事务后，为同一本人的同一瓶作付费准备；实际晋升苍白皇帝满十二周才可服药。';
export const DEATH_RISK = '成功率按当前意志和本瓶已付准备计算，只进行一次真实检定。失败留下真实重伤与污染，严重失败可能死亡。幸存者须在原处封存仍存在的同一残余，隔周付费回收后另购剩余载体；总共只有三件载体。';
