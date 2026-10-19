import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../src/domain/slice/types.js';
import type { PublicResolutionTier } from '../src/shared/contracts.js';
import { stableStringify } from '../src/domain/canonical.js';
import { sha256Hex } from '../src/domain/checksum.js';
import { addGameWeeks } from '../src/domain/game-calendar.js';
import { DeterministicActionRandomStream } from '../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../src/resolution/normal-check.js';
import { applyTimeWormAcquisition, createTimeWormState, timeWormOriginals } from '../src/domain/time-worm/index.js';
import { TIME_WORM_RECOVERY_SCHEMA_VERSION } from '../src/domain/time-worm/content.js';
import type { TimeWormAcquisitionCommand } from '../src/domain/time-worm/types.js';
import { ERROR_ASCENT_FUTURE_BRANCH, ERROR_ASCENT_MATERIAL_LOCATIONS as LOC,
  ERROR_ASCENT_MATERIAL_POLICY as POLICY, errorAscentSuccessionAt } from '../src/domain/error-ascent/material-content.js';
import { applyErrorAscentMaterial, createErrorAscentMaterials, errorAscentMaterialBlock,
  errorAscentMaterialConservationBlock, errorAscentMaterialEffect, errorAscentPreparationFactsComplete,
  getErrorAscentMaterialActions, projectErrorAscentMaterials, settleErrorAscentConsumption,
  transportErrorAscentMaterials, validateErrorAscentMaterialCommand, validateErrorAscentMaterialPolicy } from '../src/domain/error-ascent/materials.js';
import { errorAscentAcquisitionSnapshot, errorAscentBudget } from '../src/domain/error-ascent/source.js';
import { resolveErrorAscentOriginals } from '../src/domain/error-ascent/originals.js';
import { ERROR_ASCENT_CARRIER_IDS, ERROR_ASCENT_LABOUR_IDS, ERROR_ASCENT_ORIGINAL_IDS, ERROR_ASCENT_UNIQUENESS_ID,
  type ErrorAscentMaterialCommand, type ErrorAscentMaterialHost, type ErrorAscentMaterialsState,
  type ErrorAscentMaterialSettlement, type ErrorAscentOriginalId, type ErrorAscentOriginSnapshot,
  type ErrorAscentPreparationFacts } from '../src/domain/error-ascent/types.js';
import { readObjectEntry } from './helpers/read-object-entry.js';

const PATH = 'tests/fixtures/time-worm-v01970/natural.json';
const SHA = 'e9920991623fdd3f1b8ecf4e5c8049720f362145462703d6b804afa9dfd390cf';
let rawCache: SliceState | undefined;
/** Read the final entry once. Never clone or replay the full656-command run. */
const actual = () => rawCache ??= readObjectEntry<SliceState>(PATH, 'final');
const original = (n: 1 | 2 | 3): ErrorAscentOriginalId => `time-worm-potion-${n}`;
const actualSnapshot = () => errorAscentAcquisitionSnapshot(actual());
async function hashFile() {
  const hash = createHash('sha256'); for await (const chunk of createReadStream(PATH)) hash.update(chunk); return hash.digest('hex');
}

/** Acquisition-only component branch from the real paid BUY_POTION boundary.
 * All recorded prefix receipts stay byte-equivalent. The new boundary explicitly
 * supplies body/budget inputs and a future deterministic cursor before any new
 * receipt; it is not ordinary-playthrough or whole-save admission evidence.
 * Old roots are shared read-only; only small budgets/bottles/journals are copied.
 * Every later acquisition/recovery runs the actual TimeWorm reducer. */
