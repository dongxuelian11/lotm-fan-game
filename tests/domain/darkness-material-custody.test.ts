import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { PublicResolutionTier } from '../../src/shared/contracts.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { sha256Hex } from '../../src/domain/checksum.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyMisfortuneKnightAcquisition, resolveMisfortuneKnightOriginalCharacteristicsSnapshot } from '../../src/domain/misfortune-knight/index.js';
import { MISFORTUNE_KNIGHT_PREPARATION_IDS, type MisfortuneKnightAcquisitionCommand, type MisfortuneKnightState } from '../../src/domain/misfortune-knight/types.js';
import { DARKNESS_MATERIAL_LOCATIONS as LOC, DARKNESS_CHARACTERISTIC_BOTTLES, DARKNESS_LABOUR_TASKS,
  DARKNESS_FUTURE_BRANCH, DARKNESS_UNIQUENESS_ID, DARKNESS_LEGACY_SITE_ID, DARKNESS_GUIDE_ID,
  DARKNESS_CONSUMPTION, DARKNESS_STABILITY, darknessSuccessionAt } from '../../src/domain/darkness/material-content.js';
import type { DarknessMaterialHost } from '../../src/domain/darkness/material-ports.js';
import { applyDarknessMaterial, createDarknessMaterials, darknessMaterialBlock, darknessMaterialEffect,
  darknessMaterialConservationBlock, transportDarknessMaterials, settleDarknessConsumption,
  validateDarknessMaterialCommand, projectDarknessMaterials, type DarknessMaterialOrigin,
  type DarknessMaterialCommand, type DarknessOriginalBottleId, type DarknessCarrierId } from '../../src/domain/darkness/materials.js';
import { directedInitial2 } from './misfortune-knight-directed-helper.js';

type Snapshot = Pick<MisfortuneKnightState, 'bottles' | 'resupply' | 'acquisitionJournal'>;
const rawPath = 'tests/fixtures/misfortune-knight-v01910/snapshot-practiced.json';
const rawSha = '470d3ae9700186d8488b27663a9c64060053a011cd57bed3a5054a275bf7b6ee';
const deadPath = 'tests/fixtures/misfortune-knight-v01910/snapshot-combatTerminal.json';
const deadSha = '349ca0f6d3c714cebb197fe3306537de7751b929751eaf98488b11336bc88e4e';
const hashFile = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const original = (n: 1 | 2 | 3): DarknessOriginalBottleId => `misfortune-knight-potion-${n}`;
const snapshotOf = (s: SliceState): Snapshot => ({ bottles: structuredClone(s.misfortuneKnight.bottles), resupply: structuredClone(s.misfortuneKnight.resupply), acquisitionJournal: structuredClone(s.misfortuneKnight.acquisitionJournal) });
const originOf = (snapshot: Snapshot): DarknessMaterialOrigin => ({ ...structuredClone(snapshot), actorId: 'component:original-player',
  sourceDigest: sha256Hex(stableStringify(snapshot)), inheritanceLocation: '厄难骑士原院子',
  consumption: structuredClone(snapshot.acquisitionJournal.find(e => e.command.type === 'CONSUME' && ['SUCCESS', 'GREAT_SUCCESS'].includes(e.check?.tier ?? ''))!),
});
const actualOrigin = () => originOf(snapshotOf(JSON.parse(readFileSync(rawPath, 'utf8')) as SliceState));

/** Controlled acquisition-only component source. Before its first new receipt,
 * choose an explicit future cursor under the unchanged original seed. Every
 * check then draws through the actual deterministic stream. Declared intervening
 * body/budget and week inputs are not natural-playthrough or whole-save proof. */
