import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createChaosWalkerState } from '../../src/domain/chaos-walker/index.js';
import { advanceChaosWalkerLifeClock, applyChaosWalkerActivity, blockChaosWalkerLife, createChaosWalkerLifeState, hasChaosWalkerLifeLock, projectChaosWalkerLife, CHAOS_WALKER_CASE_IDS, chaosWalkerLifeActions, validateChaosWalkerActivityCommand, validateChaosWalkerLife, type ChaosWalkerActivityCommand, type ChaosWalkerCaseId } from '../../src/domain/chaos-walker/life.js';

const BUFFER = 'wheel.s3.deviation-buffer', IMPEDIMENT = 'wheel.s3.future-impediment';
const context = (s: SliceState, checkRoll = 1, branchRoll = 1): SeerContext => ({ roll: vi.fn(() => branchRoll), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: checkRoll })) });
/** Isolated directed state. This is not evidence of natural promotion or a naturally favourable draw. */
function ready(): SliceState {
  const s = createSliceRun('chaos-walker-life', sliceDefaultCreationSelection, 'chaos-walker-life');
  s.chaosWalker = createChaosWalkerState(); s.week = 110; s.chaosWalker.promotionWeek = 109; s.chaosWalker.misfortuneMageActingAtPromotion = 100;
  s.progression = { pathwayId: 'wheel', sequence: 3, acting: 0, promotionWeek: 109, mastery: { [BUFFER]: 0, [IMPEDIMENT]: 0, 'wheel.s4.bounded-misfortune': 17 } };
  s.winner.luck = { stored: 3, accumulated: 9, spent: 6, lastAccumulateWeek: 108 };
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000; s.injuries = [];
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
function act(s: SliceState, command: ChaosWalkerActivityCommand, checkRoll = 1, branchRoll = 1) { const ctx = context(s, checkRoll, branchRoll); applyChaosWalkerActivity(s, command, ctx); expect(validateChaosWalkerLife(s), command.type).toBe(true); return ctx; }
function step(s: SliceState, caseId: ChaosWalkerCaseId, type: Exclude<ChaosWalkerActivityCommand['type'], 'PREPARE' | 'REFLECT' | 'ACCUMULATE' | 'CONFIRM_LIMITED'>, checkRoll = 1, branchRoll = 1) { return act(s, { type, caseId } as ChaosWalkerActivityCommand, checkRoll, branchRoll); }
function reject(s: SliceState, command: ChaosWalkerActivityCommand) { const before = structuredClone(s), ctx = context(s); expect(() => applyChaosWalkerActivity(s, command, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled(); }
const attempt = (s: SliceState, id: ChaosWalkerCaseId) => s.chaosWalker.life.cases[id].attempts[0]!;
function start(s: SliceState, id: ChaosWalkerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { step(s, id, 'OBSERVE'); act(s, { type: 'PREPARE', caseId: id, method }); step(s, id, 'START_CASE'); }
function approach(s: SliceState, id: ChaosWalkerCaseId) { step(s, id, 'GO_A'); step(s, id, 'CHECK_OBJECT'); }
function cast(s: SliceState, id: ChaosWalkerCaseId, roll = 1) { approach(s, id); return step(s, id, 'PERFORM', roll); }
function trigger(s: SliceState, id: ChaosWalkerCaseId, branchRoll = 1) { return step(s, id, id === 'cart-fork' ? 'RELEASE_CART' : id === 'revoked-draw' ? 'DRAW_TAG' : 'SPIN_DISC', 1, branchRoll); }
function finish(s: SliceState, id: ChaosWalkerCaseId) {
  const a = attempt(s, id);
  if (a.inputActive) step(s, id, 'STOP_INPUT');
  if (id === 'cart-fork') { step(s, id, 'WALK_RESULT'); step(s, id, 'READ_RESULT'); step(s, id, 'RETURN_CART'); }
  else { for (const type of ['READ_RESULT', 'WALK_B', 'READ_RECORD', 'RETURN_A'] as const) step(s, id, type); if (id === 'counterexample') step(s, id, 'COMPARE_RESULT'); }
  for (const type of ['RETURN_OBJECT', 'RECORD_OUTCOME', 'RETURN_START', 'LEAVE_CASE', 'REPORT_CASE'] as const) step(s, id, type);
}
function complete(s: SliceState, id: ChaosWalkerCaseId, checkRoll = 1, branchRoll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { start(s, id, method); cast(s, id, checkRoll); if (id === 'revoked-draw' && method === 'ABILITY') step(s, id, 'STOP_INPUT'); trigger(s, id, branchRoll); finish(s, id); }
function firstTwo(s: SliceState) { complete(s, 'cart-fork', 1, 1, 'ORDINARY'); complete(s, 'revoked-draw', 1, 1, 'ORDINARY'); }

describe('Chaos Walker finite later events, original objects and current permission', () => {
  it('creates one same original of every object and a real adult, while prominently retaining candidate/G limits', () => {
    const s = ready(), l = s.chaosWalker.life; expect(l).toEqual(createChaosWalkerLifeState()); expect(validateChaosWalkerLife(s)).toBe(true);
    expect(l.volunteer).toMatchObject({ id: 'CW3-VERA', age: 39, location: 'A', health: 100, mind: 100, spirituality: 100 });
    expect(l.cart).toMatchObject({ id: 'CW3-CART', quantity: 1, location: 'A', owner: 'GUIDE' }); expect(l.parcel).toMatchObject({ quantity: 1, massGrams: 400, sealed: true, location: 'CW3-CART' });
    expect(l.tags.map(t => t.id)).toEqual(['CW3-TAG-A', 'CW3-TAG-B']); expect(l.pouch.opaque).toBe(true); expect(l.disc.location).toBe('A');
    expect(projectChaosWalkerLife(s).story).toContain('候选'); expect(projectChaosWalkerLife(s).story).toContain('原创G'); expect(projectChaosWalkerLife(s).luck).toEqual({ ...s.winner.luck, capacity: 3 });
  });
  it('START_CASE only opens the scene and consumes neither ability nor future-event randomness', () => {
    const s = ready(); start(s, 'cart-fork'); const a = attempt(s, 'cart-fork');
    expect(a).toMatchObject({ steps: [], abilityTier: null, branchRoll: null, eventDraws: 0, resolutionPaid: false });
    expect(s.actionsRemaining).toBe(98); expect(s.spirituality).toBe(120); expect(s.winner.luck.stored).toBe(3); expect(s.chaosWalker.life.playerLocation).toBe('START');
    reject(s, { type: 'PERFORM', caseId: 'cart-fork' }); reject(s, { type: 'READ_RESULT', caseId: 'cart-fork' });
  });
  it('successful arming and its later independent mechanical draw are separate actual operations', () => {
    const s = ready(); start(s, 'cart-fork'); const ctx = cast(s, 'cart-fork'); const a = attempt(s, 'cart-fork');
    expect(ctx.check).toHaveBeenCalledWith('knowledge', 20); expect(ctx.roll).not.toHaveBeenCalled(); expect(a).toMatchObject({ abilityTier: 'GREAT_SUCCESS', pendingRemainingSeconds: 30, modifierApplied: false, eventDraws: 0, branchChance: null });
    expect(s.spirituality).toBe(115); expect(s.mind).toBe(99); expect(s.winner.luck).toMatchObject({ stored: 2, accumulated: 9, spent: 7 }); expect(s.progression.mastery[BUFFER]).toBe(0);
    const event = trigger(s, 'cart-fork', 90); expect(event.check).not.toHaveBeenCalled(); expect(event.roll).toHaveBeenCalledExactlyOnceWith(1, 100); expect(a).toMatchObject({ branchRoll: 90, branchChance: 75, branchResult: 'C', modifierApplied: true, eventDraws: 1 });
    expect(s.chaosWalker.life.cart.location).toBe('C'); finish(s, 'cart-fork'); expect(s.progression.mastery[BUFFER]).toBe(8); expect(a.branchResult).toBe('C');
  });
  for (const [roll, tier, chance] of [[1, 'GREAT_SUCCESS', 75], [30, 'SUCCESS', 75], [85, 'FAILURE', 50], [100, 'GREAT_FAILURE', 50]] as const) {
    it(`keeps actual ${tier} costs while preserving an independent adverse branch`, () => {
      const s = ready(); complete(s, 'cart-fork', roll, 100); const a = attempt(s, 'cart-fork');
      expect(a).toMatchObject({ abilityTier: tier, branchChance: chance, branchRoll: 100, branchResult: 'C', spiritualitySpent: 5, mindSpent: 1, luckSpent: 1, resolutionActions: 1 });
      expect(s.actionsRemaining).toBe(96); expect(s.spirituality).toBe(115); expect(s.mind).toBe(99); expect(s.winner.luck.stored).toBe(2); expect(s.progression.mastery[BUFFER]).toBe(chance === 75 ? 8 : 0);
    });
  }
  it('follows the actual C track and pushes the same original cart and sealed parcel back, with guide physically present', () => {
    const s = ready(); start(s, 'cart-fork'); cast(s, 'cart-fork'); trigger(s, 'cart-fork', 90); const l = s.chaosWalker.life;
    reject(s, { type: 'READ_RESULT', caseId: 'cart-fork' }); reject(s, { type: 'RETURN_OBJECT', caseId: 'cart-fork' }); step(s, 'cart-fork', 'STOP_INPUT'); step(s, 'cart-fork', 'WALK_RESULT');
    expect(l.playerLocation).toBe('C'); expect(l.cart.location).toBe('C'); expect(l.guide.location).toBe('A'); step(s, 'cart-fork', 'READ_RESULT'); step(s, 'cart-fork', 'RETURN_CART');
    expect(l.cart.location).toBe('A'); expect(attempt(s, 'cart-fork').objectMoves).toEqual([{ from: 'A', to: 'C', mode: 'ROLL', metres: 4, seconds: 6, itemIds: ['CW3-CART', 'CW3-PARCEL'] }, { from: 'C', to: 'A', mode: 'PUSH', metres: 4, seconds: 4, itemIds: ['CW3-CART', 'CW3-PARCEL'] }]);
    for (const type of ['RETURN_OBJECT', 'RECORD_OUTCOME', 'RETURN_START', 'LEAVE_CASE', 'REPORT_CASE'] as const) step(s, 'cart-fork', type);
    expect(l.playerTravelMetres).toBe(16); expect(l.guideTravelMetres).toBe(8); expect(l.guide.location).toBe('START'); expect(l.cart).toMatchObject({ releases: 1, returns: 1, control: 'GUIDE' });
  });
  it('stopping before the future event cancels the successful modifier without refund or mastery', () => {
    const s = ready(); start(s, 'cart-fork'); cast(s, 'cart-fork'); step(s, 'cart-fork', 'STOP_INPUT'); trigger(s, 'cart-fork', 60); finish(s, 'cart-fork');
    expect(attempt(s, 'cart-fork')).toMatchObject({ abilityTier: 'GREAT_SUCCESS', modifierCancelled: true, modifierApplied: false, branchChance: 50, branchResult: 'C', result: 'ORDINARY', luckSpent: 1 }); expect(s.progression.mastery[BUFFER]).toBe(0); expect(s.winner.luck.stored).toBe(2);
  });
  it('WAIT_EFFECT waits exactly the remaining 30 seconds and never re-arms or pays back costs', () => {
    const s = ready(); start(s, 'cart-fork'); cast(s, 'cart-fork'); const clock = s.chaosWalker.life.clockSeconds; step(s, 'cart-fork', 'WAIT_EFFECT');
    expect(s.chaosWalker.life.clockSeconds).toBe(clock + 30); expect(attempt(s, 'cart-fork')).toMatchObject({ waitedSeconds: 30, pendingRemainingSeconds: 0, modifierExpired: true }); reject(s, { type: 'WAIT_EFFECT', caseId: 'cart-fork' }); trigger(s, 'cart-fork', 60); finish(s, 'cart-fork'); expect(s.progression.mastery[BUFFER]).toBe(0);
  });
  it('cannot reroll an already released original, even after stopping input', () => {
    const s = ready(); start(s, 'cart-fork'); cast(s, 'cart-fork'); trigger(s, 'cart-fork', 99); const original = structuredClone(attempt(s, 'cart-fork'));
    reject(s, { type: 'RELEASE_CART', caseId: 'cart-fork' }); reject(s, { type: 'PERFORM', caseId: 'cart-fork' }); step(s, 'cart-fork', 'STOP_INPUT'); expect(attempt(s, 'cart-fork').branchRoll).toBe(original.branchRoll); expect(attempt(s, 'cart-fork').modifierApplied).toBe(true);
  });
  it('obtains current voluntary permission and immediately honours revocation before the physical draw', () => {
    const s = ready(); complete(s, 'cart-fork', 1, 1, 'ORDINARY'); start(s, 'revoked-draw'); approach(s, 'revoked-draw'); const a = attempt(s, 'revoked-draw'); expect(a.consent).toBe('GRANTED');
    step(s, 'revoked-draw', 'PERFORM'); expect(a).toMatchObject({ abilityTier: 'GREAT_SUCCESS', consent: 'REVOKED', consentWithdrawn: true, pendingRemainingSeconds: 30, eventDraws: 0 });
    reject(s, { type: 'DRAW_TAG', caseId: 'revoked-draw' }); reject(s, { type: 'WAIT_EFFECT', caseId: 'revoked-draw' }); reject(s, { type: 'CHECK_OBJECT', caseId: 'revoked-draw' }); step(s, 'revoked-draw', 'STOP_INPUT');
    trigger(s, 'revoked-draw', 40); expect(a).toMatchObject({ branchChance: 50, branchResult: 'A', modifierCancelled: true, modifierApplied: false }); finish(s, 'revoked-draw'); expect(s.progression.mastery[IMPEDIMENT]).toBe(0); expect(s.winner.luck.stored).toBe(2); expect(s.chaosWalker.life.volunteer).toMatchObject({ health: 100, mind: 100, spirituality: 100, injuries: [] });
  });
  it('preserves a present refusal without repeated requests or a forced cast, allowing ordinary completion', () => {
    const s = ready(); complete(s, 'cart-fork', 1, 1, 'ORDINARY'); start(s, 'revoked-draw'); step(s, 'revoked-draw', 'GO_A'); s.chaosWalker.life.volunteer.willing = false; step(s, 'revoked-draw', 'CHECK_OBJECT');
    expect(attempt(s, 'revoked-draw').consent).toBe('DECLINED'); reject(s, { type: 'PERFORM', caseId: 'revoked-draw' }); reject(s, { type: 'CHECK_OBJECT', caseId: 'revoked-draw' });
    const ctx = step(s, 'revoked-draw', 'ORDINARY_CHECK'); expect(ctx.check).not.toHaveBeenCalled(); trigger(s, 'revoked-draw', 51); finish(s, 'revoked-draw'); expect(attempt(s, 'revoked-draw')).toMatchObject({ abilityTier: null, luckSpent: 0, result: 'ORDINARY', consent: 'DECLINED' }); expect(s.winner.luck.stored).toBe(3);
  });
  it('records ordinary permission honestly without pretending the volunteer first consented to an ability', () => {
    const s = ready(); complete(s, 'cart-fork', 1, 1, 'ORDINARY'); complete(s, 'revoked-draw', 1, 80, 'ORDINARY');
    expect(attempt(s, 'revoked-draw')).toMatchObject({ consent: 'ORDINARY', consentWithdrawn: false, abilityTier: null, branchChance: 50, branchResult: 'B', eventDraws: 1 }); expect(s.chaosWalker.life.tags.every(t => t.location === 'POUCH')).toBe(true); expect(s.chaosWalker.life.pouch).toMatchObject({ owner: 'CW3-VERA', location: 'VERA', draws: 1, returns: 1 });
  });
  it('allows the true A counterexample even after a successful 25% rotor modifier', () => {
    const s = ready(); firstTwo(s); complete(s, 'counterexample', 1, 20); const a = attempt(s, 'counterexample');
    expect(a).toMatchObject({ abilityTier: 'GREAT_SUCCESS', branchChance: 25, branchRoll: 20, branchResult: 'A', modifierApplied: true, compared: true, limitedConfirmed: true }); expect(s.chaosWalker.life.disc).toMatchObject({ pointer: 'A', spins: 1, returns: 1, location: 'A', control: 'GUIDE' }); expect(s.progression.mastery[IMPEDIMENT]).toBe(8);
  });
  it('requires physically reading the original forecast in B before comparing and returning the original disc', () => {
    const s = ready(); firstTwo(s); start(s, 'counterexample'); cast(s, 'counterexample'); trigger(s, 'counterexample', 90); step(s, 'counterexample', 'STOP_INPUT'); step(s, 'counterexample', 'READ_RESULT');
    reject(s, { type: 'COMPARE_RESULT', caseId: 'counterexample' }); reject(s, { type: 'READ_RECORD', caseId: 'counterexample' }); reject(s, { type: 'RETURN_OBJECT', caseId: 'counterexample' });
    step(s, 'counterexample', 'WALK_B'); step(s, 'counterexample', 'READ_RECORD'); reject(s, { type: 'COMPARE_RESULT', caseId: 'counterexample' }); step(s, 'counterexample', 'RETURN_A'); step(s, 'counterexample', 'COMPARE_RESULT');
    const before = structuredClone(s.winner.luck), a = attempt(s, 'counterexample'); const ctx = act(s, { type: 'CONFIRM_LIMITED', caseId: 'counterexample', claim: 'GUARANTEED' }); expect(a.rejectedClaims).toBe(1); expect(a.limitedConfirmed).toBe(false); expect(a.branchRoll).toBe(90); expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled(); expect(s.winner.luck).toEqual(before);
    act(s, { type: 'CONFIRM_LIMITED', caseId: 'counterexample', claim: 'LIMITED' }); for (const type of ['RETURN_OBJECT', 'RECORD_OUTCOME', 'RETURN_START', 'LEAVE_CASE', 'REPORT_CASE'] as const) step(s, 'counterexample', type);
  });
  it('completes all ordinary reports and reflection for exactly 13 AP with zero reserve and no new mastery', () => {
    const s = ready(); s.winner.luck = { stored: 0, accumulated: 6, spent: 6, lastAccumulateWeek: 108 }; const old = structuredClone({ monster: s.monster, machine: s.machine, lucky: s.lucky, calamityPriest: s.calamityPriest, winner: s.winner, misfortuneMage: s.misfortuneMage });
    for (const id of CHAOS_WALKER_CASE_IDS) complete(s, id, 1, 100, 'ORDINARY'); act(s, { type: 'REFLECT' });
    expect(s.actionsRemaining).toBe(87); expect(s.spirituality).toBe(120); expect(s.mind).toBe(100); expect(s.progression.acting).toBe(100); expect(s.progression.mastery[BUFFER]).toBe(0); expect(s.progression.mastery[IMPEDIMENT]).toBe(0); expect(s.chaosWalker.life.playerTravelMetres).toBe(48); expect(hasChaosWalkerLifeLock(s)).toBe(false);
    expect({ monster: s.monster, machine: s.machine, lucky: s.lucky, calamityPriest: s.calamityPriest, winner: s.winner, misfortuneMage: s.misfortuneMage }).toEqual(old);
  });
  it('uses exactly the old unique reserve for three ability attempts, with zero cancelled-consent mastery', () => {
    const s = ready(); for (const id of CHAOS_WALKER_CASE_IDS) complete(s, id, 1, 100); act(s, { type: 'REFLECT' });
    expect(s.winner.luck).toEqual({ stored: 0, accumulated: 9, spent: 9, lastAccumulateWeek: 108 }); expect(s.spirituality).toBe(105); expect(s.mind).toBe(97); expect(s.actionsRemaining).toBe(87); expect(s.progression.mastery[BUFFER]).toBe(8); expect(s.progression.mastery[IMPEDIMENT]).toBe(8); expect(s.progression.acting).toBe(100);
    expect(attempt(s, 'revoked-draw')).toMatchObject({ result: 'ORDINARY', modifierApplied: false, luckSpent: 1 }); expect('luck' in s.chaosWalker.life).toBe(false);
  });
  it('accumulates at actual 1 AP once per real week and caps at 3, without healing or refilling spirituality', () => {
    const s = ready(); s.winner.luck = { stored: 1, accumulated: 7, spent: 6, lastAccumulateWeek: 108 }; s.health = 70; s.mind = 80; s.spirituality = 40;
    act(s, { type: 'ACCUMULATE' }); expect(s.winner.luck).toEqual({ stored: 2, accumulated: 8, spent: 6, lastAccumulateWeek: 110 }); expect(s.chaosWalker.life.accumulations).toEqual([{ week: 110, actionCost: 1, storedBefore: 1, storedAfter: 2, accumulatedAfter: 8, spentAtTime: 6 }]); expect(s.actionsRemaining).toBe(99); expect([s.health, s.mind, s.spirituality]).toEqual([70, 80, 40]);
    reject(s, { type: 'ACCUMULATE' }); s.week++; act(s, { type: 'ACCUMULATE' }); expect(s.winner.luck.stored).toBe(3); s.week++; reject(s, { type: 'ACCUMULATE' });
  });
  it('forbids accumulating inside a prepared or open scene, and preserves ordinary fallback when empty', () => {
    const s = ready(); s.winner.luck = { stored: 0, accumulated: 6, spent: 6, lastAccumulateWeek: 108 }; step(s, 'cart-fork', 'OBSERVE'); act(s, { type: 'PREPARE', caseId: 'cart-fork', method: 'ABILITY' }); reject(s, { type: 'ACCUMULATE' }); step(s, 'cart-fork', 'START_CASE'); approach(s, 'cart-fork'); reject(s, { type: 'ACCUMULATE' }); reject(s, { type: 'PERFORM', caseId: 'cart-fork' }); step(s, 'cart-fork', 'ORDINARY_CHECK'); trigger(s, 'cart-fork', 60); finish(s, 'cart-fork'); expect(s.winner.luck.stored).toBe(0); expect(s.progression.mastery[BUFFER]).toBe(0);
  });
  it('keeps all living, already-paid cleanup available with no AP, mind, spirituality or luck', () => {
    const s = ready(); start(s, 'cart-fork'); cast(s, 'cart-fork', 100); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; trigger(s, 'cart-fork', 100); step(s, 'cart-fork', 'STOP_INPUT');
    for (const type of ['WALK_RESULT', 'READ_RESULT', 'RETURN_CART', 'RETURN_OBJECT', 'RECORD_OUTCOME', 'RETURN_START', 'LEAVE_CASE'] as const) step(s, 'cart-fork', type);
    expect(hasChaosWalkerLifeLock(s)).toBe(false); expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); reject(s, { type: 'REPORT_CASE', caseId: 'cart-fork' });
  });
  it('prohibits actions after death and prevents refunding or re-opening completed original cases', () => {
    const s = ready(); complete(s, 'cart-fork'); reject(s, { type: 'START_CASE', caseId: 'cart-fork' }); reject(s, { type: 'REPORT_CASE', caseId: 'cart-fork' }); s.status = 'DEAD'; s.health = 0; reject(s, { type: 'ACCUMULATE' }); reject(s, { type: 'OBSERVE', caseId: 'revoked-draw' });
  });
  it('projects only domain-authorized commands and useful actual check/event receipts', () => {
    const s = ready(); start(s, 'cart-fork'); cast(s, 'cart-fork'); const p = projectChaosWalkerLife(s); expect(p.currentAttempt).toMatchObject({ pendingRemainingSeconds: 30, eventDraws: 0, luckSpent: 1 }); expect(p.currentAttempt?.abilityCheck).toMatchObject({ roll: 1, chance: 70, difficulty: 20 }); expect(p.facts.join(' ')).toContain('待用修正30秒');
    for (const a of chaosWalkerLifeActions(s)) { expect(validateChaosWalkerActivityCommand(a.command)).toBe(true); expect(a.enabled).toBe(blockChaosWalkerLife(s, a.command) === null); }
  });
  it('rejects extra fields and scene-specific command spoofing', () => {
    for (const bad of [{ type: 'ACCUMULATE', amount: 3 }, { type: 'DRAW_TAG', caseId: 'cart-fork' }, { type: 'WALK_RESULT', caseId: 'counterexample' }, { type: 'SPIN_DISC', caseId: 'revoked-draw' }, { type: 'PERFORM', caseId: 'cart-fork', roll: 1 }, { type: 'CONFIRM_LIMITED', caseId: 'revoked-draw', claim: 'LIMITED' }]) expect(validateChaosWalkerActivityCommand(bad)).toBe(false);
  });
  it('replay rejects forged probabilities, rolls, applied flags, costs, original ownership, movement and consent', () => {
    const s = ready(); for (const id of CHAOS_WALKER_CASE_IDS) complete(s, id, 1, 90); act(s, { type: 'REFLECT' });
    const mutations: ((v: SliceState) => void)[] = [
      v => { attempt(v, 'cart-fork').branchChance = 50; }, v => { attempt(v, 'cart-fork').branchResult = 'B'; }, v => { attempt(v, 'cart-fork').eventDraws = 2; }, v => { attempt(v, 'cart-fork').branchRoll = 0; }, v => { attempt(v, 'cart-fork').luckSpent = 0; }, v => { attempt(v, 'cart-fork').mindSpent = 0; }, v => { attempt(v, 'cart-fork').luckAfter!.stored++; }, v => { attempt(v, 'cart-fork').abilityCheck = { ...attempt(v, 'cart-fork').abilityCheck!, chance: 100 }; }, v => { attempt(v, 'cart-fork').abilityCheck = { ...attempt(v, 'cart-fork').abilityCheck!, tier: 'FAILURE' }; }, v => { attempt(v, 'cart-fork').objectMoves[0]!.to = 'B'; }, v => { attempt(v, 'cart-fork').playerMoves[1]!.metres = 0; }, v => { attempt(v, 'cart-fork').guideMoves = []; }, v => { v.chaosWalker.life.cart.location = 'C'; }, v => { v.chaosWalker.life.parcel.massGrams = 401 as 400; }, v => { v.chaosWalker.life.cart.quantity = 2 as 1; }, v => { attempt(v, 'revoked-draw').modifierApplied = true; }, v => { attempt(v, 'revoked-draw').consent = 'GRANTED'; }, v => { v.chaosWalker.life.tags[0]!.location = 'VERA_HAND'; }, v => { v.chaosWalker.life.volunteer.health = 99 as 100; }, v => { v.chaosWalker.life.disc.pointer = 'A'; }, v => { v.chaosWalker.life.forecast.text = '保证'; }, v => { attempt(v, 'counterexample').limitedConfirmed = false; }, v => { attempt(v, 'counterexample').steps.find(x => x.type === 'SPIN_DISC')!.eventRoll = 10; }, v => { v.chaosWalker.life.clockSeconds++; }, v => { v.progression.mastery[IMPEDIMENT] = 16; },
    ];
    for (const mutate of mutations) { const clone = structuredClone(s); mutate(clone); expect(validateChaosWalkerLife(clone)).toBe(false); }
  });
  it('replay rejects forged accumulation receipts and additional top-level fields', () => {
    const s = ready(); s.winner.luck = { stored: 1, accumulated: 7, spent: 6, lastAccumulateWeek: 108 }; act(s, { type: 'ACCUMULATE' });
    const clone = structuredClone(s); clone.chaosWalker.life.accumulations[0]!.storedAfter = 3; expect(validateChaosWalkerLife(clone)).toBe(false);
    const duplicate = structuredClone(s); duplicate.chaosWalker.life.accumulations.push({ ...duplicate.chaosWalker.life.accumulations[0]! }); expect(validateChaosWalkerLife(duplicate)).toBe(false);
    const extra = structuredClone(s); Object.assign(extra.chaosWalker.life, { luck: { stored: 3 } }); expect(validateChaosWalkerLife(extra)).toBe(false);
  });
  it('rejects impossible external clock increments until backed by actual combat or exit receipts', () => {
    const s = ready(); expect(() => advanceChaosWalkerLifeClock(s, -1)).toThrow(); expect(() => advanceChaosWalkerLifeClock(s, 0.5)).toThrow(); advanceChaosWalkerLifeClock(s, 60); expect(validateChaosWalkerLife(s)).toBe(false);
  });
});
