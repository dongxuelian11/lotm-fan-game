import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createArcaneScholarState } from '../../src/domain/arcane-scholar/index.js';
import {
  applyArcaneScholarActivity, arcaneScholarLifeActions, blockArcaneScholarActivity, createArcaneScholarLifeState,
  findArcaneScholarOriginalCreation, hasArcaneScholarLifeLock, projectArcaneScholarLife,
  validateArcaneScholarActivityCommand, validateArcaneScholarLife, type ArcaneScholarActivityCommand, type ArcaneScholarCaseId,
} from '../../src/domain/arcane-scholar/life.js';
const ANALYSIS = 'paragon.s3.bounded-analysis', LINK = 'paragon.s3.construct-coordination';
const natural = JSON.parse(readFileSync(new URL('../fixtures/alchemist-v01200/natural.json', import.meta.url), 'utf8')) as { final: SliceState; commands: unknown[] };
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Narrow S3 unit fixture; old originals/history are copied exactly from the genuine 352-command S4 run. */
function ready(): SliceState {
  const s = createSliceRun(natural.final.runId, sliceDefaultCreationSelection, 'arcane-life-unit');
  s.alchemist = structuredClone(natural.final.alchemist); s.runId = natural.final.runId;
  s.arcaneScholar = createArcaneScholarState(); s.arcaneScholar.promotionWeek = 99; s.week = 100;
  s.progression = { ...structuredClone(natural.final.progression), sequence: 3, acting: 0, mastery: { ...natural.final.progression.mastery, [ANALYSIS]: 0, [LINK]: 0 } };
  s.seer.completedSources = [...natural.final.seer.completedSources];
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000;
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
function act(s: SliceState, c: ArcaneScholarActivityCommand, roll = 1) { const ctx = context(s, roll); applyArcaneScholarActivity(s, c, ctx); expect(validateArcaneScholarLife(s)).toBe(true); return ctx; }
function reject(s: SliceState, c: ArcaneScholarActivityCommand) { const before = structuredClone(s); expect(() => applyArcaneScholarActivity(s, c, context(s))).toThrow(); expect(s).toEqual(before); }
function begin(s: SliceState, caseId: ArcaneScholarCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') { if (s.arcaneScholar.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'PREPARE', caseId, method }); act(s, { type: 'PERFORM', caseId }); }
function clean(s: SliceState, caseId: ArcaneScholarCaseId, report = true) {
  const a = s.arcaneScholar.life.cases[caseId].attempts.at(-1)!;
  if (a.linkRemainingSeconds > 0) act(s, { type: 'STOP_LINK', caseId });
  if (a.noteTaken && !a.noteReturned) act(s, { type: 'RETURN_NOTE', caseId });
  if (a.fuseId && s.arcaneScholar.life.fuses.find(f => f.id === a.fuseId)?.location === 'LOAD_DEVICE') act(s, { type: 'RECYCLE_FUSE', caseId });
  act(s, { type: 'RETURN_ORIGINALS', caseId }); act(s, { type: 'CLOSE', caseId }); if (report) act(s, { type: 'REPORT', caseId });
}
function measure(s: SliceState) { for (const type of ['READ_RECORDS', 'MEASURE_BASELINE', 'MEASURE_BASELINE'] as const) act(s, { type, caseId: 'tolerance-map' }); }
function tolerance(s: SliceState, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY', roll = 1) { begin(s, 'tolerance-map', method); measure(s); act(s, { type: method === 'ABILITY' ? 'ANALYZE' : 'COMPARE_READINGS', caseId: 'tolerance-map' }, roll); if (s.arcaneScholar.life.cases['tolerance-map'].result === 'NONE') act(s, { type: 'COMPARE_READINGS', caseId: 'tolerance-map' }); clean(s, 'tolerance-map'); }
function transfer(s: SliceState) { begin(s, 'timed-transfer'); for (const type of ['CONSENT', 'TAKE_NOTE', 'CARRY_NOTE'] as const) act(s, { type, caseId: 'timed-transfer' }); clean(s, 'timed-transfer'); }
function toFault(s: SliceState, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') { tolerance(s); transfer(s); begin(s, 'fault-isolation', method); }
function frame(s: SliceState) { return findArcaneScholarOriginalCreation(s, 'AL4-FRAME-1')!; }
function box(s: SliceState) { return findArcaneScholarOriginalCreation(s, 'AL4-BOX-1')!; }
function fillFrame(s: SliceState) { act(s, { type: 'RECHARGE', objectId: 'AL4-FRAME-1' }); }

describe('Arcane Scholar finite research with genuine original S4 creations', () => {
  it('starts with exactly the real original box2/frame0, original dead enemy and returned owner materials', () => {
    const s = ready(); expect(natural.commands).toHaveLength(352); expect(s.arcaneScholar.life).toEqual(createArcaneScholarLifeState());
    expect(s.arcaneScholar.life).not.toHaveProperty('creations'); expect(box(s)).toMatchObject({ id: 'AL4-BOX-1', charge: 2, durability: 100, location: 'PLAYER', active: false });
    expect(frame(s)).toMatchObject({ id: 'AL4-FRAME-1', charge: 0, durability: 95, location: 'PLAYER', active: false });
    expect(s.alchemist.encounter.enemy).toMatchObject({ id: 'AL4-OSRIC', status: 'DEAD', health: 0, weaponLocation: 'YARD' });
    expect(s.alchemist.life.parcel).toMatchObject({ custodian: 'AL4-HELENA', location: 'OWNER' }); expect(s.alchemist.life.entrustedMaterial.location).toBe('OWNER'); expect(validateArcaneScholarLife(s)).toBe(true);
  });
  it('reserves implementation AP, and a cancelled preparation refunds nothing or spawns nothing', () => {
    const s = ready(); act(s, { type: 'OBSERVE', caseId: 'tolerance-map' }); s.actionsRemaining = 1;
    reject(s, { type: 'PREPARE', caseId: 'tolerance-map', method: 'ABILITY' }); s.actionsRemaining = 2; act(s, { type: 'PREPARE', caseId: 'tolerance-map', method: 'ABILITY' });
    const before = structuredClone(s.alchemist); expect(hasArcaneScholarLifeLock(s)).toBe(true); s.actionsRemaining = 0; act(s, { type: 'WITHDRAW', caseId: 'tolerance-map' });
    expect(s.actionsRemaining).toBe(0); expect(s.alchemist).toEqual(before); expect(hasArcaneScholarLifeLock(s)).toBe(false);
  });
  it('performs two actual baseline journeys before finite analysis; repeated readings cannot farm rolls', () => {
    const s = ready(), originals = s.alchemist.life.creations; begin(s, 'tolerance-map', 'ABILITY');
    expect(box(s).location).toBe('BENCH_START'); expect(frame(s).location).toBe('GUARD_MARK'); reject(s, { type: 'ANALYZE', caseId: 'tolerance-map' });
    act(s, { type: 'READ_RECORDS', caseId: 'tolerance-map' }); reject(s, { type: 'READ_RECORDS', caseId: 'tolerance-map' });
    act(s, { type: 'MEASURE_BASELINE', caseId: 'tolerance-map' }); reject(s, { type: 'ANALYZE', caseId: 'tolerance-map' }); act(s, { type: 'MEASURE_BASELINE', caseId: 'tolerance-map' }); reject(s, { type: 'MEASURE_BASELINE', caseId: 'tolerance-map' });
    const a = s.arcaneScholar.life.cases['tolerance-map'].attempts[0]!; expect(a).toMatchObject({ recordsRead: true, boxTravelMetres: 8, ownerTravelMetres: 8, elapsedSeconds: 56 });
    expect(a.baselines).toEqual([{ sample: 1, boxTravelMetres: 4, transferSeconds: 8, openingMm: 18 }, { sample: 2, boxTravelMetres: 4, transferSeconds: 9, openingMm: 17 }]);
    const ctx = act(s, { type: 'ANALYZE', caseId: 'tolerance-map' }); expect(ctx.check).toHaveBeenCalledWith('knowledge', 16); expect(s.spirituality).toBe(116); expect(a.boundedSetting).toContain('17毫米');
    reject(s, { type: 'ANALYZE', caseId: 'tolerance-map' }); reject(s, { type: 'CLOSE', caseId: 'tolerance-map' }); clean(s, 'tolerance-map');
    expect(s.alchemist.life.creations).toBe(originals); expect(s.progression.mastery[ANALYSIS]).toBe(8); expect(s.progression.mastery[LINK]).toBe(0); expect(box(s).charge).toBe(2); expect(frame(s).charge).toBe(0);
  });
  it('keeps failed analysis cost and completes ordinary comparison without another check or old mastery award', () => {
    const s = ready(), oldMastery = { ...s.progression.mastery }, oldSources = [...s.seer.completedSources]; begin(s, 'tolerance-map', 'ABILITY'); measure(s);
    act(s, { type: 'ANALYZE', caseId: 'tolerance-map' }, 100); expect(s.spirituality).toBe(116); expect(s.arcaneScholar.life.cases['tolerance-map'].attempts[0]!.boundedSetting).toBeNull(); reject(s, { type: 'ANALYZE', caseId: 'tolerance-map' });
    const ctx = act(s, { type: 'COMPARE_READINGS', caseId: 'tolerance-map' }); expect(ctx.check).not.toHaveBeenCalled(); clean(s, 'tolerance-map'); expect(s.progression.mastery).toEqual(oldMastery); expect(s.seer.completedSources).toEqual(oldSources); expect(s.progression.acting).toBe(25);
  });
  it('pays every recharge with a consumed original material and never repairs durability or changes the old ledger', () => {
    const s = ready(), same = frame(s), oldCount = s.alchemist.life.rechargeCount; fillFrame(s);
    expect(frame(s)).toBe(same); expect(same).toMatchObject({ charge: 3, durability: 95, active: false }); expect(s.cash).toBe(960); expect(s.spirituality).toBe(117); expect(s.actionsRemaining).toBe(99); expect(s.alchemist.life.rechargeCount).toBe(oldCount);
    act(s, { type: 'RECHARGE', objectId: 'AL4-BOX-1' }); expect(s.arcaneScholar.life.recharges.map(v => [v.objectId, v.previousCharge, v.resultingCharge, v.materialConsumed])).toEqual([['AL4-FRAME-1', 0, 3, true], ['AL4-BOX-1', 2, 3, true]]);
    expect(new Set(s.arcaneScholar.life.recharges.map(v => v.materialId)).size).toBe(2); reject(s, { type: 'RECHARGE', objectId: 'AL4-BOX-1' });
  });
  it('rejects insufficient recharge resources, damaged originals, and recharge at a live scene', () => {
    const s = ready(); s.cash = 39; reject(s, { type: 'RECHARGE', objectId: 'AL4-FRAME-1' }); s.cash = 1000; s.spirituality = 2; reject(s, { type: 'RECHARGE', objectId: 'AL4-FRAME-1' }); s.spirituality = 120;
    frame(s).durability = 0; reject(s, { type: 'RECHARGE', objectId: 'AL4-FRAME-1' }); frame(s).durability = 95; begin(s, 'tolerance-map'); reject(s, { type: 'RECHARGE', objectId: 'AL4-FRAME-1' });
  });
  it('requires new current owner consent and cannot borrow old Helena parcel or assume consent from the prior case', () => {
    const s = ready(); tolerance(s); begin(s, 'timed-transfer'); reject(s, { type: 'TAKE_NOTE', caseId: 'timed-transfer' });
    act(s, { type: 'CONSENT', caseId: 'timed-transfer' }); act(s, { type: 'TAKE_NOTE', caseId: 'timed-transfer' }); expect(s.arcaneScholar.life.note).toMatchObject({ id: 'AR3-TEST-NOTE', owner: 'AR3-NELL', custodian: 'PLAYER', location: 'BENCH_START' });
    reject(s, { type: 'TAKE_NOTE', caseId: 'timed-transfer' }); act(s, { type: 'CARRY_NOTE', caseId: 'timed-transfer' }); clean(s, 'timed-transfer'); begin(s, 'fault-isolation'); reject(s, { type: 'TRIGGER_LOAD', caseId: 'fault-isolation' });
    expect(s.alchemist.life.parcel.location).toBe('OWNER'); expect(s.alchemist.life.entrustedMaterial.location).toBe('OWNER');
  });
  it('successful coordination spends the old resources and physically moves only the same paper and box 2m', () => {
    const s = ready(); tolerance(s); fillFrame(s); const oldSP = s.spirituality; begin(s, 'timed-transfer', 'ABILITY');
    for (const type of ['CONSENT', 'TAKE_NOTE', 'START_LINK'] as const) act(s, { type, caseId: 'timed-transfer' });
    expect(box(s).charge).toBe(1); expect(frame(s).charge).toBe(2); expect(s.spirituality).toBe(oldSP - 5); expect(s.arcaneScholar.life.note.location).toBe('BENCH_START');
    reject(s, { type: 'START_LINK', caseId: 'timed-transfer' }); act(s, { type: 'MOVE_NOTE', caseId: 'timed-transfer' });
    expect(box(s).location).toBe('BENCH_END'); expect(frame(s).location).toBe('GUARD_MARK'); expect(s.arcaneScholar.life.note).toMatchObject({ custodian: 'AL4-BOX-1', location: 'BENCH_END' });
    expect(s.arcaneScholar.life.cases['timed-transfer'].attempts[0]).toMatchObject({ boxTravelMetres: 2, ownerTravelMetres: 0, linkRemainingSeconds: 20 });
    reject(s, { type: 'MOVE_NOTE', caseId: 'timed-transfer' }); reject(s, { type: 'RETURN_NOTE', caseId: 'timed-transfer' }); reject(s, { type: 'RETURN_ORIGINALS', caseId: 'timed-transfer' }); clean(s, 'timed-transfer');
    expect(s.arcaneScholar.life.note.location).toBe('OWNER'); expect(s.arcaneScholar.life.cases['timed-transfer'].attempts[0]!.ownerTravelMetres).toBe(8); expect(s.progression.mastery[LINK]).toBe(8);
  });
  it('the last single stored charge funds one paid window without granting old animation or free refills', () => {
    const s = ready(); tolerance(s); box(s).charge = 1; frame(s).charge = 1; begin(s, 'timed-transfer', 'ABILITY'); for (const type of ['CONSENT', 'TAKE_NOTE', 'START_LINK', 'MOVE_NOTE'] as const) act(s, { type, caseId: 'timed-transfer' });
    expect(box(s)).toMatchObject({ charge: 0, active: false }); expect(frame(s)).toMatchObject({ charge: 0, active: false }); clean(s, 'timed-transfer'); expect(s.arcaneScholar.life.recharges).toEqual([]);
  });
  it('failed coordination keeps 5SP and each original charge, then the owner carries the paper out and back normally', () => {
    const s = ready(); tolerance(s); fillFrame(s); begin(s, 'timed-transfer', 'ABILITY'); for (const type of ['CONSENT', 'TAKE_NOTE'] as const) act(s, { type, caseId: 'timed-transfer' });
    act(s, { type: 'START_LINK', caseId: 'timed-transfer' }, 100); const paid = s.spirituality; reject(s, { type: 'START_LINK', caseId: 'timed-transfer' }); reject(s, { type: 'MOVE_NOTE', caseId: 'timed-transfer' });
    const ctx = act(s, { type: 'CARRY_NOTE', caseId: 'timed-transfer' }); expect(ctx.check).not.toHaveBeenCalled(); expect(box(s).location).toBe('BENCH_START'); expect(s.arcaneScholar.life.ownerNode).toBe('BENCH_END'); act(s, { type: 'RETURN_NOTE', caseId: 'timed-transfer' }); expect(s.arcaneScholar.life.ownerNode).toBe('BENCH_START'); clean(s, 'timed-transfer');
    expect(s.spirituality).toBe(paid); expect(s.progression.mastery[LINK]).toBe(0); expect(s.arcaneScholar.life.cases['timed-transfer'].attempts[0]).toMatchObject({ result: 'ORDINARY', ownerTravelMetres: 6, boxTravelMetres: 0, boxChargeSpent: 1, frameChargeSpent: 1 });
  });
  it('zero charge or damaged original bodies still permit all ordinary research without fabrication', () => {
    const s = ready(); const ids = s.alchemist.life.creations.map(v => v.id); box(s).charge = 0; box(s).durability = 0; frame(s).durability = 0;
    tolerance(s); transfer(s); begin(s, 'fault-isolation'); for (const type of ['CONSENT', 'TRIGGER_LOAD', 'MANUAL_STOP'] as const) act(s, { type, caseId: 'fault-isolation' }); clean(s, 'fault-isolation'); act(s, { type: 'REFLECT' });
    expect(s.alchemist.life.creations.map(v => v.id)).toEqual(ids); expect(box(s)).toMatchObject({ charge: 0, durability: 0 }); expect(frame(s)).toMatchObject({ charge: 0, durability: 0 }); expect(s.progression.acting).toBe(100); expect(s.progression.mastery[LINK]).toBe(0); expect(s.spirituality).toBe(120); expect(s.cash).toBe(980);
  });
  it('requires actual fault triggering before stopping and spends the unique20p fuse rather than inventing a failure', () => {
    const s = ready(); toFault(s); expect(s.cash).toBe(980); expect(s.arcaneScholar.life.fuses[0]).toMatchObject({ id: 'AR3-FUSE-1', consumed: false, location: 'LOAD_DEVICE' }); reject(s, { type: 'MANUAL_STOP', caseId: 'fault-isolation' }); reject(s, { type: 'STOP_LOAD', caseId: 'fault-isolation' });
    act(s, { type: 'CONSENT', caseId: 'fault-isolation' }); act(s, { type: 'TRIGGER_LOAD', caseId: 'fault-isolation' }); expect(s.arcaneScholar.life.load.status).toBe('RUNNING'); expect(s.arcaneScholar.life.fuses[0]!.consumed).toBe(true); reject(s, { type: 'TRIGGER_LOAD', caseId: 'fault-isolation' }); reject(s, { type: 'RECYCLE_FUSE', caseId: 'fault-isolation' });
    act(s, { type: 'MANUAL_STOP', caseId: 'fault-isolation' }); clean(s, 'fault-isolation'); expect(s.arcaneScholar.life.fuses[0]).toMatchObject({ consumed: true, location: 'RECYCLING_BOX' }); expect(frame(s).durability).toBe(95);
  });
  it('a failed ability stop loses frame durability and costs, but the zero-resource original handle remains a real exit', () => {
    const s = ready(); fillFrame(s); toFault(s, 'ABILITY'); for (const type of ['CONSENT', 'TRIGGER_LOAD'] as const) act(s, { type, caseId: 'fault-isolation' });
    act(s, { type: 'STOP_LOAD', caseId: 'fault-isolation' }, 100); expect(frame(s)).toMatchObject({ durability: 90, charge: 2 }); expect(box(s).charge).toBe(1); expect(s.spirituality).toBe(112); expect(s.arcaneScholar.life.load.status).toBe('RUNNING'); reject(s, { type: 'STOP_LOAD', caseId: 'fault-isolation' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; const ctx = act(s, { type: 'MANUAL_STOP', caseId: 'fault-isolation' }); expect(ctx.check).not.toHaveBeenCalled(); clean(s, 'fault-isolation', false);
    expect(hasArcaneScholarLifeLock(s)).toBe(false); expect(frame(s).durability).toBe(90); expect(s.cash).toBe(940); expect(s.arcaneScholar.life.fuses[0]!.consumed).toBe(true); expect(s.progression.mastery[LINK]).toBe(0);
  });
  it('successful stop uses the real pair and preserves the same stopped device, fuse and exact new mastery', () => {
    const s = ready(); fillFrame(s); toFault(s, 'ABILITY'); for (const type of ['CONSENT', 'TRIGGER_LOAD', 'STOP_LOAD'] as const) act(s, { type, caseId: 'fault-isolation' });
    expect(s.arcaneScholar.life.load).toMatchObject({ deviceId: 'AL4-PAD-1', status: 'STOPPED' }); expect(frame(s).durability).toBe(95); reject(s, { type: 'RECYCLE_FUSE', caseId: 'fault-isolation' }); clean(s, 'fault-isolation'); expect(s.progression.mastery[LINK]).toBe(8); expect(s.arcaneScholar.life.fuses[0]!.location).toBe('RECYCLING_BOX');
  });
  it('untriggered cancellation recycles the purchased original fuse without claiming consumption or a study result', () => {
    const s = ready(); toFault(s); const oldFrame = frame(s).durability; act(s, { type: 'RECYCLE_FUSE', caseId: 'fault-isolation' }); act(s, { type: 'RETURN_ORIGINALS', caseId: 'fault-isolation' }); act(s, { type: 'WITHDRAW', caseId: 'fault-isolation' });
    expect(s.arcaneScholar.life.fuses[0]).toMatchObject({ consumed: false, location: 'RECYCLING_BOX' }); expect(s.arcaneScholar.life.cases['fault-isolation'].result).toBe('NONE'); expect(s.cash).toBe(980); expect(frame(s).durability).toBe(oldFrame);
    reject(s, { type: 'PREPARE', caseId: 'fault-isolation', method: 'ORDINARY' }); s.week++; begin(s, 'fault-isolation'); expect(s.arcaneScholar.life.fuses[1]).toMatchObject({ id: 'AR3-FUSE-2', paidPennies: 20, consumed: false }); expect(s.cash).toBe(960);
  });
  it('does not permit report/reflect replay or mastery awards from ordinary paths', () => {
    const s = ready(), old = { ...s.progression.mastery }; toFault(s); for (const type of ['CONSENT', 'TRIGGER_LOAD', 'MANUAL_STOP'] as const) act(s, { type, caseId: 'fault-isolation' }); clean(s, 'fault-isolation'); act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(old); reject(s, { type: 'REPORT', caseId: 'fault-isolation' }); reject(s, { type: 'REFLECT' });
  });
  it('prevents simultaneous cases, extra sources, and a forged maker or component record', () => {
    const s = ready(); begin(s, 'tolerance-map'); reject(s, { type: 'OBSERVE', caseId: 'timed-transfer' }); reject(s, { type: 'REFLECT' });
    const original = box(s); original.madeBy = 'FORGED'; expect(findArcaneScholarOriginalCreation(s, 'AL4-BOX-1')).toBeNull(); expect(validateArcaneScholarLife(s)).toBe(false); original.madeBy = s.runId; original.componentIds = ['FORGED']; expect(findArcaneScholarOriginalCreation(s, 'AL4-BOX-1')).toBeNull();
    for (const bad of [{ type: 'RECHARGE', objectId: 'AL4-BOX-1', amount: 99 }, { type: 'RECHARGE', objectId: 'COPY-BOX' }, { type: 'ANALYZE', caseId: 'tolerance-map', result: 'SUCCESS' }, { type: 'CONSENT', personId: 'AL4-HELENA' }, { type: 'WAIT' }]) expect(validateArcaneScholarActivityCommand(bad)).toBe(false);
  });
  it('rejects fabricated baselines, free charge costs, source rewrites, extra fields and failed-return saves', () => {
    const s = ready(); tolerance(s); fillFrame(s); begin(s, 'timed-transfer', 'ABILITY'); for (const type of ['CONSENT', 'TAKE_NOTE', 'START_LINK', 'MOVE_NOTE'] as const) act(s, { type, caseId: 'timed-transfer' });
    const original = structuredClone(s.arcaneScholar.life);
    s.arcaneScholar.life.cases['tolerance-map'].attempts[0]!.baselines[0]!.openingMm = 17; expect(validateArcaneScholarLife(s)).toBe(false); s.arcaneScholar.life = structuredClone(original);
    s.arcaneScholar.life.cases['timed-transfer'].attempts[0]!.boxChargeSpent = 0; expect(validateArcaneScholarLife(s)).toBe(false); s.arcaneScholar.life = structuredClone(original);
    s.arcaneScholar.life.recharges[0]!.source = 'FREE'; expect(validateArcaneScholarLife(s)).toBe(false); s.arcaneScholar.life = structuredClone(original);
    s.arcaneScholar.life.note.location = 'OWNER'; expect(validateArcaneScholarLife(s)).toBe(false); s.arcaneScholar.life = structuredClone(original);
    Object.assign(s.arcaneScholar.life, { creations: [] }); expect(validateArcaneScholarLife(s)).toBe(false);
  });
  it('projects copies of original resources and concrete readings without mutating originals or inventing settings', () => {
    const s = ready(); begin(s, 'tolerance-map', 'ABILITY'); const initial = projectArcaneScholarLife(s); expect(initial.currentAttempt?.boundedSetting).toBeNull(); expect(initial.currentAttempt?.baselines).toEqual([]);
    expect(initial.source).toContain('跨段推定'); expect(initial.source).toContain('原创G'); measure(s); const p = projectArcaneScholarLife(s); expect(p.currentAttempt?.baselines).toHaveLength(2); expect(p.creations).toHaveLength(2); p.creations[0]!.charge = 99; expect(box(s).charge).toBe(2);
    expect(p.actions.find(v => v.command.type === 'RETURN_ORIGINALS')?.enabled).toBe(true); expect(blockArcaneScholarActivity(s, { type: 'REFLECT' })).not.toBeNull();
    const pristine = ready(); pristine.progression.sequence = 4; expect(arcaneScholarLifeActions(pristine)).toEqual([]); expect(validateArcaneScholarLife(pristine)).toBe(true); pristine.arcaneScholar.life.reflected = true; expect(validateArcaneScholarLife(pristine)).toBe(false);
  });
});
