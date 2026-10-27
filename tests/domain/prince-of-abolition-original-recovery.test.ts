import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import {
  createPrinceOfAbolitionState, princeOfAbolitionAcquisitionActions, princeOfAbolitionAcquisitionBlock, princeOfAbolitionCharacteristicId, princeOfAbolitionOriginalBottlePrice,
  resolvePrinceOfAbolitionOriginalsSnapshot, validatePrinceOfAbolitionAcquisitionCommand,
  validatePrinceOfAbolitionAcquisitionJournal, validatePrinceOfAbolitionState,
} from '../../src/domain/prince-of-abolition/index.js';
import { PRINCE_OF_ABOLITION_CURRENT_CONSUMPTION_RISK, PRINCE_OF_ABOLITION_RECOVERY_SCHEMA_VERSION, PRINCE_OF_ABOLITION_RECOVERY_SITE_ID, princeOfAbolitionPotionSource } from '../../src/domain/prince-of-abolition/content.js';
import type { PrinceOfAbolitionAcquisitionCommand } from '../../src/domain/prince-of-abolition/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { poa, oldBlackEmperorRoots, prepareBottle, ready, rejectPrinceOfAbolition } from './prince-of-abolition-directed-helper.js';

const natural = 'tests/fixtures/prince-of-abolition-v02050/natural.json';
const archiveHash = '116e7060455dbde907758f92af3fb20f6de8f0e15b248f44bb895d4a78e03dfa';
const prefixHash = '0df148186fbd9ba2760b3c703f59f7318124e65d6ad238eebcad7ba9eb9738ab';
let prefixCache: SliceState | undefined;
function prefixSource(): SliceState {
  if (!prefixCache) {
    expect(createHash('sha256').update(readFileSync(natural)).digest('hex')).toBe(archiveHash);
    const raw = readObjectEntry<SliceState>(natural, 'prefixFinal');
    expect(createHash('sha256').update(stableStringify(raw)).digest('hex')).toBe(prefixHash);
    expect(raw).toMatchObject({ schemaVersion: 202, revision: 744, week: 185, health: 100, mind: 95, spirituality: 94, cash: 800, actionsRemaining: 3,
      random: { seed: 'lawyer-natural-v063', cursor: 228 }, progression: { pathwayId: 'black-emperor', sequence: 2, acting: 100 }, princeOfAbolition: { guidanceKnown: false } });
    const before = stableStringify(raw), current = migrateSliceState(raw);
    expect(current).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    expect(stableStringify(raw)).toBe(before);
    for (const key of Object.keys(raw) as (keyof SliceState)[]) if (key !== 'schemaVersion' && key !== 'contentVersion') expect(current[key], String(key)).toEqual(raw[key]);
    expect(oldBlackEmperorRoots(current)).toEqual(oldBlackEmperorRoots(raw)); expect(current.character).toEqual(raw.character);
    expect(current.princeOfAbolition).toEqual(raw.princeOfAbolition); expect(current.random).toEqual(raw.random);
    expect(current.injuries).toEqual(raw.injuries); expect(current.briber.gifts).toEqual(raw.briber.gifts);
    assertValidSliceState(current); prefixCache = current;
  }
  return structuredClone(prefixCache);
}
/** Only the declared UNIT setup changes before guidance; no captured history is replayed or repaired. */
function directedInitial2(kind: 'SUCCESS' | 'THREE_FAILURES' = 'SUCCESS'): SliceState {
  const s = prefixSource(), weeks = Math.max(0, s.entropyDuke.promotionWeek! + 12 - s.week);
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7); s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  if (kind === 'SUCCESS') {
    let selected: number | null = null;
    for (let cursor = s.random.cursor; cursor < s.random.cursor + 512; cursor++) {
      const roll = new DeterministicActionRandomStream(s.random.seed, cursor).nextInt(1, 100);
      if (roll > 5 && roll <= chance) { selected = cursor; break; }
    }
    if (selected === null) throw Error('No bounded original-seed successful UNIT cursor.');
    s.random.cursor = selected;
  }
  assertValidSliceState(s); return s;
}
const originalId = (n: number) => `prince-of-abolition-potion-${n}`;
const carrierId = 'prince-of-abolition-recovery-1';
const recovery = (type: 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1', bottleId = originalId(1)): PrinceOfAbolitionAcquisitionCommand => ({ type, bottleId });
const journal = (s: SliceState) => s.princeOfAbolition.acquisitionJournal;
let failures: SliceState, requested: SliceState, supplier: SliceState;

/** Declared UNIT-only selection before the new guidance journal. All subsequent
 * preparation, money, rest, failures and elapsed weeks use public commands.
 * Read the genuine predecessor checkpoint; never replay its 743 old commands or the full 924-command campaign. */
beforeAll(() => {
  let s = directedInitial2('THREE_FAILURES'); s.actionsRemaining = s.weeklyBudget = 3;
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  let selected: number | null = null;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 4096; cursor++) {
    const random = new DeterministicActionRandomStream(s.random.seed, cursor);
    const rolls = Array.from({ length: 5 }, () => random.nextInt(1, 100));
    if (rolls.slice(0, 4).every(roll => roll > chance && roll < 96) && rolls[4]! > 5 && rolls[4]! <= chance) { selected = cursor; break; }
  }
  if (selected === null) throw Error('No declared four-failure UNIT cursor in the bounded original-seed search.');
  s.random.cursor = selected;
  for (const n of [1, 2, 3]) {
    s = prepareBottle(s, originalId(n), undefined, false);
    s = poa(s, { type: 'CONSUME', bottleId: originalId(n), confirmed: true });
    expect(s.progression.sequence).toBe(2);
  }
  failures = structuredClone(s);
  s = ready(s, { ap: 2, cash: 1500, health: 100, mind: 100 });
  requested = poa(s, recovery('REQUEST_RECOVERY_V1'));
  s = ready(requested, { ap: 2, cash: 1300, afterWeek: requested.princeOfAbolition.resupply.requestedWeek! });
  supplier = poa(s, recovery('RECOVER_CHARACTERISTIC_V1'));
}, 240_000);