function controlledOrigin(success: 1 | 2 | 3, mode: 'SUPPLIER' | 'PLAYER' | 'FAILED_REMAINS' | 'RECOVERED_SUCCESS' | 'RECOVERY_SUPPLIER' = 'SUPPLIER') {
  const s = directedInitial2(); s.schemaVersion = 210;
  const kinds: PublicResolutionTier[] = mode === 'FAILED_REMAINS' ? ['FAILURE', 'FAILURE', 'SUCCESS'] :
    mode === 'RECOVERED_SUCCESS' || mode === 'RECOVERY_SUPPLIER' ? ['FAILURE', 'FAILURE', 'FAILURE', 'SUCCESS'] : ['SUCCESS'];
  let cursor: number | null = null;
  for (let c = s.random.cursor; c < s.random.cursor + 65536; c++) {
    const random = new DeterministicActionRandomStream(s.random.seed, c);
    if (kinds.every(tier => resolveNormalCheck({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [], roll: random.nextInt(1, 100) }).tier === tier)) { cursor = c; break; }
  }
  if (cursor === null) throw Error('No controlled future component cursor'); s.random.cursor = cursor;
  const apply = (command: MisfortuneKnightAcquisitionCommand) => {
    applyMisfortuneKnightAcquisition(s, command, { note() {}, roll() { throw Error('No extra component draw'); }, check(ability, difficulty) {
      const random = new DeterministicActionRandomStream(s.random.seed, s.random.cursor), roll = random.nextInt(1, 100); s.random.cursor = random.cursor;
      return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll });
    } }); s.revision++;
  };
  const recoverBody = () => { s.revision += 2; s.health = 100; s.mind = 100; s.spirituality = 120; s.seer.pollution = 0; s.actionsRemaining = 100; };
  const consume = (id: string) => { if (s.misfortuneKnight.bottles.find(b => b.id === id)!.status === 'SUPPLIER') apply({ type: 'BUY_POTION', bottleId: id }); apply({ type: 'PREPARE_PROMOTION' }); apply({ type: 'CONSUME', bottleId: id, confirmed: true }); };
  const recover = (id: string) => { apply({ type: 'REQUEST_RECOVERY_V1', bottleId: id }); s.week++; s.date = addGameWeeks(s.date, 1); s.revision += 2; apply({ type: 'RECOVER_CHARACTERISTIC_V1', bottleId: id }); return s.misfortuneKnight.bottles.at(-1)!.id; };
  apply({ type: 'LEARN_GUIDANCE' }); for (const taskId of MISFORTUNE_KNIGHT_PREPARATION_IDS) apply({ type: 'PREPARE_TASK', taskId });
  if (mode === 'PLAYER') for (const id of DARKNESS_CHARACTERISTIC_BOTTLES) apply({ type: 'BUY_POTION', bottleId: id });
  if (mode === 'FAILED_REMAINS') for (const id of DARKNESS_CHARACTERISTIC_BOTTLES.filter(id => id !== original(success))) { consume(id); recoverBody(); }
  if (mode === 'RECOVERED_SUCCESS' || mode === 'RECOVERY_SUPPLIER') {
    for (const id of DARKNESS_CHARACTERISTIC_BOTTLES) { consume(id); recoverBody(); }
    if (mode === 'RECOVERY_SUPPLIER') recover(DARKNESS_CHARACTERISTIC_BOTTLES.find(id => id !== original(success))!);
    consume(recover(original(success)));
  } else consume(original(success));
  const snapshot = snapshotOf(s); expect(resolveMisfortuneKnightOriginalCharacteristicsSnapshot(snapshot)).not.toBeNull(); return originOf(snapshot);
}

/** Host values are explicit private component fixtures. In production the
 * current owned engine derives them from original room, actual date, evacuation
 * state and authored scene. These strings/objects never grant import authority. */
