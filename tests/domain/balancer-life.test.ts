import { describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { PublicResolutionTier } from '../../src/shared/contracts.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { BALANCER_PREPARATION_IDS } from '../../src/domain/balancer/types.js';
import { BALANCER_CASE_IDS, balancerLifeClosed, blockBalancerLife, hasBalancerLifeLock, projectBalancerLife, replayBalancerLifeRoot, replayBalancerLifeGuardPlate, validateBalancerActivityCommand, validateBalancerLifeState, validateBalancerSourceChaosHunterLife, type BalancerActivityCommand, type BalancerCaseId } from '../../src/domain/balancer/life.js';
import { directedInitial3, dose, ba, promoted, rejectBalancer, rejectIntent } from './balancer-directed-helper.js';
const SENSE = 'justiciar.s2.imbalance-sensing', RESIST = 'justiciar.s2.measured-resistance';
const attempt = (s: SliceState, id: BalancerCaseId) => s.balancer.life.cases[id].attempts.at(-1)!;
function act(s: SliceState, command: BalancerActivityCommand): SliceState { const next = ba(s, command); expect(validateBalancerLifeState(next), JSON.stringify(command)).toBe(true); return next; }
function begin(s: SliceState, id: BalancerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY', consent: 'CONSENT_MIRA' | 'DECLINE_PERMISSION' = 'CONSENT_MIRA'): SliceState {
  for (const c of [{ type: 'OBSERVE', caseId: id }, { type: 'PREPARE', caseId: id, method }, { type: 'WALK', caseId: id, to: 'A' }, { type: 'CHECK_ORIGINALS', caseId: id }, { type: consent, caseId: id }, { type: 'SETUP_OBJECTS', caseId: id }] as BalancerActivityCommand[]) s = act(s, c);
  return id === 'measured-impact' ? act(s, { type: 'TAKE_PARCEL', caseId: id }) : s;
}
function finish(s: SliceState, id: BalancerCaseId, report = true): SliceState {
  if (id === 'withdrawn-inspection' && attempt(s, id).method === 'ABILITY' && attempt(s, id).consent === 'GRANTED') s = act(s, { type: 'WITHDRAW_PERMISSION', caseId: id });
  if (s.chaosHunter.life.playerLocation === 'A') s = act(s, { type: 'WALK', caseId: id, to: 'B' });
  if (s.balancer.life.operation.truth?.obscuredByPaper) s = act(s, { type: 'REMOVE_COVER', caseId: id });
  if (id === 'measured-impact' && !attempt(s, id).impact) s = act(s, { type: 'ORDINARY_BRACE', caseId: id });
  for (const c of [{ type: 'MANUAL_INSPECTION', caseId: id }, { type: 'TAKE_OBJECT', caseId: id }, { type: 'WALK', caseId: id, to: 'A' }, { type: 'RETURN_OBJECTS', caseId: id }, { type: 'WALK', caseId: id, to: 'START' }, { type: 'INSPECT', caseId: id }, { type: 'LEAVE', caseId: id }] as BalancerActivityCommand[]) s = act(s, c);
  return report ? act(s, { type: 'REPORT', caseId: id }) : s;
}
const ordinary = (s: SliceState, id: BalancerCaseId) => finish(begin(s, id, 'ORDINARY'), id);
const third = (s: SliceState) => ordinary(ordinary(s, 'visible-imbalance'), 'withdrawn-inspection');
const cache = new Map<string, SliceState>();
/** DECLARED UNIT-only original-seed cursor and AP selection before any new journal.
 * No old record, body, item, injury, stat, roll, mastery or check is rewritten. */
function directed(tiers: PublicResolutionTier[], stats: ('perception' | 'knowledge' | 'will')[] = tiers.map(() => 'perception'), actions = 100): SliceState {
  const key = `${tiers}:${stats}:${actions}`, saved = cache.get(key); if (saved) return structuredClone(saved);
  let s = directedInitial3(); const potionChance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] }); let cursor: number | null = null;
  for (let n = s.random.cursor; n < s.random.cursor + 8192; n++) {
    const rng = new DeterministicActionRandomStream(s.random.seed, n), potion = rng.nextInt(1, 100); if (potion <= 5 || potion > potionChance) continue;
    const okay = tiers.every((tier, i) => { const roll = rng.nextInt(1, 100), chance = computeCheckChance({ baseAbility: Math.min(500, s.character.coreStats[stats[i]!] + 1), difficulty: 20, modifiers: [] }); return tier === 'GREAT_SUCCESS' ? roll <= 5 : tier === 'SUCCESS' ? roll > 5 && roll <= chance : tier === 'FAILURE' ? roll > chance && roll < 96 : roll >= 96; });
    if (okay) { cursor = n; break; }
  }
  expect(cursor).not.toBeNull(); s.random.cursor = cursor!; s.actionsRemaining = s.weeklyBudget = actions; assertValidSliceState(s);
  s = ba(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of BALANCER_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId }); s = ba(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = ba(s, { type: 'PREPARE_PROMOTION' }); s = ba(s, dose); expect(s.progression.sequence).toBe(2); cache.set(key, structuredClone(s)); return s;
}
function sensing(s = directed(['SUCCESS']), id: BalancerCaseId = 'visible-imbalance'): SliceState { return act(begin(s, id), { type: 'IMBALANCE_SENSING', caseId: id }); }
function resistance(tier: PublicResolutionTier = 'SUCCESS'): SliceState { let s = act(directed([tier], ['knowledge']), { type: 'BUY_GUARD_PLATE' }); s = third(s); return act(begin(s, 'measured-impact'), { type: 'MEASURED_RESISTANCE', caseId: 'measured-impact' }); }
function impact(tier: PublicResolutionTier = 'SUCCESS'): SliceState { return act(act(resistance(tier), { type: 'WALK', caseId: 'measured-impact', to: 'B' }), { type: 'APPLY_IMPACT', caseId: 'measured-impact' }); }

