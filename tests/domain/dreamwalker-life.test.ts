import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyDreamwalkerCommand, createDreamwalkerState, projectDreamwalker, validateDreamwalkerState } from '../../src/domain/dreamwalker/index.js';
import { applyDreamwalkerActivity, dreamwalkerActions, dreamwalkerCases, dreamwalkerInside, DREAMWALKER_ENVIRONMENT, validateDreamwalkerLife } from '../../src/domain/dreamwalker/life.js';
import { DREAMWALKER_ABILITY_IDS, DREAMWALKER_CASE_IDS, type DreamwalkerActivityCommand, type DreamwalkerCaseId } from '../../src/domain/dreamwalker/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[DREAMWALKER_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
function hypnotist(): SliceState {
  const old = JSON.parse(readFileSync('tests/fixtures/hypnotist-v0750/natural.json', 'utf8')).final;
  const s = migrateSliceState(old); s.dreamwalker = createDreamwalkerState();
  s.week = s.hypnotist.promotionWeek! + 12; s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26; s.world.city = 'BACKLUND';
  return s;
}
function promoted(closeRitual = true): SliceState {
  const s = hypnotist(), c = context(s).ctx;
  applyDreamwalkerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyDreamwalkerCommand(s, { type: 'BUY_POTION', bottleId: s.dreamwalker.bottles[0]!.id }, c);
  applyDreamwalkerCommand(s, { type: 'REQUEST_RITUAL' }, c); s.week += 1;
  applyDreamwalkerCommand(s, { type: 'BEGIN_RITUAL' }, c);
  applyDreamwalkerCommand(s, { type: 'CONSUME', bottleId: s.dreamwalker.bottles[0]!.id, confirmed: true }, c);
  if (closeRitual) applyDreamwalkerCommand(s, { type: 'END_RITUAL' }, c);
  return s;
}
function act(s: SliceState, command: DreamwalkerActivityCommand, roll = 1) { const c = context(s, roll); applyDreamwalkerActivity(s, command, c.ctx, c.award); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyDreamwalkerActivity(s, command as DreamwalkerActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: DreamwalkerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: DreamwalkerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId }); act(s, { type: 'CLOSE', caseId });
  if (caseId === 'repeated-garden') {
    s.week += 1; act(s, { type: 'PREPARE', caseId, method }); act(s, { type: 'PERFORM', caseId }); act(s, { type: 'CLOSE', caseId });
  }
  if (caseId === 'paired-dream') act(s, { type: 'RETURN' });
  act(s, { type: 'VERIFY', caseId }); act(s, { type: 'REPORT', caseId });
}
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');