function harness(origin = actualOrigin()) {
  let state = createDarknessMaterials(origin), revision = 2000;
  const host: DarknessMaterialHost = { actorId: origin.actorId, sourceDigest: origin.sourceDigest, eventId: 'component:2000', revision,
    week: 200, date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 4, day: 21 }, nowSecond: 0, location: origin.inheritanceLocation,
    verifiedReceipts: ['component:actual-three-stage-evacuation'], sequence: 1, status: 'ACTIVE', cash: 50000, actions: 100,
    health: 100, mind: 97, spirituality: 112, check: null,
    legacyAccess: { siteId: DARKNESS_LEGACY_SITE_ID, roomAccessible: true, custodianId: DARKNESS_GUIDE_ID, custodianAtSite: true, investigation: 'ALLOW', handover: 'ALLOW' },
    succession: darknessSuccessionAt({ epoch: 'FIFTH_EPOCH', year: 1353, month: 4, day: 21 }) };
  const move = (to: string) => { state = transportDarknessMaterials(state, host.location, to); host.location = to; };
  const laterWeek = () => { host.week++; host.date = addGameWeeks(host.date, 1); host.nowSecond += 604800; host.actions = 100; host.succession = darknessSuccessionAt(host.date); };
  const run = (command: DarknessMaterialCommand) => {
    host.eventId = `component:${revision}`; host.revision = revision++;
    const before = stableStringify(state), result = applyDarknessMaterial(state, command, host);
    expect(stableStringify(state)).toBe(before); expect(result.effect.cashGain).toBe(0); state = result.state;
    host.cash -= result.effect.cashCost; host.actions -= result.effect.actions; host.nowSecond += result.effect.seconds;
    expect(darknessMaterialConservationBlock(state)).toBeNull(); return result;
  };
  const acquire = () => {
    for (const id of DARKNESS_CHARACTERISTIC_BOTTLES) {
      const item = state.characteristics.find(c => c.originBottleId === id)!;
      if (item.holder === 'SUPPLIER' || item.holder === 'PLAYER') { move(item.location!); run({ type: 'ACQUIRE_CHARACTERISTIC', bottleId: id }); }
      else if (item.holder === 'UNLOCATED') { move(LOC.originalRoom); run({ type: 'INVESTIGATE_LEGACY_REMAINS', bottleId: id }); laterWeek(); run({ type: 'RECOVER_LEGACY_REMAINS', bottleId: id }); }
    }
    move(LOC.archive); run({ type: 'VERIFY_UNIQUENESS', step: 'CHAIN' }); move(LOC.vault); run({ type: 'VERIFY_UNIQUENESS', step: 'VACANCY' }); run({ type: 'ACQUIRE_UNIQUENESS' });
  };
  const compose = (batchId: DarknessCarrierId = 'darkness-carrier-1') => { move(LOC.supplier); run({ type: 'BUY_COMPOUND', batchId }); move(LOC.workshop); run({ type: 'COMPOSE_POTION', batchId }); };
  const settle = (success: boolean, alive: boolean) => {
    const input = { eventId: `component:consume:${revision++}`, week: host.week, compoundId: state.compounds.at(-1)!.id, success, alive, location: host.location };
    state = settleDarknessConsumption(state, input); if (!alive) host.status = 'DEAD'; return input;
  };
  return { host, get state() { return state; }, move, laterWeek, run, acquire, compose, settle };
}

