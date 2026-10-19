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
  mercurySnakeAcquisitionBlock, mercurySnakeCharacteristicId, mercurySnakeOriginalBottlePrice,
  resolveMercurySnakeOriginalsSnapshot, validateMercurySnakeAcquisitionCommand,
  validateMercurySnakeAcquisitionJournal, validateMercurySnakeState,
} from '../../src/domain/mercury-snake/index.js';
import { MERCURY_SNAKE_CURRENT_CONSUMPTION_RISK, MERCURY_SNAKE_RECOVERY_SITE_ID, mercurySnakePotionSource } from '../../src/domain/mercury-snake/content.js';
import type { MercurySnakeAcquisitionCommand } from '../../src/domain/mercury-snake/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { ms, oldWheelRoots, prepareBottle, ready, rejectMercurySnake } from './mercury-snake-directed-helper.js';

const natural = 'tests/fixtures/mercury-snake-v02040/natural.json';
const archiveHash = '6d4542561817368ec18b535ee6195084412f97f356c00d511b8cf57c8198d574';
const prefixHash = '8e245a712705c444a2d5389e594ffe9c8c1ea8290bae511d686cbc8cd769a4c2';
let prefixCache: SliceState | undefined;
function prefixSource(): SliceState {
  if (!prefixCache) {
    expect(createHash('sha256').update(readFileSync(natural)).digest('hex')).toBe(archiveHash);
    const raw = readObjectEntry<SliceState>(natural, 'prefixFinal');
    expect(createHash('sha256').update(stableStringify(raw)).digest('hex')).toBe(prefixHash);
    expect(raw).toMatchObject({ schemaVersion: 201, revision: 704, week: 177, health: 90, mind: 95, spirituality: 119, cash: 1060, actionsRemaining: 2,
      random: { seed: 'monster-natural-v060', cursor: 269 }, progression: { pathwayId: 'wheel', sequence: 2, acting: 100 }, mercurySnake: { guidanceKnown: false } });
    const before = stableStringify(raw), current = migrateSliceState(raw);
    expect(current).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    expect(stableStringify(raw)).toBe(before);
    for (const key of Object.keys(raw) as (keyof SliceState)[]) if (key !== 'schemaVersion' && key !== 'contentVersion') expect(current[key], String(key)).toEqual(raw[key]);
    expect(oldWheelRoots(current)).toEqual(oldWheelRoots(raw)); expect(current.character).toEqual(raw.character);
    expect(current.mercurySnake).toEqual(raw.mercurySnake); expect(current.random).toEqual(raw.random);
    expect(current.injuries).toEqual(raw.injuries); expect(current.winner.luck).toEqual({ stored: 0, lastAccumulateWeek: 176, accumulated: 14, spent: 14 });
    assertValidSliceState(current); prefixCache = current;
  }
  return structuredClone(prefixCache);
}
/** Only the declared UNIT setup changes before guidance; no captured history is replayed or repaired. */
function directedInitial2(kind: 'SUCCESS' | 'THREE_FAILURES' = 'SUCCESS'): SliceState {
  const s = prefixSource(), weeks = Math.max(0, s.fateProphet.promotionWeek! + 12 - s.week);
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
const originalId = (n: number) => `mercury-snake-potion-${n}`;
const carrierId = 'mercury-snake-recovery-1';
const recovery = (type: 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1', bottleId = originalId(1)): MercurySnakeAcquisitionCommand => ({ type, bottleId });
const journal = (s: SliceState) => s.mercurySnake.acquisitionJournal;
let failures: SliceState, requested: SliceState, supplier: SliceState;

/** Declared UNIT-only selection before the new guidance journal. All subsequent
 * preparation, money, rest, failures and elapsed weeks use public commands.
 * Read the genuine predecessor checkpoint; never replay its 703 old commands. */
beforeAll(() => {
  let s = directedInitial2('THREE_FAILURES'); s.actionsRemaining = s.weeklyBudget = 3;
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  let selected: number | null = null;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 4096; cursor++) {
    const random = new DeterministicActionRandomStream(s.random.seed, cursor);
    if (Array.from({ length: 4 }, () => random.nextInt(1, 100)).every(roll => roll > chance && roll < 96)) { selected = cursor; break; }
  }
  if (selected === null) throw Error('No declared four-failure UNIT cursor in the bounded original-seed search.');
  s.random.cursor = selected;
  for (const n of [1, 2, 3]) {
    s = prepareBottle(s, originalId(n), undefined, false);
    s = ms(s, { type: 'CONSUME', bottleId: originalId(n), confirmed: true });
    expect(s.progression.sequence).toBe(2);
  }
  failures = structuredClone(s);
  s = ready(s, { ap: 2, cash: 1500, health: 100, mind: 100 });
  requested = ms(s, recovery('REQUEST_RECOVERY_V1'));
  s = ready(requested, { ap: 2, cash: 1300, afterWeek: requested.mercurySnake.resupply.requestedWeek! });
  supplier = ms(s, recovery('RECOVER_CHARACTERISTIC_V1'));
}, 240_000);

/** An explicitly synthetic archived-format history, never the captured source.
 * Old independent4–6 remain readable but cannot become finite-original input. */
function legacyIndependentDelivery(): SliceState {
  const s = structuredClone(supplier), request = structuredClone(journal(requested).at(-1)!), delivery = structuredClone(journal(supplier).at(-1)!);
  delete request.recoverySite; delete delivery.recoverySite;
  request.command = { type: 'REQUEST_SUPPLY' }; request.after.cash = request.before.cash - 100;
  delivery.command = { type: 'RECEIVE_SUPPLY' }; delivery.before.cash += 20; delivery.after = structuredClone(delivery.before);
  s.mercurySnake.acquisitionJournal = [...structuredClone(journal(failures)), request, delivery];
  s.mercurySnake.bottles = [...structuredClone(failures.mercurySnake.bottles), ...[4, 5, 6].map(n => ({
    id: originalId(n), source: mercurySnakePotionSource(n, delivery.week), stockedWeek: delivery.week,
    labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER' as const, outcome: null,
  }))];
  s.mercurySnake.resupply = { requestedWeek: null, deliveries: 1 };
  s.cash = delivery.after.cash; s.actionsRemaining = delivery.after.actions; s.revision = delivery.revision + 2;
  return s;
}

function expectOldOriginals(s: SliceState): void {
  expect(s.mercurySnake.bottles.slice(0, 3)).toEqual(failures.mercurySnake.bottles);
  expect(journal(s).slice(0, journal(failures).length)).toEqual(journal(failures));
  expect(s.mercurySnake.sourceHistory).toEqual(failures.mercurySnake.sourceHistory);
  expect(oldWheelRoots(s)).toEqual(oldWheelRoots(failures));
  expect(s.mercurySnake.luck).toEqual(failures.mercurySnake.luck);
  expect(validateMercurySnakeAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
}

describe('Mercury Snake finite originals and paid recovery', () => {
  it('reads the untouched actual841 source with failed1, embodied2 and unbought3', () => {
    expect(createHash('sha256').update(readFileSync(natural)).digest('hex')).toBe(archiveHash);
    const source = readObjectEntry<SliceState>(natural, 'final'), before = stableStringify(source.mercurySnake);
    const originals = resolveMercurySnakeOriginalsSnapshot(source.mercurySnake)!;
    expect(originals).toMatchObject({ embodiedOriginalBottleId: originalId(2), embodiedBottleId: originalId(2), characteristics: [
      { characteristicId: 'MS226-CHAR-1', originalBottleId: originalId(1), latestBottleId: originalId(1), holder: 'FAILED_REMNANT', consumptionHistory: [{ bottleId: originalId(1), revision: 730, week: 185, outcome: 'FAILURE' }] },
      { characteristicId: 'MS226-CHAR-2', originalBottleId: originalId(2), holder: 'EMBODIED', consumptionHistory: [{ bottleId: originalId(2), revision: 767, week: 196, outcome: 'SUCCESS' }] },
      { characteristicId: 'MS226-CHAR-3', originalBottleId: originalId(3), holder: 'SUPPLIER', consumptionHistory: [] },
    ] });
    expect(originals.characteristics[0]).not.toHaveProperty('location');
    expect(source.mercurySnake.bottles.every(b => !Object.hasOwn(b, 'recovery'))).toBe(true);
    expect(stableStringify(source.mercurySnake)).toBe(before);
    expect(source).toMatchObject({ revision: 842, week: 202, health: 90, mind: 88, spirituality: 86, cash: 20, actionsRemaining: 3 });
    expect(source.mercurySnake.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
    const current = migrateSliceState(source); expect(validateMercurySnakeState(current)).toBe(true);
    expect(current.mercurySnake).toEqual(source.mercurySnake);
    expect(stableStringify(source.mercurySnake)).toBe(before);
    const oldGuidance = source.chronicle.find(e => e.title === '听取水银之蛇独立成品与专业准备指导')!;
    expect(oldGuidance).toMatchObject({ id: 'record-705-1131', week: 177 });
    expect(oldGuidance.text).toContain('申请独立三瓶');
    expect(MERCURY_SNAKE_CURRENT_CONSUMPTION_RISK).toContain('不再供应第四份原特性');
    expect(MERCURY_SNAKE_CURRENT_CONSUMPTION_RISK).not.toContain('申请独立三瓶');
  });

  it.each([1, 2, 3])('supports original%s as the actual success with a genuinely paid held peer', n => {
    let s = directedInitial2('SUCCESS');
    s = ms(s, { type: 'LEARN_GUIDANCE' });
    expect(s.chronicle.find(e => e.title === '听取水银之蛇独立成品与专业准备指导')!.text).toContain('不再供应第四份原特性');
    const peer = n % 3 + 1;
    s = ms(s, { type: 'BUY_POTION', bottleId: originalId(peer) });
    s = prepareBottle(s, originalId(n), undefined, false);
    s = ms(s, { type: 'CONSUME', bottleId: originalId(n), confirmed: true });
    const originals = resolveMercurySnakeOriginalsSnapshot(s.mercurySnake)!;
    expect(originals.embodiedOriginalBottleId).toBe(originalId(n));
    expect(originals.characteristics).toHaveLength(3);
    expect(originals.characteristics.find(c => c.originalBottleId === originalId(peer))!.holder).toBe('PLAYER');
    expect(originals.characteristics.filter(c => c.holder === 'SUPPLIER')).toHaveLength(1);
    expect(originals.characteristics[n - 1]!.characteristicId).toBe(mercurySnakeCharacteristicId(originalId(n)));
    expect(validateMercurySnakeAcquisitionJournal(s)).toBe(true);
  }, 120_000);

  it('requires a new paid inspection, fresh permission and a real later-week handover', () => {
    const inspection = journal(requested).at(-1)!, handover = journal(supplier).at(-1)!;
    expect([inspection.before.cash - inspection.after.cash, inspection.before.actions - inspection.after.actions]).toEqual([120, 1]);
    expect(inspection.recoverySite).toMatchObject({ siteId: MERCURY_SNAKE_RECOVERY_SITE_ID, sourceReceiptRevision: journal(failures).find(e => e.command.type === 'CONSUME')!.revision,
      originalBottleId: originalId(1), characteristicId: 'MS226-CHAR-1', permission: { personId: 'WF226-MERCURY_SNAKE-SUPPLIER', purpose: 'INVESTIGATE', week: inspection.week, revision: inspection.revision }, custodyBefore: 'FAILED_REMNANT', custodyAfter: 'SEALED_WITH_CUSTODIAN' });
    expect([handover.before.cash - handover.after.cash, handover.before.actions - handover.after.actions]).toEqual([30, 1]);
    expect(handover.week).toBeGreaterThan(inspection.week);
    expect(requested.random).toEqual(failures.random); expect(supplier.random).toEqual(failures.random);
    expect(inspection.before.luck).toEqual(inspection.after.luck); expect(handover.before.luck).toEqual(handover.after.luck);
    expect(handover.recoverySite).toMatchObject({ permission: { purpose: 'RECOVER', week: handover.week, revision: handover.revision }, custodyBefore: 'SEALED_WITH_CUSTODIAN', custodyAfter: 'SUPPLIER' });
    expect(mercurySnakeAcquisitionBlock(requested, recovery('RECOVER_CHARACTERISTIC_V1'))).toContain('真实周');
    rejectMercurySnake(requested, recovery('RECOVER_CHARACTERISTIC_V1'));
    rejectMercurySnake(requested, recovery('RECOVER_CHARACTERISTIC_V1', originalId(2)));
    rejectMercurySnake(supplier, recovery('REQUEST_RECOVERY_V1'));
    expect(supplier.mercurySnake.bottles).toHaveLength(4);
    expect(supplier.mercurySnake.bottles[3]).toMatchObject({ id: carrierId, status: 'SUPPLIER', acquiredWeek: null, recovery: { originalBottleId: originalId(1), sourceBottleId: originalId(1), characteristicId: 'MS226-CHAR-1' } });
    expect(resolveMercurySnakeOriginalsSnapshot(supplier.mercurySnake)!.characteristics).toHaveLength(3);
    expectOldOriginals(supplier);
  });

  it('repays liquid and preparation, then preserves another real failure and recovers that same remnant', () => {
    let s = structuredClone(supplier);
    expect(mercurySnakeOriginalBottlePrice(s.mercurySnake.bottles[3]!)).toBe(900);
    for (let n = 0; n < 5; n++) s = ms(ready(s), { type: 'POTION_WORK', bottleId: carrierId });
    expect(mercurySnakeOriginalBottlePrice(s.mercurySnake.bottles[3]!)).toBe(90);
    s = ready(s, { ap: 2, cash: 300, health: 100, mind: 100, spirituality: 120, pollution: 0 });
    s = ms(s, { type: 'BUY_POTION', bottleId: carrierId });
    const delivery = journal(s).at(-1)!; expect(delivery.before.cash - delivery.after.cash).toBe(90);
    s = ms(s, { type: 'PREPARE_PROMOTION' });
    const preparation = journal(s).at(-1)!; expect(preparation.before.cash - preparation.after.cash).toBe(180);
    s = ms(s, { type: 'CONSUME', bottleId: carrierId, confirmed: true });
    expect(s.progression.sequence).toBe(2);
    expect(journal(s).at(-1)!.check?.tier).toBe('FAILURE');
    expect(resolveMercurySnakeOriginalsSnapshot(s.mercurySnake)!.characteristics[0]).toMatchObject({ holder: 'FAILED_REMNANT', latestBottleId: carrierId });
    expect(resolveMercurySnakeOriginalsSnapshot(s.mercurySnake)!.characteristics[0]!.consumptionHistory).toHaveLength(2);
    s = ms(ready(s, { ap: 2, cash: 150 }), recovery('REQUEST_RECOVERY_V1', carrierId));
    s = ready(s, { ap: 2, cash: 30, afterWeek: s.mercurySnake.resupply.requestedWeek! });
    s = ms(s, recovery('RECOVER_CHARACTERISTIC_V1', carrierId));
    expect(s.random.cursor).toBe(failures.random.cursor + 1);
    expect(s.mercurySnake.bottles.at(-1)).toMatchObject({ id: 'mercury-snake-recovery-2', recovery: { originalBottleId: originalId(1), sourceBottleId: carrierId, characteristicId: 'MS226-CHAR-1' } });
    expect(resolveMercurySnakeOriginalsSnapshot(s.mercurySnake)!.characteristics).toHaveLength(3);
    expectOldOriginals(s);
  }, 120_000);

  it('rejects forged receipts, wrong custody, closed original route and independent fourth originals', () => {
    for (const mutate of [
      (s: SliceState) => { s.mercurySnake.bottles[3]!.recovery!.originalBottleId = originalId(2); },
      (s: SliceState) => { journal(s).find(e => e.recoverySite)!.recoverySite!.sourceReceiptRevision++; },
      (s: SliceState) => { journal(s).find(e => e.recoverySite)!.recoverySite!.permission.personId = 'CW3-VERA' as never; },
      (s: SliceState) => { journal(s).find(e => e.recoverySite)!.recoverySite!.custodyBefore = 'SEALED_WITH_CUSTODIAN'; },
      (s: SliceState) => { journal(s).at(-1)!.after.cash++; },
    ]) {
      const bad = structuredClone(supplier); mutate(bad);
      expect(validateMercurySnakeState(bad)).toBe(false); expect(resolveMercurySnakeOriginalsSnapshot(bad.mercurySnake)).toBeNull();
    }
    const blocked = structuredClone(failures); blocked.fateProphet.life.operation.door = 'CLOSED';
    expect(mercurySnakeAcquisitionBlock(blocked, recovery('REQUEST_RECOVERY_V1'))).not.toBeNull();
    expect(validateMercurySnakeAcquisitionCommand({ type: 'REQUEST_SUPPLY' })).toBe(false);
    expect(validateMercurySnakeAcquisitionCommand({ type: 'RECEIVE_SUPPLY' })).toBe(false);
    const legacy = legacyIndependentDelivery();
    expect(validateMercurySnakeState(legacy)).toBe(true);
    const before = stableStringify(legacy);
    expect(resolveMercurySnakeOriginalsSnapshot(legacy.mercurySnake)).toBeNull();
    expect(stableStringify(legacy)).toBe(before);
    rejectMercurySnake(legacy, recovery('REQUEST_RECOVERY_V1'));
  });
});
