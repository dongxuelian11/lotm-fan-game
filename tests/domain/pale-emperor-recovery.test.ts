import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  applyPaleEmperorAcquisition, recordPaleEmperorEraCommand, paleEmperorAcquisitionBudget,
  paleEmperorAcquisitionBlock, paleEmperorInheritedView, validatePaleEmperorAcquisitionCommand,
  validatePaleEmperorAcquisitionJournal, validatePaleEmperorState,
} from '../../src/domain/pale-emperor/index.js';
import {
  PALE_EMPEROR_BOTTLE_IDS, PALE_EMPEROR_RECOVERY_SCHEMA_VERSION,
  PALE_EMPEROR_RECOVERY_PRICES, paleEmperorPotionSource,
} from '../../src/domain/pale-emperor/content.js';
import { PALE_EMPEROR_PREPARATION_IDS, type PaleEmperorAcquisitionCommand } from '../../src/domain/pale-emperor/types.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveDeathOriginals } from '../../src/domain/death/source.js';
import type { DeathOriginSnapshot } from '../../src/domain/death/types.js';

const fixture = 'tests/fixtures/pale-emperor-v01950/natural.json';
const original = (n: number) => `pale-emperor-potion-${n}`;
const copy = <T>(v: T): T => structuredClone(v);
let finalCache: SliceState | undefined;
const captured = () => copy(finalCache ??= readObjectEntry<SliceState>(fixture, 'final'));
const snapshot = (s: SliceState): DeathOriginSnapshot => ({ sourceEra: s.paleEmperor.sourceEra!, bottles: copy(s.paleEmperor.bottles),
  acquisitionJournal: copy(s.paleEmperor.acquisitionJournal), promotionWeek: s.paleEmperor.promotionWeek!, resupply: copy(s.paleEmperor.resupply) });

/** Uses the actual S2 checkpoint and ordinary paid era operations. Failure-chain
 * tests explicitly choose a synthetic test seed; they are not natural-capture
 * or inherited-prefix validation evidence. Native-seed order cases keep the
 * real prefix and exercise the complete official validator separately. */
function harness(synthetic: boolean | readonly boolean[] = true) {
  const s = paleEmperorInheritedView(captured());
  Object.assign(s, { schemaVersion: PALE_EMPEROR_RECOVERY_SCHEMA_VERSION });
  if (synthetic) {
    let seed: string | undefined;
    for (let n = 0; n < 10000; n++) {
      const candidate = `pale-emperor-recovery-directed-${n}`, stream = new DeterministicActionRandomStream(candidate, s.random.cursor);
      const desired = Array.isArray(synthetic) ? synthetic : [false, false, false, false, true];
      const rolls = Array.from({ length: desired.length }, () => stream.nextInt(1, 100));
      if (rolls.every((roll, index) => (roll <= 42) === desired[index])) { seed = candidate; break; }
    }
    if (!seed) throw new Error('No bounded synthetic recovery seed');
    s.random.seed = seed;
  }
  const ctx: SeerContext = { note() {}, roll() { throw new Error('No extra draw'); }, check(ability, difficulty) {
    const stream = new DeterministicActionRandomStream(s.random.seed, s.random.cursor), roll = stream.nextInt(1, 100);
    s.random.cursor = stream.cursor;
    return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll });
  } };
  const apply = (command: PaleEmperorAcquisitionCommand) => { applyPaleEmperorAcquisition(s, command, ctx); s.revision++; };
  const era = (type: 'ERA_WORK' | 'ERA_REST' | 'ERA_CARE' | 'ERA_NEXT_WEEK') => {
    recordPaleEmperorEraCommand(s, { type }, ctx); s.revision++;
  };
  const ready = (ap = 1, cash = 0, body = false, afterWeek = -1) => {
    for (let n = 0; s.actionsRemaining < ap || s.cash < cash || s.week <= afterWeek || body && (s.health < 100 || s.mind < 100 || s.seer.pollution > 0 || s.injuries.length > 0); n++) {
      if (n >= 1500) throw new Error('Bounded actual current-era budget not reached');
      if (s.actionsRemaining === 0) era(s.cash < 24 ? 'ERA_WORK' : 'ERA_NEXT_WEEK');
      else if (body && s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null) && s.cash >= 60) era('ERA_CARE');
      else if (body && (s.health < 100 || s.mind < 100 || s.seer.pollution > 0 || s.injuries.length > 0) && s.cash >= 32 && !s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null)) era('ERA_REST');
      else era('ERA_WORK');
    }
  };
  ready(1, 120); apply({ type: 'LEARN_GUIDANCE' });
  for (const taskId of PALE_EMPEROR_PREPARATION_IDS) { ready(); apply({ type: 'PREPARE_TASK', taskId }); }
  const buy = (id: string, labour = true) => {
    if (labour) for (let n = s.paleEmperor.bottles.find(b => b.id === id)!.labourSteps; n < 5; n++) { ready(); apply({ type: 'POTION_WORK', bottleId: id }); }
    const recovered = !!s.paleEmperor.bottles.find(b => b.id === id)!.recovery;
    ready(1, recovered ? labour ? 12 : 120 : labour ? 80 : 1200);
    apply({ type: 'BUY_POTION', bottleId: id });
  };
  const consume = (id: string) => { ready(1, 20, true, s.deathConsul.promotionWeek! + 11); apply({ type: 'PREPARE_PROMOTION' }); apply({ type: 'CONSUME', bottleId: id, confirmed: true }); };
  const failOriginals = () => { for (const id of PALE_EMPEROR_BOTTLE_IDS) { buy(id); consume(id); } ready(2, 20); };
  const recover = (id: string) => {
    ready(1, 20); apply({ type: 'REQUEST_RECOVERY_V1', bottleId: id });
    ready(1, 0, false, s.paleEmperor.resupply.requestedWeek!);
    apply({ type: 'RECOVER_CHARACTERISTIC_V1', bottleId: id });
    return s.paleEmperor.bottles.at(-1)!.id;
  };
  return { s, apply, era, ready, buy, consume, failOriginals, recover };
}

