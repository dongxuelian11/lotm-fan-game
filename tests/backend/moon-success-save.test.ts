/** Controlled success integration, deliberately separate from natural replay.
 * The full670 source is unchanged; only new d100 draws318/319 return1 after
 * their real generator calls advance. Every service, cost and custody move is
 * produced by public/owned commands. No patched state is accepted as authority. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { stableStringify } from '../../src/domain/canonical.js';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { createMoonState, getMoonPromotionStabilityPreview } from '../../src/domain/moon/engine.js';
import { openMoonRuntimeSession } from '../../src/domain/moon/owned-session.js';
import type { MoonCommand } from '../../src/domain/moon/types.js';
import { MOON_FROZEN_SOURCE_KEYS } from '../../src/domain/moon/source.js';
import { MOON_ABILITY_IDS, MOON_STATIONS, MOON_UNIQUENESS_ID, MOON_UNIQUENESS_SEAL, MOON_WORKSHOP } from '../../src/domain/moon/content.js';
import { moonVerifiedReceipts } from '../../src/domain/moon/services.js';
import { getBeautyGoddessGuest } from '../../src/domain/beauty-goddess/life.js';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import type { StoredSlice } from '../../src/application/slice-application.js';
import type { SliceEnvelope, SliceResult } from '../../src/shared/slice-contracts.js';
import {
  controlledMoonSuccess, installControlledMoonSuccess, type ControlledMoonSuccess,
} from '../helpers/moon-success.js';
import { assertUnmodifiedMoonRecoverySource, moonStateHash } from '../helpers/moon-source.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

const now = '2026-10-17T15:00:00.000Z';
let route: ControlledMoonSuccess | undefined, projection: SliceProjection | undefined;
let seam: ReturnType<typeof installControlledMoonSuccess> | undefined;
const dirs: string[] = [], stores: SqliteSliceStore[] = [];
function unwrap<T>(value: SliceResult<T>): T { if (!value.ok) throw Error(value.error.message); return value.value; }
function raw(file: string): string {
  const db = new DatabaseSync(file, { readOnly: true });
  try { return String(db.prepare('SELECT current_json FROM slice_runs WHERE id=?').get(route!.success.runId)!.current_json); }
  finally { db.close(); }
}
function stored(file: string): StoredSlice { return JSON.parse(JSON.parse(raw(file)).payload) as StoredSlice; }
function replaceRaw(file: string, state: SliceState): void {
  const payload = stableStringify({ state, updatedAt: now });
  const encoded = JSON.stringify({ format: 1, checksum: createHash('sha256').update(payload).digest('hex'), payload });
  const db = new DatabaseSync(file);
  try { db.prepare('UPDATE slice_runs SET current_json=? WHERE id=?').run(encoded, state.runId); }
  finally { db.close(); }
}
function disk(state: SliceState) {
  const dir = mkdtempSync(join(tmpdir(), 'lotm-moon-success-')); dirs.push(dir);
  const file = join(dir, 'save.sqlite'), store = new SqliteSliceStore(file, { now: () => now }); stores.push(store);
  store.repository.transaction(() => { store.repository.put({ state, updatedAt: now }); store.repository.selectRun(state.runId); });
  return { file, store };
}
function close(store: SqliteSliceStore): void { store.close(); stores.splice(stores.indexOf(store), 1); }
function advance(session: ReturnType<typeof openMoonRuntimeSession>, command: MoonCommand): SliceState {
  const draft = session.prepare({ type: 'MOON', command }, session.inspect().revision);
  session.commit(draft); return session.snapshot();
}
function expectBlockedWithoutChange(session: ReturnType<typeof openMoonRuntimeSession>, command: MoonCommand): void {
  const before = session.snapshot(), hash = moonStateHash(before);
  expect(() => session.prepare({ type: 'MOON', command }, before.revision)).toThrow();
  expect(moonStateHash(session.snapshot())).toBe(hash);
  expect(session.inspect().revision).toBe(before.revision);
}
function expectHistory(state: SliceState): void {
  const source = route!.source;
  for (const key of MOON_FROZEN_SOURCE_KEYS) expect(state[key], `Frozen ${key}`).toEqual(source[key]);
  expect(state.world).toEqual(source.world);
  expect(state.combatHistory).toEqual(source.combatHistory);
  expect(state.character).toEqual(source.character);
  expect(state.chronicle.slice(0, source.chronicle.length)).toEqual(source.chronicle);
  expect(getBeautyGoddessGuest(state)).toEqual(getBeautyGoddessGuest(source));
  expect(state.moon.source!.originalPartner).toEqual(getBeautyGoddessGuest(source));
  expect(state.beautyGoddess.bottles.slice(0, 3).every(b => b.status === 'CONSUMED')).toBe(true);
  assertUnmodifiedMoonRecoverySource();
}

beforeAll(() => {
  const control = installControlledMoonSuccess();
  try {
    route = controlledMoonSuccess(control);
    projection = projectSliceState(route.success);
    expect(control.substituted.every(draw => draw.cursorAfter === draw.cursorBefore + 1 && draw.controlled === 1)).toBe(true);
  } finally { control.restore(); control.substituted.length = 0; }
}, 180_000);
beforeEach(() => { seam = installControlledMoonSuccess(); });
afterEach(() => {
  seam?.restore(); if (seam) seam.substituted.length = 0; seam = undefined;
  vi.restoreAllMocks();
  for (const store of stores.splice(0)) store.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
afterAll(() => { route = undefined; projection = undefined; });

describe('full controlled Moon S0 success and current SQLite compatibility', () => {
  it('centrally validates the genuinely constructed S0 and preserves every predecessor and original body', () => {
    const { source, success, commands, cursorAdvancements } = route!;
    assertValidSliceState(success);
    expect(migrateSliceState(success)).toEqual(success);
    expect([success.schemaVersion, success.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(success.progression).toMatchObject({ pathwayId: 'moon', sequence: 0, acting: 0 });
    expect(success.moon.promotionWeek).toBe(success.week);
    expect(success.moon.journal).toHaveLength(commands.length - 1);
    expect(success.moon.journal.map(event => event.command)).toEqual(commands.slice(1));
    expect(success.random).toEqual({ seed: source.random.seed, cursor: 320 });
    expect(cursorAdvancements).toMatchObject([
      { stage: 'S1', cursorBefore: 318, cursorAfter: 319, actual: 57, controlled: 1, roll: 1, chance: 44 },
      { stage: 'S0', cursorBefore: 319, cursorAfter: 320, actual: expect.any(Number), controlled: 1, roll: 1, chance: 70 },
    ]);
    expect(success.moon.journal.flatMap(event => event.randomReceipts)).toHaveLength(1);
    expect(success.progression.mastery).toEqual({ ...source.progression.mastery,
      'moon.s0.moonlit-channel': 0, 'moon.s0.gentle-crossing': 0 });
    expect(success.seer.completedSources).toEqual([...source.seer.completedSources, 'MOON_ORIGINAL_SUCCESSION']);
    const historicalProgression = (state: SliceState) => {
      const { sequence: _sequence, acting: _acting, mastery: _mastery, ...history } = state.progression;
      return history;
    };
    const historicalSeer = (state: SliceState) => {
      const { pollution: _pollution, completedSources: _completedSources, ...history } = state.seer;
      return history;
    };
    expect(historicalProgression(success)).toEqual(historicalProgression(source));
    expect(historicalSeer(success)).toEqual(historicalSeer(source));
    const mutable = new Set(['moon', 'revision', 'week', 'date', 'actionsRemaining', 'cash', 'health', 'mind',
      'spirituality', 'injuries', 'injuryRisk', 'progression', 'seer', 'random', 'lastCheck', 'chronicle',
      'lastResult', 'wagePaidWeek', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']);
    for (const key of Object.keys(source) as (keyof SliceState)[])
      if (!mutable.has(key)) expect(success[key], `Unchanged full-slice field ${key}`).toEqual(source[key]);
    expectHistory(success);
  }, 60_000);

  it('earns six timed night arrivals with original equipment and pays finite costs, custody and actual70% preparation', () => {
    const { beforeConsume, success } = route!, root = success.moon, materials = root.materials!;
    expect(moonVerifiedReceipts(root.services!)).toHaveLength(6);
    const passengers = root.services!.stations.flatMap(st => st.passengers);
    expect(new Set(passengers.map(p => p.id)).size).toBe(6);
    for (const definition of MOON_STATIONS) {
      const station = root.services!.stations.find(st => st.id === definition.id)!;
      expect(station).toMatchObject({ status: 'VERIFIED', supplier: { crates: 0 }, lamp: { id: definition.lampId, condition: 87, lit: false }, boat: { id: definition.boatId, condition: 76 } });
      expect(station.passengers.map(p => p.id)).toEqual(definition.passengers.map(p => p.id));
      expect(station.passengers.every(p => p.status === 'ARRIVED' && p.location === p.destination)).toBe(true);
      const arrived = station.bookings.find(b => b.status === 'ARRIVED')!;
      expect(arrived.window.weather).toBe('CLEAR');
      const disembark = station.operations.find(op => op.bookingId === arrived.id && op.phase === 'DISEMBARK')!;
      expect(disembark.second).toBeGreaterThanOrEqual(arrived.window.startSecond);
      expect(disembark.second).toBeLessThanOrEqual(arrived.window.endSecond);
      expect(disembark.positions).toEqual(station.passengers.map(p => ({ id: p.id, location: p.destination })));
      expect(station.consumedOil).toHaveLength(definition.incident === 'NONE' ? 1 : 2);
      if (definition.incident !== 'NONE') {
        expect(station.bookings.filter(b => b.status === 'INTERRUPTED')).toHaveLength(1);
        expect(station.operations.filter(op => op.phase === 'SHORE_RETURN')).toHaveLength(1);
      }
    }
    const serviceCost = root.services!.journal.reduce((total, event) => total + event.effect.cashCost, 0);
    expect(serviceCost).toBe(120); // Three36p fittings plus one12p damage repair.
    expect(materials.legacyRemains).toHaveLength(2);
    for (const remains of materials.legacyRemains) {
      expect(remains.latestBottleId).toBe(remains.originalBottleId);
      expect(remains.investigatedEventId).not.toBeNull(); expect(remains.recoveredEventId).not.toBeNull();
      const recovered = materials.receipts.find(event => event.eventId === remains.recoveredEventId)!;
      expect(recovered.week).toBeGreaterThan(remains.investigatedWeek!);
    }
    expect(materials.receipts.reduce((total, event) => total + event.effect.cashCost, 0)).toBe(1020);
    expect(materials.characteristics).toHaveLength(3);
    expect(materials.characteristics.every(item => item.holder === 'FUSED' && item.location === root.source!.actorId)).toBe(true);
    expect(materials.uniqueness).toMatchObject({ id: MOON_UNIQUENESS_ID, seal: MOON_UNIQUENESS_SEAL,
      holder: 'FUSED', incumbentActorId: root.source!.actorId, custodianActorId: null, currentObjectCount: 1,
      deliveryRecord: { id: 'MOON-DELIVERY-01', vacancyRechecked: true, seal: MOON_UNIQUENESS_SEAL } });
    expect(materials.batches.map(batch => [batch.id, batch.status, batch.uses])).toEqual([
      ['moon-carrier-1', 'SPENT', 1], ['moon-carrier-2', 'SUPPLIER', 0], ['moon-carrier-3', 'SUPPLIER', 0],
    ]);
    expect(getMoonPromotionStabilityPreview(beforeConsume.moon, 'moon-compound-1')).toMatchObject({ prepared: true, chance: 70, preparedChance: 70 });
    const preparation = root.promotionStability.preparations[0]!, consumption = root.journal.at(-1)!;
    expect(preparation).toMatchObject({ status: 'SPENT', spentEventId: consumption.id, compoundId: 'moon-compound-1', actorId: root.source!.actorId });
    expect(preparation.receipts).toEqual(moonVerifiedReceipts(root.services!));
    expect(preparation.expiresSecond - preparation.preparedSecond).toBe(604800);
    const paid = root.journal.find(event => event.command.type === 'STABILIZE_PROMOTION')!;
    expect([paid.before.budget.cash - paid.after.budget.cash, paid.before.budget.actions - paid.after.budget.actions,
      paid.before.budget.spirituality - paid.after.budget.spirituality, paid.before.budget.mind - paid.after.budget.mind]).toEqual([100, 1, 12, 8]);
    expect([success.health, success.mind, success.spirituality, success.cash, success.actionsRemaining])
      .toEqual([beforeConsume.health, beforeConsume.mind, beforeConsume.spirituality - 30, beforeConsume.cash, beforeConsume.actionsRemaining - 1]);
    expect(success.character.coreStats).toEqual(beforeConsume.character.coreStats);
    for (const ability of MOON_ABILITY_IDS) expect(success.progression.mastery[ability]).toBe(0);
    expect(root.materials!.settlements).toHaveLength(1);
    expect(root.materials!.settlements[0]).toMatchObject({ success: true, alive: true });
    const work = root.journal.filter(event => event.command.type === 'WORK');
    expect(new Set(work.map(event => event.before.budget.week)).size).toBe(work.length);
    for (const event of work) expect(event.after.budget.cash - event.before.budget.cash).toBe(180);
    for (const event of root.journal.filter(event => event.command.type === 'NEXT_WEEK')) {
      expect(event.after.budget.week).toBe(event.before.budget.week + 1);
      expect(event.after.nowSecond).toBe(event.after.weekAnchor);
      expect(event.after.budget.cash).toBeLessThanOrEqual(event.before.budget.cash - 30);
    }
  });

  it('invalidates paid preparation on real departure and cannot reuse it after returning before expiry', () => {
    const { beforeConsume } = route!, session = openMoonRuntimeSession(beforeConsume);
    const preparation = beforeConsume.moon.promotionStability.preparations[0]!;
    const departed = advance(session, { type: 'RETURN_ON_FOOT' });
    expect(departed.moon.promotionStability.preparations[0]).toMatchObject({ id: preparation.id,
      status: 'INVALIDATED', invalidatedEventId: departed.moon.journal.at(-1)!.id, spentEventId: null });
    expect(departed.moon.frame!.location).not.toBe(MOON_WORKSHOP);
    expect(departed.moon.frame!.nowSecond).toBe(beforeConsume.moon.frame!.nowSecond + 7200);
    // One real boundary restores ordinary AP, then paid travel returns to the
    // same room while the original seven-day expiry is still in the future.
    advance(session, { type: 'NEXT_WEEK' });
    const returned = advance(session, { type: 'TRAVEL', to: MOON_WORKSHOP });
    expect(returned.moon.frame!.nowSecond).toBeLessThan(preparation.expiresSecond);
    expect(returned.actionsRemaining).toBeGreaterThan(0);
    expect(returned.moon.promotionStability.preparations[0]!.status).toBe('INVALIDATED');
    expect(getMoonPromotionStabilityPreview(returned.moon, preparation.compoundId).prepared).toBe(false);
    expectBlockedWithoutChange(session, { type: 'CONSUME', compoundId: preparation.compoundId, confirmed: true });
    expect(returned.random).toEqual(beforeConsume.random);
    assertValidSliceState(returned);
  }, 60_000);

  it('expires paid preparation only after advancing real week boundaries beyond its seven-day deadline', () => {
    const { beforeConsume } = route!, session = openMoonRuntimeSession(beforeConsume);
    const preparation = beforeConsume.moon.promotionStability.preparations[0]!;
    let current = beforeConsume, boundaries = 0;
    while (current.moon.frame!.nowSecond <= preparation.expiresSecond) {
      expect(boundaries++).toBeLessThan(3);
      current = advance(session, { type: 'NEXT_WEEK' });
    }
    expect(current.moon.frame!.location).toBe(MOON_WORKSHOP);
    expect(current.week).toBe(beforeConsume.week + boundaries);
    expect(current.moon.frame!.nowSecond).toBeGreaterThan(preparation.preparedSecond + 604800);
    expect(current.moon.promotionStability.preparations[0]).toMatchObject({ id: preparation.id,
      status: 'INVALIDATED', invalidatedEventId: current.moon.journal.at(-1)!.id, spentEventId: null });
    expect(current.actionsRemaining).toBeGreaterThan(0);
    expect(current.cash).toBeLessThanOrEqual(beforeConsume.cash - 30 * boundaries);
    expect(current.random).toEqual(beforeConsume.random);
    expect(getMoonPromotionStabilityPreview(current.moon, preparation.compoundId).prepared).toBe(false);
    expectBlockedWithoutChange(session, { type: 'CONSUME', compoundId: preparation.compoundId, confirmed: true });
    assertValidSliceState(current);
  }, 60_000);

  it('cannot prepare or consume an already spent original compound again or charge any hidden cost or draw', () => {
    const { success } = route!, session = openMoonRuntimeSession(success);
    const preparation = success.moon.promotionStability.preparations[0]!;
    expect(preparation.status).toBe('SPENT');
    expect(success.moon.materials!.compounds[0]!.status).toBe('SUCCESS');
    expectBlockedWithoutChange(session, { type: 'STABILIZE_PROMOTION', compoundId: preparation.compoundId });
    expectBlockedWithoutChange(session, { type: 'CONSUME', compoundId: preparation.compoundId, confirmed: true });
    const unchanged = session.snapshot();
    expect(unchanged.moon.materials!.settlements).toHaveLength(1);
    expect(unchanged.random).toEqual(success.random);
    expect(unchanged.moon.frame!.budget).toEqual(success.moon.frame!.budget);
  }, 60_000);

  it('commits actual controlled S0 consumption to SQLite and strictly reopens an identical current projection', () => {
    const { beforeConsume, success } = route!, { file, store } = disk(beforeConsume);
    const inputHash = moonStateHash(beforeConsume);
    const request: SliceEnvelope = { intentId: 'moon-controlled-s0-success', runId: beforeConsume.runId,
      expectedRevision: beforeConsume.revision, payload: { type: 'MOON', command: { type: 'CONSUME', compoundId: 'moon-compound-1', confirmed: true } } };
    const receipt = unwrap(store.submitIntent(request));
    expect(receipt.state).toEqual(projection); expect(receipt.state.moon.promoted).toBe(true);
    expect(stored(file).state).toEqual(success);
    expect(store.repository.ownedHead(success.runId)?.revision).toBe(success.revision);
    expect(unwrap(store.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    const bytes = raw(file); close(store);
    const reopened = new SqliteSliceStore(file, { now: () => now }); stores.push(reopened);
    expect(unwrap(reopened.loadRun(success.runId))).toEqual(projection);
    expect(unwrap(reopened.getBootstrap()).activeState).toEqual(projection);
    expect(unwrap(reopened.submitIntent(request))).toEqual({ ...receipt, replayed: true });
    expect(raw(file)).toBe(bytes); expect(stored(file).state).toEqual(success);
    expect(moonStateHash(beforeConsume)).toBe(inputHash);
    const owned = openMoonRuntimeSession(stored(file).state);
    expect(owned.project()).toEqual(projection); expect(owned.projectMoon()).toEqual(projection!.moon);
    expect(owned.snapshot()).toEqual(success); expectHistory(stored(file).state);
  }, 60_000);

  it('rejects missing or fabricated S0 history even in a checksum-valid current-format SQLite save', () => {
    const { success } = route!, { file, store } = disk(success);
    const changes: [string, (state: SliceState) => void][] = [
      ['missing Moon history', state => { state.moon = createMoonState(); }],
      ['missing actual consumption', state => { state.moon.journal.pop(); }],
      ['invented arrival position', state => { const p = state.moon.services!.stations[0]!.passengers[0]!; p.location = p.origin; }],
      ['missing paid preparation', state => { state.moon.promotionStability.preparations = []; }],
      ['rewritten historical S1 receipt', state => {
        state.beautyGoddess.acquisitionJournal.find(event => event.cursorBefore === 318 && event.check)!.check!.roll = 2;
      }],
    ];
    for (const [label, change] of changes) {
      const forged = structuredClone(success); change(forged);
      expect(() => assertValidSliceState(forged), label).toThrow();
      replaceRaw(file, forged); const bytes = raw(file);
      expect(() => store.repository.ownedHead(success.runId), label).toThrow();
      expect(raw(file), `${label} must remain read-only on rejection`).toBe(bytes);
      replaceRaw(file, success);
    }
    expect(unwrap(store.loadRun(success.runId))).toEqual(projection);
    expectHistory(stored(file).state);
  }, 120_000);
});
