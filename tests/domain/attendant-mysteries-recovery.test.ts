import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyAttendantMysteriesCommand, attendantMysteriesAcquisitionBlock, createAttendantMysteriesState, projectAttendantMysteries, validateAttendantMysteriesAcquisitionCommand, validateAttendantMysteriesAcquisitionJournal } from '../../src/domain/attendant-mysteries/index.js';
import { attendantMysteriesBudget } from '../../src/domain/attendant-mysteries/ritual.js';
import { ATTENDANT_MYSTERIES_FORMULA, ATTENDANT_MYSTERIES_GUIDE } from '../../src/domain/attendant-mysteries/content.js';
import type { AttendantMysteriesAcquisitionCommand, AttendantMysteriesCommand, AttendantMysteriesRecoveryRequest } from '../../src/domain/attendant-mysteries/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const ROOT = 'tests/fixtures/attendant-mysteries-v01860';
const FIRST = 'attendant-mysteries-batch-1:bottle';
const FOURTH = 'attendant-mysteries-batch-4';
const request = { type: 'REQUEST_RECOVERY_V1', bottleId: FIRST } as const;
const recover = { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: FIRST } as const;
let original: SliceState | undefined;
function firstFailure(): SliceState {
  original ??= migrateSliceState(readObjectEntry<unknown>(`${ROOT}/boundary-attendant-mysteries-batch-1_bottle-actual-consumption-result.json`, 'final'));
  return structuredClone(original);
}
function context(s: SliceState): SeerContext {
  return {
    note() {},
    roll(min, max) { const rng = new DeterministicActionRandomStream(s.random.seed, s.random.cursor), roll = rng.nextInt(min, max); s.random.cursor = rng.cursor; return roll; },
    check(ability, difficulty) { return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: this.roll(1, 100) }); },
  };
}
function issue(s: SliceState, c: AttendantMysteriesCommand): void {
  s.revision++;
  applyAttendantMysteriesCommand(s, c, context(s));
}
function travel(s: SliceState, to: 'base' | 'new-alder-clearing' | 'new-flint-clearing'): void { issue(s, { type: 'TOWN', command: { type: 'TRAVEL', to } }); }
function nextWeek(s: SliceState): void { s.week++; s.date = addGameWeeks(s.date, 1); s.actionsRemaining = 10; }

/** Explicit synthetic module fixtures, NOT captured natural play or a replacement
 * for v01860's successful branch. Provision resources and low will outside the
 * acquisition module to exercise deterministic all-failure/recovery histories.
 * Each added acquisition/town operation still records its exact input/cost/RNG.
 */
function allFailed(): SliceState {
  const s = firstFailure(), plot = s.attendantMysteries.town!.plot!;
  s.cash = 100_000; s.actionsRemaining = 10; s.character.coreStats.will = 0;
  for (const n of [2, 3]) {
    s.actionsRemaining = 10; s.health = 100; s.mind = 100;
    travel(s, 'base');
    const batchId = `attendant-mysteries-batch-${n}`, bottleId = `${batchId}:bottle`;
    issue(s, { type: 'BUY_MATERIALS', batchId }); issue(s, { type: 'BREW', batchId }); travel(s, plot);
    // Consume independent test-host rolls until the next recorded check is a failure.
    // No source fixture, recorded result, seed or existing cursor is rewritten.
    while (new DeterministicActionRandomStream(s.random.seed, s.random.cursor).nextInt(1, 100) <= 5) context(s).roll(1, 100);
    issue(s, { type: 'PREPARE_PROMOTION', bottleId }); issue(s, { type: 'CONSUME', bottleId, confirmed: true });
    expect(s.attendantMysteries.bottles.at(-1)!.outcome).toMatch(/FAILURE/);
  }
  travel(s, 'base');
  expect(validateAttendantMysteriesAcquisitionJournal(s)).toBe(true);
  return s;
}
function recovered(): SliceState {
  const s = allFailed(); issue(s, request); nextWeek(s); travel(s, s.attendantMysteries.resupply.recovery!.plot); issue(s, recover);
  return s;
}
function historicalSupply(s: SliceState, type: 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY'): void {
  // Reconstruct an explicitly labeled old-format unit receipt; no live legacy API is exposed.
  s.revision++;
  const before = attendantMysteriesBudget(s), a = s.attendantMysteries;
  if (type === 'REQUEST_SUPPLY') { s.actionsRemaining--; s.cash -= 120; a.resupply.requestedWeek = s.week; }
  else {
    const n = a.batches.length + 1, id = `attendant-mysteries-batch-${n}`; s.actionsRemaining--;
    a.batches.push({ id, stockedWeek: s.week, labourSteps: 0, acquiredWeek: null, brewedWeek: null,
      materials: ATTENDANT_MYSTERIES_FORMULA.map((m, index) => ({ id: `${id}:${m.id}`, name: m.name, quantity: m.quantity, unit: m.unit,
        source: index === 0 ? `${ATTENDANT_MYSTERIES_GUIDE}核验的独立封存遗产AM1-LEGACY-${n}，原诡秘侍者特性一份。` : `灵界采集队原封AM1-EXPEDITION-${n}-${index}，本批不同特产原样；须实际购买、调配耗用。`, holder: 'SUPPLIER' })) });
    a.resupply.deliveries++; a.resupply.requestedWeek = null;
  }
  a.acquisitionJournal.push({ week: s.week, date: { ...s.date }, revision: s.revision, command: { type }, actor: structuredClone(a.acquisitionJournal[0]!.actor), before, after: attendantMysteriesBudget(s), randomBefore: s.random.cursor, randomAfter: s.random.cursor, check: null, townEvidence: null });
}