describe('Dreamwalker original voluntary dream records and waking verification', () => {
  it('keeps future cases and precise practice state hidden until promotion', () => {
    const s = hypnotist(); expect(dreamwalkerCases(s)).toEqual([]); expect(dreamwalkerActions(s)).toEqual([]);
    expect(projectDreamwalker(s).practice).toBeNull(); expect(validateDreamwalkerLife(s)).toBe(true);
    const p = promoted(); expect(dreamwalkerCases(p).map(c => c.id)).toEqual([...DREAMWALKER_CASE_IDS]);
    expect(dreamwalkerCases(p).every(c => c.observations.length === 0)).toBe(true);
    expect(projectDreamwalker(p).practice).toEqual({ location: 'SOURCE_ROOM', dream: 'NONE', outboundTrips: 0, returns: 0, wakingChecks: 0 });
    expect(DREAMWALKER_ENVIRONMENT).toContain('不超过500米'); expect(validateDreamwalkerState(p)).toBe(true);
  });
  it('counts the still-active promotion visit as inside and allows no life shortcuts', () => {
    const s = promoted(false); expect(dreamwalkerInside(s)).toBe(true);
    for (const command of [{ type: 'OBSERVE', caseId: 'dream-evidence' }, { type: 'CLOSE', caseId: 'dream-evidence' }, { type: 'RETURN' }, { type: 'ENCOUNTER_TALK' }]) reject(s, command);
    expect(dreamwalkerActions(s).every(action => !action.enabled)).toBe(true);
    applyDreamwalkerCommand(s, { type: 'END_RITUAL' }, context(s).ctx); expect(dreamwalkerInside(s)).toBe(false);
    act(s, { type: 'OBSERVE', caseId: 'dream-evidence' }); expect(validateDreamwalkerState(s)).toBe(true);
  });
  it.each([null, {}, { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: 'dream-evidence', method: 'FORCE_SLEEP' }, { type: 'RETURN', caseId: 'paired-dream' }, { type: 'CLOSE', caseId: 'paired-dream', destination: 'SOURCE_ROOM' }, { type: 'VERIFY', caseId: 'dream-evidence', truth: true }, { type: 'REFLECT', extra: true }])('rejects malformed or invented commands without mutation %#', command => {
    reject(promoted(), command);
  });
  it('requires observation and a single real preparation before any implementation', () => {
    const s = promoted(); reject(s, { type: 'PERFORM', caseId: 'dream-evidence' }); reject(s, { type: 'VERIFY', caseId: 'dream-evidence' });
    begin(s, 'dream-evidence', 'ABILITY'); reject(s, { type: 'OBSERVE', caseId: 'repeated-garden' }); reject(s, { type: 'ENCOUNTER_FIGHT' });
    expect(s.dreamwalker.practice).toMatchObject({ location: 'SOURCE_ROOM', dream: 'NONE' });
    expect(dreamwalkerInside(s)).toBe(false); expect(validateDreamwalkerLife(s)).toBe(true);
  });
  it('records only Noel’s existing dream, pays two spirit and requires an actual exit before checking reality', () => {
    const s = promoted(); begin(s, 'dream-evidence', 'ABILITY'); const spirit = s.spirituality, ap = s.actionsRemaining;
    const c = act(s, { type: 'PERFORM', caseId: 'dream-evidence' });
    expect(c.ctx.check).toHaveBeenCalledWith('will', 14); expect([s.spirituality, s.actionsRemaining]).toEqual([spirit - 2, ap - 1]);
    expect(s.dreamwalker.practice).toMatchObject({ location: 'SOURCE_ROOM', dream: 'NOEL', wakingChecks: 0 });
    expect(s.dreamwalker.cases['dream-evidence']).toMatchObject({ status: 'EXAMINED', sessions: 1, verified: false, outcome: 'NONE', contactOpen: true });
    expect(messages(c)).toContain('箱子换位'); expect(messages(c)).toContain('没有把清醒者拉入梦'); expect(validateDreamwalkerState(s)).toBe(true);
    reject(s, { type: 'VERIFY', caseId: 'dream-evidence' }); reject(s, { type: 'REPORT', caseId: 'dream-evidence' }); reject(s, { type: 'RETURN' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    act(s, { type: 'CLOSE', caseId: 'dream-evidence' });
    expect(s.dreamwalker.practice).toMatchObject({ location: 'SOURCE_ROOM', dream: 'NONE' }); expect(dreamwalkerInside(s)).toBe(false);
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); reject(s, { type: 'VERIFY', caseId: 'dream-evidence' });
  });
  it('ordinary testimony uses no spirit or entry and is still only a recollection until checked', () => {
    const s = promoted(); s.spirituality = 0; begin(s, 'dream-evidence');
    const c = act(s, { type: 'PERFORM', caseId: 'dream-evidence' });
    expect(c.ctx.check).toHaveBeenCalledWith('knowledge', 10); expect(s.spirituality).toBe(0);
    expect(s.dreamwalker.practice.dream).toBe('NONE'); expect(messages(c)).toContain('没有入梦'); expect(messages(c)).toContain('清醒自述');
    act(s, { type: 'CLOSE', caseId: 'dream-evidence' }); reject(s, { type: 'REPORT', caseId: 'dream-evidence' });
    expect(validateDreamwalkerState(s)).toBe(true);
  });
  it('spends a separate action on fixed waking evidence without a truth roll or early award', () => {
    const s = promoted(); begin(s, 'dream-evidence'); act(s, { type: 'PERFORM', caseId: 'dream-evidence' }); act(s, { type: 'CLOSE', caseId: 'dream-evidence' });
    const ap = s.actionsRemaining, spirit = s.spirituality, c = act(s, { type: 'VERIFY', caseId: 'dream-evidence' });
    expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled(); expect(s.progression.acting).toBe(0);
    expect([s.actionsRemaining, s.spirituality, s.dreamwalker.practice.wakingChecks]).toEqual([ap - 1, spirit, 1]);
    expect(s.dreamwalker.cases['dream-evidence']).toMatchObject({ verified: true, outcome: 'EVIDENCE_CHECKED' });
    expect(messages(c)).toContain('原交接记录'); expect(messages(c)).toContain('没有据梦认定犯罪');
    reject(s, { type: 'VERIFY', caseId: 'dream-evidence' }); act(s, { type: 'REPORT', caseId: 'dream-evidence' });
    expect(s.progression.acting).toBe(25); expect(s.seer.completedSources.filter(x => x === 'dreamwalker-case:dream-evidence')).toHaveLength(1);
    reject(s, { type: 'REPORT', caseId: 'dream-evidence' }); expect(validateDreamwalkerState(s)).toBe(true);
  });
});

describe('Dreamwalker repeated garden needs two actual weeks', () => {
  it.each(['ABILITY', 'ORDINARY'] as const)('preserves a first real session, then closes to OBSERVED and waits for a new week: %s', method => {
    const s = promoted(), spirit = s.spirituality; begin(s, 'repeated-garden', method);
    act(s, { type: 'PERFORM', caseId: 'repeated-garden' }); const firstWeek = s.week;
    expect(s.dreamwalker.cases['repeated-garden']).toMatchObject({ status: 'EXAMINED', sessions: 1, sessionWeeks: [firstWeek], verified: false });
    expect(s.dreamwalker.practice).toMatchObject({ location: 'SOURCE_ROOM', dream: method === 'ABILITY' ? 'AMINA' : 'NONE' });
    expect(validateDreamwalkerState(s)).toBe(true); act(s, { type: 'CLOSE', caseId: 'repeated-garden' });
    expect(s.dreamwalker.cases['repeated-garden']!.status).toBe('OBSERVED');
    reject(s, { type: 'PREPARE', caseId: 'repeated-garden', method }); reject(s, { type: 'VERIFY', caseId: 'repeated-garden' }); reject(s, { type: 'REPORT', caseId: 'repeated-garden' });
    s.week += 1; act(s, { type: 'PREPARE', caseId: 'repeated-garden', method }); act(s, { type: 'PERFORM', caseId: 'repeated-garden' });
    expect(s.dreamwalker.cases['repeated-garden']).toMatchObject({ status: 'EXAMINED', sessions: 2, sessionWeeks: [firstWeek, firstWeek + 1], verified: false });
    act(s, { type: 'CLOSE', caseId: 'repeated-garden' }); const c = act(s, { type: 'VERIFY', caseId: 'repeated-garden' });
    expect(messages(c)).toContain('她本人的有限反馈'); expect(messages(c)).toContain('不把两次练习报告为治愈');
    act(s, { type: 'REPORT', caseId: 'repeated-garden' }); expect(s.spirituality).toBe(spirit - (method === 'ABILITY' ? 6 : 0));
    expect(validateDreamwalkerState(s)).toBe(true);
  });
  it('keeps each actual method when an ordinary second session follows an ability first session', () => {
    const s = promoted(); begin(s, 'repeated-garden', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'repeated-garden' }); act(s, { type: 'CLOSE', caseId: 'repeated-garden' });
    const first = s.dreamwalker.cases['repeated-garden']!.notes[0]; s.week += 1;
    act(s, { type: 'PREPARE', caseId: 'repeated-garden', method: 'ORDINARY' }); act(s, { type: 'PERFORM', caseId: 'repeated-garden' }); act(s, { type: 'CLOSE', caseId: 'repeated-garden' });
    const p = dreamwalkerCases(s).find(c => c.id === 'repeated-garden')!;
    expect(p.sessions).toBe(2); expect(p.sessionWeeks[1]).toBeGreaterThan(p.sessionWeeks[0]!); expect(p.verified).toBe(false);
    expect(s.dreamwalker.cases['repeated-garden']!.notes[0]).toBe(first); expect(p.observations.join(' ')).toContain('有限调整'); expect(p.observations.join(' ')).toContain('普通谈话');
    act(s, { type: 'VERIFY', caseId: 'repeated-garden' }); act(s, { type: 'REPORT', caseId: 'repeated-garden' }); expect(validateDreamwalkerState(s)).toBe(true);
  });
  it('retains the first week when the later ability session fails, consumes costs and requires another actual preparation', () => {
    const s = promoted(); begin(s, 'repeated-garden'); act(s, { type: 'PERFORM', caseId: 'repeated-garden' }); act(s, { type: 'CLOSE', caseId: 'repeated-garden' });
    const firstWeek = s.week, firstNote = s.dreamwalker.cases['repeated-garden']!.notes[0]; s.week += 1;
    act(s, { type: 'PREPARE', caseId: 'repeated-garden', method: 'ABILITY' }); const ap = s.actionsRemaining, spirit = s.spirituality, mind = s.mind;
    act(s, { type: 'PERFORM', caseId: 'repeated-garden' }, 100);
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([ap - 1, spirit - 3, mind - 5]);
    expect(s.dreamwalker.cases['repeated-garden']).toMatchObject({ status: 'OBSERVED', sessions: 1, sessionWeeks: [firstWeek], notes: [firstNote], verified: false });
    expect(validateDreamwalkerState(s)).toBe(true); act(s, { type: 'CLOSE', caseId: 'repeated-garden' });
    reject(s, { type: 'PREPARE', caseId: 'repeated-garden', method: 'ORDINARY' }); reject(s, { type: 'VERIFY', caseId: 'repeated-garden' });
    s.week += 1; reject(s, { type: 'PERFORM', caseId: 'repeated-garden' });
    act(s, { type: 'PREPARE', caseId: 'repeated-garden', method: 'ORDINARY' }); act(s, { type: 'PERFORM', caseId: 'repeated-garden' }); act(s, { type: 'CLOSE', caseId: 'repeated-garden' });
    expect(s.dreamwalker.cases['repeated-garden']!.sessionWeeks).toEqual([firstWeek, firstWeek + 2]); expect(validateDreamwalkerState(s)).toBe(true);
  });
});

