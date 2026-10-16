import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createChaosHunterState } from '../../src/domain/chaos-hunter/index.js';
import {
  advanceChaosHunterClock, advanceChaosHunterLifeClock, applyChaosHunterActivity, blockChaosHunterLife,
  CHAOS_HUNTER_CASE_IDS, chaosHunterLifeActions, createChaosHunterLifeState, hasChaosHunterLifeLock,
  projectChaosHunterLife, validateChaosHunterActivityCommand, validateChaosHunterLife,
  type ChaosHunterActivityCommand, type ChaosHunterCaseId,
} from '../../src/domain/chaos-hunter/life.js';

const ABILITY = 'justiciar.s3.bounded-order';
/** Directed isolated fixtures, explicitly not evidence of natural promotion or natural success. */
function ready(): SliceState {
  const s = createSliceRun('chaos-hunter-life-directed', sliceDefaultCreationSelection, 'chaos-hunter-life-directed');
  s.chaosHunter = createChaosHunterState(); s.week = 110; s.chaosHunter.promotionWeek = 109; s.chaosHunter.imperativeMageActingAtPromotion = 100;
  s.progression = { pathwayId: 'justiciar', sequence: 3, acting: 0, promotionWeek: 109, mastery: { [ABILITY]: 0, 'justiciar.s4.deprivation': 24 } };
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000; s.injuries = [];
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
const context = (s: SliceState, checkRoll = 1): SeerContext => ({
  roll: vi.fn(() => { throw new Error('Marked-line scenes never draw another event, resistance or luck roll.'); }), note: vi.fn(),
  check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: checkRoll })),
});
function act(s: SliceState, command: ChaosHunterActivityCommand, checkRoll = 1) { const ctx = context(s, checkRoll); applyChaosHunterActivity(s, command, ctx); expect(validateChaosHunterLife(s), command.type).toBe(true); return ctx; }
type PlainStep = Exclude<ChaosHunterActivityCommand['type'], 'PREPARE' | 'REFLECT' | 'CONFIRM_LIMITED'>;
function step(s: SliceState, caseId: ChaosHunterCaseId, type: PlainStep, checkRoll = 1) { return act(s, { type, caseId } as ChaosHunterActivityCommand, checkRoll); }
function reject(s: SliceState, command: ChaosHunterActivityCommand) { const before = structuredClone(s), ctx = context(s); expect(() => applyChaosHunterActivity(s, command, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled(); }
const attempt = (s: SliceState, id: ChaosHunterCaseId) => s.chaosHunter.life.cases[id].attempts[0]!;
function start(s: SliceState, id: ChaosHunterCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { step(s, id, 'OBSERVE'); act(s, { type: 'PREPARE', caseId: id, method }); step(s, id, 'START_CASE'); }
function approach(s: SliceState, id: ChaosHunterCaseId) { step(s, id, 'GO_A'); step(s, id, 'CHECK_OBJECT'); }
function cast(s: SliceState, id: ChaosHunterCaseId, roll = 1) { approach(s, id); return step(s, id, 'PERFORM', roll); }
function tryBoth(s: SliceState, id: ChaosHunterCaseId, partnerFirst = false) {
  if (id !== 'own-line' && partnerFirst) step(s, id, 'TRY_PARTNER'); step(s, id, 'TRY_PLAYER'); if (id !== 'own-line' && !partnerFirst) step(s, id, 'TRY_PARTNER');
}
function finish(s: SliceState, id: ChaosHunterCaseId, report = true) {
  step(s, id, 'READ_RESULT'); if (!attempt(s, id).stopped) step(s, id, 'STOP_RULE');
  if (s.chaosHunter.life.volunteer.location === 'B') step(s, id, 'RETURN_PERSON');
  if (s.chaosHunter.life.playerLocation === 'A') step(s, id, 'WALK_B');
  for (const type of ['TAKE_OBJECT', 'RETURN_A', 'RETURN_OBJECT'] as const) step(s, id, type);
  if (id === 'own-line') act(s, { type: 'CONFIRM_LIMITED', caseId: id, claim: 'LIMITED' });
  for (const type of ['RECORD_OUTCOME', 'RETURN_START', 'LEAVE_CASE'] as const) step(s, id, type);
  if (report) step(s, id, 'REPORT_CASE');
}
function complete(s: SliceState, id: ChaosHunterCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY', roll = 1) {
  start(s, id, method); cast(s, id, roll); if (id === 'withdrawn-line' && method === 'ABILITY') step(s, id, 'STOP_RULE'); tryBoth(s, id); finish(s, id);
}
function firstTwo(s: SliceState) { complete(s, 'paired-line', 'ORDINARY'); complete(s, 'withdrawn-line', 'ORDINARY'); }
function oldSources(s: SliceState) { return structuredClone({ arbiter: s.arbiter, sheriff: s.sheriff, interrogator: s.interrogator, judge: s.judge, punishmentKnight: s.punishmentKnight, imperativeMage: s.imperativeMage, winner: s.winner, character: s.character, world: s.world }); }

describe('Chaos Hunter directed original marked line and independent bodily attempts', () => {
  it('creates one new adult, one350g parcel, one unchanging paper and one physical non-wall line', () => {
    const s = ready(), l = s.chaosHunter.life; expect(l).toEqual(createChaosHunterLifeState()); expect(validateChaosHunterLife(s)).toBe(true);
    expect(l.volunteer).toMatchObject({ id: 'CH3-MIRA', name: '米拉·佩恩', age: 43, independentMind: true, location: 'A', health: 100, mind: 100 });
    expect(l.parcel).toMatchObject({ id: 'CH3-PARCEL', quantity: 1, massGrams: 350, owner: 'GUIDE', holder: 'GUIDE', location: 'START' });
    expect(l.line).toMatchObject({ id: 'CH3-LINE', holder: 'GUIDE', location: 'START', isWall: false }); expect(l.paper.text).toBe('本次从A到B的越线');
    for (const text of ['原著直接依据', '原创G', '完整配方', '天使', '不能自动豁免']) expect(projectChaosHunterLife(s).story).toContain(text);
    expect('luck' in l).toBe(false);
  });
  it('locks START_CASE without moving originals, taking consent, charging resolution or creating a result', () => {
    const s = ready(); start(s, 'paired-line'); expect(hasChaosHunterLifeLock(s)).toBe(true); expect(s.actionsRemaining).toBe(98);
    expect(attempt(s, 'paired-line')).toMatchObject({ steps: [], abilityTier: null, resolutionPaid: false, consent: 'UNASKED', selfConsent: false, playerAttempted: false, partnerAttempted: false, playerResult: null, partnerResult: null });
    expect(s.chaosHunter.life.playerLocation).toBe('START'); expect(s.chaosHunter.life.parcel.location).toBe('START');
    for (const type of ['PERFORM', 'TRY_PLAYER', 'TRY_PARTNER', 'LEAVE_CASE', 'WITHDRAW'] as const) reject(s, { type, caseId: 'paired-line' });
  });
  it('records the guide personally carrying the only parcel toB and walking back, before taking current consent', () => {
    const s = ready(); start(s, 'paired-line'); approach(s, 'paired-line'); const l = s.chaosHunter.life, a = attempt(s, 'paired-line');
    expect([l.playerLocation, l.guide.location, l.volunteer.location]).toEqual(['A', 'A', 'A']);
    expect(l.parcel).toMatchObject({ location: 'B', holder: 'TABLE', handovers: 1, owner: 'GUIDE' }); expect(l.line).toMatchObject({ location: 'A', holder: 'FLOOR' });
    expect(a.guideMoves).toEqual([
      { from: 'START', to: 'A', mode: 'WALK', metres: 4, seconds: 4, itemIds: ['CH3-PARCEL', 'CH3-RULE-PAPER', 'CH3-LINE'] },
      { from: 'A', to: 'B', mode: 'WALK', metres: 4, seconds: 4, itemIds: ['CH3-PARCEL'] },
      { from: 'B', to: 'A', mode: 'WALK', metres: 4, seconds: 4, itemIds: [] },
    ]);
    expect(a).toMatchObject({ elapsedSeconds: 14, playerTravelMetres: 4, consent: 'GRANTED', selfConsent: true, expressedAction: 'WALK_A_TO_B' });
    expect(l.paper).toMatchObject({ location: 'A', holder: 'PLAYER', text: '本次从A到B的越线' }); expect(l.guideTravelMetres).toBe(12);
  });
  it.each([1, 50])('directed successful check%s prepares20seconds without moving or pre-awarding either bodily action', roll => {
    const s = ready(); start(s, 'paired-line'); const ctx = cast(s, 'paired-line', roll), a = attempt(s, 'paired-line');
    expect(ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 20); expect(ctx.roll).not.toHaveBeenCalled();
    expect(a).toMatchObject({ ruleActive: true, pendingRemainingSeconds: 20, abilityAtSecond: 16, playerAttempted: false, partnerAttempted: false, spiritualitySpent: 5, mindSpent: 2 });
    expect(s.progression.mastery[ABILITY]).toBe(0); expect(s.chaosHunter.life.volunteer.location).toBe('A'); expect(s.chaosHunter.life.playerLocation).toBe('A');
    const p = step(s, 'paired-line', 'TRY_PLAYER'); expect(p.check).not.toHaveBeenCalled(); expect(p.roll).not.toHaveBeenCalled();
    expect(a).toMatchObject({ playerAttempted: true, playerBlocked: true, playerResult: 'A', playerAtSecond: 17, partnerAttempted: false, pendingRemainingSeconds: 19 });
    step(s, 'paired-line', 'TRY_PARTNER'); expect(a).toMatchObject({ partnerAttempted: true, partnerBlocked: true, partnerResult: 'A', partnerAtSecond: 18, pendingRemainingSeconds: 18 });
    expect(a.personMoves).toEqual([]); expect(a.playerMoves).toHaveLength(1); finish(s, 'paired-line'); expect(s.progression.mastery[ABILITY]).toBe(8);
  });
  it('permits partner-first without consuming or exempting the player share', () => {
    const s = ready(); start(s, 'paired-line'); cast(s, 'paired-line'); step(s, 'paired-line', 'TRY_PARTNER'); const a = attempt(s, 'paired-line');
    expect(a).toMatchObject({ partnerResult: 'A', partnerBlocked: true, playerAttempted: false, pendingRemainingSeconds: 19 });
    reject(s, { type: 'READ_RESULT', caseId: 'paired-line' }); step(s, 'paired-line', 'TRY_PLAYER');
    expect(a).toMatchObject({ playerResult: 'A', playerBlocked: true, partnerAtSecond: 17, playerAtSecond: 18 }); finish(s, 'paired-line'); expect(a.elapsedSeconds).toBe(35);
  });
  it.each([90, 100])('directed failed check%s keeps all costs; each body actually walks its own4metres, without a reroll', roll => {
    const s = ready(); start(s, 'paired-line'); cast(s, 'paired-line', roll); const a = attempt(s, 'paired-line');
    expect(a).toMatchObject({ ruleActive: false, pendingRemainingSeconds: 0, resolutionActions: 1 }); expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([97, 115, 98]);
    reject(s, { type: 'PERFORM', caseId: 'paired-line' }); reject(s, { type: 'ORDINARY_CHECK', caseId: 'paired-line' }); reject(s, { type: 'WAIT_EFFECT', caseId: 'paired-line' });
    step(s, 'paired-line', 'TRY_PLAYER'); expect([s.chaosHunter.life.playerLocation, s.chaosHunter.life.volunteer.location]).toEqual(['B', 'A']);
    step(s, 'paired-line', 'TRY_PARTNER'); expect(a).toMatchObject({ playerResult: 'B', partnerResult: 'B', playerBlocked: false, partnerBlocked: false, playerAtSecond: 21, partnerAtSecond: 26 });
    finish(s, 'paired-line'); expect(a.elapsedSeconds).toBe(43); expect(s.progression.mastery[ABILITY]).toBe(0); expect(s.actionsRemaining).toBe(96);
  });
  it('does not let one person test twice or read both results before the other person has tried', () => {
    const s = ready(); start(s, 'paired-line'); cast(s, 'paired-line'); step(s, 'paired-line', 'TRY_PLAYER');
    for (const type of ['TRY_PLAYER', 'READ_RESULT', 'RETURN_OBJECT', 'RECORD_OUTCOME', 'LEAVE_CASE'] as const) reject(s, { type, caseId: 'paired-line' });
    step(s, 'paired-line', 'TRY_PARTNER'); reject(s, { type: 'TRY_PARTNER', caseId: 'paired-line' }); finish(s, 'paired-line');
  });
  it.each([1, 100])('automatic post-cast withdrawal on check%s requires STOP_RULE before either ordinary bodily attempt', roll => {
    const s = ready(); complete(s, 'paired-line', 'ORDINARY'); start(s, 'withdrawn-line'); cast(s, 'withdrawn-line', roll); const a = attempt(s, 'withdrawn-line');
    expect(a).toMatchObject({ consent: 'REVOKED', consentWithdrawn: true, spiritualitySpent: 5, mindSpent: 2, playerAttempted: false, partnerAttempted: false }); expect(s.chaosHunter.life.volunteer.willing).toBe(false);
    for (const type of ['TRY_PLAYER', 'TRY_PARTNER', 'WAIT_EFFECT'] as const) reject(s, { type, caseId: 'withdrawn-line' });
    step(s, 'withdrawn-line', 'STOP_RULE'); tryBoth(s, 'withdrawn-line', true); finish(s, 'withdrawn-line');
    expect(a).toMatchObject({ result: 'ORDINARY', stopped: true, ruleActive: false, pendingRemainingSeconds: 0, playerResult: 'B', partnerResult: 'B', elapsedSeconds: 43 }); expect(s.progression.mastery[ABILITY]).toBe(0);
  });
  it('permits an explicit early withdrawal before paying, preserves costs already paid and offers a single ordinary implementation', () => {
    const s = ready(); start(s, 'paired-line'); approach(s, 'paired-line'); step(s, 'paired-line', 'WITHDRAW_CONSENT');
    expect(s.actionsRemaining).toBe(98); reject(s, { type: 'PERFORM', caseId: 'paired-line' }); step(s, 'paired-line', 'STOP_RULE'); const ctx = step(s, 'paired-line', 'ORDINARY_CHECK');
    expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled(); tryBoth(s, 'paired-line'); finish(s, 'paired-line');
    expect(attempt(s, 'paired-line')).toMatchObject({ consent: 'REVOKED', result: 'ORDINARY', playerResult: 'B', partnerResult: 'B', resolutionActions: 1 }); expect([s.spirituality, s.mind, s.progression.mastery[ABILITY]]).toEqual([120, 100, 0]);
  });
  it('permits explicit withdrawal after paying but before either attempt, retaining the check and costs', () => {
    const s = ready(); start(s, 'paired-line'); cast(s, 'paired-line'); step(s, 'paired-line', 'WITHDRAW_CONSENT');
    reject(s, { type: 'TRY_PLAYER', caseId: 'paired-line' }); reject(s, { type: 'TRY_PARTNER', caseId: 'paired-line' }); step(s, 'paired-line', 'STOP_RULE'); tryBoth(s, 'paired-line'); finish(s, 'paired-line');
    expect(attempt(s, 'paired-line')).toMatchObject({ result: 'ORDINARY', ruleCancelled: true, abilityTier: 'GREAT_SUCCESS', spiritualitySpent: 5, mindSpent: 2 }); expect(s.progression.mastery[ABILITY]).toBe(0);
  });
  it('does not retroactively move the first stopped body when the remaining rule is cancelled', () => {
    const s = ready(); start(s, 'paired-line'); cast(s, 'paired-line'); step(s, 'paired-line', 'TRY_PLAYER');
    reject(s, { type: 'WITHDRAW_CONSENT', caseId: 'paired-line' }); step(s, 'paired-line', 'STOP_RULE'); step(s, 'paired-line', 'TRY_PARTNER');
    expect(attempt(s, 'paired-line')).toMatchObject({ playerResult: 'A', playerBlocked: true, partnerResult: 'B', partnerBlocked: false, ruleCancelled: true });
    expect([s.chaosHunter.life.playerLocation, s.chaosHunter.life.volunteer.location]).toEqual(['A', 'B']); finish(s, 'paired-line'); expect(s.progression.mastery[ABILITY]).toBe(8);
  });
  it('waits exactly20remaining seconds once, then both walk ordinarily and no mastery is awarded', () => {
    const s = ready(); start(s, 'paired-line'); cast(s, 'paired-line'); const clock = s.chaosHunter.life.clockSeconds; step(s, 'paired-line', 'WAIT_EFFECT');
    expect(s.chaosHunter.life.clockSeconds).toBe(clock + 20); expect(attempt(s, 'paired-line')).toMatchObject({ waitCompleted: true, waitedSeconds: 20, ruleExpired: true, ruleActive: false, pendingRemainingSeconds: 0 });
    reject(s, { type: 'WAIT_EFFECT', caseId: 'paired-line' }); tryBoth(s, 'paired-line'); finish(s, 'paired-line'); expect(s.progression.mastery[ABILITY]).toBe(0); expect(s.spirituality).toBe(115);
  });
  it('can wait only the19remaining seconds after one actual stop, preserving that first result and not exempting future action', () => {
    const s = ready(); start(s, 'paired-line'); cast(s, 'paired-line'); step(s, 'paired-line', 'TRY_PARTNER'); step(s, 'paired-line', 'WAIT_EFFECT'); step(s, 'paired-line', 'TRY_PLAYER');
    expect(attempt(s, 'paired-line')).toMatchObject({ waitedSeconds: 19, partnerBlocked: true, partnerResult: 'A', playerBlocked: false, playerResult: 'B' }); finish(s, 'paired-line');
  });
  it('moves Mira independently back fromB without moving the player or his paper', () => {
    const s = ready(); start(s, 'paired-line', 'ORDINARY'); cast(s, 'paired-line'); tryBoth(s, 'paired-line'); step(s, 'paired-line', 'READ_RESULT');
    reject(s, { type: 'RETURN_PERSON', caseId: 'paired-line' }); step(s, 'paired-line', 'STOP_RULE'); step(s, 'paired-line', 'RETURN_PERSON');
    const l = s.chaosHunter.life, a = attempt(s, 'paired-line'); expect([l.playerLocation, l.paper.location, l.volunteer.location, l.parcel.location]).toEqual(['B', 'B', 'A', 'B']);
    expect(a.personMoves.map(m => [m.from, m.to, m.itemIds])).toEqual([['A', 'B', []], ['B', 'A', []]]); expect(a.playerTravelMetres).toBe(8);
    reject(s, { type: 'WALK_B', caseId: 'paired-line' }); for (const type of ['TAKE_OBJECT', 'RETURN_A', 'RETURN_OBJECT', 'RECORD_OUTCOME', 'RETURN_START', 'LEAVE_CASE', 'REPORT_CASE'] as const) step(s, 'paired-line', type);
  });
  it('requires actualB pickup, Areturn and original-object handover; stopping does not perform cleanup', () => {
    const s = ready(); start(s, 'paired-line'); cast(s, 'paired-line'); tryBoth(s, 'paired-line'); step(s, 'paired-line', 'READ_RESULT'); step(s, 'paired-line', 'STOP_RULE');
    for (const type of ['TAKE_OBJECT', 'RETURN_A', 'RETURN_OBJECT', 'RETURN_START', 'LEAVE_CASE'] as const) reject(s, { type, caseId: 'paired-line' });
    step(s, 'paired-line', 'WALK_B'); reject(s, { type: 'RETURN_A', caseId: 'paired-line' }); step(s, 'paired-line', 'TAKE_OBJECT');
    expect(s.chaosHunter.life.parcel).toMatchObject({ holder: 'PLAYER', location: 'B' }); step(s, 'paired-line', 'RETURN_A');
    expect(attempt(s, 'paired-line').playerMoves.at(-1)?.itemIds).toEqual(['CH3-RULE-PAPER', 'CH3-PARCEL']); step(s, 'paired-line', 'RETURN_OBJECT');
    expect(s.chaosHunter.life.parcel).toMatchObject({ owner: 'GUIDE', holder: 'GUIDE', location: 'A', handovers: 3, returns: 1 }); expect(s.chaosHunter.life.line).toMatchObject({ holder: 'GUIDE', location: 'A', returns: 1 });
    reject(s, { type: 'LEAVE_CASE', caseId: 'paired-line' }); for (const type of ['RECORD_OUTCOME', 'RETURN_START', 'LEAVE_CASE', 'REPORT_CASE'] as const) step(s, 'paired-line', type);
    expect(s.chaosHunter.life.parcel.location).toBe('START'); expect(s.chaosHunter.life.volunteer.location).toBe('A'); expect(attempt(s, 'paired-line').guideMoves).toHaveLength(4);
  });
  it.each([1, 100])('own-line check%s affects only the explicit self and never makes Mira attempt or move', roll => {
    const s = ready(); firstTwo(s); start(s, 'own-line'); cast(s, 'own-line', roll); const a = attempt(s, 'own-line');
    expect(a).toMatchObject({ selfConsent: true, consent: 'ORDINARY', abilitySourceId: 'PLAYER_ORIGINAL', partnerAttempted: false, partnerResult: null }); reject(s, { type: 'TRY_PARTNER', caseId: 'own-line' });
    step(s, 'own-line', 'TRY_PLAYER'); expect(a.playerResult).toBe(roll === 1 ? 'A' : 'B'); expect(a.playerBlocked).toBe(roll === 1); finish(s, 'own-line');
    expect(a.personMoves).toEqual([]); expect(a.elapsedSeconds).toBe(34); expect(s.chaosHunter.life.volunteer.location).toBe('A'); expect(s.progression.mastery[ABILITY]).toBe(roll === 1 ? 8 : 0);
  });
  it('rejects guarantees after original-object return and demands the finite conclusion without rechecking', () => {
    const s = ready(); firstTwo(s); start(s, 'own-line'); cast(s, 'own-line', 100); step(s, 'own-line', 'TRY_PLAYER'); step(s, 'own-line', 'READ_RESULT'); step(s, 'own-line', 'STOP_RULE');
    for (const type of ['TAKE_OBJECT', 'RETURN_A'] as const) step(s, 'own-line', type);
    reject(s, { type: 'CONFIRM_LIMITED', caseId: 'own-line', claim: 'LIMITED' }); step(s, 'own-line', 'RETURN_OBJECT'); reject(s, { type: 'RECORD_OUTCOME', caseId: 'own-line' });
    const ctx = act(s, { type: 'CONFIRM_LIMITED', caseId: 'own-line', claim: 'GUARANTEED' }); expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled();
    expect(attempt(s, 'own-line')).toMatchObject({ rejectedClaims: 1, limitedConfirmed: false, playerResult: 'B', playerAttempted: true }); reject(s, { type: 'RECORD_OUTCOME', caseId: 'own-line' });
    act(s, { type: 'CONFIRM_LIMITED', caseId: 'own-line', claim: 'LIMITED' }); for (const type of ['RECORD_OUTCOME', 'RETURN_START', 'LEAVE_CASE', 'REPORT_CASE'] as const) step(s, 'own-line', type);
    expect(s.progression.mastery[ABILITY]).toBe(0);
  });
  it('completes three ordinary cases plus reflection for exactly13AP with no luck, spell costs or old-root mutation', () => {
    const s = ready(), before = oldSources(s); for (const id of CHAOS_HUNTER_CASE_IDS) complete(s, id, 'ORDINARY'); act(s, { type: 'REFLECT' });
    expect([s.actionsRemaining, s.spirituality, s.mind, s.progression.acting, s.progression.mastery[ABILITY]]).toEqual([87, 120, 100, 100, 0]); expect(oldSources(s)).toEqual(before);
    expect(s.chaosHunter.life).toMatchObject({ playerTravelMetres: 48, guideTravelMetres: 48, clockSeconds: 120, reflected: true }); expect(hasChaosHunterLifeLock(s)).toBe(false);
    expect(s.chaosHunter.life.parcel).toMatchObject({ returns: 3, handovers: 9, location: 'START', holder: 'GUIDE' }); expect(s.chaosHunter.life.line.returns).toBe(3);
  });
  it('records three successful directed checks but only actual paired and own stops award8each, max16', () => {
    const s = ready(), before = oldSources(s); for (const id of CHAOS_HUNTER_CASE_IDS) complete(s, id); act(s, { type: 'REFLECT' });
    expect([s.actionsRemaining, s.spirituality, s.mind, s.progression.acting, s.progression.mastery[ABILITY]]).toEqual([87, 105, 94, 100, 16]); expect(oldSources(s)).toEqual(before);
    expect(CHAOS_HUNTER_CASE_IDS.map(id => attempt(s, id).playerResult)).toEqual(['A', 'B', 'A']); expect(CHAOS_HUNTER_CASE_IDS.map(id => attempt(s, id).abilityTier)).toEqual(['GREAT_SUCCESS', 'GREAT_SUCCESS', 'GREAT_SUCCESS']);
    expect(s.chaosHunter.life.clockSeconds).toBe(112); expect(s.progression.mastery['justiciar.s4.deprivation']).toBe(24); expect(s.chaosHunter.life.paper.text).toBe('本次从A到B的越线');
  });
  it('keeps every already-paid bodily attempt and actual cleanup available at0AP,0spirit,0mind', () => {
    const s = ready(); start(s, 'paired-line'); cast(s, 'paired-line', 100); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    tryBoth(s, 'paired-line'); finish(s, 'paired-line', false); expect(hasChaosHunterLifeLock(s)).toBe(false); expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); reject(s, { type: 'REPORT_CASE', caseId: 'paired-line' });
  });
  it('offers one ordinary fallback for insufficient spell resources and reserves implementation AP before preparing', () => {
    const s = ready(); start(s, 'paired-line'); approach(s, 'paired-line'); s.spirituality = 4; s.mind = 1;
    reject(s, { type: 'PERFORM', caseId: 'paired-line' }); const ctx = step(s, 'paired-line', 'ORDINARY_CHECK'); expect(ctx.check).not.toHaveBeenCalled(); tryBoth(s, 'paired-line'); finish(s, 'paired-line'); expect([s.spirituality, s.mind]).toEqual([4, 1]);
    const poor = ready(); step(poor, 'paired-line', 'OBSERVE'); poor.actionsRemaining = 1; reject(poor, { type: 'PREPARE', caseId: 'paired-line', method: 'ORDINARY' });
  });
  it('withdraws only an unstarted preparation without refund and rejects death, other cases and reopened reports', () => {
    const s = ready(); step(s, 'paired-line', 'OBSERVE'); act(s, { type: 'PREPARE', caseId: 'paired-line', method: 'ABILITY' }); step(s, 'paired-line', 'WITHDRAW');
    expect(s.actionsRemaining).toBe(98); expect(s.chaosHunter.life.cases['paired-line'].withdrawals).toBe(1); expect(hasChaosHunterLifeLock(s)).toBe(false); expect(s.chaosHunter.life.parcel.location).toBe('START');
    reject(s, { type: 'OBSERVE', caseId: 'withdrawn-line' }); act(s, { type: 'PREPARE', caseId: 'paired-line', method: 'ORDINARY' }); step(s, 'paired-line', 'START_CASE'); cast(s, 'paired-line'); tryBoth(s, 'paired-line'); finish(s, 'paired-line');
    reject(s, { type: 'START_CASE', caseId: 'paired-line' }); reject(s, { type: 'REPORT_CASE', caseId: 'paired-line' }); s.status = 'DEAD'; s.health = 0; reject(s, { type: 'OBSERVE', caseId: 'withdrawn-line' });
  });
  it('projects independent bodies, pending versus applied facts and only validated typed commands', () => {
    const s = ready(); start(s, 'paired-line'); cast(s, 'paired-line'); const p = projectChaosHunterLife(s);
    expect(p.currentAttempt).toMatchObject({ ruleActive: true, pendingRemainingSeconds: 20, playerAttempted: false, partnerAttempted: false }); expect(p.currentAttempt?.abilityCheck).toMatchObject({ roll: 1, chance: 70, difficulty: 20 });
    expect(p.facts.join(' ')).toContain('剩余20秒'); for (const action of chaosHunterLifeActions(s)) { expect(validateChaosHunterActivityCommand(action.command)).toBe(true); expect(action.enabled).toBe(blockChaosHunterLife(s, action.command) === null); }
    p.parcel.location = 'A'; expect(s.chaosHunter.life.parcel.location).toBe('B');
  });
  it('rejects supplied outcomes, extra fields, luck/event commands and another person participating in own-line', () => {
    for (const bad of [{ type: 'PERFORM', caseId: 'paired-line', roll: 1 }, { type: 'TRY_PLAYER', caseId: 'paired-line', result: 'A' }, { type: 'TRY_PARTNER', caseId: 'own-line' }, { type: 'RETURN_PERSON', caseId: 'own-line' }, { type: 'WITHDRAW_CONSENT', caseId: 'own-line' }, { type: 'CONFIRM_LIMITED', caseId: 'paired-line', claim: 'LIMITED' }, { type: 'REFLECT', caseId: 'paired-line' }, { type: 'DRAW_TAG', caseId: 'paired-line' }, { type: 'ACCUMULATE' }]) expect(validateChaosHunterActivityCommand(bad)).toBe(false);
  });
  it('strictly rejects forged bodies, paper, ownership, movement, clocks, consent, costs, duplicate steps and mastery', () => {
    const s = ready(); for (const id of CHAOS_HUNTER_CASE_IDS) complete(s, id); act(s, { type: 'REFLECT' });
    const mutations: ((v: SliceState) => void)[] = [
      v => { attempt(v, 'paired-line').playerResult = 'B'; }, v => { attempt(v, 'paired-line').partnerResult = 'B'; }, v => { attempt(v, 'paired-line').playerBlocked = false; }, v => { attempt(v, 'paired-line').partnerAttempted = false; }, v => { attempt(v, 'paired-line').selfConsent = false; },
      v => { attempt(v, 'paired-line').spiritualitySpent = 0; }, v => { attempt(v, 'paired-line').mindSpent = 0; }, v => { attempt(v, 'paired-line').resolutionActions = 0; }, v => { attempt(v, 'paired-line').abilityCheck = { ...attempt(v, 'paired-line').abilityCheck!, chance: 100 }; }, v => { attempt(v, 'paired-line').abilityTier = 'FAILURE'; },
      v => { attempt(v, 'paired-line').guideMoves[1]!.to = 'A'; }, v => { attempt(v, 'paired-line').playerMoves[1]!.metres = 0 as 4; }, v => { attempt(v, 'paired-line').objectMoves[0]!.itemIds = []; }, v => { attempt(v, 'withdrawn-line').personMoves = []; },
      v => { v.chaosHunter.life.parcel.location = 'B'; }, v => { v.chaosHunter.life.parcel.quantity = 2 as 1; }, v => { v.chaosHunter.life.parcel.massGrams = 351 as 350; }, v => { v.chaosHunter.life.parcel.returns--; }, v => { v.chaosHunter.life.parcel.handovers--; },
      v => { v.chaosHunter.life.line.holder = 'FLOOR'; }, v => { v.chaosHunter.life.line.isWall = true as false; }, v => { v.chaosHunter.life.line.returns--; }, v => { v.chaosHunter.life.paper.text = '本次从B到A的越线' as '本次从A到B的越线'; }, v => { v.chaosHunter.life.paper.holder = 'PLAYER'; },
      v => { v.chaosHunter.life.volunteer.health = 99 as 100; }, v => { v.chaosHunter.life.volunteer.location = 'B'; }, v => { v.chaosHunter.life.volunteer.willing = true; }, v => { v.chaosHunter.life.table.thirdParties = 1 as 0; },
      v => { attempt(v, 'withdrawn-line').consent = 'GRANTED'; }, v => { attempt(v, 'withdrawn-line').consentWithdrawn = false; }, v => { attempt(v, 'withdrawn-line').playerBlocked = true; }, v => { attempt(v, 'own-line').partnerAttempted = true; }, v => { attempt(v, 'own-line').limitedConfirmed = false; },
      v => { attempt(v, 'own-line').steps.find(x => x.type === 'TRY_PLAYER')!.atSecond++; }, v => { attempt(v, 'own-line').steps.find(x => x.type === 'TRY_PLAYER')!.willing = true; }, v => { Object.assign(attempt(v, 'own-line').steps.find(x => x.type === 'TRY_PLAYER')!, { eventRoll: 1 }); }, v => { attempt(v, 'paired-line').steps.push(structuredClone(attempt(v, 'paired-line').steps.find(x => x.type === 'TRY_PLAYER')!)); },
      v => { v.chaosHunter.life.clockSeconds++; }, v => { v.chaosHunter.life.playerTravelMetres--; }, v => { v.chaosHunter.life.guideTravelMetres--; }, v => { v.progression.mastery[ABILITY] = 24; }, v => { Object.assign(v.chaosHunter.life, { luck: { stored: 3 } }); },
    ];
    for (const mutate of mutations) { const copy = structuredClone(s); mutate(copy); expect(validateChaosHunterLife(copy)).toBe(false); }
  });
  it('accepts the exact clock alias while rejecting unsupported durations and unbacked external time', () => {
    const s = ready(); expect(advanceChaosHunterLifeClock).toBe(advanceChaosHunterClock); expect(() => advanceChaosHunterClock(s, -1)).toThrow(); expect(() => advanceChaosHunterClock(s, 0.5)).toThrow();
    advanceChaosHunterClock(s, 60); expect(s.chaosHunter.life.clockSeconds).toBe(60); expect(validateChaosHunterLife(s)).toBe(false);
  });
  it('rejects malformed replay records without throwing or accepting hidden extra state', () => {
    const s = ready(); start(s, 'paired-line'); cast(s, 'paired-line');
    for (const mutate of [(v: SliceState) => { Object.assign(v.chaosHunter.life, { volunteer: null }); }, (v: SliceState) => { Object.assign(attempt(v, 'paired-line'), { steps: [null] }); }, (v: SliceState) => { Object.assign(v.chaosHunter.life.cases, { extra: {} }); }]) {
      const copy = structuredClone(s); mutate(copy); expect(() => validateChaosHunterLife(copy)).not.toThrow(); expect(validateChaosHunterLife(copy)).toBe(false);
    }
  });
});