describe('Balancer actual original room, independent truth and finite physical practice', () => {
  it('accepts exact finite commands only, rejecting extra fields and remote targets', () => {
    for (const c of [{ type: 'REFLECT', extra: true }, { type: 'BUY_GUARD_PLATE', quantity: 2 }, { type: 'WALK', caseId: 'visible-imbalance', to: 'OUTSIDE' }, { type: 'IMBALANCE_SENSING', caseId: 'visible-imbalance', target: 'MIRA_MIND' }, { type: 'MEASURED_RESISTANCE', caseId: 'foreign' }, { type: 'RESTORE_PLATE' }, { type: 'APPLY_IMPACT', caseId: 'measured-impact', victim: 'MIRA' }]) expect(validateBalancerActivityCommand(c)).toBe(false);
    rejectBalancer(promoted(), { type: 'IMBALANCE_SENSING', caseId: 'visible-imbalance' });
  }, 10_000);
  it('three ordinary cases complete with no new mastery, no hurt, no payment and unchanged old histories', () => {
    let s = promoted(); const old = structuredClone(s.chaosHunter.life), oldEncounter = structuredClone(s.chaosHunter.encounter), oldHistory = structuredClone(s.combatHistory), mastery = { ...s.progression.mastery }, injuries = structuredClone(s.injuries), resources = [s.health, s.mind, s.spirituality, s.cash];
    for (const id of BALANCER_CASE_IDS) s = ordinary(s, id); s = act(s, { type: 'REFLECT' });
    expect(balancerLifeClosed(s)).toBe(true); expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(mastery); expect(s.balancer.life.source!.snapshot).toEqual(old);
    expect(s.chaosHunter.life.cases).toEqual(old.cases); expect(s.chaosHunter.life.reflected).toBe(old.reflected); expect(s.chaosHunter.life.volunteer).toEqual(old.volunteer); expect(s.chaosHunter.life.guide).toEqual(old.guide); expect(s.chaosHunter.life.paper).toEqual(old.paper); expect(s.chaosHunter.life.table).toEqual(old.table);
    expect(s.chaosHunter.life.parcel).toEqual({ ...old.parcel, handovers: old.parcel.handovers + 3, returns: old.parcel.returns + 3 }); expect(s.chaosHunter.life.line).toEqual({ ...old.line, returns: old.line.returns + 3 }); expect(s.chaosHunter.life.playerTravelMetres).toBe(old.playerTravelMetres + 48); expect(s.chaosHunter.life.guideTravelMetres).toBe(old.guideTravelMetres + 40);
    expect([s.health, s.mind, s.spirituality, s.cash]).toEqual(resources); expect(s.injuries).toEqual(injuries); expect(injuries).toHaveLength(1); expect(s.chaosHunter.encounter).toEqual(oldEncounter); expect(s.combatHistory).toEqual(oldHistory);
    expect(s.balancer.life.guardPlate).toMatchObject({ owner: 'GUIDE', holder: 'GUIDE', location: 'START', integrity: 65, acquiredWeek: null }); expect(validateBalancerSourceChaosHunterLife(s)).toBe(true); assertValidSliceState(s);
  }, 60_000);
  it('uses one real30p sale, preserves exact inventory identity and cannot regenerate or reissue', () => {
    const before = promoted(), s = act(before, { type: 'BUY_GUARD_PLATE' }), e = s.balancer.life.journal[0]!;
    expect([before.cash - s.cash, before.actionsRemaining - s.actionsRemaining]).toEqual([30, 0]); expect(s.balancer.life.guardPlate).toEqual({ id: 'BA2-GUARD-PLATE', owner: 'PLAYER', holder: 'PLAYER', location: 'START', integrity: 65, acquiredWeek: s.week }); expect(s.balancer.life.source!.guardPlate).toMatchObject({ owner: 'GUIDE', acquiredWeek: null, integrity: 65 }); expect(s.chaosHunter.life.clockSeconds).toBe(before.chaosHunter.life.clockSeconds + 2); expect(e.plateBefore.owner).toBe('GUIDE'); expect(e.plateAfter.owner).toBe('PLAYER'); rejectBalancer(s, { type: 'BUY_GUARD_PLATE' }); expect(replayBalancerLifeGuardPlate(s)).toEqual(s.balancer.life.guardPlate);
  });
  it('fresh consent requires real approach and can be refused without losing the ordinary route', () => {
    let s = act(promoted(), { type: 'OBSERVE', caseId: 'visible-imbalance' }); s = act(s, { type: 'PREPARE', caseId: 'visible-imbalance', method: 'ABILITY' });
    expect(hasBalancerLifeLock(s)).toBe(true); rejectIntent(s, { type: 'ACTION', action: 'REST' }); for (const type of ['CHECK_ORIGINALS', 'CONSENT_MIRA', 'SETUP_OBJECTS', 'IMBALANCE_SENSING'] as const) rejectBalancer(s, { type, caseId: 'visible-imbalance' });
    s = act(s, { type: 'WALK', caseId: 'visible-imbalance', to: 'A' }); s = act(s, { type: 'CHECK_ORIGINALS', caseId: 'visible-imbalance' }); s = act(s, { type: 'DECLINE_PERMISSION', caseId: 'visible-imbalance' }); rejectBalancer(s, { type: 'CONSENT_MIRA', caseId: 'visible-imbalance' }); s = act(s, { type: 'SETUP_OBJECTS', caseId: 'visible-imbalance' }); rejectBalancer(s, { type: 'IMBALANCE_SENSING', caseId: 'visible-imbalance' }); s = finish(s, 'visible-imbalance'); expect(s.progression.mastery[SENSE]).toBe(0);
  });
  it('guide placement establishes physical truth before any ability, paying real movement and keeping answer unknown', () => {
    const before = promoted(), s = begin(before, 'visible-imbalance'), a = attempt(s, 'visible-imbalance');
    expect(s.balancer.life.operation.truth).toMatchObject({ objectId: 'CH3-PARCEL', location: 'B', referenceOffsetMm: 0, displacementMm: 120, obscuredByPaper: false }); expect(a.sensingAnswer).toBeNull(); expect(a.verifiedOffsetMm).toBeNull(); expect(s.chaosHunter.life.parcel).toMatchObject({ holder: 'TABLE', location: 'B', massGrams: 350 });
    expect(a.guideMoves.map(m => [m.from, m.to, m.metres, m.seconds])).toEqual([['START', 'A', 4, 4], ['A', 'B', 4, 4], ['B', 'A', 4, 4]]); expect(s.chaosHunter.life.guideTravelMetres - before.chaosHunter.life.guideTravelMetres).toBe(12);
    const publicView = projectBalancerLife(s); expect(publicView.currentAttempt?.sensingAnswer).toBeNull(); expect(publicView.currentAttempt?.verifiedOffsetMm).toBeNull(); expect(JSON.stringify(publicView)).not.toContain('displacementMm'); expect(JSON.stringify(publicView)).not.toContain('120毫米');
  });
  it.each(['SUCCESS', 'GREAT_SUCCESS'] as const)('sensing %s uses perception20/5S/1AP/2M and earns8 only after actual verification/report', tier => {
    const before = directed([tier]), ready = begin(before, 'visible-imbalance'); let s = act(ready, { type: 'IMBALANCE_SENSING', caseId: 'visible-imbalance' });
    expect(attempt(s, 'visible-imbalance').sensingTier).toBe(tier); expect([ready.actionsRemaining - s.actionsRemaining, ready.spirituality - s.spirituality, ready.mind - s.mind, ready.health - s.health]).toEqual([1, 5, 2, 0]); expect(s.balancer.life.journal.at(-1)!.source).toMatchObject({ coreStat: 'perception', difficulty: 20, distanceMetres: 4, currentConsent: 'GRANTED', actorLocation: 'A' }); expect(attempt(s, 'visible-imbalance').sensingAnswer).toMatchObject({ kind: 'VISIBLE_DEVIATION', displacementMm: 120 }); expect(s.progression.mastery[SENSE]).toBe(0); rejectBalancer(s, { type: 'IMBALANCE_SENSING', caseId: 'visible-imbalance' });
    s = finish(s, 'visible-imbalance'); expect(s.progression.mastery[SENSE]).toBe(8); expect(s.progression.mastery[RESIST]).toBe(0); expect(attempt(s, 'visible-imbalance').verifiedOffsetMm).toBe(120);
  });
  it.each(['FAILURE', 'GREAT_FAILURE'] as const)('sensing %s retains5S/4M costs, unknown answer and ordinary completion without mastery', tier => {
    const before = begin(directed([tier]), 'visible-imbalance'); let s = act(before, { type: 'IMBALANCE_SENSING', caseId: 'visible-imbalance' }); expect([before.spirituality - s.spirituality, before.mind - s.mind]).toEqual([5, 4]); expect(attempt(s, 'visible-imbalance').sensingAnswer).toMatchObject({ kind: 'UNRESOLVED', displacementMm: null }); s = finish(s, 'visible-imbalance'); expect(s.progression.mastery[SENSE]).toBe(0); expect(attempt(s, 'visible-imbalance').verifiedOffsetMm).toBe(120);
  });
  it('successful sensing cannot see through original-paper occlusion; withdrawal preserves costs and requires manual uncovering', () => {
    let s = ordinary(directed(['SUCCESS']), 'visible-imbalance'); s = begin(s, 'withdrawn-inspection'); const before = structuredClone(s); s = act(s, { type: 'IMBALANCE_SENSING', caseId: 'withdrawn-inspection' });
    expect(s.balancer.life.operation.truth?.displacementMm).toBe(120); expect(attempt(s, 'withdrawn-inspection').sensingAnswer).toMatchObject({ kind: 'OBSCURED', displacementMm: null }); expect(s.chaosHunter.life.paper).toMatchObject({ holder: 'TABLE', location: 'B' }); expect(projectBalancerLife(s).currentAttempt?.sensingAnswer).toContain('未知'); rejectBalancer(s, { type: 'REMOVE_COVER', caseId: 'withdrawn-inspection' }); rejectBalancer(s, { type: 'WALK', caseId: 'withdrawn-inspection', to: 'B' });
    s = act(s, { type: 'WITHDRAW_PERMISSION', caseId: 'withdrawn-inspection' }); expect([s.spirituality, s.mind]).toEqual([before.spirituality - 5, before.mind - 2]); rejectBalancer(s, { type: 'IMBALANCE_SENSING', caseId: 'withdrawn-inspection' }); s = act(s, { type: 'WALK', caseId: 'withdrawn-inspection', to: 'B' }); rejectBalancer(s, { type: 'MANUAL_INSPECTION', caseId: 'withdrawn-inspection' }); s = finish(s, 'withdrawn-inspection'); expect(attempt(s, 'withdrawn-inspection').coverRemoved).toBe(true); expect(attempt(s, 'withdrawn-inspection').verifiedOffsetMm).toBe(120); expect(s.progression.mastery[SENSE]).toBe(0); expect(s.chaosHunter.life.volunteer.willing).toBe(false);
  });
  it('withdrawal before sensing permits only ordinary inspection and no paid cast', () => {
    let s = begin(promoted(), 'visible-imbalance'); const before = [s.spirituality, s.mind]; s = act(s, { type: 'WITHDRAW_PERMISSION', caseId: 'visible-imbalance' }); rejectBalancer(s, { type: 'IMBALANCE_SENSING', caseId: 'visible-imbalance' }); s = finish(s, 'visible-imbalance'); expect([s.spirituality, s.mind]).toEqual(before); expect(s.progression.mastery[SENSE]).toBe(0);
  });
  it('new cases never reuse the preceding consent', () => {
    let s = ordinary(promoted(), 'visible-imbalance'); s = act(s, { type: 'OBSERVE', caseId: 'withdrawn-inspection' }); s = act(s, { type: 'PREPARE', caseId: 'withdrawn-inspection', method: 'ABILITY' }); expect(attempt(s, 'withdrawn-inspection').consent).toBe('UNASKED'); expect(s.chaosHunter.life.volunteer.willing).toBe(false); rejectBalancer(s, { type: 'IMBALANCE_SENSING', caseId: 'withdrawn-inspection' });
  });
});

