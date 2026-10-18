import type { PublicCheckResult } from '../../shared/contracts.js';
import type { WriterAcquisitionEvent, WriterBottle, WriterState } from '../writer/types.js';
import { resolveWriterOriginalCharacteristicsSnapshot } from '../writer/index.js';
import { WRITER_POTION_SOURCES } from '../writer/content.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import { emptyVisionaryEffect, type VisionaryEffect, type VisionaryHost, type VisionaryModuleResult } from './ports.js';
import { VISIONARY_CARRIER_BATCHES, VISIONARY_CARRIER_REFILLS, VISIONARY_CHARACTERISTIC_BOTTLES, VISIONARY_FORMULA_NOTICE,
  VISIONARY_LABOUR_TASKS, VISIONARY_MATERIAL_LOCATIONS as LOC, VISIONARY_MATERIAL_PRICES as PRICE,
  VISIONARY_RECOVERY_NOTICE, VISIONARY_UNIQUENESS_ID, VISIONARY_UNIQUENESS_SOURCE, VISIONARY_UNIQUENESS_STEPS } from './material-content.js';

export type VisionaryMaterialBottleId = typeof VISIONARY_CHARACTERISTIC_BOTTLES[number];
export type VisionaryLabourId = typeof VISIONARY_LABOUR_TASKS[number]['id'];
export type VisionaryCarrierId = typeof VISIONARY_CARRIER_BATCHES[number]['id'];
export type VisionaryUniquenessStep = typeof VISIONARY_UNIQUENESS_STEPS[number]['id'];
export type VisionaryMaterialCommand =
  | { type: 'MATERIAL_LABOUR'; bottleId: VisionaryMaterialBottleId; taskId: VisionaryLabourId }
  | { type: 'ACQUIRE_CHARACTERISTIC' | 'INVESTIGATE_LEGACY_REMAINS' | 'SEAL_LEGACY_REMAINS' | 'RECOVER_LEGACY_REMAINS'; bottleId: VisionaryMaterialBottleId }
  | { type: 'VERIFY_UNIQUENESS'; step: VisionaryUniquenessStep }
  | { type: 'ACQUIRE_UNIQUENESS' }
  | { type: 'BUY_COMPOUND' | 'REQUEST_COMPOUND_REPAIR' | 'RECEIVE_COMPOUND_REPAIR' | 'COMPOSE_POTION'; batchId: VisionaryCarrierId }
  | { type: 'SEAL_REMAINS'; compoundId: string; method: 'ABILITY' | 'PROFESSIONAL' }
  | { type: 'RECOVER_SEALED'; compoundId: string };
export interface VisionaryMaterialOrigin {
  actorId: string; sourceDigest: string; bottles: WriterBottle[];
  consumption: WriterAcquisitionEvent; consumptions?: WriterAcquisitionEvent[]; inheritanceLocation?: string; resupply: WriterState['resupply'];
  /** Exact frozen recovery evidence, never a caller-authored ancestry mapping. */
  acquisitionJournal?: WriterAcquisitionEvent[];
}
export type VisionaryMaterialHolder = 'EMBODIED' | 'SUPPLIER' | 'CUSTODIAN' | 'PLAYER' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'LOST' | 'FUSED' | 'UNLOCATED' | 'LEGACY_RESIDUE' | 'LEGACY_SEALED';
interface MaterialEvidence { eventId: string; week: number }
export interface VisionaryCharacteristic {
  id: string; originBottleId: string; holder: VisionaryMaterialHolder; location: string | null; compoundId: string | null;
  labour: (MaterialEvidence & { taskId: VisionaryLabourId })[];
  acquiredEventId: string | null; acquiredWeek: number | null;
}
export interface VisionaryUniqueness {
  id: typeof VISIONARY_UNIQUENESS_ID; holder: VisionaryMaterialHolder; location: string | null; compoundId: string | null;
  checks: (MaterialEvidence & { step: VisionaryUniquenessStep })[];
  acquiredEventId: string | null; acquiredWeek: number | null; incumbentActorId: string | null;
}
export interface VisionaryCarrierBatch {
  id: VisionaryCarrierId; status: 'SUPPLIER' | 'PLAYER' | 'IN_COMPOUND' | 'SPENT' | 'REPAIR_ORDERED'; location: string;
  acquiredEventId: string | null; acquiredWeek: number | null; uses: number; spentWeek: number | null;
  repair: (MaterialEvidence & { refillId: string; deliveredEventId: string | null; deliveredWeek: number | null }) | null;
}
export interface VisionaryCompound {
  id: string; batchId: VisionaryCarrierId; status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'FAILED_LOST' | 'RECOVERED';
  location: string; preparedEventId: string; preparedWeek: number; consumedWeek: number | null;
  settlementEventId: string | null; sealedEventId: string | null; recoveredEventId: string | null;
  /** References, never additional inventory. The first characteristic remains embodied before successful fusion. */
  characteristicIds: string[]; uniquenessId: typeof VISIONARY_UNIQUENESS_ID;
}
export interface VisionaryMaterialReceipt {
  eventId: string; revision: number; week: number; actorId: string; location: string;
  command: VisionaryMaterialCommand; effect: VisionaryEffect; check: PublicCheckResult | null;
}
export interface VisionaryMaterialSettlement {
  eventId: string; week: number; compoundId: string; success: boolean; alive: boolean; location: string;
}
export interface VisionaryLegacyRemains {
  originBottleId: VisionaryMaterialBottleId; sourceRevision: number; sourceWeek: number; custodyId: string;
  status: 'UNLOCATED' | 'LOCATED' | 'SEALED' | 'RECOVERED'; location: string | null;
  investigatedEventId: string | null; sealedEventId: string | null; recoveredEventId: string | null;
}
export interface VisionaryMaterialsState {
  version: 1; origin: VisionaryMaterialOrigin; characteristics: VisionaryCharacteristic[]; uniqueness: VisionaryUniqueness;
  batches: VisionaryCarrierBatch[]; compounds: VisionaryCompound[]; receipts: VisionaryMaterialReceipt[];
  settlements: VisionaryMaterialSettlement[]; legacyRemains: VisionaryLegacyRemains[];
  refills: { id: string; batchId: VisionaryCarrierId | null; orderedEventId: string | null; deliveredEventId: string | null }[];
}
export interface VisionaryMaterialAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: VisionaryMaterialCommand }
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min;
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 256;
const same = (a: unknown, b: unknown) => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const good = (c: PublicCheckResult | null) => c?.tier === 'SUCCESS' || c?.tier === 'GREAT_SUCCESS';
const characteristicId = (bottleId: string) => `${bottleId}:characteristic`;
const compoundId = (v: unknown): v is string => typeof v === 'string' && /^visionary-compound-[1-9][0-9]{0,3}$/.test(v);
const bottleId = (v: unknown): v is VisionaryMaterialBottleId => VISIONARY_CHARACTERISTIC_BOTTLES.some(id => id === v);
const carrierId = (v: unknown): v is VisionaryCarrierId => VISIONARY_CARRIER_BATCHES.some(b => b.id === v);
const stepId = (v: unknown): v is VisionaryUniquenessStep => VISIONARY_UNIQUENESS_STEPS.some(s => s.id === v);
const labourId = (v: unknown): v is VisionaryLabourId => VISIONARY_LABOUR_TASKS.some(t => t.id === v);
const originalForAttempt = (b: WriterBottle) => b.recovery?.originalBottleId ?? b.id;
/** These lookups run only after origin validation has established the complete
 * recovery genealogy. The historical attempt rows remain untouched. */
