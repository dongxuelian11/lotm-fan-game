import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { CIVILIZATION_ENLIGHTENER_PREPARATION_IDS } from '../../src/domain/civilization-enlightener/types.js';
import {
  blockCivilizationEnlightenerActivity, civilizationEnlightenerLifeActions, civilizationEnlightenerLifeOriginalEvents,
  civilizationEnlightenerLifeOriginalTail, civilizationEnlightenerOriginalSnapshot, createCivilizationEnlightenerLifeState,
  findCivilizationEnlightenerOriginalCreation, hasCivilizationEnlightenerLifeLock, projectCivilizationEnlightenerLife,
  validateCivilizationEnlightenerActivityCommand, validateCivilizationEnlightenerLife, CIVILIZATION_ENLIGHTENER_CASE_IDS,
  type CivilizationEnlightenerActivityCommand, type CivilizationEnlightenerCaseId,
} from '../../src/domain/civilization-enlightener/life.js';
import { ce, directedInitial2, dose, originalKnowledgeMentor, rejectEnlightener, step } from './civilization-enlightener-directed-helper.js';

const ANALYSIS = 'paragon.s1.process-analysis', GUIDANCE = 'paragon.s1.operational-guidance';
const ok = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const pair = civilizationEnlightenerOriginalSnapshot;
const frame = (s: SliceState) => findCivilizationEnlightenerOriginalCreation(s, 'AL4-FRAME-1')!;
interface Inputs { analysis?: boolean; guidance?: boolean; learner?: boolean }
const lifeCache = new Map<string, SliceState>();
/** Declared future inputs are selected BEFORE the first new acquisition event.
 * Promotion and every check then run through the public reducer. Historical
 * seed, old rolls, injuries, live objects and predecessor mastery are untouched. */
function lifeState(inputs: Inputs = {}): SliceState {
  const key = JSON.stringify(inputs), cached = lifeCache.get(key); if (cached) return structuredClone(cached);
  let s = directedInitial2(), selected: number | null = null;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 8192; cursor++) {
    const random = new DeterministicActionRandomStream(s.random.seed, cursor);
    const promotion = resolveNormalCheck({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [], roll: random.nextInt(1, 100) });
    if (promotion.tier !== 'SUCCESS') continue;
    const analysis = inputs.analysis === undefined ? null : resolveNormalCheck({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge + 1, difficulty: 18, modifiers: [], roll: random.nextInt(1, 100) });
    const guidance = inputs.guidance === undefined ? null : resolveNormalCheck({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge + 1, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
    const learner = inputs.learner === undefined ? null : resolveNormalCheck({ ability: 'knowledge', baseAbility: 12, difficulty: 20,
      modifiers: inputs.guidance ? [{ source: '同一次普通停载的有限操作启示', value: 10 }] : [], roll: random.nextInt(1, 100) });
    if ((!analysis || ok(analysis.tier) === inputs.analysis) && (!guidance || ok(guidance.tier) === inputs.guidance) && (!learner || ok(learner.tier) === inputs.learner)) { selected = cursor; break; }
  }
  if (selected === null) throw new Error('No declared finite life input within the bounded original seed search.');
  s.random.cursor = selected; assertValidSliceState(s);
  s = ce(s, { type: 'LEARN_GUIDANCE' });
  for (const taskId of CIVILIZATION_ENLIGHTENER_PREPARATION_IDS) s = ce(s, { type: 'PREPARE_TASK', taskId });
  s = ce(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = ce(s, { type: 'PREPARE_PROMOTION' }); s = ce(s, dose);
  expect(s.progression.sequence).toBe(1); expect(validateCivilizationEnlightenerLife(s)).toBe(true); lifeCache.set(key, structuredClone(s)); return s;
}
function act(s: SliceState, ...commands: CivilizationEnlightenerActivityCommand[]): SliceState {
  for (const command of commands) { s = ce(s, command); expect(validateCivilizationEnlightenerLife(s), JSON.stringify(command)).toBe(true); }
  return s;
}
function enter(s: SliceState, id: CivilizationEnlightenerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY', teaching = true): SliceState {
  s = act(s, { type: 'OBSERVE', caseId: id }, { type: 'INVITE', caseId: id, method }, { type: teaching ? 'CONSENT' : 'DECLINE_CONSENT', permission: 'TEACHING' },
    { type: method === 'ABILITY' ? 'CONSENT' : 'DECLINE_CONSENT', permission: 'ABILITY' }, { type: 'BORROW_WRENCH' }, { type: 'ENTER_WORKSHOP' }, { type: 'PLACE_ORIGINALS' });
  return s;
}
function inspect(s: SliceState): SliceState { return act(s, { type: 'READ_RECORDS' }, { type: 'INSPECT_FRAME' }); }
function repair(s: SliceState): SliceState { return act(s, { type: 'HAND_INSPECT' }, { type: 'BUY_SHIM' }, { type: 'REPAIR_FRAME' }); }
function finish(s: SliceState, id: CivilizationEnlightenerCaseId): SliceState {
  return act(s, { type: 'RETURN_ORIGINALS' }, { type: 'MOVE', to: 'NEAR' }, { type: 'RETURN_WRENCH' }, { type: 'RETURN_HOME' }, { type: 'REPORT', caseId: id });
}
function completeBearing(s: SliceState, useAbility = false): SliceState {
  s = inspect(enter(s, 'worn-bearing', useAbility ? 'ABILITY' : 'ORDINARY'));
  if (useAbility) s = act(s, { type: 'PROCESS_ANALYSIS' });
  return finish(repair(s), 'worn-bearing');
}
function ordinaryStopCase(s: SliceState, id: 'taught-stop' | 'withdrawn-operation'): SliceState {
  s = enter(s, id, 'ORDINARY'); s = act(s, { type: 'DEMONSTRATE_STOP' }, { type: 'ARM_MANUAL_LOAD' }, { type: 'MANUAL_STOP' }); return finish(s, id);
}
function nextActualWeek(s: SliceState): SliceState {
  const week = s.week;
  for (let n = 0; n < 180 && s.week === week; n++) {
    if (s.activeEvent) {
      if (s.activeEvent.id !== 'LIFE-CARE-01') throw new Error(`Unexpected ordinary-week event ${s.activeEvent.id}`);
      s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId: 'PAY' });
    } else s = step(s, { type: 'ACTION', action: 'REST' });
  }
  expect(s.week).toBeGreaterThan(week); return s;
}