describe('Versioned recovery keeps the same finite original S1 characteristic', () => {
  it('leaves the three original unopened inventory shapes unchanged and closes live legacy mint commands', () => {
    const empty = createAttendantMysteriesState();
    expect(empty.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
    expect(empty.batches).toHaveLength(3); expect(empty.batches.every(b => !Object.hasOwn(b, 'recovery'))).toBe(true);
    for (const type of ['REQUEST_SUPPLY', 'RECEIVE_SUPPLY'] as const) {
      expect(validateAttendantMysteriesAcquisitionCommand({ type })).toBe(false);
      expect(validateSlicePayload({ type: 'ATTENDANT_MYSTERIES', command: { type } })).toBe(false);
      const s = allFailed(), before = stableStringify(s);
      expect(attendantMysteriesAcquisitionBlock(s, { type })).toMatch(/历史回放/);
      expect(() => applyAttendantMysteriesCommand(s, { type }, context(s))).toThrow(); expect(stableStringify(s)).toBe(before);
    }
    for (const c of [request, recover]) {
      expect(validateAttendantMysteriesAcquisitionCommand(c)).toBe(true);
      expect(validateAttendantMysteriesAcquisitionCommand({ ...c, replayLegacySupply: true })).toBe(false);
      expect(validateAttendantMysteriesAcquisitionCommand({ type: c.type })).toBe(false);
      expect(validateAttendantMysteriesAcquisitionCommand({ ...c, bottleId: 'forged' })).toBe(false);
    }
    const actions = projectAttendantMysteries(allFailed()).actions;
    expect(actions.filter(a => a.command.type === 'REQUEST_RECOVERY_V1')).toHaveLength(3);
    expect(actions.some(a => ['REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(a.command.type))).toBe(false);
  }, 30_000);

  it('requires all original attempts to fail, a paid targeted request, a later real week and the actual failure site', () => {
    const early = firstFailure(); expect(attendantMysteriesAcquisitionBlock(early, request)).not.toBeNull();
    const s = allFailed(), before = attendantMysteriesBudget(s), originalBottles = structuredClone(s.attendantMysteries.bottles);
    expect(attendantMysteriesAcquisitionBlock(s, recover)).not.toBeNull();
    issue(s, request);
    expect(before.cash - s.cash).toBe(120); expect(before.actions - s.actionsRemaining).toBe(1);
    expect(s.attendantMysteries.resupply.recovery).toEqual({ version: 1, sourceBottleId: FIRST, characteristicId: 'attendant-mysteries-batch-1:characteristic', regionId: 'town-spirit-region-1', plot: 'new-alder-clearing', requestedWeek: s.week });
    expect(attendantMysteriesAcquisitionBlock(s, request)).not.toBeNull();
    travel(s, 'new-alder-clearing'); expect(attendantMysteriesAcquisitionBlock(s, recover)).toMatch(/隔一真实周/);
    nextWeek(s); travel(s, 'base'); expect(attendantMysteriesAcquisitionBlock(s, recover)).toMatch(/原处/);
    travel(s, 'new-flint-clearing'); expect(attendantMysteriesAcquisitionBlock(s, recover)).toMatch(/原处/);
    travel(s, 'new-alder-clearing');
    const paid = attendantMysteriesBudget(s), random = { ...s.random }; issue(s, recover);
    expect(s.actionsRemaining).toBe(paid.actions - 1); expect(s.cash).toBe(paid.cash);
    expect([s.health, s.mind, s.seer.pollution, s.injuries]).toEqual([paid.health, paid.mind, paid.pollution, paid.injuries]);
    expect(s.random).toEqual(random); expect(s.attendantMysteries.bottles).toEqual(originalBottles);
    expect(s.attendantMysteries.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(validateAttendantMysteriesAcquisitionJournal(s)).toBe(true);
  }, 30_000);

  it('moves one original identity into a paid new nine-auxiliary batch, with no usable duplicate or free brewing', () => {
    const s = recovered(), a = s.attendantMysteries, first = structuredClone(a.batches[0]!), batch = a.batches.at(-1)!;
    expect(batch.id).toBe(FOURTH); expect(new Set(a.batches.map(b => b.materials[0]!.id)).size).toBe(3);
    expect(batch.materials[0]).toEqual({ ...first.materials[0]!, quantity: 1, holder: 'PLAYER' });
    expect(batch.materials.slice(1)).toHaveLength(9); expect(batch.materials.slice(1).every(m => m.holder === 'SUPPLIER' && m.quantity === 1 && !first.materials.some(old => old.id === m.id))).toBe(true);
    expect(batch.recovery).toMatchObject({ version: 1, sourceBottleId: FIRST, characteristicId: first.materials[0]!.id });
    expect(attendantMysteriesAcquisitionBlock(s, recover)).not.toBeNull(); expect(attendantMysteriesAcquisitionBlock(s, request)).not.toBeNull();
    travel(s, 'base'); expect(attendantMysteriesAcquisitionBlock(s, { type: 'BREW', batchId: FOURTH })).not.toBeNull();
    const paid = s.cash; issue(s, { type: 'BUY_MATERIALS', batchId: FOURTH }); expect(paid - s.cash).toBe(900);
    const brew = attendantMysteriesBudget(s); issue(s, { type: 'BREW', batchId: FOURTH }); expect(brew.cash - s.cash).toBe(120); expect(brew.actions - s.actionsRemaining).toBe(1);
    expect(a.bottles.at(-1)!.inputIds[0]).toBe(first.materials[0]!.id);
    expect(a.batches[0]).toEqual(first); expect(batch.materials.every(m => m.holder === 'CONSUMED' && m.quantity === 0)).toBe(true);
    expect(validateAttendantMysteriesAcquisitionJournal(s)).toBe(true);
  }, 30_000);

  it('allows only the latest genuinely failed bottle in a repeated recovery lineage', () => {
    const s = recovered(); travel(s, 'base'); issue(s, { type: 'BUY_MATERIALS', batchId: FOURTH }); issue(s, { type: 'BREW', batchId: FOURTH });
    s.actionsRemaining = 10; s.health = 100; s.mind = 100;
    travel(s, s.attendantMysteries.town!.plot!);
    while (new DeterministicActionRandomStream(s.random.seed, s.random.cursor).nextInt(1, 100) <= 5) context(s).roll(1, 100);
    const bottleId = `${FOURTH}:bottle`;
    issue(s, { type: 'PREPARE_PROMOTION', bottleId }); issue(s, { type: 'CONSUME', bottleId, confirmed: true }); travel(s, 'base');
    expect(attendantMysteriesAcquisitionBlock(s, request)).toMatch(/重复/);
    const previousBatch = structuredClone(s.attendantMysteries.batches.at(-1)!);
    issue(s, { type: 'REQUEST_RECOVERY_V1', bottleId }); nextWeek(s); travel(s, s.attendantMysteries.resupply.recovery!.plot); issue(s, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId });
    expect(s.attendantMysteries.batches).toHaveLength(5);
    expect(s.attendantMysteries.batches.at(-1)!.recovery!.sourceBottleId).toBe(bottleId);
    expect(s.attendantMysteries.batches.at(-1)!.materials[0]!.id).toBe('attendant-mysteries-batch-1:characteristic');
    expect(new Set(s.attendantMysteries.batches.map(b => b.materials[0]!.id)).size).toBe(3);
    expect(s.attendantMysteries.batches[3]).toEqual(previousBatch);
    expect(validateAttendantMysteriesAcquisitionJournal(s)).toBe(true);
  }, 30_000);

  it('keeps a failed original at its recorded site even after that region has been retired', () => {
    // Directed location-only clone: this tests the blocker, not natural relocation evidence.
    const s = allFailed(); issue(s, request); nextWeek(s);
    const t = s.attendantMysteries.town!; t.retiredRegions.push(t.region!); t.region = null; t.plot = 'new-flint-clearing'; t.operatorAt = 'new-flint-clearing';
    expect(attendantMysteriesAcquisitionBlock(s, recover)).toMatch(/原处/);
    t.operatorAt = 'new-alder-clearing'; expect(attendantMysteriesAcquisitionBlock(s, recover)).toBeNull();
    t.retiredRegions = []; expect(attendantMysteriesAcquisitionBlock(s, recover)).toMatch(/现场/);
  }, 30_000);

  it('offers the existing five paid-in-actions checks for a 90-penny auxiliary balance', () => {
    const s = recovered(); travel(s, 'base'); s.actionsRemaining = 10;
    const before = attendantMysteriesBudget(s);
    for (let i = 0; i < 5; i++) issue(s, { type: 'MATERIAL_WORK', batchId: FOURTH });
    expect(before.actions - s.actionsRemaining).toBe(5); expect(s.cash).toBe(before.cash);
    issue(s, { type: 'BUY_MATERIALS', batchId: FOURTH }); expect(before.cash - s.cash).toBe(90);
    expect(validateAttendantMysteriesAcquisitionJournal(s)).toBe(true);
  }, 30_000);

  it('rejects changed source IDs, duplicate live ownership, wrong request versions and forged evidence', () => {
    const s = recovered(), source = stableStringify(s);
    const mutations: Array<(v: SliceState) => void> = [
      v => { v.attendantMysteries.batches.at(-1)!.materials[0]!.id = `${FOURTH}:characteristic`; },
      v => { v.attendantMysteries.batches[0]!.materials[0]!.holder = 'PLAYER'; v.attendantMysteries.batches[0]!.materials[0]!.quantity = 1; },
      v => { v.attendantMysteries.batches.at(-1)!.recovery!.sourceBottleId = 'attendant-mysteries-batch-2:bottle'; },
      v => { Object.assign(v.attendantMysteries.batches.at(-1)!.recovery!, { extra: true }); },
      v => { v.attendantMysteries.acquisitionJournal.at(-1)!.townEvidence = null; },
      v => { v.attendantMysteries.acquisitionJournal.find(e => e.command.type === 'REQUEST_RECOVERY_V1')!.after.cash++; },
    ];
    for (const mutate of mutations) { const bad = structuredClone(s); mutate(bad); expect(validateAttendantMysteriesAcquisitionJournal(bad)).toBe(false); }
    const pending = allFailed(); issue(pending, request);
    for (const mutate of [
      (r: AttendantMysteriesRecoveryRequest) => { Object.assign(r, { version: 2 }); },
      (r: AttendantMysteriesRecoveryRequest) => { r.characteristicId = 'attendant-mysteries-batch-2:characteristic'; },
      (r: AttendantMysteriesRecoveryRequest) => { Object.assign(r, { extra: true }); },
    ]) { const bad = structuredClone(pending); mutate(bad.attendantMysteries.resupply.recovery!); expect(validateAttendantMysteriesAcquisitionJournal(bad)).toBe(false); }
    expect(stableStringify(s)).toBe(source);
  }, 30_000);

  it('preserves a historical LEGACY-4 receipt and original ID, without silently converting it to recovery', () => {
    const s = allFailed(); historicalSupply(s, 'REQUEST_SUPPLY'); nextWeek(s); historicalSupply(s, 'RECEIVE_SUPPLY');
    const before = stableStringify(s.attendantMysteries);
    expect(s.attendantMysteries.batches.at(-1)!.materials[0]).toMatchObject({ id: `${FOURTH}:characteristic`, source: `${ATTENDANT_MYSTERIES_GUIDE}核验的独立封存遗产AM1-LEGACY-4，原诡秘侍者特性一份。` });
    expect(new Set(s.attendantMysteries.batches.map(b => b.materials[0]!.id)).size).toBe(4);
    expect(validateAttendantMysteriesAcquisitionJournal(s)).toBe(true);
    expect(stableStringify(s.attendantMysteries)).toBe(before);
    expect(s.attendantMysteries.batches.at(-1)!.recovery).toBeUndefined();
  }, 30_000);

  it('can redirect a pending old paid commission through an explicit new paid investigation without refund', () => {
    const s = allFailed(); historicalSupply(s, 'REQUEST_SUPPLY'); const paid = s.cash;
    issue(s, request); expect(s.cash).toBe(paid - 120); expect(s.attendantMysteries.batches).toHaveLength(3);
    expect(validateAttendantMysteriesAcquisitionJournal(s)).toBe(true);
    const commands: AttendantMysteriesAcquisitionCommand['type'][] = s.attendantMysteries.acquisitionJournal.slice(-2).map(e => e.command.type);
    expect(commands).toEqual(['REQUEST_SUPPLY', 'REQUEST_RECOVERY_V1']);
  }, 30_000);
});