const currentOriginBottle = (origin: VisionaryMaterialOrigin, id: string) => origin.bottles.filter(b => originalForAttempt(b) === id).at(-1)!;
const currentOriginBottles = (origin: VisionaryMaterialOrigin) => VISIONARY_CHARACTERISTIC_BOTTLES.map(id => currentOriginBottle(origin, id));
const recoveredCustody = (s: VisionaryMaterialsState, id: string) => {
  const b = currentOriginBottle(s.origin, id); return !!b.recovery && b.status === 'SUPPLIER';
};
const integratedBottle = (s: VisionaryMaterialsState) => {
  const command = s.origin.consumption.command;
  return command.type === 'CONSUME' ? originalForAttempt(s.origin.bottles.find(b => b.id === command.bottleId)!) : '';
};
const embodied = (s: VisionaryMaterialsState) => s.characteristics.find(i => i.originBottleId === integratedBottle(s))!;
const external = (s: VisionaryMaterialsState) => s.characteristics.filter(i => i.originBottleId !== integratedBottle(s));
const inheritedLabour = (s: VisionaryMaterialsState, id: string) => currentOriginBottle(s.origin, id).labourSteps;
const labourTotal = (s: VisionaryMaterialsState, item: VisionaryCharacteristic) => inheritedLabour(s, item.originBottleId) + item.labour.length;
const receiptFor = (s: VisionaryMaterialsState, eventId: string | null) => s.receipts.find(r => r.eventId === eventId);
function validMaterialCheck(c: unknown, difficulty: number): c is PublicCheckResult {
  if (!record(c) || !exact(c, ['ability', 'baseAbility', 'modifiers', 'effectiveAbility', 'difficulty', 'chance', 'roll', 'tier']) ||
      c.ability !== 'will' || c.difficulty !== difficulty || !integer(c.baseAbility) || c.baseAbility > 500 || !integer(c.roll, 1) || c.roll > 100 ||
      !Array.isArray(c.modifiers) || c.modifiers.length > 16 || c.modifiers.some(m => !record(m) || !exact(m, ['source', 'value']) ||
        !text(m.source) || !Number.isSafeInteger(m.value) || Math.abs(m.value as number) > 500) ||
      c.modifiers.reduce((sum, modifier) => sum + (modifier.value as number), 0) !== 0 || c.effectiveAbility !== c.baseAbility ||
      c.chance !== Math.max(5, Math.min(95, 50 + 2 * (c.baseAbility - difficulty)))) return false;
  return c.tier === (c.roll <= 5 ? 'GREAT_SUCCESS' : c.roll >= 96 ? 'GREAT_FAILURE' : c.roll <= c.chance ? 'SUCCESS' : 'FAILURE');
}

/** Checks the original three characteristics, without rewriting any old bottle.
 * The central owner additionally binds sourceDigest and the entire receipt to
 * its frozen, strictly replayed source snapshot. */
