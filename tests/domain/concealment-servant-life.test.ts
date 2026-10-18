import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { CONCEALMENT_SERVANT_ABILITY_IDS } from '../../src/domain/concealment-servant/types.js';
import { CONCEALMENT_SERVANT_CASE_IDS, createConcealmentServantLifeState, hasConcealmentServantLifeLock,
  projectConcealmentServantLife, validateConcealmentServantActivityCommand, validateConcealmentServantLife,
  type ConcealmentServantCaseId } from '../../src/domain/concealment-servant/life.js';
import { attempt, beginCase, closeCase, cs, darknessLegacyKeys, directedLifeReady, enterAndTake, rejectCs, reportCase, unitBudget } from './concealment-servant-test-fixture.js';

// Every branch in this file is explicitly directed unit play. Natural captures remain untouched.
function ordinary(s: SliceState, id: ConcealmentServantCaseId): SliceState {
  s = enterAndTake(beginCase(s, id, 'ORDINARY'), id);
  if (id === 'withdrawn-consent') s = cs(s, { type: 'WITHDRAW_CONSENT', caseId: id, actor: 'ERIN' });
  else {
    s = cs(s, { type: 'MOVE_BOX', caseId: id }); s = cs(s, { type: 'WEAK_SEARCH', caseId: id });
    if (id === 'blocked-door') s = cs(s, { type: 'BLOCK_DOOR', caseId: id });
  }
  return reportCase(closeCase(s, id), id);
}
function beforeBlocked(): SliceState { return ordinary(ordinary(directedLifeReady(), 'consented-box'), 'withdrawn-consent'); }
const oldRecords = (s: SliceState) => [...darknessLegacyKeys.map(k => s[k]), s.spiritWarlock, s.injuries, s.injuryRisk, s.combatHistory, s.town];
const both = (s: SliceState, id: ConcealmentServantCaseId = 'consented-box', roll = 1) => cs(cs(s, { type: 'CONCEAL', caseId: id }, roll), { type: 'TRACE_VEIL', caseId: id }, roll);

