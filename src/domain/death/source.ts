/** R217 source admission and same-original acquisition history.
 * No source validator can be skipped or replaced by a caller-supplied token. */
import type { PublicGameDate } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { PaleEmperorAcquisitionBudget } from '../pale-emperor/types.js';
import { PALE_EMPEROR_ABILITY_IDS, PALE_EMPEROR_PREPARATION_IDS } from '../pale-emperor/types.js';
import {
  PALE_EMPEROR_INHERITED_ABILITY_IDS, hasPaleEmperorLock, hasPaleEmperorOldPractice,
  paleEmperorOriginals, validatePaleEmperorAcquisitionCommand, validatePaleEmperorState,
} from '../pale-emperor/index.js';
import { paleEmperorPrices, paleEmperorPotionSource, PALE_EMPEROR_POTION_SOURCES, PALE_EMPEROR_MIN_DEATH_CONSUL_WEEKS } from '../pale-emperor/content.js';
import { createFerrymanEraState, validateFerrymanEra } from '../ferryman/era.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { DEATH_FUTURE_BRANCH, DEATH_S1_RECOVERY_PRICES, DEATH_SUCCESSION } from './content.js';
import {
  DEATH_FROZEN_SOURCE_KEYS, DEATH_ORIGINAL_IDS,
  type DeathAcquisitionEvent, type DeathBudget, type DeathCharacteristicId,
  type DeathOriginSnapshot, type DeathOriginalId, type DeathOriginalResolution,
  type DeathRecoveredBottle, type DeathRecoveryRequest, type DeathRecoverySiteReceipt,
  type DeathSource, type DeathSourceEra,
} from './types.js';

export { DEATH_FROZEN_SOURCE_KEYS } from './types.js';
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]): boolean => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 500;
const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
const digest = (v: unknown): string => sha256Hex(stableStringify(v));
const succeeded = (v: unknown): boolean => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const failed = (v: unknown): boolean => v === 'FAILURE' || v === 'GREAT_FAILURE';
const recoveryCommand = (v: { type: string }): boolean => v.type === 'REQUEST_RECOVERY_V1' || v.type === 'RECOVER_CHARACTERISTIC_V1';
export const isDeathOriginal = (id: unknown): id is DeathOriginalId => DEATH_ORIGINAL_IDS.some(original => original === id);
const characteristicId = (id: DeathOriginalId): DeathCharacteristicId => `${id}:characteristic`;

/** Minimal additional evidence required from the FUTURE S1 reducer. This is
 * one observed original remnant, not a generic physics or permission system.
 * It is deliberately absent from old receipts and never backfilled there. */
export interface DeathS1RecoverySiteEvidence extends DeathRecoverySiteReceipt {
  observation: {
    physicalId: string; location: string; custodianId: string; custodianPresent: boolean;
    actorId: string; actorLocation: string; residualPresent: boolean; accessible: boolean;
    sourceEra: DeathSourceEra;
  };
  placement: {
    physicalId: string; physicalVersion: number; custody: 'FAILED_REMAINS' | 'SUPPLIER';
    bottleId: string | null;
  };
}
type RecoveryEvent = DeathAcquisitionEvent & { recoverySite: DeathS1RecoverySiteEvidence };

/** Source labels are descriptive equality checks, never proof of recovery. */
export function deathRecoveredBottleSource(id: string, r: DeathRecoveryRequest & { recoveredWeek: number }): string {
  return `${r.sourceEra}第${r.recoveredWeek}周在${r.siteId}将${r.sourceBottleId}失败回执${r.sourceReceiptRevision}的同一份${r.characteristicId}封入普通重配瓶${id}；原劳动和原费用不返，不增加特性。`;
}