export function validateVisionaryMaterialOrigin(v: unknown): v is VisionaryMaterialOrigin {
  if (!record(v) || !exact(v, ['actorId', 'sourceDigest', 'bottles', 'consumption', 'resupply',
      ...(Object.hasOwn(v, 'consumptions') ? ['consumptions'] : []), ...(Object.hasOwn(v, 'inheritanceLocation') ? ['inheritanceLocation'] : []),
      ...(Object.hasOwn(v, 'acquisitionJournal') ? ['acquisitionJournal'] : [])]) || !text(v.actorId) ||
      typeof v.sourceDigest !== 'string' || !/^[a-f0-9]{64}$/.test(v.sourceDigest) || !Array.isArray(v.bottles) || v.bottles.length < 3 || v.bottles.length > 10000 ||
      !record(v.consumption) ||
      (Object.hasOwn(v, 'inheritanceLocation') && !text(v.inheritanceLocation))) return false;
  const recovery = Object.hasOwn(v, 'acquisitionJournal');
  if (recovery) {
    if (!Array.isArray(v.acquisitionJournal) || !v.bottles.some(b => record(b) && Object.hasOwn(b, 'recovery'))) return false;
    const lineage = resolveWriterOriginalCharacteristicsSnapshot(v as unknown as Pick<WriterState, 'bottles' | 'acquisitionJournal' | 'resupply'>);
    if (!lineage || lineage.characteristics.length !== 3 || !lineage.embodiedOriginalBottleId || !lineage.embodiedBottleId ||
        !same(v.consumptions, v.acquisitionJournal.filter(e => record(e) && record(e.command) && e.command.type === 'CONSUME'))) return false;
  } else if (v.bottles.length !== 3 || !same(v.resupply, { requestedWeek: null, deliveries: 0 })) return false;
  const receipts = Object.hasOwn(v, 'consumptions') ? v.consumptions : [v.consumption];
  if (!Array.isArray(receipts) || receipts.length < 1 || receipts.length > v.bottles.length) return false;
  const seen = new Set<string>(); let successes = 0;
  for (const r of receipts) {
    const receiptBottle = record(r) && record(r.command) ? r.command.bottleId : null;
    if (!record(r) || !exact(r, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'randomBefore', 'randomAfter', 'check']) ||
        !integer(r.week, 1) || !integer(r.revision) || !isValidGameDate(r.date) || !record(r.command) ||
        !exact(r.command, ['type', 'bottleId', 'confirmed']) || r.command.type !== 'CONSUME' || r.command.confirmed !== true ||
        !text(receiptBottle) || !v.bottles.some(b => record(b) && b.id === receiptBottle) ||
        seen.has(receiptBottle) || !record(r.before) || !record(r.after) || !record(r.actor) || !record(r.before.coreStats) ||
        r.before.sequence !== 2 || r.before.acting !== 100 || r.actor.pathwayId !== 'audience' || !integer(r.after.health, 1) || !integer(r.after.mind, 1) ||
        !integer(r.randomBefore) || r.randomAfter !== r.randomBefore + 1 || !validMaterialCheck(r.check, 30) || r.check.modifiers.length !== 0 ||
        r.check.baseAbility !== r.before.coreStats.will || typeof r.actor.sourceIdentityDigest !== 'string' || !/^[a-f0-9]{64}$/.test(r.actor.sourceIdentityDigest) ||
        typeof r.actor.sourceHistoryDigest !== 'string' || !/^[a-f0-9]{64}$/.test(r.actor.sourceHistoryDigest)) return false;
    const successful = good(r.check);
    if (r.after.sequence !== (successful ? 1 : 2) || r.after.acting !== (successful ? 0 : 100)) return false;
    if (successful) { successes++; if (!same(r, v.consumption)) return false; }
    seen.add(receiptBottle);
  }
  if (successes !== 1 || !same(receipts.at(-1), v.consumption) || !record(v.consumption.command)) return false;
  for (const [i, b] of v.bottles.entries()) {
    const expected = WRITER_POTION_SOURCES[i];
    if (!record(b) || !integer(b.labourSteps) || b.labourSteps > 5) return false;
    if (i < 3 && (!expected || !exact(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) ||
        b.id !== expected.id || b.source !== expected.source || b.stockedWeek !== null)) return false;
    if (i >= 3 && !recovery) return false;
    if (b.status === 'SUPPLIER') {
      if (b.acquiredWeek !== null || b.consumedWeek !== null || b.preparationWeek !== null || b.outcome !== null || seen.has(b.id as string)) return false;
    } else if (b.status === 'PLAYER') {
      if (!text(v.inheritanceLocation) || !integer(b.acquiredWeek, 1) || b.acquiredWeek > (v.consumption.week as number) || b.consumedWeek !== null || b.preparationWeek !== null || b.outcome !== null || seen.has(b.id as string)) return false;
    } else if (b.status === 'CONSUMED') {
      const r = receipts.find(receipt => record(receipt) && record(receipt.command) && receipt.command.bottleId === b.id);
      if (!record(r) || !record(r.check) || !integer(b.acquiredWeek, 1) || b.acquiredWeek > (r.week as number) || b.consumedWeek !== r.week || b.preparationWeek !== r.week || b.outcome !== r.check.tier) return false;
    } else return false;
  }
  return true;
}
export function createVisionaryMaterials(origin: VisionaryMaterialOrigin): VisionaryMaterialsState {
  if (!validateVisionaryMaterialOrigin(origin)) throw new Error('原瓶去向与实际服药回执尚未核清；不能重发原物或改写旧账。');
  const successId = origin.consumption.command.type === 'CONSUME' ? origin.consumption.command.bottleId : '';
  const consumptions = origin.consumptions ?? [origin.consumption];
  const current = currentOriginBottles(origin);
  return { version: 1, origin: structuredClone(origin), characteristics: current.map(b => ({
    id: characteristicId(originalForAttempt(b)), originBottleId: originalForAttempt(b),
    holder: b.id === successId ? 'EMBODIED' : b.status === 'SUPPLIER' ? b.recovery ? 'CUSTODIAN' : 'SUPPLIER' : b.status === 'PLAYER' ? 'PLAYER' : 'UNLOCATED',
    location: b.status === 'SUPPLIER' ? LOC.supplier : b.status === 'PLAYER' ? origin.inheritanceLocation! : null,
    compoundId: null, labour: [], acquiredEventId: null, acquiredWeek: b.acquiredWeek,
  })), uniqueness: { id: VISIONARY_UNIQUENESS_ID, holder: 'CUSTODIAN', location: LOC.vault, compoundId: null,
    checks: [], acquiredEventId: null, acquiredWeek: null, incumbentActorId: null },
    batches: VISIONARY_CARRIER_BATCHES.map(b => ({ id: b.id, status: 'SUPPLIER', location: LOC.supplier,
      acquiredEventId: null, acquiredWeek: null, uses: 0, spentWeek: null, repair: null })),
    compounds: [], receipts: [], settlements: [], legacyRemains: current.filter(b => b.status === 'CONSUMED' && b.id !== successId).map(b => {
      const receipt = consumptions.find(r => r.command.type === 'CONSUME' && r.command.bottleId === b.id)!;
      const original = originalForAttempt(b);
      if (!bottleId(original)) throw new Error('旧原瓶编号不合法。');
      return { originBottleId: original, sourceRevision: receipt.revision, sourceWeek: receipt.week,
        custodyId: `${b.id}:residue:revision-${receipt.revision}`, status: 'UNLOCATED', location: null,
        investigatedEventId: null, sealedEventId: null, recoveredEventId: null };
    }), refills: VISIONARY_CARRIER_REFILLS.map(id => ({ id, batchId: null, orderedEventId: null, deliveredEventId: null })) };
}
export function validateVisionaryMaterialCommand(v: unknown): v is VisionaryMaterialCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  switch (v.type) {
    case 'MATERIAL_LABOUR': return exact(v, ['type', 'bottleId', 'taskId']) && bottleId(v.bottleId) && labourId(v.taskId);
    case 'ACQUIRE_CHARACTERISTIC': case 'INVESTIGATE_LEGACY_REMAINS': case 'SEAL_LEGACY_REMAINS': case 'RECOVER_LEGACY_REMAINS': return exact(v, ['type', 'bottleId']) && bottleId(v.bottleId);
    case 'VERIFY_UNIQUENESS': return exact(v, ['type', 'step']) && stepId(v.step);
    case 'ACQUIRE_UNIQUENESS': return exact(v, ['type']);
    case 'BUY_COMPOUND': case 'REQUEST_COMPOUND_REPAIR': case 'RECEIVE_COMPOUND_REPAIR': case 'COMPOSE_POTION': return exact(v, ['type', 'batchId']) && carrierId(v.batchId);
    case 'SEAL_REMAINS': return exact(v, ['type', 'compoundId', 'method']) && compoundId(v.compoundId) && ['ABILITY', 'PROFESSIONAL'].includes(v.method as string);
    case 'RECOVER_SEALED': return exact(v, ['type', 'compoundId']) && compoundId(v.compoundId);
    default: return false;
  }
}
function materialEffect(s: VisionaryMaterialsState, c: VisionaryMaterialCommand): VisionaryEffect {
  const e = emptyVisionaryEffect(); e.actions = 1;
  switch (c.type) {
    case 'MATERIAL_LABOUR': break;
    case 'INVESTIGATE_LEGACY_REMAINS': e.cashCost = PRICE.legacyInvestigation; break;
    case 'SEAL_LEGACY_REMAINS': e.cashCost = PRICE.legacySealing; e.actions = 2; break;
    case 'RECOVER_LEGACY_REMAINS': e.cashCost = PRICE.legacyRecovery; break;
    case 'ACQUIRE_CHARACTERISTIC': e.cashCost = recoveredCustody(s, c.bottleId) ? 0 : PRICE.characteristic - labourTotal(s, s.characteristics.find(b => b.originBottleId === c.bottleId)!) * PRICE.labourCreditPerTask; break;
    case 'VERIFY_UNIQUENESS': e.cashCost = VISIONARY_UNIQUENESS_STEPS.find(step => step.id === c.step)!.cost; break;
    case 'ACQUIRE_UNIQUENESS': e.cashCost = PRICE.uniqueness; break;
    case 'BUY_COMPOUND': e.cashCost = VISIONARY_CARRIER_BATCHES.find(b => b.id === c.batchId)!.price; break;
    case 'REQUEST_COMPOUND_REPAIR': e.cashCost = PRICE.repairOrder; break;
    case 'RECEIVE_COMPOUND_REPAIR': e.cashCost = PRICE.repairDelivery; break;
    case 'COMPOSE_POTION': e.cashCost = PRICE.compose; e.actions = 2; e.spirituality = 8; e.mind = 2; break;
    case 'SEAL_REMAINS': e.cashCost = c.method === 'ABILITY' ? PRICE.abilitySeal : PRICE.professionalSeal; e.actions = c.method === 'ABILITY' ? 1 : 2; e.spirituality = c.method === 'ABILITY' ? 6 : 0; e.mind = c.method === 'ABILITY' ? 2 : 0; break;
    case 'RECOVER_SEALED': e.cashCost = PRICE.recovery; break;
  }
  return e;
}
export function visionaryMaterialChallenge(_s: VisionaryMaterialsState, c: VisionaryMaterialCommand, _h?: VisionaryHost): { difficulty: number; bonus: number } | null {
  return c.type === 'SEAL_REMAINS' && c.method === 'ABILITY' ? { difficulty: 20, bonus: 0 } : null;
}
export function visionaryMaterialBlock(s: VisionaryMaterialsState, c: VisionaryMaterialCommand, h: VisionaryHost): string | null {
  if (!validateVisionaryMaterialCommand(c)) return '材料指令形状不合法。';
  if (h.status !== 'ACTIVE' || h.sequence !== 1 || h.actorId !== s.origin.actorId) return '只有本人仍存活的作家能够处理这些原物。';
  if (!text(h.eventId) || !text(h.location) || !integer(h.week, s.origin.consumption.week) || !integer(h.revision) || ![h.cash, h.actions, h.health, h.mind, h.spirituality].every(v => integer(v)) || s.receipts.some(r => r.eventId === h.eventId) || s.settlements.some(r => r.eventId === h.eventId)) return '材料回执编号或真实时间不合法。';
  if (s.receipts.length >= 512) return '本次材料保管账已经达到安全回执容量，不能继续改账。';
  if (s.receipts.some(r => r.week > h.week || r.revision >= h.revision) || s.settlements.some(r => r.week > h.week)) return '不能倒退材料交付的真实时间或修订。';
  const e = materialEffect(s, c);
  if (h.actions < e.actions) return `需要${e.actions}次真实行动。`;
  if (h.cash < e.cashCost) return `需要${e.cashCost}便士。`;
  if (h.health <= 0 || h.mind <= e.mind || h.spirituality < e.spirituality) return '当前健康、精神或灵性不足；不会自动补满或免除死亡。';
  const at = (location: string) => h.location === location ? null : '必须本人沿真实通路到达这批原物所在地点。';
  if (c.type === 'MATERIAL_LABOUR' || c.type === 'ACQUIRE_CHARACTERISTIC') {
    const item = s.characteristics.find(b => b.originBottleId === c.bottleId)!;
    if (item.holder !== 'SUPPLIER' && !(c.type === 'ACQUIRE_CHARACTERISTIC' && item.holder === 'CUSTODIAN' && recoveredCustody(s, c.bottleId))) return '这份原物已经交付或由专业人员保管，不能再次购买或抵工。';
    if (at(LOC.supplier)) return at(LOC.supplier);
    if (c.type === 'MATERIAL_LABOUR') {
      if (VISIONARY_LABOUR_TASKS.slice(0, inheritedLabour(s, item.originBottleId)).some(t => t.id === c.taskId) || item.labour.some(t => t.taskId === c.taskId)) return '这项真实交付劳务已经做过，不能重复抵扣。';
      if (VISIONARY_LABOUR_TASKS[labourTotal(s, item)]?.id !== c.taskId) return '须依次完成封签、交付箱、供货、运输、复核五项不同劳务。';
    }
  } else if (c.type === 'INVESTIGATE_LEGACY_REMAINS' || c.type === 'SEAL_LEGACY_REMAINS' || c.type === 'RECOVER_LEGACY_REMAINS') {
    const remains = s.legacyRemains.find(r => r.originBottleId === c.bottleId);
    if (!remains) return '这瓶没有可核对的旧失败原物；不能调查出另一份特性。';
    if (at(LOC.supplier)) return at(LOC.supplier);
    const required = c.type === 'INVESTIGATE_LEGACY_REMAINS' ? 'UNLOCATED' : c.type === 'SEAL_LEGACY_REMAINS' ? 'LOCATED' : 'SEALED';
    if (remains.status !== required) return '须在原专业交接处依次实际调查、辨识封存、清理回收，不能跳步或重复领物。';
  } else if (c.type === 'VERIFY_UNIQUENESS') {
    const u = s.uniqueness, step = VISIONARY_UNIQUENESS_STEPS.find(t => t.id === c.step)!;
    if (u.holder !== 'CUSTODIAN' || u.incumbentActorId !== null) return '唯一性已不在保管人手中或已有容纳者，不能重复查验领物。';
    const refreshingSeal = c.step === 'SEAL' && u.checks.length === 3 && u.checks[2]!.week < h.week;
    if (!refreshingSeal && (u.checks.some(t => t.step === c.step) || VISIONARY_UNIQUENESS_STEPS[u.checks.length]?.id !== c.step)) return '须依次核查保管链、当代空位、同一原件封签；不得重复或跳步。';
    if (at(step.location)) return at(step.location);
  } else if (c.type === 'ACQUIRE_UNIQUENESS') {
    if (s.uniqueness.holder !== 'CUSTODIAN' || s.uniqueness.incumbentActorId !== null || s.uniqueness.checks.length !== 3) return '先完成同一唯一性三步实地查验，且不能有另一在位者。';
    if (s.uniqueness.checks[2]?.week !== h.week) return '封签与当代空位核验过期；交付须紧接本周最后查验。';
    if (at(LOC.vault)) return at(LOC.vault);
  } else if ('batchId' in c) {
    const batch = s.batches.find(b => b.id === c.batchId)!;
    if (c.type !== 'COMPOSE_POTION' && at(LOC.supplier)) return at(LOC.supplier);
    if (c.type === 'BUY_COMPOUND' && batch.status !== 'SUPPLIER') return '这个有限普通批次已经交付过。';
    if (c.type === 'REQUEST_COMPOUND_REPAIR' && (batch.status !== 'SPENT' || batch.location !== h.location || s.compounds.filter(p => p.batchId === batch.id).at(-1)?.status !== 'RECOVERED' || !s.refills.some(r => r.batchId === null))) return '只可为已耗药液的原容器订购有限普通补充物；当前没有可用余量。';
    if (c.type === 'RECEIVE_COMPOUND_REPAIR' && (batch.status !== 'REPAIR_ORDERED' || !batch.repair || h.week <= batch.repair.week)) return '须下单并经过下一真实周，才能实际领取新普通药液。';
    if (c.type === 'COMPOSE_POTION') {
      if (at(LOC.workshop)) return at(LOC.workshop);
      if (batch.status !== 'PLAYER' || batch.location !== h.location) return '须把已购普通调配包实际带到调配处。';
      if (s.compounds.some(p => ['PREPARED', 'FAILED_EXPOSED', 'FAILED_SEALED'].includes(p.status))) return '先处理现有配制物或真实失败残留。';
      if (embodied(s)?.holder !== 'EMBODIED' || external(s).some(b => b.holder !== 'PLAYER' || b.location !== h.location) ||
          s.uniqueness.holder !== 'PLAYER' || s.uniqueness.location !== h.location || s.uniqueness.incumbentActorId !== null) return '本人原有一份、两份实际交付原特性和同一唯一性必须同时真实在场。';
    }
  } else if (c.type === 'SEAL_REMAINS' || c.type === 'RECOVER_SEALED') {
    const p = s.compounds.find(potion => potion.id === c.compoundId);
    if (!p || at(p.location)) return '没有同处一地的这份实际残留物。';
    if (c.type === 'SEAL_REMAINS' && p.status !== 'FAILED_EXPOSED') return '只有尚未封存的真实失败残留可处理。';
    if (c.type === 'RECOVER_SEALED' && p.status !== 'FAILED_SEALED') return '只有本人仍活着且已经实际封存的原残留可以清理回收。';
  } else { return '不支持这条材料指令。'; }
  return null;
}
/** Pure transition. The owner resolves and records a single check and applies
 * the returned costs. This module never advances RNG, mutates host or replays a prefix. */
