import { describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { BLOOD_DUKE_CASE_IDS, blockBloodDukeLife, bloodDukeLifeClosed, hasBloodDukeLifeLock, projectBloodDukeLife, replayBloodDukeLifeRoot, validateBloodDukeActivityCommand, validateBloodDukeLifeState, type BloodDukeActivityCommand, type BloodDukeCaseId } from '../../src/domain/blood-duke/life.js';
import { BLOOD_DUKE_PREPARATION_IDS } from '../../src/domain/blood-duke/types.js';
import { bd, directedInitial3, dose, originalBlathererDead, promoted, rejectBloodDuke, rejectIntent } from './blood-duke-directed-helper.js';
const SELF = 'abyss.s2.self-restraint', EMOTION = 'abyss.s2.emotion-interference';
const attempt = (s: SliceState, id: BloodDukeCaseId) => s.bloodDuke.life.cases[id].attempts.at(-1)!;
function act(s: SliceState, c: BloodDukeActivityCommand): SliceState { const next = bd(s, c); expect(validateBloodDukeLifeState(next), JSON.stringify(c)).toBe(true); return next; }
function start(s: SliceState, id: BloodDukeCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  for (const c of [{ type: 'OBSERVE', caseId: id }, { type: 'PREPARE', caseId: id, method }, { type: 'WALK', caseId: id, to: 'A' }, { type: 'CONSENT_NORA', caseId: id }, { type: 'TAKE_CARD', caseId: id }, { type: 'WALK', caseId: id, to: 'B' }, { type: 'READ_NOTE', caseId: id }] as BloodDukeActivityCommand[]) s = act(s, c);
  return s;
}
function returnA(s: SliceState, id: BloodDukeCaseId): SliceState { return act(s, { type: 'WALK', caseId: id, to: 'A' }); }
function finish(s: SliceState, id: BloodDukeCaseId, report = true): SliceState {
  if (id === 'withdrawn-rehearsal' && attempt(s, id).consent === 'GRANTED') s = act(s, { type: 'WITHDRAW_PERMISSION', caseId: id });
  if (s.bloodDuke.life.operation.inputActive) s = act(s, { type: 'END_FOCUS', caseId: id });
  while (s.bloodDuke.life.operation.restraintUntil !== null || s.bloodDuke.life.operation.hesitationUntil !== null) s = act(s, { type: 'WAIT_6', caseId: id });
  if (s.blatherer.life.playerLocation === 'B') s = returnA(s, id);
  if (s.blatherer.life.card.location === 'PLAYER') s = act(s, { type: 'RETURN_CARD', caseId: id });
  if (s.blatherer.life.playerLocation === 'A') s = act(s, { type: 'WALK', caseId: id, to: 'START' });
  s = act(s, { type: 'INSPECT', caseId: id }); s = act(s, { type: 'LEAVE', caseId: id }); return report ? act(s, { type: 'REPORT', caseId: id }) : s;
}
function ordinary(s: SliceState, id: BloodDukeCaseId): SliceState { s = returnA(start(s, id, 'ORDINARY'), id); s = act(s, { type: 'MANUAL_OPERATION', caseId: id }); return finish(s, id); }
function selfWindow(s = promoted()): SliceState { s = returnA(start(s, 'door-restraint'), 'door-restraint'); s = act(s, { type: 'NOTICE_IMPULSE', caseId: 'door-restraint' }); return act(s, { type: 'SELF_RESTRAINT', caseId: 'door-restraint' }); }
function emotionReady(): SliceState { let s = ordinary(promoted(), 'door-restraint'); s = start(s, 'bell-hesitation'); s = act(s, { type: 'REHEARSE_BELL', caseId: 'bell-hesitation' }); return returnA(s, 'bell-hesitation'); }
/** UNIT-only cursor121 is selected before any S2 journal exists. The original seed,
 * 583-command history, bodies, stats and original resources remain unchanged. */
function failedSelfSource(): SliceState {
  let s = directedInitial3(); s.random.cursor = 121; assertValidSliceState(s);
  s = bd(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of BLOOD_DUKE_PREPARATION_IDS) s = bd(s, { type: 'PREPARE_TASK', taskId });
  s = bd(s, { type: 'BUY_POTION', bottleId: 'blood-duke-potion-1' }); s = bd(s, { type: 'PREPARE_PROMOTION' }); s = bd(s, dose);
  expect(s.progression.sequence).toBe(2); return s;
}

describe('BloodDuke finite life on the actual original quiet-room root', () => {
  it('validates exact command shapes and never permits a DEAD original to enter', () => {
    expect(validateBloodDukeActivityCommand({ type: 'REFLECT', extra: true })).toBe(false);
    expect(validateBloodDukeActivityCommand({ type: 'WALK', caseId: 'door-restraint', to: 'REMOTE' })).toBe(false);
    expect(validateBloodDukeActivityCommand({ type: 'EMOTION_INTERFERENCE', caseId: 'invented' })).toBe(false);
    const dead = originalBlathererDead(); rejectBloodDuke(dead, { type: 'OBSERVE', caseId: 'door-restraint' }); expect(dead.status).toBe('DEAD');
  }, 60_000);
  it('completes ordinary acting100 with zero ability mastery and preserves the exact original people, objects, old cases and injuries', () => {
    let s = promoted(); const old = structuredClone(s.blatherer.life), injuries = structuredClone(s.injuries), resources = [s.health, s.mind, s.spirituality, s.cash], demon = structuredClone(s.demon);
    for (const id of BLOOD_DUKE_CASE_IDS) s = ordinary(s, id);
    s = act(s, { type: 'REFLECT' }); expect(bloodDukeLifeClosed(s)).toBe(true); expect(s.progression.acting).toBe(100);
    expect(s.progression.mastery[SELF]).toBe(0); expect(s.progression.mastery[EMOTION]).toBe(0);
    expect(s.bloodDuke.life.source!.snapshot).toEqual(old); expect(s.blatherer.life.cases).toEqual(old.cases); expect(s.blatherer.life.note).toEqual(old.note);
    expect(s.blatherer.life.volunteer).toEqual(old.volunteer); expect(s.blatherer.life.guide).toEqual(old.guide); expect(s.blatherer.life.bell).toEqual(old.bell);
    expect(s.blatherer.life.playerTravelMetres).toBe(old.playerTravelMetres + 48); expect(s.blatherer.life.card.travelMetres).toBe(old.card.travelMetres + 24);
    expect([s.health, s.mind, s.spirituality, s.cash]).toEqual(resources); expect(s.injuries).toEqual(injuries); expect(s.demon).toEqual(demon); assertValidSliceState(s);
  }, 60_000);
  it('requires actual current consent, card ownership and ordinary travel before use; open scenes lock unrelated actions', () => {
    let s = act(promoted(), { type: 'OBSERVE', caseId: 'door-restraint' }); s = act(s, { type: 'PREPARE', caseId: 'door-restraint', method: 'ABILITY' });
    expect(hasBloodDukeLifeLock(s)).toBe(true); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    rejectBloodDuke(s, { type: 'CONSENT_NORA', caseId: 'door-restraint' }); rejectBloodDuke(s, { type: 'WALK', caseId: 'door-restraint', to: 'B' });
    s = act(s, { type: 'WALK', caseId: 'door-restraint', to: 'A' }); rejectBloodDuke(s, { type: 'TAKE_CARD', caseId: 'door-restraint' });
    s = act(s, { type: 'CONSENT_NORA', caseId: 'door-restraint' }); rejectBloodDuke(s, { type: 'SELF_RESTRAINT', caseId: 'door-restraint' });
    expect(s.blatherer.life.card.owner).toBe('BL3-NORA'); expect(s.blatherer.life.card.location).toBe('NORA');
  });
  it('charges successful current self-restraint once, requires actual application, and makes STOP retain its finite residual', () => {
    const before = promoted(); let s = selfWindow(before), id: BloodDukeCaseId = 'door-restraint';
    expect(attempt(s, id).selfRestraintTier).toBe('SUCCESS'); expect([s.spirituality, s.mind, s.health]).toEqual([before.spirituality - 6, before.mind - 2, before.health]);
    expect(s.bloodDuke.life.operation.restraintUntil! - s.blatherer.life.clockSeconds).toBe(8); expect(s.progression.mastery[SELF]).toBe(0);
    rejectBloodDuke(s, { type: 'SELF_RESTRAINT', caseId: id }); rejectBloodDuke(s, { type: 'WALK', caseId: id, to: 'START' });
    s = act(s, { type: 'PERFORM_OPERATION', caseId: id }); expect(s.progression.mastery[SELF]).toBe(0);
    s = act(s, { type: 'STOP', caseId: id }); expect(s.bloodDuke.life.operation.inputActive).toBe(false); expect(s.bloodDuke.life.operation.restraintUntil).not.toBeNull();
    rejectBloodDuke(s, { type: 'RETURN_CARD', caseId: id }); s = finish(s, id); expect(s.progression.mastery[SELF]).toBe(8); expect(s.health).toBe(before.health);
  });
  it('preserves failed real costs, creates no success window, and permits ordinary fallback without mastery', () => {
    const before = failedSelfSource(); let s = selfWindow(before); expect(attempt(s, 'door-restraint').selfRestraintTier).toBe('GREAT_FAILURE');
    expect([s.spirituality, s.mind, s.health]).toEqual([before.spirituality - 6, before.mind - 4, before.health]); expect(s.bloodDuke.life.operation.restraintUntil).toBeNull();
    rejectBloodDuke(s, { type: 'PERFORM_OPERATION', caseId: 'door-restraint' }); s = act(s, { type: 'MANUAL_OPERATION', caseId: 'door-restraint' }); s = finish(s, 'door-restraint');
    expect(s.progression.mastery[SELF]).toBe(0); expect(s.progression.acting).toBe(25);
  });
  it('requires a real voluntary bell rehearsal and current explicit strong emotion instead of a past license or remote mind control', () => {
    let s = ordinary(promoted(), 'door-restraint'); s = start(s, 'bell-hesitation'); rejectBloodDuke(s, { type: 'EMOTION_INTERFERENCE', caseId: 'bell-hesitation' });
    s = act(s, { type: 'REHEARSE_BELL', caseId: 'bell-hesitation' }); rejectBloodDuke(s, { type: 'EMOTION_INTERFERENCE', caseId: 'bell-hesitation' });
    s = returnA(s, 'bell-hesitation'); rejectBloodDuke(s, { type: 'EMOTION_INTERFERENCE', caseId: 'bell-hesitation' });
    s = act(s, { type: 'CONFIRM_EMOTION', caseId: 'bell-hesitation' }); s = act(s, { type: 'EMOTION_INTERFERENCE', caseId: 'bell-hesitation' });
    expect(s.bloodDuke.life.operation.hesitationUntil! - s.blatherer.life.clockSeconds).toBe(6);
    const source = s.bloodDuke.life.journal.at(-1)!.source!; expect(source).toMatchObject({ listenerId: 'BL3-NORA', listenerLocation: 'A', actorLocation: 'A', currentConsent: 'GRANTED', emotion: { triggerId: 'BL3-BELL', kind: 'STRONG_TENSION' } });
    expect(source.emotion!.confirmedAt).not.toBeNull(); s = act(s, { type: 'PERFORM_OPERATION', caseId: 'bell-hesitation' }); s = finish(s, 'bell-hesitation'); expect(s.progression.mastery[EMOTION]).toBe(8);
  });
  it('expires the actual emotion source with elapsed time and rejects another invented rehearsal', () => {
    let s = emotionReady(); s = act(s, { type: 'CONFIRM_EMOTION', caseId: 'bell-hesitation' });
    s = act(s, { type: 'WAIT_6', caseId: 'bell-hesitation' }); expect(s.bloodDuke.life.operation.emotion).not.toBeNull(); rejectBloodDuke(s, { type: 'EMOTION_INTERFERENCE', caseId: 'bell-hesitation' }); s = act(s, { type: 'WAIT_6', caseId: 'bell-hesitation' }); expect(s.bloodDuke.life.operation.emotion).toBeNull();
    rejectBloodDuke(s, { type: 'EMOTION_INTERFERENCE', caseId: 'bell-hesitation' }); rejectBloodDuke(s, { type: 'REHEARSE_BELL', caseId: 'bell-hesitation' });
    s = act(s, { type: 'MANUAL_OPERATION', caseId: 'bell-hesitation' }); s = finish(s, 'bell-hesitation'); expect(s.progression.mastery[EMOTION]).toBe(0);
  });
  it('withdrawal immediately forbids further application but retains paid resources and residual until actual wait', () => {
    let s = emotionReady(); s = act(s, { type: 'CONFIRM_EMOTION', caseId: 'bell-hesitation' }); s = act(s, { type: 'EMOTION_INTERFERENCE', caseId: 'bell-hesitation' });
    const paid = [s.mind, s.spirituality, s.health]; s = act(s, { type: 'WITHDRAW_PERMISSION', caseId: 'bell-hesitation' });
    expect(s.bloodDuke.life.operation.inputActive).toBe(false); expect(s.bloodDuke.life.operation.hesitationUntil).not.toBeNull();
    for (const type of ['PERFORM_OPERATION', 'EMOTION_INTERFERENCE', 'CONSENT_NORA', 'RETURN_CARD'] as const) rejectBloodDuke(s, { type, caseId: 'bell-hesitation' });
    s = finish(s, 'bell-hesitation', false); expect([s.mind, s.spirituality, s.health]).toEqual(paid); expect(s.blatherer.life.card.location).toBe('NORA'); expect(s.blatherer.life.playerLocation).toBe('START');
    rejectBloodDuke(s, { type: 'REPORT', caseId: 'bell-hesitation' }); expect(s.progression.mastery[EMOTION]).toBe(0); expect(s.progression.acting).toBe(25);
  });
  it('early STOP supports ordinary safe exit without inventing a report or awarding acting', () => {
    let s = act(promoted(), { type: 'OBSERVE', caseId: 'door-restraint' }); s = act(s, { type: 'PREPARE', caseId: 'door-restraint', method: 'ABILITY' });
    s = act(s, { type: 'STOP', caseId: 'door-restraint' }); s = finish(s, 'door-restraint', false);
    expect(hasBloodDukeLifeLock(s)).toBe(false); rejectBloodDuke(s, { type: 'REPORT', caseId: 'door-restraint' }); expect(s.progression.acting).toBe(0);
  });
  it('replays exact original-source handoff, budgets, RNG, dates, revision, consent and movement and rejects tampering', () => {
    let s = selfWindow(); s = act(s, { type: 'PERFORM_OPERATION', caseId: 'door-restraint' }); s = finish(s, 'door-restraint');
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.bloodDuke.life.source!.snapshot.card.travelMetres++; },
      x => { x.bloodDuke.life.source!.snapshot.cases['conflicting-bell'].attempts[0]!.steps[0]!.atSecond++; },
      x => { x.bloodDuke.life.journal[0]!.inheritedScene = null; },
      x => { x.bloodDuke.life.journal[1]!.inheritedScene = structuredClone(x.bloodDuke.life.source); },
      x => { x.bloodDuke.life.journal[1]!.budget.mindAfter--; },
      x => { x.bloodDuke.life.journal[2]!.revision = x.bloodDuke.life.journal[1]!.revision; },
      x => { x.bloodDuke.life.journal[2]!.date.day++; },
      x => { x.bloodDuke.life.journal.find(e => e.source)!.source!.currentConsent = 'WITHDRAWN' as never; },
      x => { x.bloodDuke.life.journal.find(e => e.check)!.check!.roll++; },
      x => { x.bloodDuke.life.journal.find(e => e.check)!.randomAfter!++; },
      x => { x.bloodDuke.life.cases['door-restraint'].attempts[0]!.playerMoves[0]!.metres = 8 as never; },
      x => { x.blatherer.life.card.travelMetres++; },
      x => { x.blatherer.life.volunteer.location = 'OUTSIDE'; },
      x => { x.progression.mastery[SELF] = 16; },
    ];
    for (const [i, mutate] of mutations.entries()) { const changed = structuredClone(s); mutate(changed); expect(validateBloodDukeLifeState(changed), `mutation${i}`).toBe(false); expect(() => assertValidSliceState(changed), `whole-state mutation${i}`).toThrow(); }
    expect(replayBloodDukeLifeRoot(s)).toEqual(s.blatherer.life);
  });
  it('preferred actions finish all three finite practices with natural projections and a safe ordinary fallback', () => {
    let s = promoted(); for (let i = 0; i < 150 && !s.bloodDuke.life.reflected; i++) {
      const p = projectBloodDukeLife(s), action = p.actions.find(a => a.id === p.preferredActionId); expect(action?.enabled, p.nextStep).toBe(true); s = act(s, action!.command);
    }
    expect(s.bloodDuke.life.reflected).toBe(true); expect(s.progression.acting).toBe(100); expect(bloodDukeLifeClosed(s)).toBe(true);
    const p = projectBloodDukeLife(s); expect(p.story + p.environment + p.facts.join('')).not.toMatch(/原创G|G6|START|BL3-|未核|原著推断/); expect(blockBloodDukeLife(s, { type: 'REFLECT' })).not.toBeNull();
  });
});