describe('Balancer one-use own resistance, physical plate continuity and safe exit', () => {
  it('requires the purchased original plate and cannot cast on somebody else or in the wrong place', () => {
    let s = begin(third(promoted()), 'measured-impact'); rejectBalancer(s, { type: 'MEASURED_RESISTANCE', caseId: 'measured-impact' }); rejectBalancer(s, { type: 'BUY_GUARD_PLATE' }); s = act(s, { type: 'WALK', caseId: 'measured-impact', to: 'B' }); rejectBalancer(s, { type: 'MEASURED_RESISTANCE', caseId: 'measured-impact' }); s = finish(s, 'measured-impact'); expect(s.progression.mastery[RESIST]).toBe(0); expect(s.balancer.life.guardPlate.owner).toBe('GUIDE');
  });
  it('successful resistance pays6S/1AP/2M but only creates a finite30second next-impulse effect', () => {
    const s = resistance(), a = attempt(s, 'measured-impact'), e = s.balancer.life.journal.at(-1)!;
    expect(a.resistanceTier).toBe('SUCCESS'); expect(e.paid).toEqual({ actions: 1, spirituality: 6, mind: 2, pennies: 0, health: 0, cashGained: 0 }); expect(s.balancer.life.operation.effect).toMatchObject({ actor: 'PLAYER', target: 'PLAYER', plateId: 'BA2-GUARD-PLATE', objectId: 'CH3-PARCEL', remainingUses: 1 }); const effect = s.balancer.life.operation.effect!; expect(effect.expiresAt - effect.createdAt).toBe(30); expect(effect.createdAt).toBe(s.chaosHunter.life.clockSeconds); expect(s.balancer.life.guardPlate.integrity).toBe(65); expect(s.progression.mastery[RESIST]).toBe(0); expect(a.impact).toBeNull(); rejectBalancer(s, { type: 'MEASURED_RESISTANCE', caseId: 'measured-impact' });
  });
  it.each(['SUCCESS', 'GREAT_SUCCESS'] as const)('actual %s impact uses one original350g parcel, own2H and wear15, then earns8 on report', tier => {
    let s = impact(tier); const a = attempt(s, 'measured-impact'); expect(a.impact).toMatchObject({ actor: 'PLAYER', target: 'PLAYER', massGrams: 350, visible: true, healthLoss: 2, plateWear: 15, resistanceApplied: true }); expect(s.balancer.life.operation.effect).toBeNull(); expect(s.balancer.life.guardPlate).toMatchObject({ owner: 'PLAYER', holder: 'PLAYER', location: 'B', integrity: 50 }); expect(s.chaosHunter.life.parcel).toMatchObject({ holder: 'TABLE', location: 'B', quantity: 1, massGrams: 350 }); expect(s.chaosHunter.life.volunteer).toMatchObject({ health: 100, mind: 100, location: 'A', injuries: [] }); expect(s.progression.mastery[RESIST]).toBe(0); rejectBalancer(s, { type: 'APPLY_IMPACT', caseId: 'measured-impact' }); s = finish(s, 'measured-impact'); expect(s.progression.mastery[RESIST]).toBe(8); expect(s.balancer.life.guardPlate).toMatchObject({ location: 'START', integrity: 50 }); expect(replayBalancerLifeGuardPlate(s)).toEqual(s.balancer.life.guardPlate); rejectBalancer(s, { type: 'BUY_GUARD_PLATE' }); assertValidSliceState(s);
  });
  it.each(['FAILURE', 'GREAT_FAILURE'] as const)('failed %s resistance keeps6S/4M, physical risk5H and wear15 without mastery', tier => {
    let s = impact(tier); expect(attempt(s, 'measured-impact').mindSpent).toBe(4); expect(attempt(s, 'measured-impact').spiritualitySpent).toBe(6); expect(attempt(s, 'measured-impact').impact).toMatchObject({ healthLoss: 5, plateWear: 15, resistanceApplied: false }); expect(s.balancer.life.guardPlate.integrity).toBe(50); s = finish(s, 'measured-impact'); expect(s.progression.mastery[RESIST]).toBe(0);
  });
  it('physical expiry is exact, has no refund and cannot be restacked or awarded without application', () => {
    let s = resistance(), expiry = s.balancer.life.operation.effect!.expiresAt; const resources = [s.spirituality, s.mind]; s = act(s, { type: 'WAIT_EFFECT', caseId: 'measured-impact' }); expect(s.chaosHunter.life.clockSeconds).toBe(expiry); expect(attempt(s, 'measured-impact').waitedSeconds).toBe(30); expect(attempt(s, 'measured-impact').effectExpired).toBe(true); expect(s.balancer.life.operation.effect).toBeNull(); expect([s.spirituality, s.mind]).toEqual(resources); rejectBalancer(s, { type: 'WAIT_EFFECT', caseId: 'measured-impact' }); rejectBalancer(s, { type: 'MEASURED_RESISTANCE', caseId: 'measured-impact' }); s = act(s, { type: 'WALK', caseId: 'measured-impact', to: 'B' }); s = act(s, { type: 'APPLY_IMPACT', caseId: 'measured-impact' }); expect(attempt(s, 'measured-impact').impact).toMatchObject({ healthLoss: 5, resistanceApplied: false, plateWear: 15 }); s = finish(s, 'measured-impact'); expect(s.progression.mastery[RESIST]).toBe(0);
  });
  it.each(['STOP', 'WITHDRAW_PERMISSION'] as const)('%s immediately ends unused effect while safe ordinary brace retains paid costs and no injury', type => {
    let s = resistance(); const resources = [s.health, s.spirituality, s.mind], plate = s.balancer.life.guardPlate.integrity; s = act(s, { type, caseId: 'measured-impact' }); expect(s.balancer.life.operation.effect).toBeNull(); expect(attempt(s, 'measured-impact').effectStopped).toBe(true); rejectBalancer(s, { type: 'MEASURED_RESISTANCE', caseId: 'measured-impact' }); s = finish(s, 'measured-impact'); expect([s.health, s.spirituality, s.mind]).toEqual(resources); expect(s.balancer.life.guardPlate.integrity).toBe(plate); expect(attempt(s, 'measured-impact').impact).toMatchObject({ mode: 'ORDINARY_BRACE', healthLoss: 0, plateWear: 0 }); expect(s.progression.mastery[RESIST]).toBe(0);
  });
  it('ordinary brace is also available after successful casting, ending unused effect without hurt or mastery', () => { let s = resistance(); const before = [s.health, s.spirituality, s.mind]; s = finish(s, 'measured-impact'); expect([s.health, s.spirituality, s.mind]).toEqual(before); expect(s.balancer.life.guardPlate.integrity).toBe(65); expect(s.progression.mastery[RESIST]).toBe(0); });
  it('zero AP after paid sensing never locks physical inspection, object retrieval or actual return', () => {
    let s = sensing(directed(['GREAT_FAILURE'], ['perception'], 8)); expect(s.actionsRemaining).toBe(0); expect(hasBalancerLifeLock(s)).toBe(true); const resources = [s.health, s.spirituality, s.mind, s.cash];
    for (const c of [{ type: 'STOP', caseId: 'visible-imbalance' }, { type: 'WALK', caseId: 'visible-imbalance', to: 'B' }, { type: 'MANUAL_INSPECTION', caseId: 'visible-imbalance' }, { type: 'TAKE_OBJECT', caseId: 'visible-imbalance' }, { type: 'WALK', caseId: 'visible-imbalance', to: 'A' }, { type: 'RETURN_OBJECTS', caseId: 'visible-imbalance' }, { type: 'WALK', caseId: 'visible-imbalance', to: 'START' }, { type: 'INSPECT', caseId: 'visible-imbalance' }] as BalancerActivityCommand[]) { expect(blockBalancerLife(s, c)).toBeNull(); s = act(s, c); }
    expect(s.actionsRemaining).toBe(0); expect([s.health, s.spirituality, s.mind, s.cash]).toEqual(resources); expect(blockBalancerLife(s, { type: 'LEAVE', caseId: 'visible-imbalance' })).toBeNull(); expect(s.chaosHunter.life.playerLocation).toBe('START'); expect(s.chaosHunter.life.parcel.holder).toBe('GUIDE');
  });
  it('no remote retrieval, early report, teleport return or duplicated movement can replace actual originals', () => {
    let s = sensing(); for (const type of ['TAKE_OBJECT', 'RETURN_OBJECTS', 'MANUAL_INSPECTION', 'INSPECT', 'REPORT', 'LEAVE'] as const) rejectBalancer(s, { type, caseId: 'visible-imbalance' }); rejectBalancer(s, { type: 'WALK', caseId: 'visible-imbalance', to: 'START' }); s = act(s, { type: 'WALK', caseId: 'visible-imbalance', to: 'B' }); rejectBalancer(s, { type: 'WALK', caseId: 'visible-imbalance', to: 'A' }); rejectBalancer(s, { type: 'TAKE_OBJECT', caseId: 'visible-imbalance' }); s = finish(s, 'visible-imbalance'); expect(replayBalancerLifeRoot(s)).toEqual(s.chaosHunter.life);
  });
});