function validBudget(v: unknown): v is PaleEmperorAcquisitionBudget {
  if (!record(v) || !shape(v, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk', 'era']) ||
      !integer(v.actions, 0, 100) || !integer(v.health, 1, 100) || !integer(v.mind, 1, 100) || !integer(v.spirituality, 0, 120) ||
      !integer(v.cash) || !integer(v.pollution, 0, 100) || !['MALE', 'FEMALE'].includes(String(v.gender)) ||
      (v.sequence !== 2 && v.sequence !== 1) || !integer(v.acting, 0, 100) || !record(v.coreStats) ||
      !shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) || !Object.values(v.coreStats).every(n => integer(n, 0, 500)) ||
      !record(v.mastery) || !shape(v.mastery, [...PALE_EMPEROR_INHERITED_ABILITY_IDS, ...(v.sequence === 1 ? PALE_EMPEROR_ABILITY_IDS : [])]) ||
      !Object.values(v.mastery).every(n => integer(n, 0, 500)) || !Array.isArray(v.completedSources) ||
      !v.completedSources.every(text) || new Set(v.completedSources).size !== v.completedSources.length ||
      !Array.isArray(v.injuries) || !integer(v.injuryRisk) || !record(v.era) || !shape(v.era, Object.keys(createFerrymanEraState()))) return false;
  const era = v.era;
  if (!['OUTSIDE', 'RECEPTION'].includes(String(era.location)) || typeof era.emergencyWorkUsed !== 'boolean' ||
      Object.entries(era).some(([key, value]) => !['location', 'emergencyWorkUsed'].includes(key) && !integer(value))) return false;
  return new Set(v.injuries.map(i => record(i) ? i.id : null)).size === v.injuries.length && v.injuries.every(i => record(i) &&
    shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && text(i.id) &&
    (i.severity === 'LIGHT' || i.severity === 'HEAVY') && integer(i.acquiredRevision) &&
    (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}

function validCommand(v: unknown): v is DeathAcquisitionEvent['command'] {
  return validatePaleEmperorAcquisitionCommand(v) || record(v) && shape(v, ['type']) && v.type === 'REQUEST_SUPPLY' || record(v) && shape(v, ['type', 'bottleId']) &&
    (v.type === 'REQUEST_RECOVERY_V1' || v.type === 'RECOVER_CHARACTERISTIC_V1') &&
    typeof v.bottleId === 'string' && /^pale-emperor-potion-[1-9]\d{0,14}$/.test(v.bottleId);
}

function validRecoverySite(e: DeathAcquisitionEvent, era: DeathSourceEra, original: DeathOriginalId,
  source: DeathRecoveredBottle, receipt: DeathAcquisitionEvent, successorId: string): e is RecoveryEvent {
  const raw: unknown = e.recoverySite;
  if (!record(raw) || !shape(raw, ['siteId', 'sourceReceiptRevision', 'physicalVersion', 'originalBottleId', 'sourceBottleId',
    'characteristicId', 'permission', 'custodyBefore', 'custodyAfter', 'observation', 'placement',
    ...(Object.hasOwn(raw, 'supersededLegacyRequestRevision') ? ['supersededLegacyRequestRevision'] : [])]) ||
    !text(raw.siteId) || raw.sourceReceiptRevision !== receipt.revision || raw.originalBottleId !== original ||
    raw.sourceBottleId !== source.id || raw.characteristicId !== characteristicId(original) || !integer(raw.physicalVersion, 1) ||
    raw.custodyBefore !== 'FAILED_REMAINS' || !record(raw.observation) || !record(raw.placement) || !record(raw.permission)) return false;
  const observation = raw.observation, placement = raw.placement, permission = raw.permission;
  if (!shape(observation, ['physicalId', 'location', 'custodianId', 'custodianPresent', 'actorId', 'actorLocation', 'residualPresent', 'accessible', 'sourceEra']) ||
    !text(observation.physicalId) || !text(observation.location) || !text(observation.custodianId) || !text(observation.actorId) ||
    observation.actorLocation !== observation.location || observation.custodianPresent !== true || observation.residualPresent !== true ||
    observation.accessible !== true || observation.sourceEra !== era ||
    !shape(permission, ['personId', 'actorId', 'purpose', 'status', 'eventId', 'week', 'revision', 'location', 'conditionVersion']) ||
    permission.personId !== observation.custodianId || permission.actorId !== observation.actorId || permission.status !== 'ALLOW' ||
    !text(permission.eventId) || permission.week !== e.week || permission.revision !== e.revision ||
    permission.location !== observation.location || permission.conditionVersion !== raw.physicalVersion ||
    !shape(placement, ['physicalId', 'physicalVersion', 'custody', 'bottleId']) || placement.physicalId !== observation.physicalId ||
    !integer(placement.physicalVersion, 1)) return false;
  const investigating = e.command.type === 'REQUEST_RECOVERY_V1';
  return permission.purpose === (investigating ? 'INVESTIGATE' : 'HANDOVER') &&
    raw.custodyAfter === (investigating ? 'FAILED_REMAINS' : 'SUPPLIER') && placement.custody === raw.custodyAfter &&
    placement.physicalVersion === raw.physicalVersion + (investigating ? 0 : 1) &&
    placement.bottleId === (investigating ? null : successorId) &&
    (!Object.hasOwn(raw, 'supersededLegacyRequestRevision') || investigating && integer(raw.supersededLegacyRequestRevision));
}

/** Strict inventory/receipt replay for the three originals. The enclosing
 * source MUST additionally use validatePaleEmperorState: only that formal
 * validator authenticates the seed, all life/era gaps, combat and nine earlier
 * roots. This resolver is neither an admission token nor a historical rewrite. */
export function resolveDeathOriginals(snapshot: DeathOriginSnapshot): DeathOriginalResolution | null {
  try {
    if (!record(snapshot) || !shape(snapshot, ['sourceEra', 'bottles', 'acquisitionJournal', 'promotionWeek', 'resupply']) ||
      !['ORIGINAL', 'POST_CYCLE'].includes(snapshot.sourceEra) || !Array.isArray(snapshot.bottles) ||
      !Array.isArray(snapshot.acquisitionJournal) || snapshot.acquisitionJournal.length > 10000 ||
      !integer(snapshot.promotionWeek, 1) || !record(snapshot.resupply)) return null;
    const era = snapshot.sourceEra, prices = paleEmperorPrices(era), recoveryPrices = DEATH_S1_RECOVERY_PRICES[era];
    const bottles: DeathRecoveredBottle[] = PALE_EMPEROR_POTION_SOURCES.map(({ id, source }) => ({ id, source,
      stockedWeek: null, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null }));
    const resupply: DeathOriginSnapshot['resupply'] = { requestedWeek: null, deliveries: 0 };
    const origins = new Map<string, DeathOriginalId>(DEATH_ORIGINAL_IDS.map(id => [id, id] as const));
    const latest = new Map<DeathOriginalId, string>(DEATH_ORIGINAL_IDS.map(id => [id, id] as const));
    const consumptions = new Map<string, DeathAcquisitionEvent>();
    const physicalIdentities = new Map<DeathOriginalId, string>();
    const physicalVersions = new Map<DeathOriginalId, number>();
    const permissionIds = new Set<string>();
    const preparations = new Set<string>();
    let guidance = false, preparedWeek: number | null = null, promotionWeek: number | null = null;
    let promotionReceiptRevision: number | null = null, embodiedBottleId: string | null = null;
    let previous: DeathAcquisitionEvent | null = null, first: DeathAcquisitionEvent | null = null;
    let pendingEvent: RecoveryEvent | null = null, legacyRequestRevision: number | null = null;
    for (const raw of snapshot.acquisitionJournal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'cursorBefore', 'cursorAfter',
        'randomBefore', 'randomAfter', 'check', ...(Object.hasOwn(raw, 'recoverySite') ? ['recoverySite'] : [])]) ||
        !validCommand(raw.command) || !validBudget(raw.before) || !validBudget(raw.after) || raw.before.sequence !== 2 ||
        !integer(raw.week, 1) || !integer(raw.revision) || !isValidGameDate(raw.date) ||
        raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 || !record(raw.actor) ||
        !shape(raw.actor, ['name', 'gender', 'age', 'sourceHistoryDigest', 'sourceIdentityDigest', 'pathwayId', 'deathConsulPromotionWeek', 'corpsecollectorPromotionWeek']) ||
        !text(raw.actor.name) || !integer(raw.actor.age, 1) || raw.actor.pathwayId !== 'death' || raw.actor.gender !== raw.before.gender ||
        !integer(raw.actor.deathConsulPromotionWeek, 1, raw.week) || !integer(raw.actor.corpsecollectorPromotionWeek, 1, raw.actor.deathConsulPromotionWeek) ||
        typeof raw.actor.sourceIdentityDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceIdentityDigest) ||
        (['LEARN_GUIDANCE', 'CONSUME'].includes(raw.command.type) ? typeof raw.actor.sourceHistoryDigest !== 'string' ||
          !/^[0-9a-f]{64}$/.test(raw.actor.sourceHistoryDigest) : raw.actor.sourceHistoryDigest !== null)) return null;
      const e = raw as unknown as DeathAcquisitionEvent, c = e.command, budget = structuredClone(e.before);
      if (!integer(e.cursorBefore, previous?.cursorAfter ?? 0) || !integer(e.cursorAfter) ||
        e.cursorAfter !== e.cursorBefore + (c.type === 'CONSUME' ? 1 : 0) ||
        (c.type === 'CONSUME' && (e.randomBefore !== e.cursorBefore || e.randomAfter !== e.cursorAfter)) ||
        (c.type !== 'CONSUME' && (e.check !== null || e.randomBefore !== null || e.randomAfter !== null)) ||
        (!recoveryCommand(c) && Object.hasOwn(e, 'recoverySite')) ||
        [...e.before.injuries, ...e.after.injuries].some(i => i.acquiredRevision > e.revision || i.treatedRevision !== null && i.treatedRevision > e.revision)) return null;
      if (previous && (e.revision <= previous.revision || e.week < previous.week || compareGameDates(e.date, previous.date) < 0 ||
        previous.after.sequence === 1 || e.actor.name !== previous.actor.name || e.actor.gender !== previous.actor.gender ||
        e.actor.age !== previous.actor.age || e.actor.sourceIdentityDigest !== previous.actor.sourceIdentityDigest ||
        e.actor.deathConsulPromotionWeek !== previous.actor.deathConsulPromotionWeek || e.actor.corpsecollectorPromotionWeek !== previous.actor.corpsecollectorPromotionWeek ||
        PALE_EMPEROR_INHERITED_ABILITY_IDS.some(id => e.before.mastery[id] !== previous!.after.mastery[id]) ||
        !same(e.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources) ||
        preparedWeek !== null && (e.week !== previous.week || !same(e.date, previous.date) || !same(e.before, previous.after)) ||
        e.revision === previous.revision + 1 && e.week === previous.week && previous.after.actions > 0 &&
          (!same(e.before, previous.after) || e.cursorBefore !== previous.cursorAfter))) return null;
      if (e.after.gender !== e.before.gender || first && e.actor.sourceHistoryDigest !== null && e.actor.sourceHistoryDigest !== first.actor.sourceHistoryDigest ||
        preparedWeek !== null && !['CONSUME', 'LEAVE_PREPARATION'].includes(c.type) || c.type !== 'LEARN_GUIDANCE' && !guidance) return null;
      if (c.type === 'LEARN_GUIDANCE') {
        if (guidance || previous) return null;
        guidance = true; first = e; budget.actions--; budget.cash -= prices.guidance;
        bottles.forEach((b, index) => { b.stockedWeek = e.week; b.source = paleEmperorPotionSource(era, index + 1, e.week); });
      } else if (c.type === 'PREPARE_TASK') {
        if (preparations.has(c.taskId)) return null;
        preparations.add(c.taskId); budget.actions--;
      } else if (c.type === 'PREPARE_PROMOTION') {
        if (resupply.recovery || preparations.size !== PALE_EMPEROR_PREPARATION_IDS.length || !bottles.some(b => b.status === 'PLAYER') ||
          budget.health <= 20 || budget.mind <= 40 || budget.acting !== 100 || e.week < e.actor.deathConsulPromotionWeek + PALE_EMPEROR_MIN_DEATH_CONSUL_WEEKS) return null;
        preparedWeek = e.week; budget.actions--; budget.cash -= prices.preparation;
      } else if (c.type === 'LEAVE_PREPARATION') {
        if (preparedWeek === null) return null; preparedWeek = null;
      } else if (c.type === 'REQUEST_SUPPLY') {
        if (resupply.requestedWeek !== null || bottles.length !== 3 || !bottles.every(b => b.status === 'CONSUMED' && failed(b.outcome))) return null;
        budget.actions--; budget.cash -= prices.resupply; resupply.requestedWeek = e.week; legacyRequestRevision = e.revision;
      } else if (c.type === 'RECEIVE_SUPPLY') {
        // Historical independent fourth+ originals remain valid in the formal
        // historical validator, but can never enter this three-original route.
        return null;
      } else if (c.type === 'REQUEST_RECOVERY_V1' || c.type === 'RECOVER_CHARACTERISTIC_V1') {
        const source = bottles.find(b => b.id === c.bottleId), original = origins.get(c.bottleId), receipt = consumptions.get(c.bottleId);
        const nextId = `pale-emperor-potion-${bottles.length + 1}`;
        if (!DEATH_ORIGINAL_IDS.every(id => { const b = bottles.find(item => item.id === id); return b?.status === 'CONSUMED' && failed(b.outcome); }) ||
          embodiedBottleId !== null || !source || !original || !receipt || source.status !== 'CONSUMED' || !failed(source.outcome) ||
          latest.get(original) !== source.id || !validRecoverySite(e, era, original, source, receipt, nextId)) return null;
        const site = e.recoverySite, observation = site.observation, physicalId = physicalIdentities.get(original);
        if (physicalId && physicalId !== observation.physicalId || [...physicalIdentities].some(([id, physical]) => id !== original && physical === observation.physicalId) ||
          site.physicalVersion < (physicalVersions.get(original) ?? 1) || permissionIds.has(site.permission.eventId)) return null;
        permissionIds.add(site.permission.eventId); physicalIdentities.set(original, observation.physicalId);
        physicalVersions.set(original, site.placement.physicalVersion); budget.actions--;
        if (c.type === 'REQUEST_RECOVERY_V1') {
          if (resupply.recovery || pendingEvent || (legacyRequestRevision === null ? Object.hasOwn(site, 'supersededLegacyRequestRevision') : site.supersededLegacyRequestRevision !== legacyRequestRevision)) return null;
          budget.cash -= recoveryPrices.investigation;
          resupply.requestedWeek = e.week;
          resupply.recovery = { version: 1, sourceBottleId: source.id, originalBottleId: original, characteristicId: characteristicId(original),
            sourceReceiptRevision: receipt.revision, requestedWeek: e.week, siteId: site.siteId, custodianId: observation.custodianId, sourceEra: era };
          pendingEvent = e; legacyRequestRevision = null;
        } else {
          const pending = resupply.recovery, requestedSite = pendingEvent?.recoverySite;
          if (!pending || !pendingEvent || !requestedSite || pending.sourceBottleId !== source.id || pending.originalBottleId !== original ||
            pending.characteristicId !== characteristicId(original) || pending.sourceReceiptRevision !== receipt.revision || pending.sourceEra !== era ||
            pending.requestedWeek !== resupply.requestedWeek || e.week <= pending.requestedWeek || gameDaysBetween(pendingEvent.date, e.date) < 7 ||
            pending.siteId !== site.siteId || pending.custodianId !== observation.custodianId ||
            !same(requestedSite.observation, observation) || requestedSite.placement.physicalVersion !== site.physicalVersion ||
            Object.hasOwn(site, 'supersededLegacyRequestRevision')) return null;
          const recovery = { ...pending, recoveredWeek: e.week };
          bottles.push({ id: nextId, source: deathRecoveredBottleSource(nextId, recovery), stockedWeek: e.week, labourSteps: 0,
            acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null, recovery });
          origins.set(nextId, original); latest.set(original, nextId);
          resupply.deliveries++; resupply.requestedWeek = null; delete resupply.recovery; pendingEvent = null;
        }
      } else {
        if (!('bottleId' in c)) return null;
        const bottle = bottles.find(b => b.id === c.bottleId); if (!bottle) return null;
        if (c.type === 'POTION_WORK') {
          if (bottle.status !== 'SUPPLIER' || bottle.labourSteps >= 5) return null;
          bottle.labourSteps++; budget.actions--;
        } else if (c.type === 'BUY_POTION') {
          if (bottle.status !== 'SUPPLIER') return null;
          budget.cash -= bottle.recovery ? bottle.labourSteps === 5 ? recoveryPrices.afterLabour : recoveryPrices.full :
            bottle.labourSteps === 5 ? prices.labourBalance : prices.potion;
          bottle.status = 'PLAYER'; bottle.acquiredWeek = e.week;
        } else if (c.type === 'CONSUME') {
          if (bottle.status !== 'PLAYER' || preparedWeek !== e.week || !e.check || (!succeeded(e.check.tier) && !failed(e.check.tier)) ||
            !integer(e.check.roll, 1, 100) || budget.health <= 20 || budget.mind <= 40 || budget.acting !== 100 ||
            e.week < e.actor.deathConsulPromotionWeek + PALE_EMPEROR_MIN_DEATH_CONSUL_WEEKS || preparations.size !== PALE_EMPEROR_PREPARATION_IDS.length ||
            !same(e.check, resolveNormalCheck({ ability: 'will', baseAbility: budget.coreStats.will, difficulty: 30, modifiers: [], roll: e.check.roll }))) return null;
          bottle.status = 'CONSUMED'; bottle.outcome = e.check.tier; bottle.consumedWeek = e.week; bottle.preparationWeek = preparedWeek; preparedWeek = null;
          consumptions.set(bottle.id, e);
          if (succeeded(e.check.tier)) {
            if (embodiedBottleId !== null || resupply.requestedWeek !== null) return null;
            embodiedBottleId = bottle.id; promotionWeek = e.week; promotionReceiptRevision = e.revision;
            budget.sequence = 1; budget.acting = 0; budget.mind = Math.max(1, budget.mind - (e.check.tier === 'GREAT_SUCCESS' ? 8 : 15));
            if (!budget.completedSources.includes('death-s1')) budget.completedSources.push('death-s1');
            for (const id of PALE_EMPEROR_ABILITY_IDS) budget.mastery[id] = 0;
            for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) budget.coreStats[stat] = Math.min(500, budget.coreStats[stat] + 1);
          } else {
            const severe = e.check.tier === 'GREAT_FAILURE'; budget.health = Math.max(1, budget.health - (severe ? 25 : 15));
            budget.mind = Math.max(1, budget.mind - (severe ? 45 : 25)); budget.pollution = Math.min(100, budget.pollution + (severe ? 60 : 30));
          }
        } else return null;
      }
      if (budget.actions < 0 || budget.cash < 0 || !same(budget, e.after)) return null;
      previous = e;
    }
    if (!guidance || preparedWeek !== null || pendingEvent || resupply.requestedWeek !== null || promotionWeek !== snapshot.promotionWeek ||
      promotionReceiptRevision === null || !embodiedBottleId || !same(bottles, snapshot.bottles) || !same(resupply, snapshot.resupply)) return null;
    const embodiedOriginalBottleId = origins.get(embodiedBottleId); if (!embodiedOriginalBottleId) return null;
    const characteristics: DeathOriginalResolution['characteristics'] = DEATH_ORIGINAL_IDS.map(originalBottleId => {
      const latestBottleId = latest.get(originalBottleId)!, bottle = bottles.find(b => b.id === latestBottleId)!;
      return { id: characteristicId(originalBottleId), originalBottleId, latestBottleId,
        holder: bottle.status === 'CONSUMED' ? succeeded(bottle.outcome) ? 'EMBODIED' : 'FAILED_REMAINS' : bottle.status,
        consumeRevision: consumptions.get(latestBottleId)?.revision ?? null };
    });
    if (characteristics.filter(c => c.holder === 'EMBODIED').length !== 1) return null;
    return { embodiedOriginalBottleId, embodiedBottleId, promotionReceiptRevision, characteristics };
  } catch { return null; }
}