describe('Concealment Servant original finite room and real ordinary return', () => {
  it('starts with one ordinary door, living original adult, one original box/page and no spirit inventory', () => {
    const s = directedLifeReady(), life = s.concealmentServant.life;
    expect(life).toEqual(createConcealmentServantLifeState()); expect(Object.keys(life.cases)).toEqual([...CONCEALMENT_SERVANT_CASE_IDS]);
    expect(life.erin).toMatchObject({ id: 'CS2-ERIN', age: 38, alive: true, health: 100, mind: 100, location: 'EXIT' });
    expect(life.room).toEqual({ id: 'CS2-ROOM', lengthMetres: 6, doorId: 'CS2-DOOR', doorBlocked: false, concealed: false, remainingSeconds: 0 });
    expect(life.box).toMatchObject({ id: 'CS2-CASE-1', owner: 'CS2-ERIN', location: 'START' });
    expect(life.page).toMatchObject({ id: 'CS2-PAGE-1', owner: 'CS2-ERIN', location: 'ROOM' });
    expect(life.trace).toMatchObject({ id: 'CS2-TRACE-1', alive: false, conscious: false, exists: true });
    expect(hasConcealmentServantLifeLock(s)).toBe(false); expect(validateConcealmentServantLife(s)).toBe(true);
  });
  it('requires current separate owner and participant consent and actual movement through the original door', () => {
    let s = beginCase(directedLifeReady()); const id = 'consented-box';
    rejectCs(s, { type: 'ENTER_ROOM', caseId: id }); rejectCs(s, { type: 'CONCEAL', caseId: id });
    s = cs(s, { type: 'READ_SOURCE', caseId: id }); s = cs(s, { type: 'CHECK_DOOR', caseId: id });
    s = cs(s, { type: 'CONSENT_OWNER', caseId: id }); rejectCs(s, { type: 'AGREE_RETURN', caseId: id });
    s = cs(s, { type: 'CONSENT_PARTICIPANT', caseId: id }); s = cs(s, { type: 'AGREE_RETURN', caseId: id });
    expect(s.concealmentServant.life.playerLocation).toBe('EXIT'); expect(attempt(s).entered).toBe(false);
    s = cs(s, { type: 'ENTER_ROOM', caseId: id });
    expect(s.concealmentServant.life.playerLocation).toBe('ROOM'); expect(s.concealmentServant.life.erin.location).toBe('ROOM');
    expect([attempt(s).playerTravelMetres, attempt(s).erinTravelMetres]).toEqual([6, 6]);
    rejectCs(s, { type: 'CONCEAL', caseId: id }); s = cs(s, { type: 'TAKE_BOX', caseId: id });
    expect(s.concealmentServant.life.box.owner).toBe('CS2-ERIN'); expect(attempt(s)).toMatchObject({ ownerConsent: 'GRANTED', ownerConsentWeek: s.week, participantConsent: 'GRANTED', participantConsentWeek: s.week });
  });
  it.each(['DECLINE_OWNER', 'DECLINE_PARTICIPANT'] as const)('respects %s with ordinary report and no involuntary entry, spell or skill reward', type => {
    let s = beginCase(directedLifeReady()); const id = 'consented-box', spirit = s.spirituality;
    s = cs(s, { type: 'READ_SOURCE', caseId: id }); s = cs(s, { type, caseId: id });
    rejectCs(s, { type: 'ENTER_ROOM', caseId: id }); rejectCs(s, { type: 'CONCEAL', caseId: id });
    s = reportCase(closeCase(s)); expect(s.progression.acting).toBe(25); expect(s.spirituality).toBe(spirit);
    expect(CONCEALMENT_SERVANT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    expect(attempt(s)).toMatchObject({ result: 'ORDINARY', entered: false, playerTravelMetres: 0, closed: true });
  });
  it('successful windows retain bodies and objects, cost11S, and award zero until actual application/report', () => {
    let s = enterAndTake(beginCase(directedLifeReady())); const before = structuredClone(s), id = 'consented-box'; s = both(s);
    expect(s.spirituality).toBe(before.spirituality - 11); expect([s.health, s.mind, s.cash]).toEqual([before.health, before.mind, before.cash]);
    expect(oldRecords(s)).toEqual(oldRecords(before)); expect(s.concealmentServant.life.page).toEqual(before.concealmentServant.life.page);
    expect(s.concealmentServant.life).toMatchObject({ playerLocation: 'ROOM', erin: { location: 'ROOM' }, box: { owner: 'CS2-ERIN', location: 'PLAYER' }, room: { concealed: true, remainingSeconds: 58 } });
    for (const use of [attempt(s).concealment, attempt(s).traceVeil]) expect(use).toMatchObject({ attempts: 1, successes: 1, effects: 0, state: 'ACTIVE' });
    expect(CONCEALMENT_SERVANT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    rejectCs(s, { type: 'CONCEAL', caseId: id }); rejectCs(s, { type: 'TRACE_VEIL', caseId: id }); rejectCs(s, { type: 'EXIT_ROOM', caseId: id });
    s = cs(s, { type: 'WITHDRAW_CONSENT', caseId: id, actor: 'ERIN' }); s = reportCase(closeCase(s));
    expect(CONCEALMENT_SERVANT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    expect(s.spirituality).toBe(before.spirituality - 11); expect(attempt(s).result).toBe('ORDINARY');
  });
  it('awards exactly8 per actually applied ability, retaining one20-second weak search and original records', () => {
    let s = both(enterAndTake(beginCase(directedLifeReady()))); const id = 'consented-box', page = structuredClone(s.concealmentServant.life.page), cash = s.cash;
    s = cs(s, { type: 'MOVE_BOX', caseId: id }); expect(attempt(s).concealment.effects).toBe(1);
    s = cs(s, { type: 'WEAK_SEARCH', caseId: id });
    expect(attempt(s).traceVeil).toMatchObject({ attempts: 1, successes: 1, effects: 1, state: 'APPLIED', remainingSeconds: 0 });
    expect(attempt(s).search).toMatchObject({ delayedSeconds: 20, result: 'ROOM_CONCEALED' });
    expect(attempt(s).search!.completedAt - attempt(s).search!.requestedAt).toBe(21);
    expect(s.concealmentServant.life.trace).toMatchObject({ exists: true, searches: 1, delayedSearches: 1, totalDelaySeconds: 20 });
    expect(CONCEALMENT_SERVANT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]); rejectCs(s, { type: 'WEAK_SEARCH', caseId: id });
    s = reportCase(closeCase(s)); expect(CONCEALMENT_SERVANT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 8]);
    expect(attempt(s)).toMatchObject({ closed: true, boxReturned: true, exited: true, inspected: true, result: 'ABILITY', playerTravelMetres: 16, erinTravelMetres: 12, boxTravelMetres: 4, spiritualitySpent: 11 });
    expect(s.concealmentServant.life.page).toEqual(page); expect(s.cash).toBe(cash); expect(s.concealmentServant.life.box).toMatchObject({ location: 'START', owner: 'CS2-ERIN' });
    rejectCs(s, { type: 'REPORT', caseId: id }); rejectCs(s, { type: 'PREPARE', caseId: id, method: 'ABILITY' });
  });
  it('records successful concealment only when a real observation or move uses the window', () => {
    let s = enterAndTake(beginCase(directedLifeReady())), id = 'consented-box' as const;
    s = cs(s, { type: 'CONCEAL', caseId: id }, 1); s = cs(s, { type: 'WEAK_SEARCH', caseId: id });
    expect(attempt(s).search).toMatchObject({ delayedSeconds: 0, result: 'ROOM_CONCEALED' }); expect(attempt(s).concealment.effects).toBe(1);
    s = cs(s, { type: 'MOVE_BOX', caseId: id }); s = reportCase(closeCase(s));
    expect(CONCEALMENT_SERVANT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 0]);
  });
  it.each([90, 100])('pays failed directed rolls%s with no spatial conversion, free delay, reroll or mastery', roll => {
    let s = enterAndTake(beginCase(directedLifeReady())); const spirit = s.spirituality, id = 'consented-box'; s = both(s, id, roll);
    expect(s.spirituality).toBe(spirit - 11); expect(s.concealmentServant.life.room.concealed).toBe(false);
    for (const use of [attempt(s).concealment, attempt(s).traceVeil]) expect(use).toMatchObject({ attempts: 1, successes: 0, effects: 0, state: 'FAILED', remainingSeconds: 0 });
    rejectCs(s, { type: 'TRACE_VEIL', caseId: id }); s = cs(s, { type: 'MOVE_BOX', caseId: id }); s = cs(s, { type: 'WEAK_SEARCH', caseId: id });
    expect(attempt(s).search).toMatchObject({ delayedSeconds: 0, result: 'LOCATED' }); s = reportCase(closeCase(s));
    expect(CONCEALMENT_SERVANT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]); expect(attempt(s).result).toBe('ORDINARY');
  });
  it('expires both finite successful windows without extending them or granting unused mastery', () => {
    let s = both(enterAndTake(beginCase(directedLifeReady()))); const id = 'consented-box';
    for (let i = 0; i < 3; i++) s = cs(s, { type: 'WAIT_20', caseId: id });
    expect(attempt(s).waits).toBe(3); for (const use of [attempt(s).concealment, attempt(s).traceVeil]) expect(use).toMatchObject({ successes: 1, effects: 0, state: 'EXPIRED', remainingSeconds: 0 });
    expect(s.concealmentServant.life.room).toMatchObject({ concealed: false, remainingSeconds: 0 }); rejectCs(s, { type: 'WAIT_20', caseId: id });
    s = cs(s, { type: 'MOVE_BOX', caseId: id }); s = cs(s, { type: 'WEAK_SEARCH', caseId: id }); s = reportCase(closeCase(s));
    expect(CONCEALMENT_SERVANT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]); expect(attempt(s).search!.delayedSeconds).toBe(0);
  });
  it('a real earlier strong light counters unused windows and must be ordinarily switched off before exit', () => {
    let s = both(enterAndTake(beginCase(directedLifeReady()))); const id = 'consented-box', spirit = s.spirituality;
    s = cs(s, { type: 'LIGHT_ANCHOR', caseId: id });
    for (const use of [attempt(s).concealment, attempt(s).traceVeil]) expect(use).toMatchObject({ successes: 1, effects: 0, state: 'COUNTERED', remainingSeconds: 0 });
    s = cs(s, { type: 'MOVE_BOX', caseId: id }); s = cs(s, { type: 'WEAK_SEARCH', caseId: id }); s = cs(s, { type: 'RETURN_BOX', caseId: id });
    expect(attempt(s).search!.delayedSeconds).toBe(0); rejectCs(s, { type: 'EXIT_ROOM', caseId: id });
    s = cs(s, { type: 'SWITCH_OFF_ANCHOR', caseId: id }); s = reportCase(closeCase(s));
    expect(CONCEALMENT_SERVANT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]); expect(s.spirituality).toBe(spirit);
  });
  it('a later strong light cannot retroactively cancel completed real move or delayed search', () => {
    let s = both(enterAndTake(beginCase(directedLifeReady()))); const id = 'consented-box';
    s = cs(s, { type: 'MOVE_BOX', caseId: id }); s = cs(s, { type: 'WEAK_SEARCH', caseId: id }); const search = structuredClone(attempt(s).search);
    s = cs(s, { type: 'LIGHT_ANCHOR', caseId: id }); expect(attempt(s).search).toEqual(search);
    expect([attempt(s).concealment.effects, attempt(s).traceVeil.effects]).toEqual([1, 1]);
    s = reportCase(closeCase(s)); expect(CONCEALMENT_SERVANT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 8]);
  });
  it.each(['ERIN', 'PLAYER'] as const)('honors%s withdrawal immediately at zero actions and permits only real cleanup', actor => {
    let s = ordinary(directedLifeReady(), 'consented-box'); const id = 'withdrawn-consent';
    s = both(enterAndTake(beginCase(s, id), id), id); s.actionsRemaining = 0;
    const before = structuredClone(s); s = cs(s, { type: 'WITHDRAW_CONSENT', caseId: id, actor });
    expect(s.spirituality).toBe(before.spirituality); expect(s.actionsRemaining).toBe(0);
    expect(attempt(s, id)).toMatchObject({ stoppedBy: actor, participantConsent: 'REVOKED', concealment: { state: 'STOPPED', effects: 0 }, traceVeil: { state: 'STOPPED', effects: 0 } });
    for (const type of ['MOVE_BOX', 'WEAK_SEARCH', 'CONCEAL', 'TRACE_VEIL', 'WAIT_20'] as const) rejectCs(s, { type, caseId: id });
    rejectCs(s, { type: 'WITHDRAW_CONSENT', caseId: id, actor }); s = closeCase(s, id);
    expect(s.concealmentServant.life).toMatchObject({ playerLocation: 'EXIT', erin: { location: 'EXIT' }, box: { location: 'START' } });
    expect(s.spirituality).toBe(before.spirituality); expect(attempt(s, id).closed).toBe(true); expect(hasConcealmentServantLifeLock(s)).toBe(false);
    expect(CONCEALMENT_SERVANT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
  });
  it('blocked original door requires explicit release then physical unbolt and ordinary same-door return', () => {
    let s = enterAndTake(beginCase(beforeBlocked(), 'blocked-door'), 'blocked-door'); const id = 'blocked-door';
    s = both(s, id); s = cs(s, { type: 'MOVE_BOX', caseId: id }); s = cs(s, { type: 'WEAK_SEARCH', caseId: id }); s = cs(s, { type: 'BLOCK_DOOR', caseId: id });
    const position = [s.concealmentServant.life.playerLocation, s.concealmentServant.life.erin.location, s.concealmentServant.life.playerTravelMetres];
    rejectCs(s, { type: 'EXIT_ROOM', caseId: id }); rejectCs(s, { type: 'UNBOLT_DOOR', caseId: id }); rejectCs(s, { type: 'CLOSE', caseId: id });
    s = cs(s, { type: 'RELEASE_CONCEALMENT', caseId: id });
    expect([s.concealmentServant.life.playerLocation, s.concealmentServant.life.erin.location, s.concealmentServant.life.playerTravelMetres]).toEqual(position);
    expect(s.concealmentServant.life.room.doorBlocked).toBe(true); rejectCs(s, { type: 'EXIT_ROOM', caseId: id });
    s = cs(s, { type: 'UNBOLT_DOOR', caseId: id }); expect(attempt(s, id)).toMatchObject({ doorBlocked: true, releasedAfterBlock: true, doorUnbolted: true });
    s = reportCase(closeCase(s, id), id); expect(attempt(s, id)).toMatchObject({ playerTravelMetres: 16, erinTravelMetres: 36, boxTravelMetres: 4, exited: true, closed: true });
    expect(CONCEALMENT_SERVANT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 8]);
  });
  it('ordinary refusal, withdrawal and unbolt can complete all three cases plus reflection without any spell reward', () => {
    const before = directedLifeReady(); let s = before;
    for (const id of CONCEALMENT_SERVANT_CASE_IDS) s = ordinary(s, id);
    expect(s.progression.acting).toBe(75); s = cs(unitBudget(s), { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(CONCEALMENT_SERVANT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    expect([s.health, s.mind, s.spirituality, s.cash]).toEqual([before.health, before.mind, before.spirituality, before.cash]);
    expect(oldRecords(s)).toEqual(oldRecords(before)); expect(hasConcealmentServantLifeLock(s)).toBe(false); rejectCs(s, { type: 'REFLECT' });
    expect(Object.values(s.concealmentServant.life.cases).every(c => c.status === 'RESOLVED' && c.closes === 1 && c.attempts.length === 1)).toBe(true);
  });
  it('insufficient spirit permits ordinary cleanup, never free casts or hidden refill', () => {
    let s = enterAndTake(beginCase(directedLifeReady())); const id = 'consented-box'; s.spirituality = 4;
    rejectCs(s, { type: 'CONCEAL', caseId: id }); rejectCs(s, { type: 'TRACE_VEIL', caseId: id });
    s = cs(s, { type: 'MOVE_BOX', caseId: id }); s = cs(s, { type: 'WEAK_SEARCH', caseId: id }); s = closeCase(s);
    expect(s.spirituality).toBe(4); expect(attempt(s).spiritualitySpent).toBe(0);
  });
  it('holds the common runtime inside the original room and rejects old-stage actions', () => {
    const s = enterAndTake(beginCase(directedLifeReady())), before = structuredClone(s);
    expect(hasConcealmentServantLifeLock(s)).toBe(true);
    for (const payload of [{ type: 'ACTION', action: 'REST' }, { type: 'ACTION', action: 'WORK' }, { type: 'FEAR_BISHOP', command: { type: 'OBSERVE', caseId: 'contained-residue' } }, { type: 'CONCEALMENT_SERVANT', command: { type: 'ENCOUNTER_TALK' } }]) {
      expect(() => applySliceIntent(s, payload as Parameters<typeof applySliceIntent>[1])).toThrow(); expect(s).toEqual(before);
    }
  });
  it('projects real resources, counters and detached original objects rather than inventing applied effects', () => {
    const s = both(enterAndTake(beginCase(directedLifeReady()))), before = structuredClone(s), view = projectSliceState(s);
    expect(view.concealmentServant.resources).toMatchObject({ spirituality: s.spirituality, maxSpirituality: 120, health: s.health, mind: s.mind });
    expect(view.concealmentServant.life.currentAttempt!.traceVeil).toMatchObject({ attempts: 1, successes: 1, effects: 0 });
    const local = projectConcealmentServantLife(s); local.box.location = 'TABLE'; local.erin.location = 'EXIT'; local.currentAttempt!.traceVeil.effects = 1;
    expect(s).toEqual(before); expect(local.story).toContain('原创G');
  });
  it.each([{}, { type: 'TELEPORT', caseId: 'consented-box' }, { type: 'ENTER_ROOM', caseId: 'consented-box', ignoreDoor: true }, { type: 'WITHDRAW_CONSENT', caseId: 'consented-box', actor: 'SELENE' }, { type: 'PREPARE', caseId: 'consented-box', method: 'OMNISCIENT' }, { type: 'REFLECT', caseId: 'consented-box' }])
    ('rejects nonexact life commands%# without mutation', command => {
      expect(validateConcealmentServantActivityCommand(command)).toBe(false); rejectCs(directedLifeReady(), command);
    });
  it('rejects altered local source, geometry, ownership, bodies, consent, effects, costs and movement evidence', () => {
    const s = both(enterAndTake(beginCase(directedLifeReady())));
    const mutations: ((t: SliceState) => void)[] = [
      t => { (t.concealmentServant.life.room as unknown as { lengthMetres: number }).lengthMetres = 100; },
      t => { t.concealmentServant.life.page.text = 'erase all old records'; },
      t => { (t.concealmentServant.life.box as unknown as { owner: string }).owner = 'PLAYER'; },
      t => { (t.concealmentServant.life.trace as unknown as { exists: boolean }).exists = false; },
      t => { t.concealmentServant.life.trace.source = 'unbounded newly created spirit'; },
      t => { (t.concealmentServant.life.erin as unknown as { alive: boolean }).alive = false; },
      t => { t.concealmentServant.life.playerLocation = 'EXIT'; },
      t => { attempt(t).playerTravelMetres++; }, t => { attempt(t).spiritualitySpent--; },
      t => { attempt(t).ownerConsentWeek!--; }, t => { attempt(t).traceVeil.effects = 1; },
      t => { attempt(t).concealment.remainingSeconds = 600; },
      t => { t.progression.mastery[CONCEALMENT_SERVANT_ABILITY_IDS[0]] = 8; },
    ];
    for (const mutate of mutations) { const t = structuredClone(s); mutate(t); expect(validateConcealmentServantLife(t)).toBe(false); expect(() => assertValidSliceState(t)).toThrow(); }
  });
  it('replays the new life journal and rejects missing, duplicated, reordered, backdated or forged RNG events', () => {
    const s = both(enterAndTake(beginCase(directedLifeReady()))); expect(validateConcealmentServantLife(s)).toBe(true);
    const mutations: ((t: SliceState) => void)[] = [
      t => { t.concealmentServant.life.journal.pop(); },
      t => { t.concealmentServant.life.journal.push(structuredClone(t.concealmentServant.life.journal.at(-1)!)); },
      t => { const j = t.concealmentServant.life.journal; [j[0], j[1]] = [j[1]!, j[0]!]; },
      t => { t.concealmentServant.life.journal.at(-1)!.week = t.concealmentServant.promotionWeek! - 1; },
      t => { t.concealmentServant.life.journal.at(-1)!.tier = 'GREAT_FAILURE'; },
      t => { t.concealmentServant.life.journal.at(-1)!.randomAfter!++; },
      t => { t.concealmentServant.life.journal.at(-1)!.randomBefore = null; },
      t => { t.concealmentServant.life.journal[0]!.randomBefore = 0; },
      t => { t.concealmentServant.life.journal.at(-1)!.check = null; },
      t => { (t.concealmentServant.life.journal.at(-1)!.check! as { roll: number }).roll = 100; },
      t => { (t.concealmentServant.life.journal.at(-1)!.check! as { difficulty: number }).difficulty = 1; },
    ];
    for (const mutate of mutations) { const t = structuredClone(s); mutate(t); expect(validateConcealmentServantLife(t)).toBe(false); expect(() => assertValidSliceState(t)).toThrow(); }
  });
});