/** An explicitly synthetic archived-format history, never the captured source.
 * Old independent4–6 remain readable but cannot become finite-original input. */
function legacyIndependentDelivery(): SliceState {
  const s = structuredClone(supplier), request = structuredClone(journal(requested).at(-1)!), delivery = structuredClone(journal(supplier).at(-1)!);
  delete request.recoverySite; delete delivery.recoverySite;
  request.command = { type: 'REQUEST_SUPPLY' }; request.after.cash = request.before.cash - 100;
  delivery.command = { type: 'RECEIVE_SUPPLY' }; delivery.before.cash += 20; delivery.after = structuredClone(delivery.before);
  s.princeOfAbolition.acquisitionJournal = [...structuredClone(journal(failures)), request, delivery];
  s.princeOfAbolition.bottles = [...structuredClone(failures.princeOfAbolition.bottles), ...[4, 5, 6].map(n => ({
    id: originalId(n), source: princeOfAbolitionPotionSource(n, delivery.week), stockedWeek: delivery.week,
    labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER' as const, outcome: null,
  }))];
  s.princeOfAbolition.resupply = { requestedWeek: null, deliveries: 1 };
  s.cash = delivery.after.cash; s.actionsRemaining = delivery.after.actions; s.revision = delivery.revision + 2;
  return s;
}

