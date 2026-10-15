import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { projectKnowledgeMentorLife, validateKnowledgeMentorLife, findKnowledgeMentorOriginalCreation, validateKnowledgeMentorActivityCommand } from '../../src/domain/knowledge-mentor/life.js';
import { attempt, beginCase, closeCase, directedLifeReady, directedPracticed, install, km, measure, ordinaryCase, recharge, rejectKm, unitBudget } from './knowledge-mentor-test-fixture.js';
import type { SliceState } from '../../src/domain/slice/types.js';
const BIND = 'paragon.s2.protocol-binding', CALIBRATE = 'paragon.s2.bounded-calibration';
const doc = 'documented-cycle', parcel = 'consented-transfer', blocked = 'blocked-cycle';
const pair = (s: SliceState) => s.alchemist.life.creations.map(x => [x.id, x.charge, x.durability, x.location]);
function activeDocument() { return measure(beginCase(recharge(directedLifeReady()), doc), doc); }
function activeTransfer() { return measure(beginCase(recharge(ordinaryCase(directedLifeReady(), doc)), parcel), parcel); }
function activeBlocked() { let s = ordinaryCase(directedLifeReady(), doc); s = ordinaryCase(s, parcel); return measure(beginCase(recharge(s), blocked), blocked); }
function stoppedCleanup(s: SliceState) {
  for (let i = attempt(s).completedSteps; i < 3; i++) s = km(s, { type: 'MANUAL_STEP', caseId: doc });
  return closeCase(s, doc);
}