export function applyVisionaryMaterial(s: VisionaryMaterialsState, c: VisionaryMaterialCommand, h: VisionaryHost): VisionaryModuleResult<VisionaryMaterialsState> {
  const block = visionaryMaterialBlock(s, c, h); if (block) throw new Error(block);
  const challenge = visionaryMaterialChallenge(s, c, h);
  if (challenge ? !validMaterialCheck(h.check, challenge.difficulty) : h.check !== null) throw new Error('材料检定必须由当前中央回执提供，不能另抽或带入无关结果。');
  const n = structuredClone(s), e = materialEffect(s, c), notes: string[] = [];
  if (c.type === 'MATERIAL_LABOUR') {
    n.characteristics.find(b => b.originBottleId === c.bottleId)!.labour.push({ taskId: c.taskId, eventId: h.eventId, week: h.week });
    notes.push('完成一项不同的真实交付劳务；只抵这瓶1100便士，不生成任何非凡份额。');
  } else if (c.type === 'ACQUIRE_CHARACTERISTIC') {
    Object.assign(n.characteristics.find(b => b.originBottleId === c.bottleId)!, { holder: 'PLAYER', location: h.location, acquiredEventId: h.eventId, acquiredWeek: h.week });
    notes.push(recoveredCustody(s, c.bottleId) ? `本人花1行动在专业保管处领回已付费回收的${c.bottleId}同一原特性，0便士；没有重购特性，也未购买本次不需要的作家普通药液。` : `实际交付${c.bottleId}中同一原特性；旧瓶史保持冻结，新账单独记${e.cashCost}便士。`);
  } else if (c.type === 'INVESTIGATE_LEGACY_REMAINS' || c.type === 'SEAL_LEGACY_REMAINS' || c.type === 'RECOVER_LEGACY_REMAINS') {
    const remains = n.legacyRemains.find(r => r.originBottleId === c.bottleId)!, item = n.characteristics.find(i => i.originBottleId === c.bottleId)!;
    remains.location = LOC.supplier; item.location = LOC.supplier;
    if (c.type === 'INVESTIGATE_LEGACY_REMAINS') {
      remains.status = 'LOCATED'; remains.investigatedEventId = h.eventId; item.holder = 'LEGACY_RESIDUE';
      notes.push(`本人查访原服药安静房，对照第${remains.sourceWeek}周原回执，找到编号${remains.custodyId}对应的同一排异残留；这是当代实地发现，旧账没有被补写封存。`);
    } else if (c.type === 'SEAL_LEGACY_REMAINS') {
      remains.status = 'SEALED'; remains.sealedEventId = h.eventId; item.holder = 'LEGACY_SEALED';
      notes.push('专业人员在本人实际在场时辨识同一原特性并重新封存，普通原药液和旧伤势不会恢复。');
    } else {
      remains.status = 'RECOVERED'; remains.recoveredEventId = h.eventId; item.holder = 'PLAYER';
      notes.push('清理并当面接回同一旧失败原特性，不退款、不补新瓶、不新增第四份。');
    }
  } else if (c.type === 'VERIFY_UNIQUENESS') {
    if (c.step === 'SEAL' && n.uniqueness.checks.length === 3) n.uniqueness.checks.pop();
    n.uniqueness.checks.push({ step: c.step, eventId: h.eventId, week: h.week });
    notes.push(VISIONARY_UNIQUENESS_STEPS.find(step => step.id === c.step)!.label);
  } else if (c.type === 'ACQUIRE_UNIQUENESS') {
    Object.assign(n.uniqueness, { holder: 'PLAYER', location: h.location, acquiredEventId: h.eventId, acquiredWeek: h.week });
    notes.push('玛蕾娜·沃斯在本周再次核对无另一容纳者，将同一编号唯一性实际交付本人；取得材料不等于成为神。');
  } else if (c.type === 'BUY_COMPOUND') {
    Object.assign(n.batches.find(b => b.id === c.batchId)!, { status: 'PLAYER', location: h.location, acquiredEventId: h.eventId, acquiredWeek: h.week });
    notes.push('付费取得一个独立普通调配批次。');
  } else if (c.type === 'REQUEST_COMPOUND_REPAIR') {
    const batch = n.batches.find(b => b.id === c.batchId)!, refill = n.refills.find(r => r.batchId === null)!;
    Object.assign(refill, { batchId: c.batchId, orderedEventId: h.eventId });
    batch.status = 'REPAIR_ORDERED'; batch.location = LOC.supplier;
    batch.repair = { eventId: h.eventId, week: h.week, refillId: refill.id, deliveredEventId: null, deliveredWeek: null };
    notes.push('原容器交回供应方，实付普通补充物订金；下一真实周起才能领取。');
  } else if (c.type === 'RECEIVE_COMPOUND_REPAIR') {
    const batch = n.batches.find(b => b.id === c.batchId)!;
    batch.status = 'PLAYER'; batch.location = h.location; batch.repair!.deliveredEventId = h.eventId; batch.repair!.deliveredWeek = h.week;
    n.refills.find(r => r.id === batch.repair!.refillId)!.deliveredEventId = h.eventId;
    notes.push('实付尾款并收到另一份普通药液；上一份损耗保留，非凡原物没有补造。');
  } else if (c.type === 'COMPOSE_POTION') {
    const id = `visionary-compound-${n.compounds.length + 1}`, batch = n.batches.find(b => b.id === c.batchId)!;
    batch.status = 'IN_COMPOUND'; batch.uses++;
    for (const item of [...external(n), n.uniqueness]) Object.assign(item, { holder: 'COMPOUND', compoundId: id, location: h.location });
    n.compounds.push({ id, batchId: c.batchId, status: 'PREPARED', location: h.location, preparedEventId: h.eventId, preparedWeek: h.week,
      consumedWeek: null, settlementEventId: null, sealedEventId: null, recoveredEventId: null,
      characteristicIds: n.characteristics.map(item => item.id), uniquenessId: n.uniqueness.id });
    notes.push('两份外部原特性与唯一性装入同一承载物；本人已融的一份仍只计一次，尚未服用或成神。');
  } else if (c.type === 'SEAL_REMAINS') {
    const p = n.compounds.find(potion => potion.id === c.compoundId)!;
    if (c.method === 'PROFESSIONAL' || good(h.check)) {
      p.status = 'FAILED_SEALED'; p.sealedEventId = h.eventId;
      for (const item of [...external(n), n.uniqueness]) item.holder = 'SEALED';
      notes.push('实际封存同一残留物，原两特性与唯一性未被销毁或复制；仍须另行清理回收。');
    } else {
      e.health = h.check?.tier === 'GREAT_FAILURE' ? 15 : 6; e.mind += h.check?.tier === 'GREAT_FAILURE' ? 15 : 6;
      notes.push('封存失败，费用与生命、精神损耗真实结算；没有死亡保底。仍存活者可改用付费专业封存。');
    }
  } else if (c.type === 'RECOVER_SEALED') {
    const p = n.compounds.find(potion => potion.id === c.compoundId)!;
    p.status = 'RECOVERED'; p.recoveredEventId = h.eventId;
    for (const item of [...external(n), n.uniqueness]) Object.assign(item, { holder: 'PLAYER', compoundId: null, location: h.location });
    notes.push('清理已封存残留，回收到的只是这两份原特性与同一唯一性；普通药液已经耗损。');
  } else { throw new Error('不支持这条材料指令。'); }
  n.receipts.push({ eventId: h.eventId, revision: h.revision, week: h.week, actorId: h.actorId, location: h.location,
    command: structuredClone(c), effect: structuredClone(e), check: structuredClone(h.check) });
  return { state: n, effect: e, notes };
}
export function transportVisionaryMaterials(s: VisionaryMaterialsState, from: string, to: string): VisionaryMaterialsState {
  if (!text(from) || !text(to)) throw new Error('原物移动地点不合法。');
  const n = structuredClone(s);
  for (const item of [...n.characteristics, n.uniqueness]) if (item.holder === 'PLAYER' && item.location === from) item.location = to;
  for (const b of n.batches) if ((b.status === 'PLAYER' || (b.status === 'SPENT' && n.compounds.filter(p => p.batchId === b.id).at(-1)?.status === 'RECOVERED')) && b.location === from) b.location = to;
  for (const p of n.compounds) if (p.status === 'PREPARED' && p.location === from) {
    p.location = to; n.batches.find(b => b.id === p.batchId)!.location = to;
    for (const item of [...external(n), n.uniqueness]) if (item.compoundId === p.id) item.location = to;
  }
  return n;
}
export function settleVisionaryConsumption(s: VisionaryMaterialsState, settlement: VisionaryMaterialSettlement): VisionaryMaterialsState {
  const p = s.compounds.find(c => c.id === settlement.compoundId);
  if (!exact(settlement, ['eventId', 'week', 'compoundId', 'success', 'alive', 'location']) || !text(settlement.eventId) || !integer(settlement.week, s.origin.consumption.week) ||
      typeof settlement.success !== 'boolean' || typeof settlement.alive !== 'boolean' || !text(settlement.location) ||
      !p || p.status !== 'PREPARED' || settlement.week < p.preparedWeek || s.receipts.some(r => r.week > settlement.week) || s.settlements.some(r => r.week > settlement.week) || p.location !== settlement.location ||
      (settlement.success && !settlement.alive) || s.receipts.some(r => r.eventId === settlement.eventId) || s.settlements.some(r => r.eventId === settlement.eventId) ||
      embodied(s)?.holder !== 'EMBODIED' || [...external(s), s.uniqueness].some(i => i.holder !== 'COMPOUND' || i.compoundId !== p.id || i.location !== p.location)) throw new Error('服药材料结算与同一真实配制物不一致。');
  const n = structuredClone(s), next = n.compounds.find(c => c.id === p.id)!, batch = n.batches.find(b => b.id === p.batchId)!;
  next.status = settlement.success ? 'SUCCESS' : settlement.alive ? 'FAILED_EXPOSED' : 'FAILED_LOST';
  next.settlementEventId = settlement.eventId; next.consumedWeek = settlement.week;
  batch.status = 'SPENT'; batch.spentWeek = settlement.week;
  for (const item of [...external(n), n.uniqueness]) item.holder = settlement.success ? 'FUSED' : settlement.alive ? 'EXPOSED' : 'LOST';
  if (settlement.success) {
    embodied(n).holder = 'FUSED'; embodied(n).compoundId = p.id;
    n.uniqueness.incumbentActorId = n.origin.actorId;
    for (const item of [...n.characteristics, n.uniqueness]) item.location = null;
  }
  n.settlements.push(structuredClone(settlement)); return n;
}