function controlledSnapshot(n: 1 | 2 | 3, mode: 'SUPPLIER' | 'FAILED_REMAINS' | 'RECOVERED_SUCCESS' = 'SUPPLIER'): ErrorAscentOriginSnapshot {
  const raw = actual(), originalJournal = raw.timeWorm.acquisitionJournal;
  const lastPurchase = originalJournal.findIndex(e => e.command.type === 'BUY_POTION');
  const prefix = structuredClone(originalJournal.slice(0, lastPurchase + 1)), prefixCount = prefix.length, boundary = prefix.at(-1)!, b = boundary.after;
  const timeWorm = createTimeWormState();
  Object.assign(timeWorm, { guidanceKnown: true, sourceHistory: raw.timeWorm.sourceHistory, sourceScene: raw.timeWorm.sourceScene,
    preparations: structuredClone(raw.timeWorm.preparations), acquisitionJournal: prefix, bottles: structuredClone(raw.timeWorm.bottles) });
  Object.assign(timeWorm.bottles[0]!, { status: 'PLAYER', consumedWeek: null, preparationWeek: null, outcome: null });
  const state: SliceState = { ...raw, ...raw.timeWorm.sourceHistory!, ...structuredClone(boundary.finance),
    schemaVersion: TIME_WORM_RECOVERY_SCHEMA_VERSION, revision: boundary.revision + 3, week: boundary.week, date: { ...boundary.date },
    status: 'ACTIVE', actionsRemaining: 100, cash: 50000, health: 100, mind: 100, spirituality: 120,
    injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk, combat: null, activeEvent: null, eventQueue: [], pulse: 'NONE',
    character: { ...raw.character, coreStats: { ...b.coreStats } }, random: { seed: raw.random.seed, cursor: boundary.cursorAfter },
    progression: { ...raw.progression, sequence: 2, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...raw.seer, pollution: 0, completedSources: [...b.completedSources] }, timeWorm };
  const tiers: PublicResolutionTier[] = mode === 'RECOVERED_SUCCESS' ? ['FAILURE', 'FAILURE', 'FAILURE', 'SUCCESS']
    : mode === 'FAILED_REMAINS' ? [...ERROR_ASCENT_ORIGINAL_IDS.filter(id => id !== original(n)).map(() => 'FAILURE' as const), 'SUCCESS'] : ['SUCCESS'];
  let chosen: number | null = null;
  for (let cursor = state.random.cursor; cursor < state.random.cursor + 65536; cursor++) {
    const rng = new DeterministicActionRandomStream(state.random.seed, cursor);
    if (tiers.every(tier => resolveNormalCheck({ ability: 'will', baseAbility: state.character.coreStats.will,
      difficulty: 30, modifiers: [], roll: rng.nextInt(1, 100) }).tier === tier)) { chosen = cursor; break; }
  }
  if (chosen === null) throw Error('No declared component cursor'); state.random.cursor = chosen;
  const issue = (command: TimeWormAcquisitionCommand) => {
    applyTimeWormAcquisition(state, command, { note() {}, roll() { throw Error('No extra component draw'); }, check(ability, difficulty) {
      const rng = new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
      const check = resolveNormalCheck({ ability, baseAbility: state.character.coreStats[ability], difficulty, modifiers: [], roll: rng.nextInt(1, 100) });
      state.random.cursor = rng.cursor; return check;
    } }); state.revision++;
  };
  const nextBodyBoundary = () => { state.revision += 2; state.health = 100; state.mind = 100; state.actionsRemaining = 100; state.seer.pollution = 0; };
  const consume = (id: string) => {
    if (timeWorm.bottles.find(bottle => bottle.id === id)!.status === 'SUPPLIER') issue({ type: 'BUY_POTION', bottleId: id });
    issue({ type: 'PREPARE_PROMOTION' }); issue({ type: 'CONSUME', bottleId: id, confirmed: true });
  };
  const recover = (id: string) => {
    issue({ type: 'REQUEST_RECOVERY_V1', bottleId: id }); state.week++; state.date = addGameWeeks(state.date, 1); state.revision += 2;
    issue({ type: 'RECOVER_CHARACTERISTIC_V1', bottleId: id }); return timeWorm.bottles.at(-1)!.id;
  };
  if (mode === 'RECOVERED_SUCCESS') {
    for (const id of ERROR_ASCENT_ORIGINAL_IDS) { consume(id); nextBodyBoundary(); }
    recover(ERROR_ASCENT_ORIGINAL_IDS.find(id => id !== original(n))!); // Same failed original remains supplier-held in a paid new vessel.
    consume(recover(original(n)));
  } else {
    if (mode === 'FAILED_REMAINS') for (const id of ERROR_ASCENT_ORIGINAL_IDS.filter(id => id !== original(n))) { consume(id); nextBodyBoundary(); }
    consume(original(n));
  }
  const snapshot = errorAscentAcquisitionSnapshot(state);
  expect(snapshot.acquisitionJournal.slice(0, prefixCount)).toEqual(originalJournal.slice(0, lastPurchase + 1));
  expect(resolveErrorAscentOriginals(snapshot)).not.toBeNull();
  return snapshot;
}