describe('Dreamwalker actual body travel, current-node exit and ordinary return', () => {
  it.each(['ABILITY', 'ORDINARY'] as const)('really reaches TARGET_ROOM, exits there and must explicitly walk the original route back: %s', method => {
    const s = promoted(), spirit = s.spirituality, town = structuredClone(s.town), carried = structuredClone(s.world);
    begin(s, 'paired-dream', method); const c = act(s, { type: 'PERFORM', caseId: 'paired-dream' });
    expect(s.dreamwalker.practice).toEqual({ location: 'TARGET_ROOM', dream: method === 'ABILITY' ? 'AMINA' : 'NONE', outboundTrips: 1, returns: 0, wakingChecks: 0 });
    expect(s.spirituality).toBe(spirit - (method === 'ABILITY' ? 4 : 0)); expect(messages(c)).toContain('160米');
    expect(messages(c)).toContain(method === 'ABILITY' ? '身体虚化' : '实际步行'); expect(validateDreamwalkerState(s)).toBe(true);
    reject(s, { type: 'RETURN' }); reject(s, { type: 'VERIFY', caseId: 'paired-dream' }); reject(s, { type: 'ENCOUNTER_TALK' });
    const ap = s.actionsRemaining; act(s, { type: 'CLOSE', caseId: 'paired-dream' });
    expect([s.actionsRemaining, s.dreamwalker.practice.location, s.dreamwalker.practice.dream, dreamwalkerInside(s)]).toEqual([ap, 'TARGET_ROOM', 'NONE', true]);
    expect(dreamwalkerCases(s).find(c => c.id === 'paired-dream')!.contactOpen).toContain('仍须沿原160米普通路返回');
    expect(validateDreamwalkerState(s)).toBe(true); reject(s, { type: 'VERIFY', caseId: 'paired-dream' }); reject(s, { type: 'OBSERVE', caseId: 'dream-evidence' });
    const back = act(s, { type: 'RETURN' }); expect(back.ctx.check).not.toHaveBeenCalled(); expect(s.actionsRemaining).toBe(ap);
    expect(s.dreamwalker.practice).toEqual({ location: 'SOURCE_ROOM', dream: 'NONE', outboundTrips: 1, returns: 1, wakingChecks: 0 });
    expect(messages(back)).toContain('步行回SOURCE_ROOM'); expect(messages(back)).toContain('1行动已包含'); expect(dreamwalkerInside(s)).toBe(false);
    reject(s, { type: 'RETURN' }); act(s, { type: 'VERIFY', caseId: 'paired-dream' }); act(s, { type: 'REPORT', caseId: 'paired-dream' });
    expect(s.town).toEqual(town); expect(s.world).toEqual(carried); expect(validateDreamwalkerState(s)).toBe(true);
  });
  it.each(['ABILITY', 'ORDINARY'] as const)('failed paired attempts preserve SOURCE_ROOM and never invent a successful trip: %s', method => {
    const s = promoted(), spirit = s.spirituality; begin(s, 'paired-dream', method); act(s, { type: 'PERFORM', caseId: 'paired-dream' }, 100);
    expect(s.dreamwalker.practice).toMatchObject({ location: 'SOURCE_ROOM', dream: method === 'ABILITY' ? 'NOEL' : 'NONE', outboundTrips: 0, returns: 0 });
    expect(s.dreamwalker.cases['paired-dream']).toMatchObject({ status: 'OBSERVED', sessions: 0, sessionWeeks: [], notes: [], outcome: 'NONE' });
    expect(s.spirituality).toBe(spirit - (method === 'ABILITY' ? 4 : 0)); expect(validateDreamwalkerState(s)).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'paired-dream' }); reject(s, { type: 'RETURN' }); reject(s, { type: 'PREPARE', caseId: 'paired-dream', method });
    s.week += 1; act(s, { type: 'PREPARE', caseId: 'paired-dream', method }); act(s, { type: 'PERFORM', caseId: 'paired-dream' });
    act(s, { type: 'CLOSE', caseId: 'paired-dream' }); act(s, { type: 'RETURN' }); expect(validateDreamwalkerState(s)).toBe(true);
  });
  it('keeps zero-action exit and walking available at zero spirit, mind and AP without granting free healing', () => {
    const s = promoted(); begin(s, 'paired-dream', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'paired-dream' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; const week = s.week;
    const close = act(s, { type: 'CLOSE', caseId: 'paired-dream' }); const back = act(s, { type: 'RETURN' });
    expect(close.ctx.check).not.toHaveBeenCalled(); expect(back.ctx.check).not.toHaveBeenCalled();
    expect([s.week, s.actionsRemaining, s.spirituality, s.mind]).toEqual([week, 0, 0, 0]);
    expect(s.dreamwalker.practice).toMatchObject({ location: 'SOURCE_ROOM', dream: 'NONE', returns: 1 });
    reject(s, { type: 'VERIFY', caseId: 'paired-dream' }); expect(validateDreamwalkerState(s)).toBe(true);
  });
  it('public intents hold the last-action week after CLOSE at target until the actual RETURN', () => {
    const s = promoted(); begin(s, 'paired-dream'); act(s, { type: 'PERFORM', caseId: 'paired-dream' }); s.actionsRemaining = 0; s.weeklyBudget = 3; s.debts = [];
    const week = s.week; expect(() => applySliceIntent(s, { type: 'ACTION', action: 'WORK' })).toThrow();
    const closed = applySliceIntent(s, { type: 'DREAMWALKER', command: { type: 'CLOSE', caseId: 'paired-dream' } });
    expect([closed.week, closed.actionsRemaining, closed.dreamwalker.practice.location]).toEqual([week, 0, 'TARGET_ROOM']);
    expect(() => applySliceIntent(closed, { type: 'ACTION', action: 'WORK' })).toThrow();
    const returned = applySliceIntent(closed, { type: 'DREAMWALKER', command: { type: 'RETURN' } });
    expect(returned.dreamwalker.practice).toMatchObject({ location: 'SOURCE_ROOM', dream: 'NONE', returns: 1 });
    expect(returned.week).toBe(week + 1);
  });
});