describe('Knowledge Mentor finite physical workshop, directed legal setup and public commands', () => {
  it('requires separately paid observation, preparation and deployment and locks ordinary life', () => {
    let s = directedLifeReady(); const before = structuredClone(s); s = km(s, { type: 'OBSERVE', caseId: doc });
    expect(s.actionsRemaining).toBe(before.actionsRemaining - 1);
    s = km(s, { type: 'PREPARE', caseId: doc, method: 'ABILITY' }); expect(s.actionsRemaining).toBe(1);
    s = km(s, { type: 'PERFORM', caseId: doc }); expect(s.actionsRemaining).toBe(0);
    expect(s.week).toBe(before.week); expect(projectSliceState(s).canAct).toBe(false);
    expect(() => applySliceIntent(s, { type: 'ACTION', action: 'REST' })).toThrow(); rejectKm(s, { type: 'RECHARGE', objectId: 'AL4-FRAME-1' });
    expect(pair(s).map(x => x[3])).toEqual(['BENCH_START', 'GUARD_MARK']); expect(attempt(s).elapsedSeconds).toBe(6);
    rejectKm(s, { type: 'CLOSE', caseId: doc });
  });

  it('requires real records and two independent baseline observations before the paid original blank', () => {
    let s = beginCase(directedLifeReady(), doc); rejectKm(s, { type: 'MEASURE_BASELINE', caseId: doc }); rejectKm(s, { type: 'BUY_PLATE', caseId: doc });
    s = km(s, { type: 'READ_RECORDS', caseId: doc }); s = km(s, { type: 'MEASURE_BASELINE', caseId: doc });
    rejectKm(s, { type: 'BUY_PLATE', caseId: doc }); s = km(s, { type: 'MEASURE_BASELINE', caseId: doc }); rejectKm(s, { type: 'MEASURE_BASELINE', caseId: doc });
    expect(attempt(s)).toMatchObject({ recordsRead: true, elapsedSeconds: 56, boxTravelMetres: 8, ownerTravelMetres: 8 });
    expect(attempt(s).baselines).toEqual([{ sample: 1, boxTravelMetres: 4, transferSeconds: 8, openingMm: 18 }, { sample: 2, boxTravelMetres: 4, transferSeconds: 9, openingMm: 17 }]);
    const before = structuredClone(s); s = km(s, { type: 'BUY_PLATE', caseId: doc });
    expect(s.cash).toBe(before.cash - 60); expect(attempt(s).plate).toMatchObject({ id: 'KM2-PLATE-1-1', paidPennies: 60, status: 'BLANK', location: 'PLAYER', boundObjectIds: [] });
    expect(s.alchemist.life.creations).toEqual(before.alchemist.life.creations); rejectKm(s, { type: 'BUY_PLATE', caseId: doc });
  });

  it('charges binding and actual start separately, spends both original charges and executes only real three steps', () => {
    let s = activeDocument(), before = structuredClone(s); s = install(s, doc);
    expect(s.cash).toBe(before.cash - 60); expect(s.spirituality).toBe(before.spirituality - 4); expect(pair(s)).toEqual(pair(before));
    before = structuredClone(s); s = km(s, { type: 'START_PROGRAM', caseId: doc }, 1);
    expect(s.spirituality).toBe(before.spirituality - 5); expect(s.alchemist.life.creations.map(x => x.charge)).toEqual(before.alchemist.life.creations.map(x => x.charge - 1));
    expect(attempt(s)).toMatchObject({ programActive: true, programRemainingSeconds: 45, completedSteps: 0, automaticSteps: 0, plate: { status: 'SPENT', location: 'CONTROL' } });
    rejectKm(s, { type: 'START_PROGRAM', caseId: doc }); rejectKm(s, { type: 'VERIFY', caseId: doc });
    for (let i = 0; i < 3; i++) s = km(s, { type: 'PROGRAM_STEP', caseId: doc });
    expect(attempt(s)).toMatchObject({ programActive: false, programEnd: 'COMPLETE', completedSteps: 3, automaticSteps: 3, boxTravelMetres: 10 });
    expect(s.alchemist.life.creations[0]!.location).toBe('BENCH_END'); expect(attempt(s).ownerNode).toBe('BENCH_START');
    s = closeCase(s, doc); expect(attempt(s)).toMatchObject({ result: 'ABILITY', plate: { location: 'RECYCLE', status: 'SPENT' }, originalsReturned: true });
    expect(s.progression.mastery[BIND]).toBe(8); expect(s.progression.acting).toBe(25);
  });

  it.each(['BIND_PLATE', 'START_PROGRAM'] as const)('keeps failed %s material and costs and completes through actual ordinary hand controls', type => {
    let s = activeDocument(); s = km(s, { type: 'BUY_PLATE', caseId: doc });
    if (type === 'START_PROGRAM') { s = km(s, { type: 'BIND_PLATE', caseId: doc }, 1); s = km(s, { type: 'INSTALL_PLATE', caseId: doc }); }
    const before = structuredClone(s); s = km(s, { type, caseId: doc }, 100);
    expect(s.spirituality).toBe(before.spirituality - (type === 'START_PROGRAM' ? 5 : 4)); rejectKm(s, { type, caseId: doc });
    expect(attempt(s).plate!.status).toBe(type === 'START_PROGRAM' ? 'SPENT' : 'FAILED'); expect(attempt(s).programActive).toBe(false);
    s = stoppedCleanup(s); expect(attempt(s).result).toBe('ORDINARY'); expect(s.progression.mastery[BIND]).toBe(0);
    expect(attempt(s).automaticSteps).toBe(0); expect(attempt(s).plate!.location).toBe('RECYCLE');
  });

  it('never recharges via promotion or old S3 and pays a unique new recharge material without repair', () => {
    const s = directedLifeReady(), before = structuredClone(s), next = km(s, { type: 'RECHARGE', objectId: 'AL4-FRAME-1' });
    expect([next.cash, next.spirituality, next.actionsRemaining]).toEqual([before.cash - 40, before.spirituality - 3, before.actionsRemaining - 1]);
    expect(next.alchemist.life.creations[1]).toMatchObject({ charge: 3, durability: before.alchemist.life.creations[1]!.durability });
    expect(next.arcaneScholar).toEqual(before.arcaneScholar); expect(next.knowledgeMentor.life.recharges[0]).toMatchObject({ id: 'KM2-RECHARGE-1', materialId: 'KM2-CHARGE-MATERIAL-1', materialConsumed: true, paidPennies: 40, spiritualitySpent: 3, actionsSpent: 1 });
    expect(findKnowledgeMentorOriginalCreation(next, 'AL4-FRAME-1')).toBe(next.alchemist.life.creations[1]);
    expect(next.knowledgeMentor.life).not.toHaveProperty('creations'); rejectKm(next, { type: 'RECHARGE', objectId: 'AL4-FRAME-1' });
  });

  it('requires two current independent permissions and a physically handed original parcel', () => {
    let s = install(activeTransfer(), parcel); rejectKm(s, { type: 'TAKE_PARCEL', caseId: parcel }); rejectKm(s, { type: 'START_PROGRAM', caseId: parcel });
    s = km(s, { type: 'CONSENT', caseId: parcel, permission: 'PROGRAM' }); rejectKm(s, { type: 'TAKE_PARCEL', caseId: parcel });
    s = km(s, { type: 'CONSENT', caseId: parcel, permission: 'PARCEL' }); rejectKm(s, { type: 'START_PROGRAM', caseId: parcel });
    s = km(s, { type: 'TAKE_PARCEL', caseId: parcel }); s = km(s, { type: 'LOAD_PARCEL', caseId: parcel });
    expect(attempt(s, parcel).parcel).toMatchObject({ id: 'KM2-VERA-PARCEL', owner: 'KM2-VERA', holder: 'AL4-BOX-1', location: 'BENCH_START', delivered: false });
    s = km(s, { type: 'START_PROGRAM', caseId: parcel }, 1); s = km(s, { type: 'PROGRAM_STEP', caseId: parcel });
    expect(attempt(s, parcel).parcel.delivered).toBe(false); s = km(s, { type: 'PROGRAM_STEP', caseId: parcel });
    expect(attempt(s, parcel)).toMatchObject({ boxTravelMetres: 10, ownerNode: 'BENCH_START', parcel: { location: 'BENCH_END', delivered: true } });
    s = km(s, { type: 'PROGRAM_STEP', caseId: parcel }); rejectKm(s, { type: 'COLLECT_PARCEL', caseId: parcel }); rejectKm(s, { type: 'RETURN_PARCEL', caseId: parcel });
    s = closeCase(s, parcel); expect(attempt(s, parcel).parcel).toMatchObject({ holder: 'KM2-VERA', location: 'OWNER', delivered: true, returned: true });
  });

  it.each(['PROGRAM', 'PARCEL'] as const)('withdrawn %s stops influence immediately but never teleports the held parcel or originals', permission => {
    let s = install(activeTransfer(), parcel);
    for (const p of ['PROGRAM', 'PARCEL'] as const) s = km(s, { type: 'CONSENT', caseId: parcel, permission: p });
    s = km(s, { type: 'TAKE_PARCEL', caseId: parcel }); s = km(s, { type: 'LOAD_PARCEL', caseId: parcel }); s = km(s, { type: 'START_PROGRAM', caseId: parcel }, 1);
    s = km(s, { type: 'PROGRAM_STEP', caseId: parcel }); s = km(s, { type: 'PROGRAM_STEP', caseId: parcel }); const physical = pair(s), oldParcel = attempt(s, parcel).parcel;
    s = km(s, { type: 'REVOKE_CONSENT', caseId: parcel, permission });
    expect(attempt(s, parcel)).toMatchObject({ programActive: false, programEnd: 'WITHDRAWN', ownerNode: 'BENCH_START', parcel: oldParcel }); expect(pair(s)).toEqual(physical);
    rejectKm(s, { type: 'CONSENT', caseId: parcel, permission }); rejectKm(s, { type: 'PROGRAM_STEP', caseId: parcel }); rejectKm(s, { type: 'CLOSE', caseId: parcel });
    s = km(s, { type: 'MOVE', caseId: parcel, to: 'BENCH_END' }); s = km(s, { type: 'COLLECT_PARCEL', caseId: parcel });
    s = km(s, { type: 'MOVE', caseId: parcel, to: 'BENCH_START' }); s = km(s, { type: 'RETURN_PARCEL', caseId: parcel });
    expect(attempt(s, parcel).parcel).toMatchObject({ holder: 'KM2-VERA', returned: true }); expect(s.progression.mastery[BIND]).toBe(0);
  });

  it('waits the real finite window and then ordinary controls retain all spend and positions', () => {
    let s = km(install(activeDocument(), doc), { type: 'START_PROGRAM', caseId: doc }, 1), before = attempt(s), originals = pair(s), spirit = s.spirituality;
    s = km(s, { type: 'WAIT_PROGRAM', caseId: doc }); expect(attempt(s)).toMatchObject({ programActive: false, programRemainingSeconds: 0, programEnd: 'EXPIRED', elapsedSeconds: before.elapsedSeconds + 45 });
    expect(pair(s)).toEqual(originals); expect(s.spirituality).toBe(spirit); rejectKm(s, { type: 'PROGRAM_STEP', caseId: doc });
    s = stoppedCleanup(s); expect(attempt(s).result).toBe('ORDINARY');
  });

  it.each([1, 100])('keeps actual bar damage and needs a real stop after calibration roll%s', roll => {
    let s = install(activeBlocked(), blocked); s = km(s, { type: 'PLACE_STOP_BAR', caseId: blocked }); s = km(s, { type: 'START_PROGRAM', caseId: blocked }, 1);
    s = km(s, { type: 'PROGRAM_STEP', caseId: blocked }); const durability = s.alchemist.life.creations[1]!.durability;
    s = km(s, { type: 'PROGRAM_STEP', caseId: blocked }); expect(s.alchemist.life.creations[1]!.durability).toBe(durability - 5);
    expect(attempt(s, blocked)).toMatchObject({ completedSteps: 1, stopBar: { location: 'ROUTE', triggered: true, loadRunning: true }, frameDurabilityLost: 5 });
    rejectKm(s, { type: 'CLEAR_STOP_BAR', caseId: blocked }); const spirit = s.spirituality; s = km(s, { type: 'CALIBRATE', caseId: blocked }, roll);
    expect(s.spirituality).toBe(spirit - 4); rejectKm(s, { type: 'CALIBRATE', caseId: blocked });
    if (roll === 100) { expect(attempt(s, blocked).stopBar.loadRunning).toBe(true); s = km(s, { type: 'MANUAL_STOP', caseId: blocked }); }
    expect(attempt(s, blocked).stopBar.location).toBe('ROUTE'); s = km(s, { type: 'CLEAR_STOP_BAR', caseId: blocked });
    s = km(s, { type: 'MANUAL_STEP', caseId: blocked }); s = km(s, { type: 'MANUAL_STEP', caseId: blocked }); s = closeCase(s, blocked);
    expect(s.alchemist.life.creations[1]!.durability).toBe(durability - 5); expect(s.progression.mastery[CALIBRATE]).toBe(roll === 1 ? 8 : 0);
    expect(attempt(s, blocked)).toMatchObject({ result: roll === 1 ? 'ABILITY' : 'ORDINARY', stopBar: { location: 'RACK', cleared: true }, originalsReturned: true });
  });

  it('allows ordinary completion and reflection without awarding a single new ability success', () => {
    const s = directedPracticed(); expect(s.progression.acting).toBe(100); expect(s.knowledgeMentor.life.reflected).toBe(true);
    expect([s.progression.mastery[BIND], s.progression.mastery[CALIBRATE]]).toEqual([0, 0]);
    expect(projectKnowledgeMentorLife(s).cases.every(c => c.status === 'RESOLVED' && c.attempts[0]!.result === 'ORDINARY')).toBe(true);
    expect(s.knowledgeMentor.life.combatPlates).toEqual([]); rejectKm(s, { type: 'REFLECT' });
  });

  it('buys at most three independently sourced combat plates, charging failed attempts with no reused material', () => {
    let s = directedPracticed(); const oldS3 = structuredClone(s.arcaneScholar);
    for (const [i, roll] of [1, 100, 1].entries()) {
      const before = unitBudget(s); s = km(before, { type: 'PREPARE_COMBAT_PLATE' }, roll);
      expect([s.cash, s.spirituality, s.actionsRemaining]).toEqual([before.cash - 60, before.spirituality - 4, before.actionsRemaining - 1]);
      expect(s.knowledgeMentor.life.combatPlates[i]).toMatchObject({ id: `KM2-COMBAT-PLATE-${i + 1}`, status: roll === 1 ? 'READY' : 'FAILED', location: roll === 1 ? 'PLAYER' : 'RECYCLE', boundObjectIds: ['AL4-BOX-1', 'AL4-FRAME-1'], spentRevision: null, paidPennies: 60 });
    }
    rejectKm(unitBudget(s), { type: 'PREPARE_COMBAT_PLATE' }); expect(s.arcaneScholar).toEqual(oldS3); expect(new Set(s.knowledgeMentor.life.combatPlates.map(p => p.id)).size).toBe(3);
  });

  it('rejects edited current positions, cost evidence, free charges, copied ledger entries and skipped observations', () => {
    let s = km(install(activeDocument(), doc), { type: 'START_PROGRAM', caseId: doc }, 1);
    const changes: ((s: SliceState) => void)[] = [
      t => { t.alchemist.life.creations[0]!.location = 'BENCH_END'; }, t => { t.alchemist.life.creations[1]!.charge++; },
      t => { t.cash++; }, t => { t.spirituality++; }, t => { t.actionsRemaining++; },
      t => { t.knowledgeMentor.life.originalLedger.push(structuredClone(t.knowledgeMentor.life.originalLedger.at(-1)!)); },
      t => { const a = t.knowledgeMentor.life.cases[doc].attempts[0]!; a.steps = a.steps.filter(x => x.type !== 'MEASURE_BASELINE'); },
      t => { (t.knowledgeMentor.life as unknown as Record<string, unknown>).creations = structuredClone(t.alchemist.life.creations); },
    ];
    for (const change of changes) { const bad = structuredClone(s); change(bad); expect(validateKnowledgeMentorLife(bad)).toBe(false); expect(() => assertValidSliceState(bad)).toThrow(); }
    s = stoppedCleanup(km(s, { type: 'STOP_PROGRAM', caseId: doc })); assertValidSliceState(s);
  });

  it.each([{ type: 'BIND_PLATE', caseId: doc, success: true }, { type: 'CONSENT', caseId: parcel, permission: 'ALL' }, { type: 'MOVE', caseId: parcel, to: 'CITY' }, { type: 'RECHARGE', objectId: 'NEW-COPY' }, { type: 'PREPARE_COMBAT_PLATE', count: 3 }, { type: 'READ_ALL_RECORDS', caseId: doc }])('rejects non-exact hidden life command %#', command => {
    expect(validateKnowledgeMentorActivityCommand(command)).toBe(false); rejectKm(directedLifeReady(), command);
  });
});