function expectOldOriginals(s: SliceState): void {
  expect(s.princeOfAbolition.bottles.slice(0, 3)).toEqual(failures.princeOfAbolition.bottles);
  expect(journal(s).slice(0, journal(failures).length)).toEqual(journal(failures));
  expect(s.princeOfAbolition.sourceHistory).toEqual(failures.princeOfAbolition.sourceHistory);
  expect(oldBlackEmperorRoots(s)).toEqual(oldBlackEmperorRoots(failures));
  expect(s.princeOfAbolition.gifts).toEqual(failures.princeOfAbolition.gifts);
  expect(validatePrinceOfAbolitionAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
}

describe('Prince of Abolition finite originals and paid recovery', () => {
  it('reads the untouched actual924 source with failed1/2 and embodied3 without offering S2 recovery', () => {
    expect(createHash('sha256').update(readFileSync(natural)).digest('hex')).toBe(archiveHash);
    const source = readObjectEntry<SliceState>(natural, 'final'), before = stableStringify(source.princeOfAbolition);
    const originals = resolvePrinceOfAbolitionOriginalsSnapshot(source.princeOfAbolition)!;
    expect(originals).toMatchObject({ embodiedOriginalBottleId: originalId(3), embodiedBottleId: originalId(3), characteristics: [
      { characteristicId: 'POA227-CHAR-1', originalBottleId: originalId(1), latestBottleId: originalId(1), holder: 'FAILED_REMNANT', consumptionHistory: [{ bottleId: originalId(1), revision: 777, week: 195, outcome: 'FAILURE' }] },
      { characteristicId: 'POA227-CHAR-2', originalBottleId: originalId(2), holder: 'FAILED_REMNANT', consumptionHistory: [{ bottleId: originalId(2), revision: 809, week: 205, outcome: 'FAILURE' }] },
      { characteristicId: 'POA227-CHAR-3', originalBottleId: originalId(3), holder: 'EMBODIED', consumptionHistory: [{ bottleId: originalId(3), revision: 846, week: 216, outcome: 'SUCCESS' }] },
    ] });
    expect(originals.characteristics[0]).not.toHaveProperty('location');
    expect(source.princeOfAbolition.bottles.every(b => !Object.hasOwn(b, 'recovery'))).toBe(true);
    expect(stableStringify(source.princeOfAbolition)).toBe(before);
    expect(source).toMatchObject({ revision: 925, week: 222, health: 80, mind: 71, spirituality: 97, cash: 140, actionsRemaining: 1 });
    expect(source.princeOfAbolition.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
    const current = migrateSliceState(source); expect(validatePrinceOfAbolitionState(current)).toBe(true);
    expect(current.princeOfAbolition).toEqual(source.princeOfAbolition);
    expect(princeOfAbolitionAcquisitionBlock(current, recovery('REQUEST_RECOVERY_V1'))).not.toBeNull();
    expect(princeOfAbolitionAcquisitionActions(current)).toEqual([]);
    expect(readObjectEntry<SliceState>(natural, 'initial').princeOfAbolition).toEqual(createPrinceOfAbolitionState());
    expect(createPrinceOfAbolitionState().resupply).not.toHaveProperty('recovery');
    expect(stableStringify(source.princeOfAbolition)).toBe(before);
    const oldGuidance = source.chronicle.find(e => e.title === '听取弑序亲王独立成品与专业准备指导')!;
    expect(oldGuidance).toMatchObject({ id: 'record-745-1188', week: 185 });
    expect(oldGuidance.text).toContain('申请独立三瓶');
    expect(PRINCE_OF_ABOLITION_CURRENT_CONSUMPTION_RISK).toContain('不再供应第四份原特性');
    expect(PRINCE_OF_ABOLITION_CURRENT_CONSUMPTION_RISK).not.toContain('申请独立三瓶');
  }, 30_000);

  it.each([1, 2, 3])('supports original%s as the actual success with a genuinely paid held peer', n => {
    let s = directedInitial2('SUCCESS');
    s = poa(s, { type: 'LEARN_GUIDANCE' });
    expect(s.chronicle.find(e => e.title === '听取弑序亲王独立成品与专业准备指导')!.text).toContain('不再供应第四份原特性');
    const peer = n % 3 + 1;
    s = poa(s, { type: 'BUY_POTION', bottleId: originalId(peer) });
    s = prepareBottle(s, originalId(n), undefined, false);
    s = poa(s, { type: 'CONSUME', bottleId: originalId(n), confirmed: true });
    const originals = resolvePrinceOfAbolitionOriginalsSnapshot(s.princeOfAbolition)!;
    expect(originals.embodiedOriginalBottleId).toBe(originalId(n));
    expect(originals.characteristics).toHaveLength(3);
    expect(originals.characteristics.find(c => c.originalBottleId === originalId(peer))!.holder).toBe('PLAYER');
    expect(originals.characteristics.filter(c => c.holder === 'SUPPLIER')).toHaveLength(1);
    expect(originals.characteristics[n - 1]!.characteristicId).toBe(princeOfAbolitionCharacteristicId(originalId(n)));
    expect(validatePrinceOfAbolitionAcquisitionJournal(s)).toBe(true);
  }, 120_000);

  it('requires a new paid inspection, fresh permission and a real later-week handover', () => {
    const inspection = journal(requested).at(-1)!, handover = journal(supplier).at(-1)!;
    expect([inspection.before.cash - inspection.after.cash, inspection.before.actions - inspection.after.actions]).toEqual([120, 1]);
    expect(inspection.recoverySite).toMatchObject({ siteId: PRINCE_OF_ABOLITION_RECOVERY_SITE_ID, sourceReceiptRevision: journal(failures).find(e => e.command.type === 'CONSUME')!.revision,
      originalBottleId: originalId(1), characteristicId: 'POA227-CHAR-1', permission: { personId: 'BE227-PRINCE_OF_ABOLITION-SUPPLIER', purpose: 'INVESTIGATE', week: inspection.week, revision: inspection.revision }, custodyBefore: 'FAILED_REMNANT', custodyAfter: 'SEALED_WITH_CUSTODIAN' });
    expect([handover.before.cash - handover.after.cash, handover.before.actions - handover.after.actions]).toEqual([30, 1]);
    expect(handover.week).toBeGreaterThan(inspection.week);
    expect(requested.random).toEqual(failures.random); expect(supplier.random).toEqual(failures.random);
    expect(inspection.before.gifts).toEqual(inspection.after.gifts); expect(handover.before.gifts).toEqual(handover.after.gifts);
    expect(handover.recoverySite).toMatchObject({ permission: { purpose: 'RECOVER', week: handover.week, revision: handover.revision }, custodyBefore: 'SEALED_WITH_CUSTODIAN', custodyAfter: 'SUPPLIER' });
    expect(princeOfAbolitionAcquisitionBlock(requested, recovery('RECOVER_CHARACTERISTIC_V1'))).toContain('真实周');
    rejectPrinceOfAbolition(requested, recovery('RECOVER_CHARACTERISTIC_V1'));
    rejectPrinceOfAbolition(requested, recovery('RECOVER_CHARACTERISTIC_V1', originalId(2)));
    rejectPrinceOfAbolition(supplier, recovery('REQUEST_RECOVERY_V1'));
    const dead = structuredClone(failures); dead.status = 'DEAD'; dead.health = 0;
    expect(princeOfAbolitionAcquisitionBlock(dead, recovery('REQUEST_RECOVERY_V1'))).not.toBeNull();
    const oldSchema = structuredClone(failures); oldSchema.schemaVersion = PRINCE_OF_ABOLITION_RECOVERY_SCHEMA_VERSION - 1;
    expect(princeOfAbolitionAcquisitionBlock(oldSchema, recovery('REQUEST_RECOVERY_V1'))).toContain('新版本');
    const oldRecovery = structuredClone(supplier); oldRecovery.schemaVersion = PRINCE_OF_ABOLITION_RECOVERY_SCHEMA_VERSION - 1;
    expect(validatePrinceOfAbolitionAcquisitionJournal(oldRecovery)).toBe(false);
    expect(princeOfAbolitionAcquisitionActions(failures).filter(a => a.command.type === 'REQUEST_RECOVERY_V1')).toHaveLength(3);
    expect(princeOfAbolitionAcquisitionActions(requested).some(a => a.command.type === 'RECOVER_CHARACTERISTIC_V1')).toBe(true);
    expect(supplier.princeOfAbolition.bottles).toHaveLength(4);
    expect(supplier.princeOfAbolition.bottles[3]).toMatchObject({ id: carrierId, status: 'SUPPLIER', acquiredWeek: null, recovery: { originalBottleId: originalId(1), sourceBottleId: originalId(1), characteristicId: 'POA227-CHAR-1' } });
    expect(resolvePrinceOfAbolitionOriginalsSnapshot(supplier.princeOfAbolition)!.characteristics).toHaveLength(3);
    expectOldOriginals(supplier);
  });

  it('repays liquid and preparation, then preserves another real failure and recovers that same remnant', () => {
    let s = structuredClone(supplier);
    expect(princeOfAbolitionOriginalBottlePrice(s.princeOfAbolition.bottles[3]!)).toBe(900);
    for (let n = 0; n < 5; n++) s = poa(ready(s), { type: 'POTION_WORK', bottleId: carrierId });
    expect(princeOfAbolitionOriginalBottlePrice(s.princeOfAbolition.bottles[3]!)).toBe(90);
    s = ready(s, { ap: 2, cash: 300, health: 100, mind: 100, spirituality: 120, pollution: 0 });
    s = poa(s, { type: 'BUY_POTION', bottleId: carrierId });
    const delivery = journal(s).at(-1)!; expect(delivery.before.cash - delivery.after.cash).toBe(90);
    s = poa(s, { type: 'PREPARE_PROMOTION' });
    const preparation = journal(s).at(-1)!; expect(preparation.before.cash - preparation.after.cash).toBe(180);
    s = poa(s, { type: 'CONSUME', bottleId: carrierId, confirmed: true });
    expect(s.progression.sequence).toBe(2);
    expect(journal(s).at(-1)!.check?.tier).toBe('FAILURE');
    expect(resolvePrinceOfAbolitionOriginalsSnapshot(s.princeOfAbolition)!.characteristics[0]).toMatchObject({ holder: 'FAILED_REMNANT', latestBottleId: carrierId });
    expect(resolvePrinceOfAbolitionOriginalsSnapshot(s.princeOfAbolition)!.characteristics[0]!.consumptionHistory).toHaveLength(2);
    s = poa(ready(s, { ap: 2, cash: 150 }), recovery('REQUEST_RECOVERY_V1', carrierId));
    s = ready(s, { ap: 2, cash: 30, afterWeek: s.princeOfAbolition.resupply.requestedWeek! });
    s = poa(s, recovery('RECOVER_CHARACTERISTIC_V1', carrierId));
    expect(s.random.cursor).toBe(failures.random.cursor + 1);
    expect(s.princeOfAbolition.bottles.at(-1)).toMatchObject({ id: 'prince-of-abolition-recovery-2', recovery: { originalBottleId: originalId(1), sourceBottleId: carrierId, characteristicId: 'POA227-CHAR-1' } });
    expect(resolvePrinceOfAbolitionOriginalsSnapshot(s.princeOfAbolition)!.characteristics).toHaveLength(3);
    expectOldOriginals(s);
    const nextCarrier = s.princeOfAbolition.bottles.at(-1)!;
    expect(princeOfAbolitionOriginalBottlePrice(nextCarrier)).toBe(900);
    s = ready(s, { ap: 2, cash: 1080, health: 100, mind: 100 });
    s = poa(s, { type: 'BUY_POTION', bottleId: nextCarrier.id });
    expect(journal(s).at(-1)!.before.cash - journal(s).at(-1)!.after.cash).toBe(900);
    s = poa(s, { type: 'PREPARE_PROMOTION' });
    s = poa(s, { type: 'CONSUME', bottleId: nextCarrier.id, confirmed: true });
    expect(s.progression.sequence).toBe(1);
    const originals = resolvePrinceOfAbolitionOriginalsSnapshot(s.princeOfAbolition)!;
    expect(originals).toMatchObject({ embodiedOriginalBottleId: originalId(1), embodiedBottleId: nextCarrier.id });
    expect(originals.characteristics).toHaveLength(3);
    expect(originals.characteristics[0]!.consumptionHistory).toHaveLength(3);
    expectOldOriginals(s);
  }, 120_000);

  it('rejects forged receipts, wrong custody, closed original route and independent fourth originals', () => {
    for (const mutate of [
      (s: SliceState) => { s.princeOfAbolition.bottles[3]!.recovery!.originalBottleId = originalId(2); },
      (s: SliceState) => { journal(s).find(e => e.recoverySite)!.recoverySite!.sourceReceiptRevision++; },
      (s: SliceState) => { journal(s).find(e => e.recoverySite)!.recoverySite!.permission.personId = 'FM3-DARIAN' as never; },
      (s: SliceState) => { journal(s).find(e => e.recoverySite)!.recoverySite!.custodyBefore = 'SEALED_WITH_CUSTODIAN'; },
      (s: SliceState) => { journal(s).at(-1)!.after.cash++; },
    ]) {
      const bad = structuredClone(supplier); mutate(bad);
      expect(validatePrinceOfAbolitionState(bad)).toBe(false); expect(resolvePrinceOfAbolitionOriginalsSnapshot(bad.princeOfAbolition)).toBeNull();
    }
    const blocked = structuredClone(failures); blocked.entropyDuke.life.operation.door = 'CLOSED';
    expect(princeOfAbolitionAcquisitionBlock(blocked, recovery('REQUEST_RECOVERY_V1'))).not.toBeNull();
    expect(validatePrinceOfAbolitionAcquisitionCommand({ type: 'REQUEST_SUPPLY' })).toBe(false);
    expect(validatePrinceOfAbolitionAcquisitionCommand({ type: 'RECEIVE_SUPPLY' })).toBe(false);
    const legacy = legacyIndependentDelivery();
    expect(validatePrinceOfAbolitionState(legacy)).toBe(true);
    const before = stableStringify(legacy);
    expect(resolvePrinceOfAbolitionOriginalsSnapshot(legacy.princeOfAbolition)).toBeNull();
    expect(stableStringify(legacy)).toBe(before);
    rejectPrinceOfAbolition(legacy, recovery('REQUEST_RECOVERY_V1'));
  });
});