/** Bounded structural/conservation validation. Historical host/RNG provenance is
 * checked exactly once by the central journal, not by nested prefix replay. */
export function validateVisionaryMaterials(value: unknown): value is VisionaryMaterialsState {
  try {
    if (!record(value) || !exact(value, ['version', 'origin', 'characteristics', 'uniqueness', 'batches', 'compounds', 'receipts', 'settlements', 'refills', 'legacyRemains']) ||
        value.version !== 1 || !validateVisionaryMaterialOrigin(value.origin)) return false;
    const s = value as unknown as VisionaryMaterialsState;
    if (!Array.isArray(s.characteristics) || s.characteristics.length !== 3 || !Array.isArray(s.batches) || s.batches.length !== 3 ||
        !Array.isArray(s.compounds) || s.compounds.length > 9 || !Array.isArray(s.receipts) || s.receipts.length > 512 ||
        !Array.isArray(s.legacyRemains) || s.legacyRemains.length > 2 || !Array.isArray(s.settlements) || s.settlements.length > 9 || !Array.isArray(s.refills) || s.refills.length !== 6) return false;
    const eventIds = [...s.receipts, ...s.settlements].map(r => r.eventId);
    if (new Set(eventIds).size !== eventIds.length) return false;
    let revision = -1, week = s.origin.consumption.week;
    for (const r of s.receipts) {
      if (!record(r) || !exact(r, ['eventId', 'revision', 'week', 'actorId', 'location', 'command', 'effect', 'check']) || !text(r.eventId) ||
          !integer(r.revision, revision + 1) || !integer(r.week, week) || r.actorId !== s.origin.actorId || !text(r.location) ||
          !validateVisionaryMaterialCommand(r.command) || !record(r.effect) || !exact(r.effect, ['cashCost', 'cashGain', 'actions', 'spirituality', 'mind', 'health', 'weeks', 'toLocation'])) return false;
      revision = r.revision; week = r.week;
      const expected = materialEffect(s, r.command), challenge = visionaryMaterialChallenge(s, r.command);
      if (challenge) {
        if (!validMaterialCheck(r.check, challenge.difficulty)) return false;
        if (!good(r.check)) { expected.health = r.check.tier === 'GREAT_FAILURE' ? 15 : 6; expected.mind += r.check.tier === 'GREAT_FAILURE' ? 15 : 6; }
      } else if (r.check !== null) return false;
      if (!same(expected, r.effect)) return false;
    }
    const currentOriginals = currentOriginBottles(s.origin);
    for (let i = 0; i < 3; i++) {
      const item = s.characteristics[i]!, original = currentOriginals[i]!;
      if (!record(item) || !exact(item, ['id', 'originBottleId', 'holder', 'location', 'compoundId', 'labour', 'acquiredEventId', 'acquiredWeek']) ||
          item.originBottleId !== VISIONARY_CHARACTERISTIC_BOTTLES[i] || item.id !== characteristicId(item.originBottleId) ||
          !Array.isArray(item.labour) || item.labour.length + inheritedLabour(s, item.originBottleId) > 5 || (item.location !== null && !text(item.location)) ||
          (item.compoundId !== null && !compoundId(item.compoundId))) return false;
      if (item.originBottleId === integratedBottle(s)) {
        if (!['EMBODIED', 'FUSED'].includes(item.holder) || item.location !== null || item.acquiredEventId !== null || item.acquiredWeek !== original.acquiredWeek || item.labour.length !== 0) return false;
        if (item.holder === 'EMBODIED' && item.compoundId !== null) return false;
      } else {
        if (!['SUPPLIER', 'CUSTODIAN', 'PLAYER', 'COMPOUND', 'EXPOSED', 'SEALED', 'LOST', 'FUSED', 'UNLOCATED', 'LEGACY_RESIDUE', 'LEGACY_SEALED'].includes(item.holder)) return false;
        if (original.recovery && item.labour.length !== 0) return false;
        for (const [index, labour] of item.labour.entries()) {
          const r = receiptFor(s, labour.eventId);
          if (!exact(labour, ['taskId', 'eventId', 'week']) || labour.taskId !== VISIONARY_LABOUR_TASKS[index + inheritedLabour(s, item.originBottleId)]?.id ||
              !r || r.week !== labour.week || r.location !== LOC.supplier || r.command.type !== 'MATERIAL_LABOUR' ||
              r.command.bottleId !== item.originBottleId || r.command.taskId !== labour.taskId) return false;
        }
        if (item.holder === 'SUPPLIER' || item.holder === 'CUSTODIAN') {
          if (original.status !== 'SUPPLIER' || (item.holder === 'CUSTODIAN') !== !!original.recovery || item.location !== LOC.supplier || item.acquiredEventId !== null || item.acquiredWeek !== null || item.compoundId !== null) return false;
        } else if (original.status !== 'SUPPLIER') {
          if (item.acquiredEventId !== null || item.acquiredWeek !== original.acquiredWeek || item.labour.length !== 0) return false;
        } else {
          const r = receiptFor(s, item.acquiredEventId);
          if (!r || r.command.type !== 'ACQUIRE_CHARACTERISTIC' || r.command.bottleId !== item.originBottleId || r.week !== item.acquiredWeek || r.location !== LOC.supplier ||
              item.labour.some(l => receiptFor(s, l.eventId)!.revision >= r.revision)) return false;
        }
        if (item.holder === 'PLAYER' && (!text(item.location) || item.compoundId !== null)) return false;
      }
    }
    const oldFailures = currentOriginals.filter(b => b.status === 'CONSUMED' && originalForAttempt(b) !== integratedBottle(s));
    if (s.legacyRemains.length !== oldFailures.length) return false;
    for (const [index, remains] of s.legacyRemains.entries()) {
      const old = oldFailures[index]!, originalId = originalForAttempt(old), item = s.characteristics.find(i => i.originBottleId === originalId)!;
      const original = s.origin.consumptions?.find(r => r.command.type === 'CONSUME' && r.command.bottleId === old.id);
      if (!record(remains) || !exact(remains, ['originBottleId', 'sourceRevision', 'sourceWeek', 'custodyId', 'status', 'location', 'investigatedEventId', 'sealedEventId', 'recoveredEventId']) ||
          remains.originBottleId !== originalId || !original || remains.sourceRevision !== original.revision || remains.sourceWeek !== original.week ||
          remains.custodyId !== `${old.id}:residue:revision-${original.revision}` || !['UNLOCATED', 'LOCATED', 'SEALED', 'RECOVERED'].includes(remains.status)) return false;
      const investigation = receiptFor(s, remains.investigatedEventId), sealed = receiptFor(s, remains.sealedEventId), recovered = receiptFor(s, remains.recoveredEventId);
      if (remains.status === 'UNLOCATED') {
        if (remains.location !== null || remains.investigatedEventId !== null || remains.sealedEventId !== null || remains.recoveredEventId !== null ||
            item.holder !== 'UNLOCATED' || item.location !== null || item.compoundId !== null) return false;
      } else {
        if (remains.location !== LOC.supplier || !investigation || investigation.command.type !== 'INVESTIGATE_LEGACY_REMAINS' ||
            investigation.command.bottleId !== originalId || investigation.location !== LOC.supplier || investigation.week < original.week) return false;
        if (remains.status === 'LOCATED') {
          if (remains.sealedEventId !== null || remains.recoveredEventId !== null || item.holder !== 'LEGACY_RESIDUE' || item.location !== LOC.supplier || item.compoundId !== null) return false;
        } else {
          if (!sealed || sealed.command.type !== 'SEAL_LEGACY_REMAINS' || sealed.command.bottleId !== originalId || sealed.location !== LOC.supplier || sealed.revision <= investigation.revision) return false;
          if (remains.status === 'SEALED') {
            if (remains.recoveredEventId !== null || item.holder !== 'LEGACY_SEALED' || item.location !== LOC.supplier || item.compoundId !== null) return false;
          } else if (!recovered || recovered.command.type !== 'RECOVER_LEGACY_REMAINS' || recovered.command.bottleId !== originalId ||
              recovered.location !== LOC.supplier || recovered.revision <= sealed.revision || ['SUPPLIER', 'CUSTODIAN', 'UNLOCATED', 'LEGACY_RESIDUE', 'LEGACY_SEALED'].includes(item.holder)) return false;
        }
      }
    }
    // A legacy residue state is possible only for its matching failed original.
    for (const item of external(s)) if (['UNLOCATED', 'LEGACY_RESIDUE', 'LEGACY_SEALED'].includes(item.holder) &&
      !s.legacyRemains.some(r => r.originBottleId === item.originBottleId)) return false;
    const u = s.uniqueness;
    if (!record(u) || !exact(u, ['id', 'holder', 'location', 'compoundId', 'checks', 'acquiredEventId', 'acquiredWeek', 'incumbentActorId']) || u.id !== VISIONARY_UNIQUENESS_ID ||
        !['CUSTODIAN', 'PLAYER', 'COMPOUND', 'EXPOSED', 'SEALED', 'LOST', 'FUSED'].includes(u.holder) || !Array.isArray(u.checks) || u.checks.length > 3 ||
        (u.location !== null && !text(u.location)) || (u.compoundId !== null && !compoundId(u.compoundId))) return false;
    for (const [index, checked] of u.checks.entries()) {
      const r = receiptFor(s, checked.eventId), step = VISIONARY_UNIQUENESS_STEPS[index];
      if (!exact(checked, ['step', 'eventId', 'week']) || !step || step.id !== checked.step || !r ||
          r.command.type !== 'VERIFY_UNIQUENESS' || r.command.step !== step.id || r.week !== checked.week || r.location !== step.location) return false;
    }
    if (u.holder === 'CUSTODIAN') {
      if (u.location !== LOC.vault || u.compoundId !== null || u.acquiredEventId !== null || u.acquiredWeek !== null) return false;
    } else {
      const r = receiptFor(s, u.acquiredEventId);
      if (u.checks.length !== 3 || !r || r.command.type !== 'ACQUIRE_UNIQUENESS' || r.location !== LOC.vault || r.week !== u.acquiredWeek ||
          u.checks.some(c => receiptFor(s, c.eventId)!.revision >= r.revision)) return false;
    }
    if (u.holder === 'PLAYER' && (!text(u.location) || u.compoundId !== null)) return false;
    if (u.incumbentActorId !== (u.holder === 'FUSED' ? s.origin.actorId : null)) return false;
    const current = s.compounds.filter(p => ['PREPARED', 'FAILED_EXPOSED', 'FAILED_SEALED', 'FAILED_LOST', 'SUCCESS'].includes(p.status));
    if (current.length > 1) return false;
    const expectedExternal = { PREPARED: 'COMPOUND', FAILED_EXPOSED: 'EXPOSED', FAILED_SEALED: 'SEALED', FAILED_LOST: 'LOST', SUCCESS: 'FUSED' } as const;
    if (current.length === 1) {
      const p = current[0]!, holder = expectedExternal[p.status as keyof typeof expectedExternal];
      if ([...external(s), u].some(item => item.holder !== holder || item.compoundId !== p.id || item.location !== (holder === 'FUSED' ? null : p.location))) return false;
      if (embodied(s).holder !== (holder === 'FUSED' ? 'FUSED' : 'EMBODIED') || (holder === 'FUSED' && embodied(s).compoundId !== p.id)) return false;
    } else if ([...external(s), u].some(item => !['SUPPLIER', 'CUSTODIAN', 'PLAYER', 'UNLOCATED', 'LEGACY_RESIDUE', 'LEGACY_SEALED'].includes(item.holder)) || embodied(s).holder !== 'EMBODIED') return false;
    for (const [index, p] of s.compounds.entries()) {
      if (!record(p) || !exact(p, ['id', 'batchId', 'status', 'location', 'preparedEventId', 'preparedWeek', 'consumedWeek', 'settlementEventId', 'sealedEventId', 'recoveredEventId', 'characteristicIds', 'uniquenessId']) ||
          p.id !== `visionary-compound-${index + 1}` || !carrierId(p.batchId) || !text(p.location) ||
          !['PREPARED', 'SUCCESS', 'FAILED_EXPOSED', 'FAILED_SEALED', 'FAILED_LOST', 'RECOVERED'].includes(p.status) ||
          !same(p.characteristicIds, s.characteristics.map(i => i.id)) || p.uniquenessId !== u.id) return false;
      const prepared = receiptFor(s, p.preparedEventId);
      if (!prepared || prepared.command.type !== 'COMPOSE_POTION' || prepared.command.batchId !== p.batchId || prepared.week !== p.preparedWeek || prepared.location !== LOC.workshop) return false;
      const settlement = s.settlements.find(r => r.eventId === p.settlementEventId);
      if (p.status === 'PREPARED') {
        if (p.consumedWeek !== null || p.settlementEventId !== null || p.sealedEventId !== null || p.recoveredEventId !== null) return false;
      } else {
        if (!settlement || settlement.compoundId !== p.id || settlement.week !== p.consumedWeek || settlement.location !== p.location || settlement.week < p.preparedWeek ||
            (p.status === 'SUCCESS' ? !settlement.success || !settlement.alive : settlement.success) ||
            (p.status === 'FAILED_LOST' ? settlement.alive : !settlement.alive)) return false;
      }
      if (['FAILED_SEALED', 'RECOVERED'].includes(p.status)) {
        const sealed = receiptFor(s, p.sealedEventId);
        if (!sealed || sealed.command.type !== 'SEAL_REMAINS' || sealed.command.compoundId !== p.id || sealed.location !== p.location ||
            sealed.week < p.consumedWeek! || (sealed.command.method === 'ABILITY' && !good(sealed.check))) return false;
      } else if (p.sealedEventId !== null) return false;
      if (p.status === 'RECOVERED') {
        const recovered = receiptFor(s, p.recoveredEventId);
        if (!recovered || recovered.command.type !== 'RECOVER_SEALED' || recovered.command.compoundId !== p.id || recovered.location !== p.location ||
            recovered.revision <= receiptFor(s, p.sealedEventId)!.revision) return false;
      } else if (p.recoveredEventId !== null) return false;
    }
    for (const settlement of s.settlements) {
      if (!record(settlement) || !exact(settlement, ['eventId', 'week', 'compoundId', 'success', 'alive', 'location']) || !text(settlement.eventId) ||
          !integer(settlement.week, s.origin.consumption.week) || !compoundId(settlement.compoundId) || typeof settlement.success !== 'boolean' || typeof settlement.alive !== 'boolean' ||
          !text(settlement.location) || !s.compounds.some(p => p.settlementEventId === settlement.eventId)) return false;
    }
    for (const [index, b] of s.batches.entries()) {
      if (!record(b) || !exact(b, ['id', 'status', 'location', 'acquiredEventId', 'acquiredWeek', 'uses', 'spentWeek', 'repair']) ||
          b.id !== VISIONARY_CARRIER_BATCHES[index]!.id || !['SUPPLIER', 'PLAYER', 'IN_COMPOUND', 'SPENT', 'REPAIR_ORDERED'].includes(b.status) || !text(b.location) || !integer(b.uses) ||
          b.uses !== s.compounds.filter(p => p.batchId === b.id).length || (b.spentWeek !== null && !integer(b.spentWeek, s.origin.consumption.week))) return false;
      const deliveredRefills = s.refills.filter(r => r.batchId === b.id && r.deliveredEventId !== null).length;
      if (b.uses > 1 + deliveredRefills) return false;
      if (b.status === 'SUPPLIER') {
        if (b.location !== LOC.supplier || b.acquiredEventId !== null || b.acquiredWeek !== null || b.uses !== 0 || b.repair !== null || b.spentWeek !== null) return false;
      } else {
        const acquired = receiptFor(s, b.acquiredEventId);
        if (!acquired || acquired.command.type !== 'BUY_COMPOUND' || acquired.command.batchId !== b.id || acquired.week !== b.acquiredWeek || acquired.location !== LOC.supplier) return false;
      }
      const latest = s.compounds.filter(p => p.batchId === b.id).at(-1);
      if (b.status === 'IN_COMPOUND' && (!latest || latest.status !== 'PREPARED' || latest.location !== b.location)) return false;
      if ((b.status === 'SPENT' || b.status === 'REPAIR_ORDERED') && (!latest || latest.status === 'PREPARED' || latest.consumedWeek !== b.spentWeek)) return false;
      if (b.status === 'PLAYER' && b.uses !== deliveredRefills) return false;
      if (b.repair !== null) {
        const r = b.repair, ordered = receiptFor(s, r.eventId), refill = s.refills.find(f => f.id === r.refillId);
        if (!record(r) || !exact(r, ['eventId', 'week', 'refillId', 'deliveredEventId', 'deliveredWeek']) || !ordered || ordered.command.type !== 'REQUEST_COMPOUND_REPAIR' ||
            ordered.command.batchId !== b.id || ordered.week !== r.week || ordered.location !== LOC.supplier || !refill || refill.batchId !== b.id || refill.orderedEventId !== r.eventId || refill.deliveredEventId !== r.deliveredEventId) return false;
        if (r.deliveredEventId === null) {
          if (r.deliveredWeek !== null || b.status !== 'REPAIR_ORDERED') return false;
        } else {
          const delivery = receiptFor(s, r.deliveredEventId);
          if (!delivery || delivery.command.type !== 'RECEIVE_COMPOUND_REPAIR' || delivery.command.batchId !== b.id || delivery.week !== r.deliveredWeek || delivery.week <= r.week || delivery.location !== LOC.supplier) return false;
        }
      } else if (b.status === 'REPAIR_ORDERED') return false;
    }
    for (const [index, r] of s.refills.entries()) {
      if (!record(r) || !exact(r, ['id', 'batchId', 'orderedEventId', 'deliveredEventId']) || r.id !== VISIONARY_CARRIER_REFILLS[index]) return false;
      if (r.batchId === null) { if (r.orderedEventId !== null || r.deliveredEventId !== null) return false; }
      else {
        const ordered = receiptFor(s, r.orderedEventId), delivered = receiptFor(s, r.deliveredEventId);
        if (!carrierId(r.batchId) || !ordered || ordered.command.type !== 'REQUEST_COMPOUND_REPAIR' || ordered.command.batchId !== r.batchId ||
            (r.deliveredEventId !== null && (!delivered || delivered.command.type !== 'RECEIVE_COMPOUND_REPAIR' || delivered.command.batchId !== r.batchId || delivered.week <= ordered.week))) return false;
      }
    }
    return true;
  } catch { return false; }
}
export function getVisionaryMaterialActions(s: VisionaryMaterialsState, h: VisionaryHost): VisionaryMaterialAction[] {
  const commands: { label: string; command: VisionaryMaterialCommand }[] = [];
  for (const bottle of VISIONARY_CHARACTERISTIC_BOTTLES) {
    for (const t of VISIONARY_LABOUR_TASKS) commands.push({ label: `${bottle.slice(-1)}号原瓶：${t.label}`, command: { type: 'MATERIAL_LABOUR', bottleId: bottle, taskId: t.id } });
    commands.push({ label: recoveredCustody(s, bottle) ? `实地领回已付费回收的${bottle.slice(-1)}号原特性` : `实际取得${bottle.slice(-1)}号原瓶的同一特性`, command: { type: 'ACQUIRE_CHARACTERISTIC', bottleId: bottle } });
  }
  for (const remains of s.legacyRemains) {
    commands.push({ label: `${remains.originBottleId.slice(-1)}号旧失败原物：实地调查去向`, command: { type: 'INVESTIGATE_LEGACY_REMAINS', bottleId: remains.originBottleId } },
      { label: `${remains.originBottleId.slice(-1)}号旧失败原物：当代辨识并封存`, command: { type: 'SEAL_LEGACY_REMAINS', bottleId: remains.originBottleId } },
      { label: `${remains.originBottleId.slice(-1)}号旧失败原物：实际清理回收`, command: { type: 'RECOVER_LEGACY_REMAINS', bottleId: remains.originBottleId } });
  }
  for (const t of VISIONARY_UNIQUENESS_STEPS) commands.push({ label: t.label, command: { type: 'VERIFY_UNIQUENESS', step: t.id } });
  commands.push({ label: '付费交接同一唯一性', command: { type: 'ACQUIRE_UNIQUENESS' } });
  for (const b of VISIONARY_CARRIER_BATCHES) {
    commands.push({ label: `购买${b.label}`, command: { type: 'BUY_COMPOUND', batchId: b.id } },
      { label: `${b.label}：订购新普通药液并修复原容器`, command: { type: 'REQUEST_COMPOUND_REPAIR', batchId: b.id } },
      { label: `${b.label}：隔周领取付费补充物`, command: { type: 'RECEIVE_COMPOUND_REPAIR', batchId: b.id } },
      { label: `${b.label}：实际配制一次成神承载物`, command: { type: 'COMPOSE_POTION', batchId: b.id } });
  }
  for (const p of s.compounds) {
    if (p.status === 'FAILED_EXPOSED') commands.push({ label: '付费专业封存真实残留', command: { type: 'SEAL_REMAINS', compoundId: p.id, method: 'PROFESSIONAL' } },
      { label: '本人检定封存真实残留', command: { type: 'SEAL_REMAINS', compoundId: p.id, method: 'ABILITY' } });
    if (p.status === 'FAILED_SEALED') commands.push({ label: '清理并回收封存的同一原物', command: { type: 'RECOVER_SEALED', compoundId: p.id } });
  }
  return commands.map(({ label, command }) => {
    const effect = materialEffect(s, command), reason = visionaryMaterialBlock(s, command, h);
    return { id: `visionary-material:${command.type}:${'bottleId' in command ? `${command.bottleId}:${'taskId' in command ? command.taskId : ''}` : 'batchId' in command ? command.batchId : 'step' in command ? command.step : 'compoundId' in command ? `${command.compoundId}:${'method' in command ? command.method : ''}` : ''}`,
      label, cost: `${effect.actions}行动 · ${effect.cashCost}便士${effect.spirituality ? ` · ${effect.spirituality}灵性` : ''}${effect.mind ? ` · ${effect.mind}精神` : ''}`, enabled: reason === null, reason, command };
  });
}
export function projectVisionaryMaterials(s: VisionaryMaterialsState) {
  return { title: '三份原特性与同一唯一性', formulaKnown: false as const, formulaNotice: VISIONARY_FORMULA_NOTICE, recoveryNotice: VISIONARY_RECOVERY_NOTICE,
    characteristics: s.characteristics.map(item => ({ ...structuredClone(item), inheritedLabourSteps: inheritedLabour(s, item.originBottleId) })), uniqueness: { ...structuredClone(s.uniqueness), source: structuredClone(VISIONARY_UNIQUENESS_SOURCE) },
    batches: s.batches.map(b => ({ ...structuredClone(b), ...VISIONARY_CARRIER_BATCHES.find(c => c.id === b.id)! })),
    compounds: structuredClone(s.compounds), ordinaryRefillsRemaining: s.refills.filter(r => r.batchId === null).length,
    receipts: structuredClone(s.receipts), settlements: structuredClone(s.settlements), legacyRemains: structuredClone(s.legacyRemains),
    conservation: { realCharacteristics: 3, embodiedOriginalBottle: integratedBottle(s), uniquenessCount: 1, duplicateCharacteristics: 0,
      explanation: `${integratedBottle(s)}是本人已经融入的那一份；另两份按原供应、本人持有或实际找回去向分别核验。配制记录只引用原物，不另增库存。` } };
}