export const deathBudget = (s: SliceState): DeathBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash, health: s.health, mind: s.mind,
  spirituality: s.spirituality, pollution: s.seer.pollution, injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk,
  status: s.status, sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats }, completedSources: [...s.seer.completedSources],
});
export const deathHistoryDigest = (s: SliceState): string => digest(Object.fromEntries(DEATH_FROZEN_SOURCE_KEYS.map(key => [key, s[key]])));
export const deathOriginalPeopleAndObjects = (s: SliceState): DeathSource['originals'] => ({
  chambers: paleEmperorOriginals(s), life: structuredClone(s.paleEmperor.life), encounter: structuredClone(s.paleEmperor.encounter),
});
export function deathAcquisitionSnapshot(s: SliceState): DeathOriginSnapshot {
  const p = s.paleEmperor;
  if (p.promotionWeek === null || p.sourceEra === null) throw Error('缺少本人真实苍白皇帝晋升或实际来源时代。');
  return { sourceEra: p.sourceEra, bottles: structuredClone(p.bottles), acquisitionJournal: structuredClone(p.acquisitionJournal),
    promotionWeek: p.promotionWeek, resupply: structuredClone(p.resupply) };
}

/** Cold source admission. It intentionally accepts the actual injured body;
 * later care and the twelve-week consumption gate are real chapter actions. */