describe('Dreamwalker finite rewards, costs, projection and persisted boundaries', () => {
  it.each(DREAMWALKER_CASE_IDS)('can cancel an unaffordable ability preparation and choose an actual ordinary method: %s', caseId => {
    const s = promoted(); begin(s, caseId, 'ABILITY'); s.spirituality = 0; reject(s, { type: 'PERFORM', caseId });
    const ap = s.actionsRemaining; act(s, { type: 'WITHDRAW', caseId }); expect(s.actionsRemaining).toBe(ap);
    expect(s.dreamwalker.cases[caseId]).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1 });
    act(s, { type: 'PREPARE', caseId, method: 'ORDINARY' }); act(s, { type: 'PERFORM', caseId }); expect(s.spirituality).toBe(0);
    expect(validateDreamwalkerState(s)).toBe(true);
  });
  it.each(['ABILITY', 'ORDINARY'] as const)('earns peaceful100 only from three verified reports and reflection: %s', method => {
    const s = promoted(), spirit = s.spirituality;
    for (const id of DREAMWALKER_CASE_IDS) complete(s, id, method);
    expect(s.progression.acting).toBe(75); expect(s.dreamwalker.practice).toEqual({ location: 'SOURCE_ROOM', dream: 'NONE', outboundTrips: 1, returns: 1, wakingChecks: 3 });
    expect(s.progression.mastery[DREAMWALKER_ABILITY_IDS[0]]).toBe(24); act(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.spirituality, s.dreamwalker.encounter.status]).toEqual([100, spirit - (method === 'ABILITY' ? 12 : 0), 'AVAILABLE']);
    expect(s.seer.completedSources.filter(x => x === 'dreamwalker-reflection')).toHaveLength(1); reject(s, { type: 'REFLECT' });
    expect(validateDreamwalkerState(s)).toBe(true);
  });
  it('returns copies of session weeks and practice position rather than mutable public aliases', () => {
    const s = promoted(); begin(s, 'repeated-garden'); act(s, { type: 'PERFORM', caseId: 'repeated-garden' });
    const original = structuredClone(s.dreamwalker), p = dreamwalkerCases(s), view = projectDreamwalker(s);
    p.find(c => c.id === 'repeated-garden')!.sessionWeeks.push(999); p[0]!.observations.push('forged'); view.practice!.location = 'TARGET_ROOM';
    expect(s.dreamwalker).toEqual(original);
  });
  it('rejects invented practice nodes, current dreams, fake trips, waking checks and duplicate growth sources', () => {
    const s = promoted(); complete(s, 'dream-evidence');
    const mutations: ((t: SliceState) => void)[] = [
      t => { t.dreamwalker.practice.location = 'TARGET_ROOM'; },
      t => { t.dreamwalker.practice.dream = 'NOEL'; },
      t => { t.dreamwalker.practice.outboundTrips = 1; t.dreamwalker.practice.returns = 1; },
      t => { t.dreamwalker.practice.wakingChecks = 0; },
      t => { t.dreamwalker.cases['dream-evidence']!.verified = false; },
      t => { t.dreamwalker.cases['dream-evidence']!.outcome = 'TRAVEL_CHECKED'; },
      t => { t.dreamwalker.cases['dream-evidence']!.notes[0] = '梦境已经证明犯罪'; },
      t => { t.seer.completedSources.push('dreamwalker-case:dream-evidence'); },
      t => { t.progression.acting = 100; },
    ];
    for (const mutation of mutations) { const t = structuredClone(s); mutation(t); expect(validateDreamwalkerLife(t)).toBe(false); }
  });
  it('rejects same-week garden fabrication, lost original records and fabricated completion', () => {
    const s = promoted(); complete(s, 'repeated-garden');
    for (const mutation of [
      (t: SliceState) => { t.dreamwalker.cases['repeated-garden']!.sessionWeeks[1] = t.dreamwalker.cases['repeated-garden']!.sessionWeeks[0]!; },
      (t: SliceState) => { t.dreamwalker.cases['repeated-garden']!.sessions = 1; },
      (t: SliceState) => { t.dreamwalker.cases['repeated-garden']!.notes.pop(); },
      (t: SliceState) => { t.dreamwalker.cases['repeated-garden']!.sessionWeeks[1] = s.week + 1; },
      (t: SliceState) => { t.dreamwalker.cases['repeated-garden']!.closes = 1; },
    ]) { const t = structuredClone(s); mutation(t); expect(validateDreamwalkerLife(t)).toBe(false); }
  });
  it('rejects an implicit physical return, cross-week open dream and premature reality verification', () => {
    const s = promoted(); begin(s, 'paired-dream', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'paired-dream' });
    for (const mutation of [
      (t: SliceState) => { t.dreamwalker.practice.location = 'SOURCE_ROOM'; t.dreamwalker.practice.returns = 1; },
      (t: SliceState) => { t.dreamwalker.practice.dream = 'NOEL'; },
      (t: SliceState) => { t.week += 1; },
      (t: SliceState) => { t.dreamwalker.cases['paired-dream']!.verified = true; t.dreamwalker.cases['paired-dream']!.outcome = 'TRAVEL_CHECKED'; t.dreamwalker.practice.wakingChecks = 1; },
    ]) { const t = structuredClone(s); mutation(t); expect(validateDreamwalkerLife(t)).toBe(false); }
    act(s, { type: 'CLOSE', caseId: 'paired-dream' }); const copied = JSON.parse(JSON.stringify(s)) as SliceState;
    expect(validateDreamwalkerState(copied)).toBe(true); expect(copied.dreamwalker.practice.location).toBe('TARGET_ROOM');
    act(copied, { type: 'RETURN' }); expect(validateDreamwalkerState(copied)).toBe(true);
  });
});
