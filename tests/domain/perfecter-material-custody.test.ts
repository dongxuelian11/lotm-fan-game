import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { sha256Hex } from '../../src/domain/checksum.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { applyCivilizationEnlightenerAcquisition, createCivilizationEnlightenerState, resolveCivilizationEnlightenerOriginalCharacteristicsSnapshot } from '../../src/domain/civilization-enlightener/index.js';
import { CIVILIZATION_ENLIGHTENER_PREPARATION_IDS, type CivilizationEnlightenerAcquisitionCommand } from '../../src/domain/civilization-enlightener/types.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { perfecterAcquisitionSnapshot } from '../../src/domain/perfecter/source.js';
import type { PerfecterHost } from '../../src/domain/perfecter/ports.js';
import { applyPerfecterMaterial, createPerfecterMaterials, getPerfecterMaterialActions, projectPerfecterMaterials,
  settlePerfecterConsumption, transportPerfecterMaterials, validatePerfecterMaterialCommand, validatePerfecterMaterialOrigin,
  validatePerfecterMaterials, perfecterMaterialBlock, perfecterMaterialChallenge,
  type PerfecterMaterialCommand, type PerfecterMaterialOrigin } from '../../src/domain/perfecter/materials.js';
import { PERFECTER_CARRIER_BATCHES, PERFECTER_LABOUR_TASKS, PERFECTER_MATERIAL_LOCATIONS as LOC,
  PERFECTER_UNIQUENESS_ID, PERFECTER_UNIQUENESS_SOURCE } from '../../src/domain/perfecter/material-content.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
const source = readObjectEntry<SliceState>('tests/fixtures/civilization-enlightener-v01890/natural.json', 'final').civilizationEnlightener;
const baseOrigin: PerfecterMaterialOrigin = { actorId: 'savant-rebuild-natural', sourceDigest: sha256Hex(stableStringify(source)),
  bottles: source.bottles, consumption: source.acquisitionJournal.find(r => r.command.type === 'CONSUME')!, resupply: source.resupply };
const initial = () => createPerfecterMaterials(structuredClone(baseOrigin));
/** Focused acquisition-only reducer fixture. Prior S2 history stays unchanged;
 * week/cash/actions, intervening recovery budgets, and checks are declared
 * component inputs, not evidence of natural play. Every acquisition receipt
 * and bottle is produced by the real reducer, never by rewriting consumed rows. */