export function deathSourceBlock(s: SliceState): string | null {
  try {
    if (s.progression.pathwayId !== 'death' || s.progression.sequence !== 1 || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0)
      return '须由仍活着的苍白皇帝本人继续；旧周期或历史视图不能复活身体。';
    if (!validatePaleEmperorState(s) || !validateFerrymanEra(s) || s.paleEmperor.promotionWeek === null)
      return '原晋升、九阶履历、当代生活、财务、实战与原人原物尚未通过完整核验。';
    if (s.progression.acting !== 100 || !s.paleEmperor.life.reflected || Object.values(s.paleEmperor.life.cases).length !== 3 ||
      Object.values(s.paleEmperor.life.cases).some(c => c.status !== 'RESOLVED' || c.contactOpen || !c.returned))
      return '先完成苍白皇帝三份真实实践、反思与消化。';
    if (hasPaleEmperorLock(s) || hasPaleEmperorOldPractice(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE')
      return '先收束旧场地、原物与未结事务，再沿普通通路回到接待处。';
    if (s.paleEmperor.sourceEra !== 'POST_CYCLE' || s.ferryman.era.location !== 'RECEPTION' ||
      s.paleEmperor.life.playerLocation !== 'RECEPTION' || s.world.city !== 'BACKLUND')
      return '本章只接续已真实到场的当代生活交接；原时代历史仍可读，不能自动换时代或重置生活额度。';
    const stocked = s.paleEmperor.acquisitionJournal.find(e => e.command.type === 'LEARN_GUIDANCE'), succession = DEATH_SUCCESSION;
    if (!stocked || succession.branchId !== DEATH_FUTURE_BRANCH.id || succession.predecessorId !== DEATH_FUTURE_BRANCH.predecessorId ||
      succession.uniquenessId !== 'DE0-U1' || succession.objectCount !== 1 || succession.predecessorStillEmbodied ||
      succession.termination.status !== 'DEAD' || succession.termination.health !== 0 || succession.termination.cause !== 'ACTUAL_DEATH' ||
      succession.incumbentActorId !== null || succession.custodianEmbodied || succession.transfer.custodyOnly !== true ||
      succession.custodianActorId !== DEATH_FUTURE_BRANCH.custodianId || succession.transfer.toActorId !== succession.custodianActorId || succession.separation.objectId !== succession.uniquenessId ||
      succession.transfer.objectId !== succession.uniquenessId || !same(succession.termination.date, DEATH_FUTURE_BRANCH.terminationDate) ||
      !same(succession.separation.date, DEATH_FUTURE_BRANCH.terminationDate) || !same(succession.transfer.date, DEATH_FUTURE_BRANCH.transferDate) ||
      compareGameDates(succession.termination.date, succession.separation.date) > 0 ||
      compareGameDates(succession.separation.date, succession.transfer.date) > 0 || compareGameDates(succession.transfer.date, stocked.date) >= 0 ||
      succession.characteristicCustody.length !== 3 || DEATH_ORIGINAL_IDS.some(id => {
        const entries = succession.characteristicCustody.filter(c => c.originalBottleId === id), c = entries[0];
        return entries.length !== 1 || !c || c.characteristicId !== characteristicId(id) || c.transfer.toActorId !== 'DE0-ORIGINAL-SUPPLIER' ||
          !same(c.separation.date, DEATH_FUTURE_BRANCH.terminationDate) || !same(c.transfer.date, DEATH_FUTURE_BRANCH.transferDate) ||
          compareGameDates(succession.termination.date, c.separation.date) > 0 || compareGameDates(c.separation.date, c.transfer.date) > 0 ||
          compareGameDates(c.transfer.date, stocked.date) >= 0;
      })) return '同一唯一性的死亡、分离、三原份交接与当前空位未核清；未解锁库存模板不能算实物来源。';
    const acquisition = deathAcquisitionSnapshot(s);
    if (acquisition.acquisitionJournal.some(e => e.command.type === 'RECEIVE_SUPPLY') || acquisition.bottles.some(b => !isDeathOriginal(b.id) && !b.recovery))
      return '历史独立第4份及以后原瓶保持原号和原记录可读，但不能进入只容纳三原份的死神支线，也不能改标为回收容器。';
    if (!resolveDeathOriginals(acquisition)) return '三份原特性的取得、实际失败与成功、现持状态或同物回收单链未通过核验。';
    return null;
  } catch { return '苍白皇帝真实来源结构无效，不能以空来源重新开局。'; }
}

export function createDeathSource(s: SliceState): DeathSource {
  const reason = deathSourceBlock(s); if (reason) throw Error(reason);
  const acquisition = deathAcquisitionSnapshot(s), originals = deathOriginalPeopleAndObjects(s), originalCharacteristics = resolveDeathOriginals(acquisition);
  if (!originalCharacteristics) throw Error('三原份来源在交接时不一致。');
  return { runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision, budget: deathBudget(s), character: structuredClone(s.character),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier,
      nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }), random: { ...s.random },
    historyDigest: deathHistoryDigest(s), originalWorldDigest: digest(s.world), combatHistoryLength: s.combatHistory.length,
    combatHistoryDigest: digest(s.combatHistory), era: structuredClone(s.ferryman.era), originals, originalsDigest: digest(originals),
    acquisition, acquisitionDigest: digest(acquisition), originalCharacteristics };
}