describe('Balancer strict replay rejects fake source, knowledge, clock, costs, plate and consequences', () => {
  const mutations: [string, (s: SliceState) => void][] = [
    ['original volunteer age', s => { (s.balancer.life.source!.snapshot.volunteer as { age: number }).age = 42; }],
    ['original paper text', s => { (s.balancer.life.source!.snapshot.paper as { text: string }).text = 'changed'; }],
    ['old case history', s => { s.chaosHunter.life.cases['paired-line'].closes++; }],
    ['actual player clock', s => { s.chaosHunter.life.clockSeconds++; }],
    ['journal clock', s => { s.balancer.life.journal.at(-1)!.clockAfter++; }],
    ['actual travel', s => { s.chaosHunter.life.playerTravelMetres += 4; }],
    ['invented displacement truth', s => { (s.balancer.life.operation.truth as { displacementMm: number }).displacementMm = 10; }],
    ['invented observed answer', s => { attempt(s, 'visible-imbalance').sensingAnswer!.displacementMm = 10; }],
    ['fake current body', s => { s.health++; }],
    ['refunded spirituality', s => { s.spirituality += 5; }],
    ['refunded mental cost', s => { s.mind += 2; }],
    ['changed paid cost', s => { s.balancer.life.journal.at(-1)!.paid.spirituality = 0; }],
    ['changed budget', s => { s.balancer.life.journal.at(-1)!.budget.spiritualityAfter++; }],
    ['fake roll', s => { s.balancer.life.journal.at(-1)!.check!.roll = 1; }],
    ['fake RNG boundary', s => { s.balancer.life.journal.at(-1)!.randomAfter!++; }],
    ['fake ability source', s => { s.balancer.life.journal.at(-1)!.source!.baseAbility++; }],
    ['fake physical source', s => { s.balancer.life.journal.at(-1)!.source!.physicalTruth!.obscuredByPaper = true; }],
    ['fake source distance', s => { (s.balancer.life.journal.at(-1)!.source as { distanceMetres: number }).distanceMetres = 40; }],
    ['missing real movement', s => { attempt(s, 'visible-imbalance').guideMoves.pop(); }],
    ['forged current consent', s => { attempt(s, 'visible-imbalance').consent = 'DECLINED'; }],
    ['free plate ownership', s => { s.balancer.life.guardPlate.owner = 'PLAYER'; s.balancer.life.guardPlate.holder = 'PLAYER'; s.balancer.life.guardPlate.acquiredWeek = s.week; }],
  ];
  it.each(mutations)('rejects %s', (_label, mutate) => { const s = sensing(); mutate(s); expect(validateBalancerLifeState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow(); });
  it.each([
    ['effect duration', (s: SliceState) => { s.balancer.life.operation.effect!.expiresAt++; }],
    ['effect target', (s: SliceState) => { (s.balancer.life.operation.effect as unknown as { target: string }).target = 'MIRA'; }],
    ['effect stacking', (s: SliceState) => { (s.balancer.life.operation.effect as unknown as { remainingUses: number }).remainingUses = 2; }],
    ['premature mastery', (s: SliceState) => { s.progression.mastery[RESIST] = 8; }],
  ] as const)('rejects %s', (_label, mutate) => { const s = resistance(); mutate(s); expect(validateBalancerLifeState(s)).toBe(false); });
  it.each([
    ['restored plate', (s: SliceState) => { s.balancer.life.guardPlate.integrity = 65; }],
    ['forged health application', (s: SliceState) => { attempt(s, 'measured-impact').impact!.healthLoss = 0; }],
    ['forged wear application', (s: SliceState) => { attempt(s, 'measured-impact').impact!.plateWear = 0; }],
    ['changed impulse object', (s: SliceState) => { (attempt(s, 'measured-impact').impact as unknown as { objectId: string }).objectId = 'REPLACEMENT'; }],
    ['refunded impact damage', (s: SliceState) => { s.health += 2; }],
  ] as const)('rejects %s', (_label, mutate) => { const s = impact(); mutate(s); expect(validateBalancerLifeState(s)).toBe(false); });
  it('projection is defensive, human-readable and does not expose hidden physical truth or original source records', () => {
    const s = sensing(), before = structuredClone(s), v = projectBalancerLife(s), prose = [v.title, v.story, v.environment, v.nextStep, ...v.facts, ...Object.values(v.site), ...v.cases.flatMap(c => [c.title, c.story, ...c.observations]), ...v.actions.flatMap(a => [a.label, a.reason ?? ''])].join('\n');
    expect(prose).not.toMatch(/\bG\b|候选|原文未核|CH3-|BA2-|START|randomCursor|baseAbility/); expect('source' in v).toBe(false); expect('operation' in v).toBe(false); v.cases[0]!.attempts[0]!.evidence.push('fake'); expect(s).toEqual(before);
  });
  it('preferred action route terminates three finite cases without forcing a failed caster to self-injure', () => {
    let s = promoted(), count = 0;
    while (!s.balancer.life.reflected && count++ < 120) { const view = projectBalancerLife(s), action = view.actions.find(a => a.id === view.preferredActionId); expect(action, view.nextStep).toBeDefined(); expect(action!.enabled).toBe(true); s = act(s, action!.command); }
    expect(count).toBeLessThan(120); expect(s.progression.acting).toBe(100); expect(balancerLifeClosed(s)).toBe(true); expect(attempt(s, 'withdrawn-inspection').permissionWithdrawn).toBe(true); if (!attempt(s, 'measured-impact').impact?.resistanceApplied) expect(attempt(s, 'measured-impact').healthLost).toBe(0); assertValidSliceState(s);
  }, 60_000);
});