function recoveryOrigin(mode: 'SUCCESS' | 'SUPPLIER' | 'PLAYER' | 'REPEATED_FAILURE' = 'SUCCESS') {
  const s = migrateSliceState(readObjectEntry<SliceState>('tests/fixtures/knowledge-mentor-v01670/natural.json', 'final'));
  s.civilizationEnlightener = createCivilizationEnlightenerState(); s.date = addGameWeeks(s.date, 169 - s.week); s.week = 169;
  s.cash = 50000; s.actionsRemaining = 100;
  const run = (command: CivilizationEnlightenerAcquisitionCommand, roll = 80) => {
    applyCivilizationEnlightenerAcquisition(s, command, { note() {}, roll() { throw Error('No unrelated check'); }, check(ability, difficulty) {
      s.random.cursor++; return resolveNormalCheck({ ability, difficulty, baseAbility: s.character.coreStats[ability], modifiers: [], roll });
    } }); s.revision++;
  };
  const later = () => { s.week++; s.date = addGameWeeks(s.date, 1); };
  const consume = (bottleId: string, roll = 80) => {
    run({ type: 'BUY_POTION', bottleId }); run({ type: 'PREPARE_PROMOTION' });
    run({ type: 'CONSUME', bottleId, confirmed: true }, roll);
  };
  const recover = (bottleId: string) => {
    run({ type: 'REQUEST_RECOVERY_V1', bottleId }); later(); run({ type: 'RECOVER_CHARACTERISTIC_V1', bottleId });
    return s.civilizationEnlightener.bottles.at(-1)!.id;
  };
  run({ type: 'LEARN_GUIDANCE' });
  for (const taskId of CIVILIZATION_ENLIGHTENER_PREPARATION_IDS) run({ type: 'PREPARE_TASK', taskId });
  // Declare independent intervening recovery budgets at revision gaps. This
  // suite verifies acquisition/custody; it does not claim to test ordinary rest.
  for (const bottleId of ['civilization-enlightener-potion-1', 'civilization-enlightener-potion-2', 'civilization-enlightener-potion-3']) {
    if (s.mind <= 40) { s.revision += 2; s.health = 98; s.mind = 98; }
    consume(bottleId);
  }
  const originals = stableStringify(s.civilizationEnlightener.bottles), fourth = recover('civilization-enlightener-potion-1');
  let successful = fourth;
  if (mode !== 'SUCCESS') {
    if (mode === 'PLAYER') run({ type: 'BUY_POTION', bottleId: fourth });
    if (mode === 'REPEATED_FAILURE') {
      s.revision += 2; s.health = 98; s.mind = 98; consume(fourth);
    }
    successful = recover('civilization-enlightener-potion-2');
  }
  s.revision += 2; s.health = 98; s.mind = 98;
  consume(successful, 10);
  const snapshot = perfecterAcquisitionSnapshot(s), consumption = snapshot.consumptions.at(-1)!;
  expect(stableStringify(s.civilizationEnlightener.bottles.slice(0, 3))).toBe(originals);
  expect(resolveCivilizationEnlightenerOriginalCharacteristicsSnapshot(s.civilizationEnlightener)?.embodiedBottleId).toBe(successful);
  const origin: PerfecterMaterialOrigin = { actorId: `${s.runId}:original-player`, sourceDigest: 'ab'.repeat(32),
    bottles: snapshot.bottles, consumption, consumptions: snapshot.consumptions, inheritanceLocation: LOC.supplier,
    resupply: structuredClone(s.civilizationEnlightener.resupply), acquisitionJournal: snapshot.recovery!.acquisitionJournal };
  return { origin, snapshot };
}
function harness(origin = baseOrigin) {
  let state = createPerfecterMaterials(structuredClone(origin));
  let id = 0;
  const host: PerfecterHost = { eventId: 'm-0', revision: Math.max(799, origin.consumption.revision + 1), week: Math.max(188, origin.consumption.week), actorId: origin.actorId, location: LOC.supplier,
    sequence: 1, status: 'ACTIVE', cash: 50000, actions: 3, health: 100, mind: 100, spirituality: 120, check: null };
  const move = (to: string) => { state = transportPerfecterMaterials(state, host.location, to); host.location = to; };
  const nextWeek = () => { host.week++; host.actions = 3; };
  const run = (c: PerfecterMaterialCommand, roll = 10) => {
    if (host.actions < 2) nextWeek();
    host.eventId = `m-${++id}`; host.revision++;
    const challenge = perfecterMaterialChallenge(state, c, host);
    host.check = challenge ? resolveNormalCheck({ ability: 'will', baseAbility: 32, modifiers: [], difficulty: challenge.difficulty, roll }) : null;
    const before = stableStringify(state), beforeHost = stableStringify(host), out = applyPerfecterMaterial(state, c, host);
    expect(stableStringify(state)).toBe(before); expect(stableStringify(host)).toBe(beforeHost);
    state = out.state; host.actions -= out.effect.actions; host.cash -= out.effect.cashCost; host.cash += out.effect.cashGain;
    host.health -= out.effect.health; host.mind -= out.effect.mind; host.spirituality -= out.effect.spirituality; host.check = null;
    expect(validatePerfecterMaterials(state)).toBe(true);
    return out;
  };
  const acquire = (leaveRecoveredCustody = false) => {
    for (const item of state.characteristics) {
      const bottleId = item.originBottleId as 'civilization-enlightener-potion-1' | 'civilization-enlightener-potion-2' | 'civilization-enlightener-potion-3';
      const bottle = state.origin.bottles.find(b => b.id === bottleId)!;
      if (item.holder === 'SUPPLIER') {
        for (const task of PERFECTER_LABOUR_TASKS.slice(bottle.labourSteps)) run({ type: 'MATERIAL_LABOUR', bottleId, taskId: task.id });
        run({ type: 'ACQUIRE_CHARACTERISTIC', bottleId });
      } else if (item.holder === 'CUSTODIAN' && !leaveRecoveredCustody) {
        run({ type: 'ACQUIRE_CHARACTERISTIC', bottleId });
      } else if (item.holder === 'UNLOCATED') {
        run({ type: 'INVESTIGATE_LEGACY_REMAINS', bottleId }); run({ type: 'SEAL_LEGACY_REMAINS', bottleId }); run({ type: 'RECOVER_LEGACY_REMAINS', bottleId });
      }
    }
    move(LOC.archive); run({ type: 'VERIFY_UNIQUENESS', step: 'CHAIN' });
    move(LOC.vault); run({ type: 'VERIFY_UNIQUENESS', step: 'VACANCY' });
    nextWeek(); run({ type: 'VERIFY_UNIQUENESS', step: 'SEAL' });
    // Keep the actual transfer in the final inspection week.
    host.actions = 3; run({ type: 'ACQUIRE_UNIQUENESS' });
    move(LOC.supplier);
    for (const batch of PERFECTER_CARRIER_BATCHES) run({ type: 'BUY_COMPOUND', batchId: batch.id });
    move(LOC.workshop);
  };
  const compose = (batchId = PERFECTER_CARRIER_BATCHES[0]!.id) => run({ type: 'COMPOSE_POTION', batchId });
  const settle = (success: boolean, alive: boolean) => {
    const potion = state.compounds.at(-1)!;
    state = settlePerfecterConsumption(state, { eventId: `s-${++id}`, week: host.week, compoundId: potion.id, success, alive, location: host.location });
    expect(validatePerfecterMaterials(state)).toBe(true);
  };
  return { get state() { return state; }, host, run, move, nextWeek, acquire, compose, settle };
}
describe('Perfecter real three-characteristic and uniqueness conservation', () => {
  it('initializes only the actual living W180 receipt, with original bottle records unchanged', () => {
    const bytes = stableStringify(baseOrigin), state = initial();
    expect(validatePerfecterMaterialOrigin(baseOrigin)).toBe(true); expect(validatePerfecterMaterials(state)).toBe(true);
    expect(stableStringify(baseOrigin)).toBe(bytes); expect(source.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
    expect(state.characteristics.map(b => [b.id, b.holder])).toEqual([
      ['civilization-enlightener-potion-1:characteristic', 'EMBODIED'], ['civilization-enlightener-potion-2:characteristic', 'SUPPLIER'], ['civilization-enlightener-potion-3:characteristic', 'SUPPLIER'],
    ]);
    expect(state.origin.bottles.every(b => !Object.hasOwn(b, 'characteristicId'))).toBe(true);
    expect(state.origin.consumption.check).toMatchObject({ roll: 35, chance: 38, tier: 'SUCCESS' });
    expect(state.origin.consumption).toEqual(source.acquisitionJournal.find(e => e.command.type === 'CONSUME'));
    expect(state.origin.consumption.cursorBefore).toBe(state.origin.consumption.randomBefore);
    expect(state.origin.consumption.cursorAfter).toBe(state.origin.consumption.randomAfter);
    expect(state.uniqueness.id).toBe(PERFECTER_UNIQUENESS_ID); expect(state.uniqueness.incumbentActorId).toBeNull();
  });
  it('rejects dead/failure evidence, fabricated fourth bottles, changes to the old success and previous resupply', () => {
    const mutations = [
      (o: PerfecterMaterialOrigin) => { o.bottles.push({ ...o.bottles[2]!, id: 'civilization-enlightener-potion-4' }); },
      (o: PerfecterMaterialOrigin) => { o.bottles[1]!.labourSteps = 6; },
      (o: PerfecterMaterialOrigin) => { o.bottles[0]!.outcome = 'FAILURE'; },
      (o: PerfecterMaterialOrigin) => { o.consumption.after.health = 0; },
      (o: PerfecterMaterialOrigin) => { o.consumption.check!.roll = 99; },
      (o: PerfecterMaterialOrigin) => { o.resupply.deliveries = 1; },
      (o: PerfecterMaterialOrigin) => { o.consumption.cursorAfter++; },
      (o: PerfecterMaterialOrigin) => { Object.assign(o.consumption.actor, { audiencePromotionWeek: 5 }); },
    ];
    for (const mutate of mutations) { const origin = structuredClone(baseOrigin); mutate(origin); expect(validatePerfecterMaterialOrigin(origin)).toBe(false); expect(() => createPerfecterMaterials(origin)).toThrow(); }
  });
  it('accepts another legitimate player date, week, revision, statistics and successful die without fixture locks', () => {
    const origin = structuredClone(baseOrigin), receipt = origin.consumption;
    origin.actorId = 'another-real-player'; origin.sourceDigest = 'ab'.repeat(32);
    receipt.week = 201; receipt.revision = 940; receipt.date = { epoch: 'FIFTH_EPOCH', year: 1353, month: 5, day: 16 };
    receipt.cursorBefore = receipt.randomBefore = 810; receipt.cursorAfter = receipt.randomAfter = 811; receipt.before.coreStats.will = 45; receipt.after.coreStats.will = 46;
    receipt.check = resolveNormalCheck({ ability: 'will', baseAbility: 45, modifiers: [], difficulty: 30, roll: 40 });
    Object.assign(origin.bottles[0]!, { labourSteps: 0, acquiredWeek: 200, consumedWeek: 201, preparationWeek: 201, outcome: receipt.check.tier });
    expect(validatePerfecterMaterialOrigin(origin)).toBe(true);
    const state = createPerfecterMaterials(origin); expect(validatePerfecterMaterials(state)).toBe(true);
    expect(state.characteristics[0]!.acquiredWeek).toBe(200);
    receipt.check = resolveNormalCheck({ ability: 'will', baseAbility: 45, modifiers: [], difficulty: 30, roll: 2 });
    origin.bottles[0]!.outcome = 'GREAT_SUCCESS'; expect(validatePerfecterMaterialOrigin(origin)).toBe(true);
  });
  it.each([1, 2, 3] as const)('uses the real acquisition reducer success for original %i without renumbering', success => {
    const s = migrateSliceState(readObjectEntry<SliceState>('tests/fixtures/knowledge-mentor-v01670/natural.json', 'final'));
    // Declared component budget/check inputs; original predecessor roots are unchanged.
    s.cash = 50000; s.actionsRemaining = 100;
    const run = (command: CivilizationEnlightenerAcquisitionCommand) => {
      applyCivilizationEnlightenerAcquisition(s, command, { note() {}, roll() { throw Error('No unrelated roll'); }, check(ability, difficulty) {
        s.random.cursor++; return resolveNormalCheck({ ability, difficulty, baseAbility: s.character.coreStats[ability], modifiers: [], roll: 10 });
      } }); s.revision++;
    };
    run({ type: 'LEARN_GUIDANCE' });
    for (const taskId of CIVILIZATION_ENLIGHTENER_PREPARATION_IDS) run({ type: 'PREPARE_TASK', taskId });
    if (success !== 1) run({ type: 'BUY_POTION', bottleId: 'civilization-enlightener-potion-1' });
    const bottleId = `civilization-enlightener-potion-${success}`;
    run({ type: 'BUY_POTION', bottleId }); run({ type: 'PREPARE_PROMOTION' }); run({ type: 'CONSUME', bottleId, confirmed: true });
    const snapshot = perfecterAcquisitionSnapshot(s);
    const origin: PerfecterMaterialOrigin = { actorId: `${s.runId}:original-player`, sourceDigest: 'ab'.repeat(32),
      bottles: snapshot.bottles, consumption: snapshot.consumptions[0]!, consumptions: snapshot.consumptions,
      resupply: structuredClone(s.civilizationEnlightener.resupply), inheritanceLocation: LOC.supplier };
    const h = harness(origin), bytes = stableStringify(origin);
    expect(h.state.characteristics.find(i => i.holder === 'EMBODIED')!.originBottleId).toBe(bottleId);
    h.acquire(); h.compose(); h.settle(true, true);
    expect(h.state.characteristics.every(i => i.holder === 'FUSED')).toBe(true); expect(stableStringify(origin)).toBe(bytes);
    expect(h.state.characteristics).toHaveLength(3);
    if (success !== 1) expect(h.state.receipts.filter(r => 'bottleId' in r.command && r.command.bottleId === 'civilization-enlightener-potion-1')).toHaveLength(0);
  });
  it('inherits supplier labour and already-held originals without repeating their paid work or purchase', () => {
    const origin = structuredClone(baseOrigin); origin.bottles[1]!.labourSteps = 3;
    Object.assign(origin.bottles[2]!, { status: 'PLAYER', acquiredWeek: 136 }); origin.inheritanceLocation = LOC.supplier;
    const h = harness(origin);
    expect(validatePerfecterMaterials(h.state)).toBe(true);
    expect(perfecterMaterialBlock(h.state, { type: 'MATERIAL_LABOUR', bottleId: 'civilization-enlightener-potion-2', taskId: 'SEAL_REGISTER' }, h.host)).toContain('已经做过');
    h.run({ type: 'MATERIAL_LABOUR', bottleId: 'civilization-enlightener-potion-2', taskId: 'TRANSIT_RECEIPT' });
    h.run({ type: 'MATERIAL_LABOUR', bottleId: 'civilization-enlightener-potion-2', taskId: 'DELIVERY_REVIEW' });
    expect(h.run({ type: 'ACQUIRE_CHARACTERISTIC', bottleId: 'civilization-enlightener-potion-2' }).effect.cashCost).toBe(1100);
    expect(h.state.characteristics[2]).toMatchObject({ holder: 'PLAYER', acquiredWeek: 136, acquiredEventId: null });
    expect(perfecterMaterialBlock(h.state, { type: 'ACQUIRE_CHARACTERISTIC', bottleId: 'civilization-enlightener-potion-3' }, { ...h.host, eventId: 'repurchase', revision: 9999, actions: 3 })).toContain('不能再次');
  });
  it('finds and seals each old failed original only through a new paid present-day chain', () => {
    const origin = structuredClone(baseOrigin), successfulBottle = structuredClone(origin.bottles[0]!);
    const third = origin.bottles[2]!; Object.assign(third, { ...successfulBottle, id: third.id, source: third.source });
    origin.consumption.command = { type: 'CONSUME', bottleId: third.id, confirmed: true };
    const failures = [0, 1].map(index => {
      const receipt = structuredClone(baseOrigin.consumption), bottle = origin.bottles[index]!, week = 133 + index * 2;
      receipt.week = week; receipt.revision = 600 + index * 10; receipt.command = { type: 'CONSUME', bottleId: bottle.id, confirmed: true };
      receipt.after.sequence = 2; receipt.after.acting = 100;
      receipt.check = resolveNormalCheck({ ability: 'will', baseAbility: receipt.before.coreStats.will, modifiers: [], difficulty: 30, roll: 80 });
      Object.assign(bottle, { status: 'CONSUMED', acquiredWeek: week, consumedWeek: week, preparationWeek: week, outcome: 'FAILURE' });
      return receipt;
    });
    origin.consumptions = [...failures, origin.consumption]; origin.inheritanceLocation = LOC.supplier;
    const h = harness(origin), originalBytes = stableStringify(origin);
    expect(h.state.characteristics.map(i => i.holder)).toEqual(['UNLOCATED', 'UNLOCATED', 'EMBODIED']);
    expect(validatePerfecterMaterials(h.state)).toBe(true);
    expect(perfecterMaterialBlock(h.state, { type: 'RECOVER_LEGACY_REMAINS', bottleId: 'civilization-enlightener-potion-1' }, h.host)).toContain('依次');
    h.acquire(); expect(h.state.legacyRemains.every(r => r.status === 'RECOVERED')).toBe(true);
    expect(h.state.receipts.filter(r => r.command.type.endsWith('LEGACY_REMAINS')).reduce((sum, r) => sum + r.effect.cashCost, 0)).toBe(720);
    h.compose(); h.settle(true, true); expect(h.state.characteristics).toHaveLength(3); expect(stableStringify(origin)).toBe(originalBytes);
    const missing = structuredClone(origin); delete missing.consumptions; expect(validatePerfecterMaterialOrigin(missing)).toBe(false);
    const forged = structuredClone(h.state); forged.legacyRemains[0]!.sealedEventId = null; expect(validatePerfecterMaterials(forged)).toBe(false);
  });
  it('accepts exact commands only and never lets a command supply authority or create a fourth share', () => {
    const command = { type: 'ACQUIRE_CHARACTERISTIC', bottleId: 'civilization-enlightener-potion-2' };
    expect(validatePerfecterMaterialCommand(command)).toBe(true);
    for (const bad of [{ ...command, free: true }, { ...command, bottleId: 'civilization-enlightener-potion-4' },
      { type: 'SEAL_REMAINS', compoundId: 'perfecter-compound-1', method: 'ABILITY', check: {} }, { type: 'COMPOSE_POTION', batchId: 'new-batch' }]) expect(validatePerfecterMaterialCommand(bad)).toBe(false);
  });
  it('inherits a successful recovery attempt as one of exactly three originals and freezes every historical bottle and cost', () => {
    const { origin, snapshot } = recoveryOrigin(), bytes = stableStringify(origin), h = harness(origin);
    expect(snapshot.bottles).toHaveLength(4); expect(snapshot.consumptions).toHaveLength(4);
    expect(snapshot.recovery!.acquisitionJournal).toEqual(origin.acquisitionJournal);
    expect(origin.consumption.after.cash).toBe(50000 - 500 - 3 * (6600 + 150) - 120 - 900 - 150);
    expect(h.state.characteristics.map(i => i.id)).toEqual([1, 2, 3].map(n => `civilization-enlightener-potion-${n}:characteristic`));
    expect(h.state.characteristics.map(i => i.holder)).toEqual(['EMBODIED', 'UNLOCATED', 'UNLOCATED']);
    expect(h.state.legacyRemains.map(r => r.originBottleId)).toEqual(['civilization-enlightener-potion-2', 'civilization-enlightener-potion-3']);
    expect(projectPerfecterMaterials(h.state).conservation.embodiedOriginalBottle).toBe('civilization-enlightener-potion-1');
    expect(perfecterMaterialBlock(h.state, { type: 'INVESTIGATE_LEGACY_REMAINS', bottleId: 'civilization-enlightener-potion-1' }, h.host)).toContain('没有可核对');
    h.acquire(); h.compose(); h.settle(true, true);
    expect(h.state.characteristics).toHaveLength(3); expect(h.state.characteristics.every(i => i.holder === 'FUSED')).toBe(true);
    expect(stableStringify(origin)).toBe(bytes); expect(h.state.origin).toEqual(origin);
  });
  it('tracks the latest failed recovery vessel and prevents claiming an earlier failure twice', () => {
    const { origin } = recoveryOrigin('REPEATED_FAILURE'), h = harness(origin);
    const latest = origin.consumptions!.find(r => r.command.type === 'CONSUME' && r.command.bottleId === 'civilization-enlightener-potion-4')!;
    expect(h.state.characteristics.map(i => i.holder)).toEqual(['UNLOCATED', 'EMBODIED', 'UNLOCATED']);
    expect(h.state.legacyRemains[0]).toMatchObject({ originBottleId: 'civilization-enlightener-potion-1', sourceRevision: latest.revision,
      sourceWeek: latest.week, custodyId: `civilization-enlightener-potion-4:residue:revision-${latest.revision}` });
    const stale = structuredClone(h.state), first = origin.consumptions![0]!;
    Object.assign(stale.legacyRemains[0]!, { sourceRevision: first.revision, sourceWeek: first.week, custodyId: `civilization-enlightener-potion-1:residue:revision-${first.revision}` });
    expect(validatePerfecterMaterials(stale)).toBe(false);
    h.run({ type: 'INVESTIGATE_LEGACY_REMAINS', bottleId: 'civilization-enlightener-potion-1' });
    h.run({ type: 'SEAL_LEGACY_REMAINS', bottleId: 'civilization-enlightener-potion-1' }); h.run({ type: 'RECOVER_LEGACY_REMAINS', bottleId: 'civilization-enlightener-potion-1' });
    expect(perfecterMaterialBlock(h.state, { type: 'RECOVER_LEGACY_REMAINS', bottleId: 'civilization-enlightener-potion-1' }, { ...h.host, eventId: 'twice', revision: 9999, actions: 3 })).toContain('重复');
    h.acquire(); h.compose(); expect(h.state.compounds[0]!.characteristicIds).toHaveLength(3);
  });
  it('keeps an already-recovered original in professional custody until one local zero-cash pickup, then transports the same item', () => {
    const { origin } = recoveryOrigin('SUPPLIER'), h = harness(origin), pickup = { type: 'ACQUIRE_CHARACTERISTIC', bottleId: 'civilization-enlightener-potion-1' } as const;
    expect(h.state.characteristics[0]).toMatchObject({ holder: 'CUSTODIAN', location: LOC.supplier, acquiredWeek: null });
    expect(getPerfecterMaterialActions(h.state, h.host).find(a => a.command.type === 'ACQUIRE_CHARACTERISTIC' && a.command.bottleId === 'civilization-enlightener-potion-1')).toMatchObject({ label: '实地领回已付费回收的1号原特性', cost: '1行动 · 0便士' });
    expect(perfecterMaterialBlock(h.state, { type: 'MATERIAL_LABOUR', bottleId: 'civilization-enlightener-potion-1', taskId: 'SEAL_REGISTER' }, h.host)).toContain('不能再次');
    h.acquire(true); expect(h.state.characteristics[0]!.location).toBe(LOC.supplier);
    expect(perfecterMaterialBlock(h.state, pickup, { ...h.host, eventId: 'remote', revision: 9999, actions: 3 })).toContain('真实通路');
    expect(perfecterMaterialBlock(h.state, { type: 'COMPOSE_POTION', batchId: 'perfecter-carrier-1' }, { ...h.host, eventId: 'unclaimed', revision: 9999, actions: 3 })).toContain('同时真实在场');
    const teleported = structuredClone(h.state); Object.assign(teleported.characteristics[0]!, { holder: 'PLAYER', location: LOC.workshop });
    expect(validatePerfecterMaterials(teleported)).toBe(false);
    h.move(LOC.supplier); const cash = h.host.cash, picked = h.run(pickup);
    expect(picked.effect).toMatchObject({ actions: 1, cashCost: 0 }); expect(h.host.cash).toBe(cash);
    expect(perfecterMaterialBlock(h.state, pickup, { ...h.host, eventId: 'duplicate-pickup', revision: 9999, actions: 3 })).toContain('不能再次');
    h.move(LOC.workshop); expect(h.state.characteristics[0]!.location).toBe(LOC.workshop);
    h.compose(); h.settle(true, true); expect(h.state.characteristics).toHaveLength(3);
  });
  it('inherits a paid unused recovery bottle already held by the player without purchase or old-remains recovery', () => {
    const { origin } = recoveryOrigin('PLAYER'), h = harness(origin), bottle = origin.bottles[3]!;
    expect(h.state.characteristics[0]).toMatchObject({ holder: 'PLAYER', acquiredWeek: bottle.acquiredWeek, acquiredEventId: null });
    expect(h.state.legacyRemains.map(r => r.originBottleId)).toEqual(['civilization-enlightener-potion-3']);
    h.acquire(); h.compose(); expect(h.state.characteristics).toHaveLength(3);
    expect(h.state.receipts.filter(r => 'bottleId' in r.command && r.command.bottleId === 'civilization-enlightener-potion-1')).toHaveLength(0);
  });
  it('rejects fabricated legacy ancestry, cross-original mappings, missing investigation costs and double-claimed recovery receipts', () => {
    const { origin } = recoveryOrigin('SUPPLIER');
    const mutations: ((o: PerfecterMaterialOrigin) => void)[] = [
      o => { delete o.acquisitionJournal; },
      o => { delete o.bottles[3]!.recovery; },
      o => { o.bottles[4]!.recovery!.originalBottleId = 'civilization-enlightener-potion-1'; o.bottles[4]!.recovery!.characteristicId = 'civilization-enlightener-potion-1:characteristic'; },
      o => { o.bottles[4]!.recovery!.sourceBottleId = 'civilization-enlightener-potion-1'; },
      o => { const r = o.acquisitionJournal!.find(e => e.command.type === 'REQUEST_RECOVERY_V1')!; r.after.cash = r.before.cash; },
      o => { const r = o.acquisitionJournal!.find(e => e.command.type === 'RECOVER_CHARACTERISTIC_V1')!; o.acquisitionJournal!.splice(o.acquisitionJournal!.indexOf(r) + 1, 0, structuredClone(r)); },
      o => { const r = o.acquisitionJournal!.find(e => e.command.type === 'RECOVER_CHARACTERISTIC_V1')!; r.command = { type: 'RECEIVE_SUPPLY' }; },
    ];
    for (const change of mutations) { const forged = structuredClone(origin); change(forged); expect(validatePerfecterMaterialOrigin(forged)).toBe(false); expect(() => createPerfecterMaterials(forged)).toThrow(); }
  });
  it('requires five different actual deliveries for each 5500 credit and still charges 1100 cash', () => {
    const h = harness(), start = h.host.cash;
    for (const task of PERFECTER_LABOUR_TASKS) h.run({ type: 'MATERIAL_LABOUR', bottleId: 'civilization-enlightener-potion-2', taskId: task.id });
    const repeat = { type: 'MATERIAL_LABOUR', bottleId: 'civilization-enlightener-potion-2', taskId: 'SEAL_REGISTER' } as const;
    h.host.revision++; h.host.eventId = 'repeat'; h.host.actions = 3;
    expect(perfecterMaterialBlock(h.state, repeat, h.host)).toContain('已经做过');
    const result = h.run({ type: 'ACQUIRE_CHARACTERISTIC', bottleId: 'civilization-enlightener-potion-2' });
    expect(result.effect.cashCost).toBe(1100); expect(h.host.cash).toBe(start - 1100);
    expect(h.state.origin.bottles[1]).toMatchObject({ status: 'SUPPLIER', labourSteps: 0, acquiredWeek: null });
    const fullPrice = h.run({ type: 'ACQUIRE_CHARACTERISTIC', bottleId: 'civilization-enlightener-potion-3' }); expect(fullPrice.effect.cashCost).toBe(6600);
  });
  it('requires actual custody checks, physical original inventory and a paid carrier before compounding', () => {
    const h = harness();
    h.host.location = LOC.workshop;
    expect(perfecterMaterialBlock(h.state, { type: 'COMPOSE_POTION', batchId: 'perfecter-carrier-1' }, h.host)).toBeTruthy();
    h.host.location = LOC.vault;
    expect(perfecterMaterialBlock(h.state, { type: 'ACQUIRE_UNIQUENESS' }, h.host)).toContain('三步');
    expect(PERFECTER_UNIQUENESS_SOURCE.loss).toContain('1352年10月9日');
    expect(PERFECTER_UNIQUENESS_SOURCE.distinction).toContain('目前没有在位完美者');
    h.host.location = LOC.supplier; h.acquire(); h.compose();
    expect(h.state.characteristics.map(b => b.holder)).toEqual(['EMBODIED', 'COMPOUND', 'COMPOUND']);
    expect(new Set(h.state.compounds[0]!.characteristicIds).size).toBe(3);
    expect(h.state.batches.filter(b => b.status === 'IN_COMPOUND')).toHaveLength(1);
  });
  it('fuses exactly three actual originals and the one uniqueness only after successful consumption', () => {
    const h = harness(); h.acquire(); h.compose(); h.settle(true, true);
    expect(h.state.characteristics.map(b => b.holder)).toEqual(['FUSED', 'FUSED', 'FUSED']);
    expect(h.state.uniqueness).toMatchObject({ holder: 'FUSED', incumbentActorId: baseOrigin.actorId });
    expect(h.state.batches[0]!.status).toBe('SPENT');
    expect(() => settlePerfecterConsumption(h.state, { eventId: 'duplicate', week: h.host.week, compoundId: 'perfecter-compound-1', success: true, alive: true, location: h.host.location })).toThrow();
    const forged = structuredClone(h.state); forged.characteristics.push({ ...forged.characteristics[0]! }); expect(validatePerfecterMaterials(forged)).toBe(false);
  });
  it('spends failed ordinary liquid, requires actual sealing and recovers only the same surviving originals', () => {
    const h = harness(); h.acquire(); h.compose(); h.settle(false, true);
    expect(h.state.compounds[0]!.status).toBe('FAILED_EXPOSED');
    expect(perfecterMaterialBlock(h.state, { type: 'RECOVER_SEALED', compoundId: 'perfecter-compound-1' }, { ...h.host, eventId: 'preview', revision: 9999, actions: 3 })).toContain('已经实际封存');
    const before = h.state.characteristics.map(i => i.id);
    h.run({ type: 'SEAL_REMAINS', compoundId: 'perfecter-compound-1', method: 'PROFESSIONAL' });
    h.run({ type: 'RECOVER_SEALED', compoundId: 'perfecter-compound-1' });
    expect(h.state.characteristics.map(i => i.id)).toEqual(before);
    expect(h.state.characteristics.map(i => i.holder)).toEqual(['EMBODIED', 'PLAYER', 'PLAYER']);
    expect(h.state.batches[0]!.status).toBe('SPENT');
    h.compose('perfecter-carrier-2'); expect(h.state.compounds[1]!.characteristicIds).toEqual(before);
  });
  it('keeps dead failure originals at the real site and never offers recovery or resurrection', () => {
    const h = harness(); h.acquire(); h.compose(); h.settle(false, false); h.host.status = 'DEAD';
    expect(h.state.uniqueness).toMatchObject({ holder: 'LOST', location: LOC.workshop });
    const moved = transportPerfecterMaterials(h.state, LOC.workshop, LOC.supplier);
    expect(moved.uniqueness.location).toBe(LOC.workshop);
    expect(getPerfecterMaterialActions(h.state, { ...h.host, revision: 9999, eventId: 'dead' }).every(a => !a.enabled)).toBe(true);
    expect(() => applyPerfecterMaterial(h.state, { type: 'SEAL_REMAINS', compoundId: 'perfecter-compound-1', method: 'PROFESSIONAL' }, h.host)).toThrow();
  });
  it('has a paid, next-real-week ordinary repair route, bounded by six separate refill deliveries', () => {
    const h = harness(); h.acquire(); h.compose(); h.settle(false, true);
    h.run({ type: 'SEAL_REMAINS', compoundId: 'perfecter-compound-1', method: 'PROFESSIONAL' });
    h.run({ type: 'RECOVER_SEALED', compoundId: 'perfecter-compound-1' });
    h.move(LOC.supplier); h.run({ type: 'REQUEST_COMPOUND_REPAIR', batchId: 'perfecter-carrier-1' });
    h.host.actions = 3;
    expect(perfecterMaterialBlock(h.state, { type: 'RECEIVE_COMPOUND_REPAIR', batchId: 'perfecter-carrier-1' }, { ...h.host, eventId: 'same-week', revision: 9999 })).toContain('下一真实周');
    h.nextWeek(); h.run({ type: 'RECEIVE_COMPOUND_REPAIR', batchId: 'perfecter-carrier-1' });
    expect(h.state.refills.filter(r => r.batchId === null)).toHaveLength(5);
    expect(h.state.batches[0]).toMatchObject({ status: 'PLAYER', uses: 1 });
    h.move(LOC.workshop); h.compose(); expect(h.state.batches[0]!.uses).toBe(2);
  });
  it('uses one central sealing check, exposes real failure costs, and leaves professional fallback without spirituality', () => {
    const h = harness(); h.acquire(); h.compose(); h.settle(false, true);
    const failed = h.run({ type: 'SEAL_REMAINS', compoundId: 'perfecter-compound-1', method: 'ABILITY' }, 99);
    expect(failed.effect).toMatchObject({ cashCost: 60, actions: 1, health: 15, mind: 17, spirituality: 6 });
    expect(h.state.compounds[0]!.status).toBe('FAILED_EXPOSED');
    h.host.spirituality = 0; h.run({ type: 'SEAL_REMAINS', compoundId: 'perfecter-compound-1', method: 'PROFESSIONAL' });
    expect(h.state.compounds[0]!.status).toBe('FAILED_SEALED');
  });
  it('allows later paid reinspection instead of locking an expired custody handoff', () => {
    const h = harness(); h.move(LOC.archive); h.run({ type: 'VERIFY_UNIQUENESS', step: 'CHAIN' });
    h.move(LOC.vault); h.run({ type: 'VERIFY_UNIQUENESS', step: 'VACANCY' }); h.run({ type: 'VERIFY_UNIQUENESS', step: 'SEAL' });
    h.nextWeek(); h.run({ type: 'VERIFY_UNIQUENESS', step: 'SEAL' }); h.host.actions = 3; h.run({ type: 'ACQUIRE_UNIQUENESS' });
    expect(h.state.uniqueness.checks).toHaveLength(3); expect(h.state.uniqueness.holder).toBe('PLAYER');
  });
  it('projects no frozen source, random cursors or seed and rejects simple conservation forgeries', () => {
    const state = initial(), view = projectPerfecterMaterials(state), bytes = stableStringify(view);
    for (const secret of ['sourceDigest', 'randomBefore', 'randomAfter', 'sourceIdentityDigest', 'seed', 'cursor', 'eventId', 'EventId', 'custodyId', 'receipts']) expect(bytes).not.toContain(secret);
    expect(view.conservation.realCharacteristics).toBe(3); expect(view.ordinaryRefillsRemaining).toBe(6);
    for (const mutate of [
      (s: typeof state) => { s.characteristics[1]!.holder = 'PLAYER'; },
      (s: typeof state) => { s.uniqueness.incumbentActorId = 'other-god'; },
      (s: typeof state) => { s.batches[0]!.status = 'PLAYER'; },
      (s: typeof state) => { s.refills.push({ ...s.refills[0]! }); },
    ]) { const copy = structuredClone(state); mutate(copy); expect(validatePerfecterMaterials(copy)).toBe(false); }
  });
});