/** Read-only S1 checkpoint. Ten roots stay in the enclosing state unchanged.
 * Only current body/finance/progression are viewed at the actual handoff. A
 * DEAD live body is never replaced or published with this ACTIVE checkpoint. */
export function deathSourceView(s: SliceState, source: DeathSource): SliceState {
  const b = source.budget;
  return { ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week, date: structuredClone(b.date),
    actionsRemaining: b.actions, cash: b.cash, health: b.health, mind: b.mind, spirituality: b.spirituality,
    status: b.status, injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk,
    character: structuredClone(source.character), random: { ...source.random },
    progression: { ...s.progression, pathwayId: 'death', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] },
    combatHistory: s.combatHistory.slice(0, source.combatHistoryLength), combat: null, activeEvent: null,
    eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null };
}

/** Cold import/reopen only. Hash equality is followed by the complete formal
 * predecessor replay; owned hot transitions must not rerun this full prefix. */
export function validateDeathSource(s: SliceState, source: DeathSource, phase: 'HANDOFF' | 'COLD_REOPEN'): boolean {
  try {
    if (phase === 'HANDOFF') return same(createDeathSource(s), source);
    if (phase !== 'COLD_REOPEN' || source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` ||
      !integer(source.revision, 1, s.revision) || source.random.seed !== s.random.seed || !integer(source.random.cursor, 0, s.random.cursor) ||
      source.budget.status !== 'ACTIVE' || source.budget.sequence !== 1 || source.historyDigest !== deathHistoryDigest(s) ||
      source.originalWorldDigest !== digest(s.world) || source.combatHistoryLength !== s.combatHistory.length ||
      source.combatHistoryDigest !== digest(s.combatHistory) || !same(source.era, s.ferryman.era) ||
      !same(source.originals, deathOriginalPeopleAndObjects(s)) || source.originalsDigest !== digest(source.originals) ||
      !same(source.acquisition, deathAcquisitionSnapshot(s)) || source.acquisitionDigest !== digest(source.acquisition)) return false;
    return same(createDeathSource(deathSourceView(s, source)), source);
  } catch { return false; }
}