/** Explicit reference construction for obsolete historical receipts. The new
 * public reducer cannot execute either old supply command. */
function legacyReceipt(h: ReturnType<typeof harness>, type: 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY') {
  const { s } = h, before = paleEmperorAcquisitionBudget(s), actor = copy(s.paleEmperor.acquisitionJournal[0]!.actor);
  actor.sourceHistoryDigest = null;
  if (type === 'REQUEST_SUPPLY') { s.actionsRemaining--; s.cash -= 20; s.paleEmperor.resupply.requestedWeek = s.week; }
  else {
    for (let n = 4; n <= 6; n++) s.paleEmperor.bottles.push({ id: original(n), source: paleEmperorPotionSource('POST_CYCLE', n, s.week),
      stockedWeek: s.week, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
    s.paleEmperor.resupply.deliveries++; s.paleEmperor.resupply.requestedWeek = null;
  }
  s.paleEmperor.acquisitionJournal.push({ week: s.week, date: copy(s.date), revision: s.revision, command: { type }, actor,
    before, after: paleEmperorAcquisitionBudget(s), cursorBefore: s.random.cursor, cursorAfter: s.random.cursor, randomBefore: null, randomAfter: null, check: null });
  s.revision++;
}

describe('Pale Emperor three-original same-remnant recovery', () => {
  it('keeps the complete 1038-command natural capture byte-exact and validates its original third success', () => {
    expect(createHash('sha256').update(readFileSync(fixture)).digest('hex')).toBe('14be49645e7fa18b4127c7ec34b39875eff1302fbba8052b9037ed149a42d66c');
    const s = captured(), before = stableStringify(s.paleEmperor);
    expect(s.paleEmperor.bottles.map(b => b.outcome)).toEqual(['FAILURE', 'FAILURE', 'SUCCESS']);
    expect(validatePaleEmperorState(s)).toBe(true);
    expect(resolveDeathOriginals(snapshot(s))?.embodiedOriginalBottleId).toBe(original(3));
    expect(stableStringify(s.paleEmperor)).toBe(before); expect(s.paleEmperor.recoveryScene).toBeUndefined();
  });
  it.each([1, 2, 3])('permutes real native-seed failures so original%s is embodied, without numbering assumptions', n => {
    const h = harness(false), order = PALE_EMPEROR_BOTTLE_IDS.filter(id => id !== original(n)).concat(original(n) as typeof PALE_EMPEROR_BOTTLE_IDS[number]);
    for (const id of order) { h.buy(id); h.consume(id); }
    expect(h.s.progression.sequence).toBe(1); expect(validatePaleEmperorState(h.s)).toBe(true);
    expect(resolveDeathOriginals(snapshot(h.s))?.embodiedOriginalBottleId).toBe(original(n));
  });
  const custodyMatrix = [1, 2, 3].flatMap(n => ['SUPPLIER', 'PLAYER', 'FAILED_REMAINS'].flatMap(a =>
    ['SUPPLIER', 'PLAYER', 'FAILED_REMAINS'].map(b => ({ n, a, b }))));
  it.each(custodyMatrix)('resolves embodied original$n with other original custody $a/$b and paid or partial labour intact', ({ n, a, b }) => {
    const states = [a, b], h = harness([...states.filter(v => v === 'FAILED_REMAINS').map(() => false), true]);
    const others = PALE_EMPEROR_BOTTLE_IDS.filter(id => id !== original(n));
    for (const [index, id] of others.entries()) {
      if (states[index] === 'SUPPLIER') {
        const partial = (n + index) % 5;
        for (let j = 0; j < partial; j++) { h.ready(); h.apply({ type: 'POTION_WORK', bottleId: id }); }
      } else { h.buy(id); if (states[index] === 'FAILED_REMAINS') h.consume(id); }
    }
    h.buy(original(n)); h.consume(original(n));
    const resolved = resolveDeathOriginals(snapshot(h.s)); expect(resolved?.embodiedOriginalBottleId).toBe(original(n));
    for (const [index, id] of others.entries()) expect(resolved?.characteristics.find(c => c.originalBottleId === id)?.holder).toBe(states[index]);
    expect(validatePaleEmperorAcquisitionJournal(h.s)).toBe(true);
  });
  it.each([0, 1, 2, 3, 4, 5])('preserves %s supplier labour steps beside an already paid unconsumed original', labour => {
    const h = harness([true]);
    for (let j = 0; j < labour; j++) { h.ready(); h.apply({ type: 'POTION_WORK', bottleId: original(2) }); }
    h.buy(original(3)); const paidBottle = copy(h.s.paleEmperor.bottles[2]);
    h.buy(original(1)); h.consume(original(1));
    expect(h.s.paleEmperor.bottles[1]).toMatchObject({ labourSteps: labour, status: 'SUPPLIER', acquiredWeek: null });
    expect(h.s.paleEmperor.bottles[2]).toEqual(paidBottle);
    expect(resolveDeathOriginals(snapshot(h.s))?.characteristics.map(c => c.holder)).toEqual(['EMBODIED', 'SUPPLIER', 'PLAYER']);
    expect(validatePaleEmperorAcquisitionJournal(h.s)).toBe(true);
  });
  it.each([1, 2, 3])('investigates and recovers only original%s, preserving all old bottles and independent identities', n => {
    const h = harness(); h.failOriginals(); const { s } = h, before = copy(s.paleEmperor.bottles), cash = s.cash, ap = s.actionsRemaining, cursor = s.random.cursor;
    h.apply({ type: 'REQUEST_RECOVERY_V1', bottleId: original(n) });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 20, ap - 1]); expect(s.paleEmperor.bottles).toEqual(before);
    const request = s.paleEmperor.acquisitionJournal.at(-1)!;
    expect(request.recoverySite).toMatchObject({ originalBottleId: original(n), custodyBefore: 'FAILED_REMAINS', custodyAfter: 'FAILED_REMAINS',
      observation: { actorId: `${s.runId}:original-player`, residualPresent: true, accessible: true, custodianPresent: true }, placement: { bottleId: null, physicalVersion: 1 } });
    expect(paleEmperorAcquisitionBlock(s, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: original(n) })).not.toBeNull();
    h.ready(1, 0, false, s.week); h.apply({ type: 'RECOVER_CHARACTERISTIC_V1', bottleId: original(n) });
    expect(s.paleEmperor.bottles.slice(0, 3)).toEqual(before); expect(s.random.cursor).toBe(cursor);
    expect(s.paleEmperor.bottles[3]).toMatchObject({ id: original(4), labourSteps: 0, status: 'SUPPLIER', recovery: { originalBottleId: original(n), characteristicId: `${original(n)}:characteristic` } });
    const handover = s.paleEmperor.acquisitionJournal.at(-1)!.recoverySite!;
    expect(handover.observation).toEqual(request.recoverySite!.observation); expect(handover.permission.eventId).not.toBe(request.recoverySite!.permission.eventId);
    expect(handover.placement).toMatchObject({ physicalVersion: 2, custody: 'SUPPLIER', bottleId: original(4) });
    expect(validatePaleEmperorAcquisitionJournal(s)).toBe(true);
  });
  it('charges fresh medicine or five fresh jobs and supports a failed successor followed by the same-original success', () => {
    const h = harness(); h.failOriginals(); const id = h.recover(original(2));
    h.buy(id); expect(h.s.paleEmperor.acquisitionJournal.filter(e => e.command.type === 'POTION_WORK' && e.command.bottleId === id)).toHaveLength(5);
    const purchase = h.s.paleEmperor.acquisitionJournal.at(-1)!; expect(purchase.before.cash - purchase.after.cash).toBe(12);
    h.consume(id); expect(h.s.progression.sequence).toBe(2);
    expect(paleEmperorAcquisitionBlock(h.s, { type: 'REQUEST_RECOVERY_V1', bottleId: original(2) })).not.toBeNull();
    const successor = h.recover(id); h.buy(successor, false);
    const full = h.s.paleEmperor.acquisitionJournal.at(-1)!; expect(full.before.cash - full.after.cash).toBe(120);
    h.consume(successor); expect(validatePaleEmperorAcquisitionJournal(h.s)).toBe(true);
    const resolved = resolveDeathOriginals(snapshot(h.s)); expect(resolved?.characteristics).toHaveLength(3);
    expect(resolved).toMatchObject({ embodiedOriginalBottleId: original(2), embodiedBottleId: successor });
    expect(paleEmperorAcquisitionBlock(h.s, { type: 'REQUEST_RECOVERY_V1', bottleId: successor })).not.toBeNull();
    expect(PALE_EMPEROR_RECOVERY_PRICES.ORIGINAL).toEqual({ investigation: 100, full: 1100, afterLabour: 100 });
  });
  it('refuses missing, moved, inaccessible, withdrawn or mismatched present physical facts and never trusts command certificates', () => {
    const h = harness(); h.failOriginals(); h.apply({ type: 'REQUEST_RECOVERY_V1', bottleId: original(1) }); h.ready(1, 0, false, h.s.week);
    const command = { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: original(1) } as const;
    for (const mutate of [
      (s: SliceState) => { s.paleEmperor.recoveryScene!.remnants[0]!.residualPresent = false; },
      (s: SliceState) => { s.paleEmperor.recoveryScene!.remnants[0]!.accessible = false; },
      (s: SliceState) => { s.paleEmperor.recoveryScene!.remnants[0]!.location = 'MOVED'; },
      (s: SliceState) => { s.paleEmperor.recoveryScene!.remnants[0]!.physicalVersion++; },
      (s: SliceState) => { s.paleEmperor.recoveryScene!.custodian.present = false; },
      (s: SliceState) => { s.paleEmperor.recoveryScene!.custodian.handover = 'WITHDRAWN'; },
      (s: SliceState) => { s.paleEmperor.recoveryScene!.actorId = 'other-player'; },
      (s: SliceState) => { s.ferryman.era.location = 'OUTSIDE'; },
      (s: SliceState) => { s.status = 'DEAD'; },
    ]) { const s = copy(h.s); mutate(s); expect(paleEmperorAcquisitionBlock(s, command), mutate.toString()).not.toBeNull(); }
    const underSeven = copy(h.s), request = underSeven.paleEmperor.acquisitionJournal.find(e => e.command.type === 'REQUEST_RECOVERY_V1')!;
    underSeven.week = request.week + 1; underSeven.date = addGameDays(request.date, 6);
    expect(paleEmperorAcquisitionBlock(underSeven, command)).not.toBeNull();
    for (const extra of ['permission', 'recoverySite', 'host', 'cash', 'sourceReceiptRevision']) expect(validatePaleEmperorAcquisitionCommand({ ...command, [extra]: true })).toBe(false);
    expect(validatePaleEmperorAcquisitionCommand({ type: 'REQUEST_SUPPLY' })).toBe(false);
    expect(validatePaleEmperorAcquisitionCommand({ type: 'RECEIVE_SUPPLY' })).toBe(false);
  });
  it('replays current-site authority and rejects receipt forgery, lineage laundering, branches and old-schema extensions', () => {
    const h = harness(); h.failOriginals(); h.recover(original(1));
    for (const mutate of [
      (s: SliceState) => { s.paleEmperor.acquisitionJournal.at(-1)!.recoverySite!.observation.actorId = 'other-player'; },
      (s: SliceState) => { s.paleEmperor.acquisitionJournal.at(-1)!.recoverySite!.permission.eventId = 'old-permission'; },
      (s: SliceState) => { s.paleEmperor.acquisitionJournal.at(-1)!.recoverySite!.sourceReceiptRevision--; },
      (s: SliceState) => { s.paleEmperor.acquisitionJournal.at(-1)!.recoverySite!.placement.physicalVersion++; },
      (s: SliceState) => { delete s.paleEmperor.acquisitionJournal.at(-1)!.recoverySite; },
      (s: SliceState) => { s.paleEmperor.bottles[3]!.recovery!.sourceBottleId = original(4); },
      (s: SliceState) => { s.paleEmperor.bottles[3]!.recovery!.originalBottleId = 'pale-emperor-potion-2'; },
      (s: SliceState) => { delete s.paleEmperor.bottles[3]!.recovery; },
      (s: SliceState) => { s.paleEmperor.recoveryScene!.remnants[1]!.physicalId = s.paleEmperor.recoveryScene!.remnants[0]!.physicalId; },
      (s: SliceState) => { Object.assign(s, { schemaVersion: PALE_EMPEROR_RECOVERY_SCHEMA_VERSION - 1 }); },
    ]) { const s = copy(h.s); mutate(s); expect(validatePaleEmperorAcquisitionJournal(s), mutate.toString()).toBe(false); }
    expect(paleEmperorAcquisitionBlock(h.s, { type: 'REQUEST_RECOVERY_V1', bottleId: original(1) })).not.toBeNull();
  });
  it('reads historical independent fourth-plus stock without relabelling it, while a paid undelivered request may be explicitly replaced', () => {
    const h = harness(); h.failOriginals(); legacyReceipt(h, 'REQUEST_SUPPLY');
    const request = copy(h.s.paleEmperor.acquisitionJournal.at(-1)!);
    h.ready(1, 20); h.apply({ type: 'REQUEST_RECOVERY_V1', bottleId: original(3) });
    expect(h.s.paleEmperor.acquisitionJournal.at(-1)!.recoverySite!.supersededLegacyRequestRevision).toBe(request.revision);
    expect(h.s.paleEmperor.acquisitionJournal.find(e => e.revision === request.revision)).toEqual(request);
    expect(validatePaleEmperorAcquisitionJournal(h.s)).toBe(true);
    const legacy = harness(); legacy.failOriginals(); legacyReceipt(legacy, 'REQUEST_SUPPLY');
    legacy.ready(1, 0, false, legacy.s.week); legacyReceipt(legacy, 'RECEIVE_SUPPLY');
    expect(legacy.s.paleEmperor.bottles).toHaveLength(6); expect(validatePaleEmperorAcquisitionJournal(legacy.s)).toBe(true);
    const before = stableStringify(legacy.s.paleEmperor.bottles);
    expect(paleEmperorAcquisitionBlock(legacy.s, { type: 'REQUEST_RECOVERY_V1', bottleId: original(1) })).not.toBeNull();
    expect(resolveDeathOriginals(snapshot(legacy.s))).toBeNull(); expect(stableStringify(legacy.s.paleEmperor.bottles)).toBe(before);
  });
});