/** Private component host inputs, not public certificates. Production derives
 * the same facts from actual SURVEY, travel, clock and custody events. */
function harness(snapshot = actualSnapshot()) {
  const origin: ErrorAscentMaterialsState['origin'] = { ...structuredClone(snapshot), actorId: `${actual().runId}:original-player`,
    sourceDigest: sha256Hex(stableStringify(snapshot)), inheritanceLocation: 'component-home' };
  let state = createErrorAscentMaterials(origin, POLICY, timeWormOriginals(actual())), revision = 2000;
  const facts: ErrorAscentPreparationFacts = { actorId: origin.actorId, sourceDigest: origin.sourceDigest,
    investigationEventId: 'component-survey', routeEventId: 'component-survey', conductorEventId: 'component-survey',
    conductorId: 'ER219-CONDUCTOR', routeId: 'ER219-OUTER-STAIR', observedConductorVersion: 1, currentConductorVersion: 1,
    conductorIntact: true, ordinaryExitOpen: true };
  const host: ErrorAscentMaterialHost = { eventId: `component-${revision}`, revision, week: actual().week, date: { ...actual().date },
    actorId: origin.actorId, sourceDigest: origin.sourceDigest, location: origin.inheritanceLocation, nowSecond: 36000, weekAnchor: 0,
    sequence: 1, status: 'ACTIVE', cash: 50000, actions: 100, preparationFacts: facts, legacyAccess: null, succession: errorAscentSuccessionAt(actual().date) };
  const sync = (id?: ErrorAscentOriginalId) => { host.legacyAccess = structuredClone(state.legacySites.find(site =>
    site.location === host.location && site.residualPresent && (!id || site.originalBottleId === id)) ?? null); };
  const bump = () => { host.revision = ++revision; host.eventId = `component-${revision}`; };
  const run = (command: ErrorAscentMaterialCommand) => {
    sync('bottleId' in command ? command.bottleId : undefined);
    const before = stableStringify(state), result = applyErrorAscentMaterial(state, command, host, POLICY);
    expect(stableStringify(state)).toBe(before); state = result.state;
    host.cash -= result.effect.cashCost; host.actions -= result.effect.actions; host.nowSecond += result.effect.seconds;
    bump(); sync('bottleId' in command ? command.bottleId : undefined); expect(errorAscentMaterialConservationBlock(state)).toBeNull(); return result;
  };
  const move = (to: string) => { state = transportErrorAscentMaterials(state, host.location, to); host.location = to; sync(); };
  const laterWeek = () => { host.week++; host.date = addGameWeeks(host.date, 1); host.nowSecond += 604800; host.weekAnchor += 604800; host.actions = 100; };
  const acquire = () => {
    for (const id of ERROR_ASCENT_ORIGINAL_IDS) {
      const item = state.characteristics.find(c => c.originBottleId === id)!;
      if (item.holder === 'SUPPLIER' || item.holder === 'PLAYER') { move(item.location!); run({ type: 'ACQUIRE_CHARACTERISTIC', bottleId: id }); }
      else if (item.holder === 'UNLOCATED') {
        move(LOC.originalRoom); run({ type: 'ASK_LEGACY_PERMISSION', bottleId: id }); run({ type: 'INVESTIGATE_LEGACY_REMAINS', bottleId: id });
        run({ type: 'SEAL_LEGACY_REMAINS', bottleId: id }); laterWeek(); run({ type: 'ASK_LEGACY_PERMISSION', bottleId: id }); run({ type: 'RECOVER_LEGACY_REMAINS', bottleId: id });
      }
    }
    move(LOC.archive); run({ type: 'VERIFY_UNIQUENESS', step: 'CHAIN' }); move(LOC.vault);
    run({ type: 'VERIFY_UNIQUENESS', step: 'VACANCY' }); run({ type: 'ACQUIRE_UNIQUENESS' });
  };
  const compose = () => { move(LOC.supplier); run({ type: 'BUY_COMPOUND', batchId: ERROR_ASCENT_CARRIER_IDS[0] }); move(LOC.workshop);
    return run({ type: 'COMPOSE_POTION', batchId: ERROR_ASCENT_CARRIER_IDS[0] }); };
  const settle = (success: boolean, alive: boolean) => {
    const event: ErrorAscentMaterialSettlement = { eventId: host.eventId, compoundId: state.compounds[0]!.id, week: host.week,
      location: host.location, success, alive, residualPresent: !success };
    state = settleErrorAscentConsumption(state, event); if (!alive) host.status = 'DEAD'; if (success) host.sequence = 0; bump(); return event;
  };
  return { get state() { return state; }, host, run, move, laterWeek, acquire, compose, settle };
}