describe('Darkness finite materials: controlled component candidate, not executed evidence', () => {
  it('pins living679 and dead694 raw bytes without revising either history', () => {
    expect(hashFile(rawPath)).toBe(rawSha); expect(hashFile(deadPath)).toBe(deadSha);
    const s = JSON.parse(readFileSync(rawPath, 'utf8')) as SliceState;
    expect([s.revision, s.week, s.status, s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([680, 158, 'ACTIVE', 100, 97, 112, 400, 3]);
    const origin = actualOrigin(), before = stableStringify(origin), state = createDarknessMaterials(origin);
    expect(state.legacyRemains.map(r => [r.originalConsumeRevision, r.originalConsumeWeek])).toEqual([[555, 132], [584, 141]]);
    expect(state.characteristics.map(c => c.holder)).toEqual(['UNLOCATED', 'UNLOCATED', 'EMBODIED']);
    expect(state.characteristics[2]!.acquiredEventId).toBeNull(); expect(stableStringify(origin)).toBe(before);
    expect(hashFile(rawPath)).toBe(rawSha); expect(hashFile(deadPath)).toBe(deadSha);
  });
  it.each([1, 2, 3] as const)('accepts original%s success with each legitimate external custody branch', n => {
    for (const mode of ['SUPPLIER', 'PLAYER', 'FAILED_REMAINS', 'RECOVERED_SUCCESS'] as const) {
      const origin = controlledOrigin(n, mode), before = stableStringify(origin), r = harness(origin);
      expect(r.state.embodiedOriginalBottleId).toBe(original(n)); expect(r.state.characteristics.find(c => c.holder === 'EMBODIED')!.id).toBe(`${original(n)}:characteristic`);
      r.acquire(); r.compose(); expect(r.state.characteristics.filter(c => c.holder === 'COMPOUND')).toHaveLength(2);
      expect(r.state.compounds[0]!.characteristicIds).toEqual(DARKNESS_CHARACTERISTIC_BOTTLES.map(id => `${id}:characteristic`));
      r.settle(true, true); expect(r.state.characteristics.every(c => c.holder === 'FUSED')).toBe(true);
      expect(r.state.uniqueness).toMatchObject({ id: DARKNESS_UNIQUENESS_ID, holder: 'FUSED', incumbentActorId: origin.actorId });
      expect(stableStringify(origin)).toBe(before); expect(r.state.origin).toEqual(origin);
    }
  });
  it('keeps private actor, unseen original locations and raw custody labels out of public text', () => {
    const r = harness(), initial = stableStringify(projectDarknessMaterials(r.state));
    expect(initial).not.toContain(r.host.actorId); expect(initial).not.toContain('UNLOCATED'); expect(initial).not.toContain('EMBODIED');
    expect(initial).not.toContain('physicalLocation'); expect(initial).not.toContain('originalConsumeRevision');
    r.acquire(); r.compose(); r.settle(true, true);
    expect(stableStringify(projectDarknessMaterials(r.state))).not.toContain(r.host.actorId);
  });
  it('never launders an independent fourth bottle into a recovered original', () => {
    const origin = actualOrigin(); origin.bottles.push({ ...structuredClone(origin.bottles[0]!), id: 'misfortune-knight-potion-4' });
    expect(resolveMisfortuneKnightOriginalCharacteristicsSnapshot(origin)).toBeNull(); expect(() => createDarknessMaterials(origin)).toThrow('来源总量未解决');
    expect(origin.bottles.at(-1)!.id).toBe('misfortune-knight-potion-4'); expect(origin.bottles).toHaveLength(4);
  });
  it('charges no second purchase for inherited PLAYER inventory but requires actual handover', () => {
    const r = harness(controlledOrigin(2, 'PLAYER')), id = original(1), command = { type: 'ACQUIRE_CHARACTERISTIC', bottleId: id } as const;
    expect(darknessMaterialEffect(r.state, command).cashCost).toBe(0); const receipt = r.run(command);
    expect(receipt.effect.actions).toBe(1); expect(darknessMaterialBlock(r.state, command, r.host)).not.toBeNull();
    expect(darknessMaterialBlock(r.state, { type: 'ACQUIRE_CHARACTERISTIC', bottleId: original(2) }, r.host)).not.toBeNull();
  });
  it.each(['SUPPLIER', 'RECOVERY_SUPPLIER'] as const)('requires all five actual jobs for %s discount', mode => {
    const r = harness(controlledOrigin(3, mode)), item = r.state.characteristics.find(c => c.holder === 'SUPPLIER')!, command = { type: 'ACQUIRE_CHARACTERISTIC', bottleId: item.originBottleId } as const;
    r.move(LOC.supplier); const full = item.freshCarrier ? 900 : 6600, discounted = item.freshCarrier ? 90 : 1100;
    expect(darknessMaterialEffect(r.state, command).cashCost).toBe(full);
    for (const taskId of DARKNESS_LABOUR_TASKS.slice(0, 4)) { r.run({ type: 'MATERIAL_LABOUR', bottleId: item.originBottleId, taskId }); expect(darknessMaterialEffect(r.state, command).cashCost).toBe(full); }
    r.run({ type: 'MATERIAL_LABOUR', bottleId: item.originBottleId, taskId: DARKNESS_LABOUR_TASKS[4] });
    expect(darknessMaterialEffect(r.state, command).cashCost).toBe(discounted); expect(r.run(command).effect.cashCost).toBe(discounted);
  });
  it('does not locate remains with money alone, a forged command certificate, refusal or a blocked original room', () => {
    const r = harness(), c = { type: 'INVESTIGATE_LEGACY_REMAINS', bottleId: original(1) } as const;
    expect(darknessMaterialBlock(r.state, c, r.host)).not.toBeNull(); r.move(LOC.originalRoom);
    for (const patch of [{ roomAccessible: false }, { custodianAtSite: false }, { investigation: 'REFUSE' as const }, { investigation: 'UNVERIFIED' as const }]) {
      expect(darknessMaterialBlock(r.state, c, { ...r.host, legacyAccess: { ...r.host.legacyAccess!, ...patch } })).not.toBeNull();
    }
    expect(validateDarknessMaterialCommand({ ...c, verified: true })).toBe(false);
    const missing = structuredClone(r.state); missing.legacyRemains[0]!.residualPresent = false;
    expect(darknessMaterialBlock(missing, c, r.host)).not.toBeNull();
    const result = r.run(c); expect(result.effect).toMatchObject({ cashCost: 120, actions: 1 });
    expect(r.state.characteristics[0]!.holder).toBe('LOCATED'); expect(r.state.legacyRemains[0]!.residualPresent).toBe(true);
    const recover = { type: 'RECOVER_LEGACY_REMAINS', bottleId: original(1) } as const;
    expect(darknessMaterialBlock(r.state, recover, r.host)).not.toBeNull(); r.laterWeek();
    expect(darknessMaterialBlock(r.state, recover, { ...r.host, legacyAccess: { ...r.host.legacyAccess!, handover: 'REFUSE' } })).not.toBeNull();
    r.move(LOC.workshop); expect(darknessMaterialBlock(r.state, recover, r.host)).not.toBeNull(); r.move(LOC.originalRoom);
    expect(r.run(recover).effect).toMatchObject({ cashCost: 0, actions: 1 }); expect(r.state.legacyRemains[0]!.residualPresent).toBe(false);
    expect(darknessMaterialBlock(r.state, recover, r.host)).not.toBeNull();
  });
  it('requires real future date, actual termination, same separation, non-embodied custody and a current vacancy', () => {
    const r = harness(); r.move(LOC.archive); const chain = { type: 'VERIFY_UNIQUENESS', step: 'CHAIN' } as const;
    const past = { epoch: 'FIFTH_EPOCH' as const, year: 1352, month: 7, day: 1 };
    expect(darknessSuccessionAt(past)).toBeNull(); expect(darknessMaterialBlock(r.state, chain, { ...r.host, date: past })).not.toBeNull();
    for (const patch of [{ termination: null }, { separation: null }, { transfer: null }, { objectCount: 2 }, { predecessorStillEmbodied: true }, { incumbentActorId: DARKNESS_FUTURE_BRANCH.predecessorId }, { deliveryAllowed: false }]) {
      expect(darknessMaterialBlock(r.state, chain, { ...r.host, succession: { ...r.host.succession!, ...patch } })).not.toBeNull();
    }
    r.run(chain); r.move(LOC.vault); r.run({ type: 'VERIFY_UNIQUENESS', step: 'VACANCY' }); r.laterWeek();
    expect(darknessMaterialBlock(r.state, { type: 'ACQUIRE_UNIQUENESS' }, r.host)).not.toBeNull();
    r.run({ type: 'VERIFY_UNIQUENESS', step: 'VACANCY' }); expect(r.run({ type: 'ACQUIRE_UNIQUENESS' }).effect.cashCost).toBe(240);
    expect(darknessMaterialBlock(r.state, { type: 'ACQUIRE_UNIQUENESS' }, r.host)).not.toBeNull();
  });
  it('does not compose from reports alone, an unhanded original or the embodied original twice', () => {
    const r = harness(); r.acquire(); r.move(LOC.supplier); r.run({ type: 'BUY_COMPOUND', batchId: 'darkness-carrier-1' }); r.move(LOC.workshop);
    const c = { type: 'COMPOSE_POTION', batchId: 'darkness-carrier-1' } as const;
    expect(darknessMaterialBlock(r.state, c, { ...r.host, verifiedReceipts: [] })).not.toBeNull();
    const copy = structuredClone(r.state); copy.characteristics[0]!.acquiredEventId = null; expect(darknessMaterialBlock(copy, c, r.host)).not.toBeNull();
    const doubled = structuredClone(r.state); doubled.characteristics[2]!.holder = 'PLAYER'; expect(darknessMaterialBlock(doubled, c, r.host)).not.toBeNull();
    r.run(c); expect(r.state.characteristics[2]!.holder).toBe('EMBODIED');
  });
  it('preserves two external remnants after failure, supports0AP sealing, and charges later-week recovery', () => {
    const r = harness(), old = stableStringify(r.state.origin); r.acquire(); r.compose(); const settlement = r.settle(false, true), p = r.state.compounds[0]!;
    expect(r.state.characteristics.map(c => c.holder)).toEqual(['EXPOSED', 'EXPOSED', 'EMBODIED']);
    expect(() => settleDarknessConsumption(r.state, settlement)).toThrow(); r.host.actions = 0; r.host.cash = 0;
    r.run({ type: 'SEAL_REMAINS', compoundId: p.id }); expect(r.state.characteristics[0]!.holder).toBe('SEALED');
    const recover = { type: 'RECOVER_SEALED', compoundId: p.id } as const;
    expect(darknessMaterialBlock(r.state, recover, r.host)).not.toBeNull(); r.laterWeek(); r.host.cash = 120;
    r.move(LOC.archive); expect(darknessMaterialBlock(r.state, recover, r.host)).not.toBeNull();
    expect(r.state.characteristics[0]!.location).toBe(LOC.workshop); r.move(LOC.workshop);
    expect(r.run(recover).effect).toMatchObject({ cashCost: 120, actions: 1 });
    expect(r.state.characteristics.map(c => c.holder)).toEqual(['PLAYER', 'PLAYER', 'EMBODIED']); expect(r.state.batches[0]!.status).toBe('SPENT');
    expect(stableStringify(r.state.origin)).toBe(old); expect(r.state.uniqueness.id).toBe(DARKNESS_UNIQUENESS_ID);
  });
  it('loses player control on death and refuses resurrection or residual movement', () => {
    const r = harness(); r.acquire(); r.compose(); r.settle(false, false);
    expect(r.state.characteristics.every(c => c.holder === 'LOST' && c.location === LOC.workshop)).toBe(true); expect(r.state.uniqueness.holder).toBe('LOST');
    expect(darknessMaterialBlock(r.state, { type: 'SEAL_REMAINS', compoundId: 'darkness-compound-1' }, r.host)).not.toBeNull();
    r.move(LOC.originalRoom); expect(r.state.characteristics.every(c => c.location === LOC.workshop)).toBe(true);
  });
  it('uses exactly three paid carriers with no refill or fourth compound', () => {
    const r = harness(); r.acquire();
    for (const batchId of ['darkness-carrier-1', 'darkness-carrier-2', 'darkness-carrier-3'] as const) {
      r.compose(batchId); r.settle(false, true); const p = r.state.compounds.at(-1)!;
      r.run({ type: 'SEAL_REMAINS', compoundId: p.id }); r.laterWeek(); r.run({ type: 'RECOVER_SEALED', compoundId: p.id });
    }
    expect(r.state.batches.every(b => b.uses === 1 && b.status === 'SPENT')).toBe(true); expect(r.state.compounds).toHaveLength(3);
    expect(validateDarknessMaterialCommand({ type: 'REQUEST_COMPOUND_REPAIR', batchId: 'darkness-carrier-1' })).toBe(false);
    expect(validateDarknessMaterialCommand({ type: 'BUY_COMPOUND', batchId: 'darkness-carrier-4' })).toBe(false);
    expect(projectDarknessMaterials(r.state).lines.some(x => x.includes('剩余0件'))).toBe(true);
  });
  it('costs exactly1328 on the real two-remnant first route, before travel and living', () => {
    const r = harness(), before = r.host.cash; r.acquire(); r.compose();
    expect(before - r.host.cash).toBe(1020); expect(before - r.host.cash + 100 + 108 + DARKNESS_STABILITY.cash).toBe(1328);
    expect(1328 - 400).toBe(928); expect(Math.ceil(928 / (180 - 30))).toBe(7);
    expect(120 + 390 + 120 + 100 + 60).toBe(790);
  });
  it('keeps the approved70% and real lethal resource deltas as engine integration constants', () => {
    expect(computeCheckChance({ baseAbility: 31, difficulty: DARKNESS_CONSUMPTION.difficulty, modifiers: [{ source: '本瓶付费稳定准备', value: DARKNESS_CONSUMPTION.bonus }] })).toBe(70);
    expect(computeCheckChance({ baseAbility: 32, difficulty: DARKNESS_CONSUMPTION.difficulty, modifiers: [{ source: '本瓶付费稳定准备', value: DARKNESS_CONSUMPTION.bonus }] })).toBe(72);
    expect(DARKNESS_STABILITY).toMatchObject({ cash: 100, actions: 1, spirituality: 12, mind: 8, validSeconds: 604800 });
    expect(DARKNESS_CONSUMPTION).toMatchObject({ spirituality: 30, successMind: 12, failureHealth: 45, failureMind: 40, failurePollution: 35, greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70 });
  });
});