describe('Civilization Enlightener same-original finite workshop life', () => {
  it('keeps the actual 691-command source, live zero-charge resources and original adult without carrying old permission', () => {
    const original = originalKnowledgeMentor(), s = lifeState(), l = s.civilizationEnlightener.life;
    for (const key of ['savant', 'archaeologist', 'appraiser', 'artisan', 'astronomer', 'alchemist', 'arcaneScholar', 'knowledgeMentor'] as const) expect(s[key]).toEqual(original[key]);
    expect(s.injuries).toEqual(original.injuries); expect(s.health).toBe(70); expect(s.mind).toBe(84); expect(s.spirituality).toBe(113);
    expect(pair(s)).toEqual([{ id: 'AL4-BOX-1', charge: 0, durability: 100, location: 'PLAYER', active: false }, { id: 'AL4-FRAME-1', charge: 0, durability: 90, location: 'PLAYER', active: false }]);
    expect(l.sourceOriginals).toEqual(pair(s)); expect(l.sourceRecord).toMatchObject({ workbenchId: 'AL4-WORKBENCH-1', pieceRecords: original.alchemist.life.pieceRecords });
    expect(l.practice.participant).toEqual({ id: 'KM2-VERA', name: '维拉', age: 39, present: false, node: 'NEAR', walkedMetres: 0 });
    expect(l.practice.parcel).toEqual({ id: 'KM2-VERA-PARCEL', owner: 'KM2-VERA', holder: 'KM2-VERA', location: 'OWNER' });
    expect(l.practice.stopBar).toEqual({ id: 'KM2-STOP-BAR', location: 'RACK', loadRunning: false });
    expect(l.practice.wrench).toMatchObject({ holder: 'RACK', loans: 0, returns: 0 }); expect(l.practice.shim.status).toBe('SUPPLIER');
    expect(projectCivilizationEnlightenerLife(s).currentConsents).toEqual([{ id: 'KM2-VERA', consented: false, teachingConsented: false }]);
    for (const [id, value] of Object.entries(original.progression.mastery)) expect(s.progression.mastery[id]).toBe(value);
    expect(s.progression.mastery[ANALYSIS]).toBe(0); expect(s.progression.mastery[GUIDANCE]).toBe(0); expect(createCivilizationEnlightenerLifeState().sourceRecord).toBeNull();
  }, 60_000);

  it('requires fresh invitation and distinct current permission, real access, records, diagnosis, bought shim and explicit repair', () => {
    let s = lifeState({ analysis: true }); const before = structuredClone(s), oldLedger = structuredClone(s.knowledgeMentor.life.originalLedger);
    rejectEnlightener(s, { type: 'PROCESS_ANALYSIS' }); s = act(s, { type: 'OBSERVE', caseId: 'worn-bearing' }, { type: 'INVITE', caseId: 'worn-bearing', method: 'ABILITY' });
    expect(projectCivilizationEnlightenerLife(s).currentConsents[0]!.consented).toBe(false); rejectEnlightener(s, { type: 'ENTER_WORKSHOP' });
    s = act(s, { type: 'CONSENT', permission: 'TEACHING' }, { type: 'CONSENT', permission: 'ABILITY' }); rejectEnlightener(s, { type: 'ENTER_WORKSHOP' });
    s = act(s, { type: 'BORROW_WRENCH' }, { type: 'ENTER_WORKSHOP' }, { type: 'PLACE_ORIGINALS' }); rejectEnlightener(s, { type: 'PROCESS_ANALYSIS' }); rejectEnlightener(s, { type: 'REPAIR_FRAME' });
    s = inspect(s); s = act(s, { type: 'PROCESS_ANALYSIS' });
    expect(frame(s).durability).toBe(90); expect(frame(s).charge).toBe(0); expect(s.progression.mastery[ANALYSIS]).toBe(0);
    expect(s.spirituality).toBe(before.spirituality - 6); expect(s.mind).toBe(before.mind - 2); expect(s.random.cursor).toBe(before.random.cursor + 1);
    expect(s.civilizationEnlightener.life.cases['worn-bearing']).toMatchObject({ defectKnown: true, handsInspected: false, abilityApplied: false });
    rejectEnlightener(s, { type: 'PROCESS_ANALYSIS' }); rejectEnlightener(s, { type: 'BUY_SHIM' }); rejectEnlightener(s, { type: 'REPAIR_FRAME' });
    s = act(s, { type: 'HAND_INSPECT' }); rejectEnlightener(s, { type: 'REPAIR_FRAME' }); s = act(s, { type: 'BUY_SHIM' });
    expect(s.cash).toBe(before.cash - 60); expect(frame(s).durability).toBe(90); rejectEnlightener(s, { type: 'BUY_SHIM' });
    s = act(s, { type: 'MOVE', to: 'NEAR' }); rejectEnlightener(s, { type: 'REPAIR_FRAME' }); s = act(s, { type: 'MOVE', to: 'FAR' }, { type: 'REPAIR_FRAME' });
    expect(frame(s).durability).toBe(95); expect(frame(s).charge).toBe(0); expect(s.civilizationEnlightener.life.practice.shim.status).toBe('CONSUMED');
    expect(s.civilizationEnlightener.life.journal.at(-1)).toMatchObject({ command: { type: 'REPAIR_FRAME' }, elapsedSeconds: 20,
      originalsBefore: [{ id: 'AL4-BOX-1', charge: 0, durability: 100 }, { id: 'AL4-FRAME-1', charge: 0, durability: 90 }], originalsAfter: [{ id: 'AL4-BOX-1', charge: 0, durability: 100 }, { id: 'AL4-FRAME-1', charge: 0, durability: 95 }] });
    rejectEnlightener(s, { type: 'REPAIR_FRAME' }); rejectEnlightener(s, { type: 'RETURN_HOME' }); s = finish(s, 'worn-bearing');
    expect(s.progression.mastery[ANALYSIS]).toBe(8); expect(s.progression.mastery[GUIDANCE]).toBe(0); expect(s.progression.acting).toBe(25);
    expect(s.civilizationEnlightener.life.practice).toMatchObject({ ownerNode: 'NEAR', ownerWalkedMetres: 8, participant: { present: false, node: 'NEAR', walkedMetres: 4 }, wrench: { holder: 'RACK', node: 'NEAR', loans: 1, returns: 1 }, stopBar: { loadRunning: false } });
    expect(pair(s).every(x => x.location === 'PLAYER' && !x.active && x.charge === 0)).toBe(true); expect(s.knowledgeMentor.life.originalLedger).toEqual(oldLedger);
    expect(findCivilizationEnlightenerOriginalCreation(s, 'AL4-FRAME-1')).toBe(s.alchemist.life.creations[1]); expect(civilizationEnlightenerLifeOriginalTail(s)).toEqual(pair(s));
    expect(civilizationEnlightenerLifeOriginalEvents(s).filter(e => e.before[1]!.durability !== e.after[1]!.durability)).toHaveLength(1);
  }, 60_000);

  it('retains paid seeded analysis failure and completes the same real repair by hands-on diagnosis without mastery', () => {
    let s = inspect(enter(lifeState({ analysis: false }), 'worn-bearing')); const spirit = s.spirituality, mind = s.mind, cursor = s.random.cursor;
    s = act(s, { type: 'PROCESS_ANALYSIS' }); const failed = s.civilizationEnlightener.life.cases['worn-bearing'].outcome;
    expect(ok(failed!)).toBe(false); expect(s.spirituality).toBe(spirit - 6); expect(s.mind).toBe(mind - 2); expect(s.random.cursor).toBe(cursor + 1); expect(frame(s).durability).toBe(90);
    expect(s.civilizationEnlightener.life.cases['worn-bearing'].defectKnown).toBe(false); rejectEnlightener(s, { type: 'PROCESS_ANALYSIS' });
    s = finish(repair(s), 'worn-bearing'); expect(frame(s).durability).toBe(95); expect(s.progression.mastery[ANALYSIS]).toBe(0);
    expect(s.civilizationEnlightener.life.cases['worn-bearing']).toMatchObject({ abilityAttempted: true, abilityApplied: false, outcome: failed, result: 'ORDINARY', repairDone: true });
    expect(s.civilizationEnlightener.life.practice.abilityUses[ANALYSIS]).toEqual({ attempts: 1, successes: 0, applied: 0 });
  }, 60_000);

  it('requires a physical player demonstration, then separate willing learner action, and gives one finite bonus only', () => {
    let s = enter(completeBearing(lifeState({ guidance: true, learner: true })), 'taught-stop');
    const originals = pair(s), spirit = s.spirituality, mind = s.mind, cursor = s.random.cursor;
    rejectEnlightener(s, { type: 'OPERATIONAL_GUIDANCE' }); rejectEnlightener(s, { type: 'LEARNER_TRY' });
    s = act(s, { type: 'DEMONSTRATE_STOP' }); expect(s.civilizationEnlightener.life.journal.at(-1)!.loadTransitions).toEqual(['HAND_START', 'HAND_STOP']);
    s = act(s, { type: 'OPERATIONAL_GUIDANCE' });
    expect(s.spirituality).toBe(spirit - 8); expect(s.mind).toBe(mind - 3); expect(pair(s)).toEqual(originals); expect(s.progression.mastery[GUIDANCE]).toBe(0);
    expect(s.civilizationEnlightener.life.cases['taught-stop']).toMatchObject({ abilityApplied: false, learnerAttempted: false, learnerWantsStep: true, guidanceEnd: 'PENDING' });
    const pending = s.civilizationEnlightener.life.practice.pendingGuidance!; expect(pending.expiresAt - pending.createdAt).toBe(30); expect(pending.bonus).toBe(10);
    rejectEnlightener(s, { type: 'OPERATIONAL_GUIDANCE' }); rejectEnlightener(s, { type: 'LEARNER_TRY' });
    s = act(s, { type: 'ARM_MANUAL_LOAD' }, { type: 'LEARNER_TRY' });
    expect(s.random.cursor).toBe(cursor + 2); expect(s.civilizationEnlightener.life.journal.at(-1)!.check).toMatchObject({ ability: 'knowledge', baseAbility: 12, effectiveAbility: 22, difficulty: 20, modifiers: [{ source: '同一次普通停载的有限操作启示', value: 10 }] });
    expect(s.civilizationEnlightener.life.cases['taught-stop']).toMatchObject({ ordinaryStepLearned: true, abilityApplied: true, result: 'ABILITY', guidanceEnd: 'APPLIED' });
    expect(s.civilizationEnlightener.life.practice.pendingGuidance).toBeNull(); expect(s.civilizationEnlightener.life.practice.stopBar.loadRunning).toBe(false);
    expect(s.civilizationEnlightener.life.practice.participant).not.toHaveProperty('mastery'); expect(s.civilizationEnlightener.life.practice.participant).not.toHaveProperty('abilities');
    rejectEnlightener(s, { type: 'LEARNER_TRY' }); s = finish(s, 'taught-stop'); expect(s.progression.mastery[GUIDANCE]).toBe(8);
    expect(s.civilizationEnlightener.life.practice.abilityUses[GUIDANCE]).toEqual({ attempts: 1, successes: 1, applied: 1 }); expect(pair(s).map(x => x.charge)).toEqual([0, 0]);
  }, 60_000);

  it('keeps successful casting and actual learner failure distinct, with paid costs and ordinary manual fallback', () => {
    let s = enter(completeBearing(lifeState({ guidance: true, learner: false })), 'taught-stop'); const spirit = s.spirituality, mind = s.mind;
    s = act(s, { type: 'DEMONSTRATE_STOP' }, { type: 'OPERATIONAL_GUIDANCE' }, { type: 'ARM_MANUAL_LOAD' }, { type: 'LEARNER_TRY' });
    const r = structuredClone(s.civilizationEnlightener.life.cases['taught-stop']); expect(ok(r.outcome!)).toBe(true); expect(ok(r.learnerOutcome!)).toBe(false); expect(r.guidanceEnd).toBe('LEARNER_FAILED');
    expect(s.civilizationEnlightener.life.practice.stopBar.loadRunning).toBe(true); expect(s.spirituality).toBe(spirit - 8); expect(s.mind).toBe(mind - 3);
    rejectEnlightener(s, { type: 'LEARNER_TRY' }); rejectEnlightener(s, { type: 'OPERATIONAL_GUIDANCE' }); rejectEnlightener(s, { type: 'RETURN_ORIGINALS' });
    s = act(s, { type: 'MANUAL_STOP' }); s = finish(s, 'taught-stop');
    expect(s.civilizationEnlightener.life.cases['taught-stop']).toMatchObject({ outcome: r.outcome, learnerOutcome: r.learnerOutcome, result: 'ORDINARY', ordinaryStepLearned: false, abilityApplied: false });
    expect(s.progression.mastery[GUIDANCE]).toBe(0); expect(s.civilizationEnlightener.life.practice.abilityUses[GUIDANCE]).toEqual({ attempts: 1, successes: 1, applied: 0 });
  }, 60_000);

  it('charges a failed cast once and lets an independent ordinary learner success remain ordinary', () => {
    let s = enter(completeBearing(lifeState({ guidance: false, learner: true })), 'taught-stop'); const spirit = s.spirituality, mind = s.mind;
    s = act(s, { type: 'DEMONSTRATE_STOP' }, { type: 'OPERATIONAL_GUIDANCE' }); expect(s.civilizationEnlightener.life.practice.pendingGuidance).toBeNull();
    expect(s.civilizationEnlightener.life.cases['taught-stop'].guidanceEnd).toBe('FAILED'); rejectEnlightener(s, { type: 'OPERATIONAL_GUIDANCE' });
    s = act(s, { type: 'ARM_MANUAL_LOAD' }, { type: 'LEARNER_TRY' }); expect(s.civilizationEnlightener.life.journal.at(-1)!.check!.modifiers).toEqual([]);
    s = finish(s, 'taught-stop'); expect(s.civilizationEnlightener.life.cases['taught-stop']).toMatchObject({ ordinaryStepLearned: true, result: 'ORDINARY', abilityApplied: false });
    expect(s.progression.mastery[GUIDANCE]).toBe(0); expect(s.spirituality).toBe(spirit - 8); expect(s.mind).toBe(mind - 3);
  }, 60_000);

  it.each(['expiry', 'ability', 'teaching'] as const)('loses an unused successful help window on %s without refund, retry or award', mode => {
    let s = enter(completeBearing(lifeState({ guidance: true })), 'taught-stop'); const spirit = s.spirituality, mind = s.mind;
    s = act(s, { type: 'DEMONSTRATE_STOP' }, { type: 'OPERATIONAL_GUIDANCE' }); const elapsed = s.civilizationEnlightener.life.practice.elapsedSeconds;
    if (mode === 'expiry') { s = act(s, { type: 'WAIT_GUIDANCE' }); expect(s.civilizationEnlightener.life.practice.elapsedSeconds).toBe(elapsed + 30); }
    else s = act(s, { type: 'REVOKE_CONSENT', permission: mode === 'ability' ? 'ABILITY' : 'TEACHING' });
    expect(s.civilizationEnlightener.life.practice.pendingGuidance).toBeNull(); expect(s.spirituality).toBe(spirit - 8); expect(s.mind).toBe(mind - 3); rejectEnlightener(s, { type: 'OPERATIONAL_GUIDANCE' });
    s = act(s, { type: 'ARM_MANUAL_LOAD' }); if (mode === 'teaching') rejectEnlightener(s, { type: 'LEARNER_TRY' });
    s = act(s, { type: 'MANUAL_STOP' }); s = finish(s, 'taught-stop'); expect(s.progression.mastery[GUIDANCE]).toBe(0);
    expect(s.civilizationEnlightener.life.practice.abilityUses[GUIDANCE]).toEqual({ attempts: 1, successes: 1, applied: 0 });
  }, 60_000);

  it('permits entirely ordinary three-case completion, honors third-case withdrawal and gives exactly three reports plus reflection', () => {
    let s = lifeState(); const before = structuredClone(s); s = completeBearing(s); s = ordinaryStopCase(s, 'taught-stop'); s = enter(s, 'withdrawn-operation');
    expect(s.civilizationEnlightener.life.cases['withdrawn-operation'].permission.ability).toBe('WITHDRAWN'); rejectEnlightener(s, { type: 'PROCESS_ANALYSIS' }); rejectEnlightener(s, { type: 'OPERATIONAL_GUIDANCE' }); rejectEnlightener(s, { type: 'CONSENT', permission: 'ABILITY' });
    s = act(s, { type: 'DEMONSTRATE_STOP' }, { type: 'ARM_MANUAL_LOAD' }, { type: 'MANUAL_STOP' }); s = finish(s, 'withdrawn-operation'); s = act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.progression.mastery[ANALYSIS]).toBe(0); expect(s.progression.mastery[GUIDANCE]).toBe(0);
    expect(s.cash).toBe(before.cash - 100); expect(s.actionsRemaining).toBe(before.actionsRemaining - 10); expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind); expect(s.random.cursor).toBe(before.random.cursor);
    expect(CIVILIZATION_ENLIGHTENER_CASE_IDS.every(id => s.civilizationEnlightener.life.cases[id].status === 'RESOLVED')).toBe(true); expect(hasCivilizationEnlightenerLifeLock(s)).toBe(false);
    expect(s.civilizationEnlightener.life.practice).toMatchObject({ ownerWalkedMetres: 12, participant: { present: false, walkedMetres: 12 }, wrench: { holder: 'RACK', loans: 3, returns: 3 }, shim: { status: 'CONSUMED' }, stopBar: { loadRunning: false, location: 'RACK' } });
    expect(s.seer.completedSources.filter(x => x.startsWith('civilization-enlightener-case:'))).toHaveLength(3); expect(s.seer.completedSources.filter(x => x === 'civilization-enlightener-reflection')).toHaveLength(1);
    rejectEnlightener(s, { type: 'REFLECT' }); rejectEnlightener(s, { type: 'REPAIR_FRAME' }); expect(s.knowledgeMentor).toEqual(before.knowledgeMentor); expect(frame(s).durability).toBe(95);
  }, 60_000);

  it('lets Vera decline the lesson and still completes by the player ordinary operation without creating her desire', () => {
    let s = enter(completeBearing(lifeState()), 'taught-stop', 'ORDINARY', false); const cursor = s.random.cursor;
    expect(s.civilizationEnlightener.life.cases['taught-stop']).toMatchObject({ learnerWantsStep: false, permission: { teaching: 'DECLINED', ability: 'DECLINED' } });
    s = act(s, { type: 'DEMONSTRATE_STOP' }, { type: 'ARM_MANUAL_LOAD' }); rejectEnlightener(s, { type: 'LEARNER_TRY' }); rejectEnlightener(s, { type: 'OPERATIONAL_GUIDANCE' }); rejectEnlightener(s, { type: 'CONSENT', permission: 'TEACHING' });
    s = act(s, { type: 'MANUAL_STOP' }); s = finish(s, 'taught-stop'); expect(s.random.cursor).toBe(cursor); expect(s.progression.mastery[GUIDANCE]).toBe(0);
  }, 60_000);

  it('aborts by actual two-metre return trips, preserves purchased material and allows only later paid ordinary resumption', () => {
    let s = inspect(enter(lifeState({ analysis: false }), 'worn-bearing')); s = act(s, { type: 'PROCESS_ANALYSIS' }, { type: 'HAND_INSPECT' }, { type: 'BUY_SHIM' }, { type: 'MOVE', to: 'NEAR' });
    const failure = s.civilizationEnlightener.life.cases['worn-bearing'].outcome, cash = s.cash, travel = s.civilizationEnlightener.life.practice.ownerWalkedMetres;
    s = act(s, { type: 'ABORT' }); expect(s.civilizationEnlightener.life.practice.ownerWalkedMetres).toBe(travel + 4);
    expect(s.civilizationEnlightener.life.journal.at(-1)).toMatchObject({ ownerWalkedMetres: 4, veraWalkedMetres: 2, originalsCarriedMetres: 4, wrenchCarriedMetres: 4 });
    expect(s.civilizationEnlightener.life.cases['worn-bearing'].status).toBe('PAUSED'); expect(frame(s).durability).toBe(90); expect(pair(s).every(x => x.location === 'PLAYER')).toBe(true);
    expect(s.civilizationEnlightener.life.practice.shim.status).toBe('PLAYER'); expect(s.civilizationEnlightener.life.practice.wrench.holder).toBe('RACK'); expect(s.cash).toBe(cash);
    rejectEnlightener(s, { type: 'INVITE', caseId: 'worn-bearing', method: 'ORDINARY' }); s = nextActualWeek(s); const resumeCash = s.cash, cursor = s.random.cursor;
    rejectEnlightener(s, { type: 'INVITE', caseId: 'worn-bearing', method: 'ABILITY' });
    s = act(s, { type: 'INVITE', caseId: 'worn-bearing', method: 'ORDINARY' }, { type: 'CONSENT', permission: 'TEACHING' }, { type: 'DECLINE_CONSENT', permission: 'ABILITY' }, { type: 'BORROW_WRENCH' }, { type: 'ENTER_WORKSHOP' }, { type: 'PLACE_ORIGINALS' });
    expect(s.cash).toBe(resumeCash - 20); rejectEnlightener(s, { type: 'PROCESS_ANALYSIS' }); rejectEnlightener(s, { type: 'BUY_SHIM' });
    s = act(s, { type: 'REPAIR_FRAME' }); s = finish(s, 'worn-bearing'); expect(s.random.cursor).toBe(cursor); expect(frame(s).durability).toBe(95);
    expect(s.civilizationEnlightener.life.cases['worn-bearing']).toMatchObject({ outcome: failure, abilityAttempted: true, abilityApplied: false, result: 'ORDINARY' }); expect(s.progression.mastery[ANALYSIS]).toBe(0);
    expect(projectCivilizationEnlightenerLife(s).cases[0]!.attempts).toHaveLength(2); expect(s.civilizationEnlightener.life.practice.wrench).toMatchObject({ loans: 2, returns: 2 });
  }, 60_000);

  it('keeps learner failure on paid resumption while physically rearming only an ordinary load', () => {
    let s = enter(completeBearing(lifeState({ guidance: true, learner: false })), 'taught-stop');
    s = act(s, { type: 'DEMONSTRATE_STOP' }, { type: 'OPERATIONAL_GUIDANCE' }, { type: 'ARM_MANUAL_LOAD' }, { type: 'LEARNER_TRY' }, { type: 'ABORT' });
    const failed = s.civilizationEnlightener.life.cases['taught-stop'].learnerOutcome;
    expect(s.civilizationEnlightener.life.practice.stopBar.loadRunning).toBe(false); expect(s.civilizationEnlightener.life.cases['taught-stop'].status).toBe('PAUSED');
    s = nextActualWeek(s); const cursor = s.random.cursor;
    s = act(s, { type: 'INVITE', caseId: 'taught-stop', method: 'ORDINARY' }, { type: 'CONSENT', permission: 'TEACHING' }, { type: 'DECLINE_CONSENT', permission: 'ABILITY' }, { type: 'BORROW_WRENCH' }, { type: 'ENTER_WORKSHOP' }, { type: 'PLACE_ORIGINALS' }, { type: 'ARM_MANUAL_LOAD' });
    rejectEnlightener(s, { type: 'LEARNER_TRY' }); rejectEnlightener(s, { type: 'OPERATIONAL_GUIDANCE' }); s = act(s, { type: 'MANUAL_STOP' }); s = finish(s, 'taught-stop');
    expect(s.random.cursor).toBe(cursor); expect(s.civilizationEnlightener.life.cases['taught-stop']).toMatchObject({ learnerOutcome: failed, learnerAttempted: true, abilityApplied: false, result: 'ORDINARY' }); expect(s.progression.mastery[GUIDANCE]).toBe(0);
  }, 60_000);

  it('rejects unknown fields and tampering with original resources, manufacture records, fresh consent, costs, positions and seeded evidence', () => {
    let s = inspect(enter(lifeState({ analysis: true }), 'worn-bearing')); s = act(s, { type: 'PROCESS_ANALYSIS' });
    const changes: ((state: SliceState) => void)[] = [
      x => { frame(x).charge = 3; }, x => { frame(x).durability = 100; }, x => { frame(x).componentIds.push('FREE-PART'); },
      x => { x.civilizationEnlightener.life.sourceOriginals[1]!.durability = 100; }, x => { x.civilizationEnlightener.life.sourceRecord!.frameManufactureDigest = '0'.repeat(64); },
      x => { x.civilizationEnlightener.life.practice.participant.age = 17 as 39; }, x => { x.civilizationEnlightener.life.practice.parcel.holder = 'PLAYER' as 'KM2-VERA'; },
      x => { x.civilizationEnlightener.life.practice.wrench.holder = 'RACK'; }, x => { x.civilizationEnlightener.life.practice.shim.status = 'PLAYER'; },
      x => { x.civilizationEnlightener.life.practice.ownerNode = 'NEAR'; }, x => { x.civilizationEnlightener.life.practice.ownerWalkedMetres = 0; },
      x => { x.civilizationEnlightener.life.cases['worn-bearing'].permission.ability = 'WITHDRAWN'; },
      x => { x.civilizationEnlightener.life.cases['worn-bearing'].abilityApplied = true; },
      x => { x.civilizationEnlightener.life.journal.at(-1)!.after.spirituality++; }, x => { x.civilizationEnlightener.life.journal.at(-1)!.originalsAfter[1]!.durability++; },
      x => { x.civilizationEnlightener.life.journal.at(-1)!.randomCursor++; }, x => { x.civilizationEnlightener.life.journal.at(-1)!.randomAfter!++; },
      x => { x.civilizationEnlightener.life.journal.at(-1)!.checkBase = 500; }, x => { x.civilizationEnlightener.life.journal.at(-1)!.check!.roll = 100; },
      x => { x.civilizationEnlightener.life.journal.at(-1)!.revision = 1; }, x => { x.civilizationEnlightener.life.journal.at(-1)!.date.day++; },
      x => { x.spirituality++; }, x => { x.random.cursor++; }, x => { (x.civilizationEnlightener.life.journal.at(-1)! as unknown as Record<string, unknown>).extra = true; },
    ];
    for (const change of changes) { const invalid = structuredClone(s); change(invalid); expect(validateCivilizationEnlightenerLife(invalid)).toBe(false); }
    const reordered = JSON.parse(stableStringify(s)) as SliceState; expect(validateCivilizationEnlightenerLife(reordered)).toBe(true); expect(projectCivilizationEnlightenerLife(reordered)).toEqual(projectCivilizationEnlightenerLife(s));
    expect(validateCivilizationEnlightenerActivityCommand({ type: 'PROCESS_ANALYSIS', repair: true })).toBe(false); expect(validateCivilizationEnlightenerActivityCommand({ type: 'MOVE', to: 'FAR', metres: 0 })).toBe(false);
    expect(validateCivilizationEnlightenerActivityCommand({ type: 'CONSENT', permission: 'ABILITY', inherited: true })).toBe(false); expect(blockCivilizationEnlightenerActivity(s, { type: 'PROCESS_ANALYSIS' })).not.toBeNull();
    expect(civilizationEnlightenerLifeActions(s).filter(a => a.enabled && a.preferredAction)).toHaveLength(1);
  }, 60_000);
});