describe('Error219 finite original materials (focused components, no full replay)', () => {
  it('pins actual raw197 and retains its H70 heavy wound,16 masteries and two supplier originals', async () => {
    expect(await hashFile()).toBe(SHA);
    const s = actual(), budget = errorAscentBudget(s), snapshot = actualSnapshot(), before = stableStringify(snapshot);
    expect(s).toMatchObject({ revision: 657, week: 147, status: 'ACTIVE', health: 70, mind: 96, spirituality: 112,
      cash: 867, actionsRemaining: 3, injuryRisk: 0, random: { seed: 'marauder-natural-v038', cursor: 397 } });
    expect(budget.injuries).toEqual([{ id: 'marauder-rebuild-natural:combat:1:PLAYER:655:0', severity: 'HEAVY', acquiredRevision: 655, treatedRevision: null }]);
    expect(Object.keys(budget.mastery)).toHaveLength(16); expect(budget.mastery).toEqual(s.progression.mastery);
    expect(budget.mastery['error.s5.thought-theft']).toBe(0); expect(budget.mastery['error.s1.time-release']).toBe(0);
    expect(budget.mastery['error.s1.short-time-theft']).toBe(16);
    expect(snapshot.resupply).toEqual({ requestedWeek: null, deliveries: 0 }); expect(snapshot.promotionWeek).toBe(139);
    const r = harness(snapshot); expect(r.state.characteristics.map(c => c.holder)).toEqual(['EMBODIED', 'SUPPLIER', 'SUPPLIER']);
    expect(r.state.characteristics.map(c => c.id)).toEqual(['ER0-TW-CHAR-1', 'ER0-TW-CHAR-2', 'ER0-TW-CHAR-3']);
    expect(s.fateTrojan.life.site.parcel).toMatchObject({ ownerId: 'FT2-VICTOR', location: 'OUTSIDE', carriedBy: 'PLAYER' });
    expect(stableStringify(snapshot)).toBe(before); expect(errorAscentMaterialConservationBlock(r.state)).toBeNull();
  });

  it.each([1, 2, 3] as const)('accepts legal original%s success without treating the embodied original as stock', n => {
    const snapshot = controlledSnapshot(n), r = harness(snapshot), result = resolveErrorAscentOriginals(snapshot)!;
    expect(result.embodiedOriginalBottleId).toBe(original(n)); expect(result.embodiedBottleId).toBe(original(n));
    expect(r.state.characteristics.filter(c => c.holder === 'EMBODIED').map(c => c.originBottleId)).toEqual([original(n)]);
    expect(errorAscentMaterialBlock(r.state, { type: 'ACQUIRE_CHARACTERISTIC', bottleId: original(n) }, r.host, POLICY)).not.toBeNull();
    r.acquire(); r.compose(); r.settle(true, true);
    expect(r.state.characteristics.map(c => c.holder)).toEqual(['FUSED', 'FUSED', 'FUSED']);
    expect(r.state.uniqueness.id).toBe(ERROR_ASCENT_UNIQUENESS_ID); expect(errorAscentMaterialConservationBlock(r.state)).toBeNull();
  });

  it('requires current permission and paid later-week recovery of the same failed S1 originals', () => {
    const snapshot = controlledSnapshot(2, 'FAILED_REMAINS'), r = harness(snapshot), id = original(1);
    expect(r.state.characteristics.map(c => c.holder)).toEqual(['UNLOCATED', 'EMBODIED', 'UNLOCATED']);
    expect(r.state.legacyRemains[0]).toMatchObject({ investigatedEventId: null, sceneId: null, recoveredEventId: null });
    r.move(LOC.originalRoom);
    const inspect = { type: 'INVESTIGATE_LEGACY_REMAINS', bottleId: id } as const;
    expect(errorAscentMaterialBlock(r.state, inspect, r.host, POLICY)).not.toBeNull();
    for (const patch of [{ residualPresent: false }, { custodianPresent: false }, { accessible: false }, { consumeRevision: -1 }])
      expect(errorAscentMaterialBlock(r.state, { type: 'ASK_LEGACY_PERMISSION', bottleId: id }, { ...r.host, legacyAccess: { ...r.host.legacyAccess!, ...patch } }, POLICY)).not.toBeNull();
    r.run({ type: 'ASK_LEGACY_PERMISSION', bottleId: id }); expect(r.run(inspect).effect.cashCost).toBe(120);
    r.host.actions = 0; expect(r.run({ type: 'SEAL_LEGACY_REMAINS', bottleId: id }).effect).toEqual({ actions: 0, cashCost: 0, seconds: 600 });
    const recover = { type: 'RECOVER_LEGACY_REMAINS', bottleId: id } as const;
    expect(errorAscentMaterialBlock(r.state, recover, r.host, POLICY)).not.toBeNull();
    r.move(LOC.supplier); r.move(LOC.originalRoom); r.laterWeek(); expect(errorAscentMaterialBlock(r.state, recover, r.host, POLICY)).not.toBeNull();
    r.run({ type: 'ASK_LEGACY_PERMISSION', bottleId: id }); expect(r.run(recover).effect.cashCost).toBe(30);
    expect(r.state.characteristics[0]).toMatchObject({ id: 'ER0-TW-CHAR-1', latestBottleId: id, holder: 'PLAYER' });
    expect(r.state.origin.bottles[0]!.status).toBe('CONSUMED'); expect(r.state.legacySites[0]!.residualPresent).toBe(false);
  });

  it('resolves failedsameID S1 re-vessels and charges900 or five fresh labour steps then90', () => {
    const snapshot = controlledSnapshot(1, 'RECOVERED_SUCCESS'), resolution = resolveErrorAscentOriginals(snapshot)!, r = harness(snapshot);
    expect(resolution.embodiedOriginalBottleId).toBe(original(1)); expect(resolution.embodiedBottleId).toBe('time-worm-recovery-2');
    expect(snapshot.bottles.slice(0, 3).every(b => b.status === 'CONSUMED' && b.outcome === 'FAILURE')).toBe(true);
    expect(snapshot.acquisitionJournal.filter(e => e.command.type === 'REQUEST_RECOVERY_V1').map(e => e.before.cash - e.after.cash)).toEqual([120, 120]);
    expect(snapshot.acquisitionJournal.filter(e => e.command.type === 'RECOVER_CHARACTERISTIC_V1').map(e => e.before.cash - e.after.cash)).toEqual([30, 30]);
    expect(r.state.characteristics[1]).toMatchObject({ id: 'ER0-TW-CHAR-2', latestBottleId: 'time-worm-recovery-1', recoveredVessel: true, holder: 'SUPPLIER', inheritedLabourSteps: 0 });
    const c = { type: 'ACQUIRE_CHARACTERISTIC', bottleId: original(2) } as const; r.move(LOC.supplier);
    expect(errorAscentMaterialEffect(r.state, c, POLICY).cashCost).toBe(900);
    for (const taskId of ERROR_ASCENT_LABOUR_IDS) r.run({ type: 'MATERIAL_LABOUR', bottleId: original(2), taskId });
    expect(r.run(c).effect.cashCost).toBe(90); expect(r.state.characteristics).toHaveLength(3);
    const forged = structuredClone(snapshot); forged.bottles.at(-1)!.recovery!.originalBottleId = original(3);
    expect(resolveErrorAscentOriginals(forged)).toBeNull();
    const copy = structuredClone(actualSnapshot()); copy.bottles.push({ ...copy.bottles[1]!, id: 'time-worm-potion-4' });
    expect(resolveErrorAscentOriginals(copy)).toBeNull();
  });

  it('charges original6600 or five per-original jobs plus1100 without sharing labour', () => {
    const r = harness(), c = { type: 'ACQUIRE_CHARACTERISTIC', bottleId: original(2) } as const; r.move(LOC.supplier);
    expect(errorAscentMaterialEffect(r.state, c, POLICY).cashCost).toBe(6600);
    expect(errorAscentMaterialBlock(r.state, c, { ...r.host, cash: 6599 }, POLICY)).not.toBeNull();
    for (const taskId of ERROR_ASCENT_LABOUR_IDS) r.run({ type: 'MATERIAL_LABOUR', bottleId: original(2), taskId });
    expect(r.run(c).effect.cashCost).toBe(1100);
    expect(errorAscentMaterialEffect(r.state, { type: 'ACQUIRE_CHARACTERISTIC', bottleId: original(3) }, POLICY).cashCost).toBe(6600);
    expect(errorAscentMaterialBlock(r.state, c, r.host, POLICY)).not.toBeNull();
    const inherited = harness(controlledSnapshot(2)); inherited.move('component-home');
    expect(inherited.run({ type: 'ACQUIRE_CHARACTERISTIC', bottleId: original(1) }).effect.cashCost).toBe(0);
  });

  it('keeps the Error succession earlier than actual guidance and charges100/150 at actual locations', () => {
    expect(validateErrorAscentMaterialPolicy(POLICY)).toBe(true);
    expect(ERROR_ASCENT_FUTURE_BRANCH.terminationDate).toEqual({ epoch: 'FIFTH_EPOCH', year: 1351, month: 12, day: 10 });
    expect(ERROR_ASCENT_FUTURE_BRANCH.transferDate).toEqual({ epoch: 'FIFTH_EPOCH', year: 1351, month: 12, day: 11 });
    expect(actualSnapshot().acquisitionJournal[0]!.date).toEqual({ epoch: 'FIFTH_EPOCH', year: 1351, month: 12, day: 18 });
    expect(errorAscentSuccessionAt(ERROR_ASCENT_FUTURE_BRANCH.terminationDate)).toBeNull();
    const r = harness(); r.move(LOC.archive); expect(r.run({ type: 'VERIFY_UNIQUENESS', step: 'CHAIN' }).effect.cashCost).toBe(100);
    const vacancy = { type: 'VERIFY_UNIQUENESS', step: 'VACANCY' } as const;
    expect(errorAscentMaterialBlock(r.state, vacancy, r.host, POLICY)).not.toBeNull(); r.move(LOC.vault); r.run(vacancy);
    const acquire = { type: 'ACQUIRE_UNIQUENESS' } as const; r.laterWeek(); expect(errorAscentMaterialBlock(r.state, acquire, r.host, POLICY)).not.toBeNull();
    r.run(vacancy); expect(r.run(acquire).effect.cashCost).toBe(150);
    expect(r.state.uniqueness).toMatchObject({ id: 'ER219-ERROR-UNIQUE', holder: 'PLAYER', incumbentActorId: null });
    const wrong = structuredClone(POLICY); wrong.succession.transfer.objectId = 'ER219-TYRANT-UNIQUE' as typeof ERROR_ASCENT_UNIQUENESS_ID;
    expect(validateErrorAscentMaterialPolicy(wrong)).toBe(false);
  });

  it('accepts one actual survey for early composition but rejects submitted private facts and extra stock', () => {
    const r = harness(), facts = r.host.preparationFacts!;
    expect(errorAscentPreparationFactsComplete(facts, r.host.actorId, r.host.sourceDigest)).toBe(true);
    expect(errorAscentPreparationFactsComplete(null, r.host.actorId, r.host.sourceDigest)).toBe(false);
    expect(errorAscentPreparationFactsComplete({ ...facts, routeEventId: '' }, r.host.actorId, r.host.sourceDigest)).toBe(false);
    for (const c of [{ type: 'BUY_COMPOUND', batchId: 'error-ascent-carrier-2' }, { type: 'ACQUIRE_CHARACTERISTIC', bottleId: 'time-worm-potion-4' },
      { type: 'COMPOSE_POTION', batchId: ERROR_ASCENT_CARRIER_IDS[0], preparationFacts: facts }, { type: 'ACQUIRE_UNIQUENESS', succession: POLICY.succession }])
      expect(validateErrorAscentMaterialCommand(c)).toBe(false);
    r.acquire(); r.move(LOC.supplier); expect(r.run({ type: 'BUY_COMPOUND', batchId: ERROR_ASCENT_CARRIER_IDS[0] }).effect.cashCost).toBe(50); r.move(LOC.workshop);
    const compose = { type: 'COMPOSE_POTION', batchId: ERROR_ASCENT_CARRIER_IDS[0] } as const;
    expect(errorAscentMaterialBlock(r.state, compose, { ...r.host, preparationFacts: null }, POLICY)).not.toBeNull();
    r.host.preparationFacts = { ...facts, currentConductorVersion: 2, conductorIntact: false, ordinaryExitOpen: false };
    expect(r.run(compose).effect.cashCost).toBe(40); // Live contact belongs to the later ritual gate.
    expect(r.state.characteristics.map(c => c.holder)).toEqual(['EMBODIED', 'COMPOUND', 'COMPOUND']);
    expect(r.state.batches).toHaveLength(1); expect(r.state.compounds).toHaveLength(1);
  });

  it.each([{ success: true, alive: true }, { success: false, alive: true }, { success: false, alive: false }])(
    'conserves the sole3+unique for success=$success alive=$alive without reroll or material disappearance', ({ success, alive }) => {
      const r = harness(); r.acquire(); r.compose(); r.move('ER219-TIDE-BELL-OUTER-CONTACT');
      const ids = r.state.characteristics.map(c => c.id), origin = structuredClone(r.state.origin), event = r.settle(success, alive);
      expect(errorAscentMaterialConservationBlock(r.state)).toBeNull(); expect(() => settleErrorAscentConsumption(r.state, event)).toThrow();
      expect(r.state.characteristics.map(c => c.id)).toEqual(ids); expect(r.state.origin).toEqual(origin);
      expect(r.state.characteristics.map(c => c.holder)).toEqual(success ? ['FUSED', 'FUSED', 'FUSED'] : alive ? ['EMBODIED', 'EXPOSED', 'EXPOSED'] : ['EXPOSED', 'EXPOSED', 'EXPOSED']);
      expect(r.state.uniqueness.holder).toBe(success ? 'FUSED' : 'EXPOSED'); expect(r.state.batches[0]).toMatchObject({ status: 'SPENT', uses: 1 });
      if (!alive) {
        expect(r.state.compounds[0]!.status).toBe('DEATH_EXPOSED');
        expect(new Set([...r.state.characteristics, r.state.uniqueness].map(c => c.location))).toEqual(new Set([event.location]));
      }
      const bad = structuredClone(r.state); bad.characteristics[1]!.id = bad.characteristics[0]!.id;
      expect(errorAscentMaterialConservationBlock(bad)).not.toBeNull();
    });

  it('rejects failure settlement that claims the real original materials disappeared', () => {
    const r = harness(); r.acquire(); r.compose(); const before = stableStringify(r.state);
    for (const alive of [true, false]) expect(() => settleErrorAscentConsumption(r.state, { eventId: 'missing-remains',
      week: r.host.week, compoundId: r.state.compounds[0]!.id, success: false, alive, location: r.host.location, residualPresent: false })).toThrow();
    expect(stableStringify(r.state)).toBe(before);
  });

  it('leaves sealed remains during zero-cash transport, charges60 for custody and permits no second material ceremony', () => {
    const r = harness(); r.acquire(); r.compose(); const ids = r.state.characteristics.map(c => c.id), event = r.settle(false, true);
    r.host.actions = 0; r.host.cash = 0;
    expect(r.run({ type: 'SEAL_REMAINS', compoundId: event.compoundId }).effect).toEqual({ actions: 0, cashCost: 0, seconds: 600 });
    r.move('component-home'); expect(r.host.cash).toBe(0); expect(r.host.actions).toBe(0);
    expect(r.state.uniqueness.location).toBe(LOC.workshop); expect(r.state.uniqueness.holder).toBe('SEALED');
    r.move(LOC.workshop); const recover = { type: 'RECOVER_SEALED', compoundId: event.compoundId } as const;
    expect(errorAscentMaterialBlock(r.state, recover, r.host, POLICY)).not.toBeNull(); r.laterWeek();
    expect(errorAscentMaterialBlock(r.state, recover, { ...r.host, cash: 59 }, POLICY)).not.toBeNull();
    r.host.cash = 60; expect(r.run(recover).effect.cashCost).toBe(60); expect(r.host.cash).toBe(0);
    expect(r.state.characteristics.map(c => c.id)).toEqual(ids); expect(r.state.characteristics.map(c => c.holder)).toEqual(['EMBODIED', 'PLAYER', 'PLAYER']);
    expect(r.state.compounds[0]!.status).toBe('RECOVERED'); expect(r.state.batches[0]).toMatchObject({ status: 'SPENT', uses: 1 });
    expect(errorAscentMaterialBlock(r.state, { type: 'BUY_COMPOUND', batchId: ERROR_ASCENT_CARRIER_IDS[0] }, { ...r.host, cash: 50000, actions: 100 }, POLICY)).not.toBeNull();
    expect(errorAscentMaterialBlock(r.state, { type: 'COMPOSE_POTION', batchId: ERROR_ASCENT_CARRIER_IDS[0] }, { ...r.host, cash: 50000, actions: 100 }, POLICY)).not.toBeNull();
    expect(getErrorAscentMaterialActions(r.state, POLICY).some(a => ['BUY_COMPOUND', 'COMPOSE_POTION'].includes(a.command.type))).toBe(false);
    expect(stableStringify(projectErrorAscentMaterials(r.state))).toContain('不产生第二次仪式');
  });
});
