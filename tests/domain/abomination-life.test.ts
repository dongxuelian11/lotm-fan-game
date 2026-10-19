import { describe, expect, it } from 'vitest';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { validateAbominationState } from '../../src/domain/abomination/index.js';
import { blockAbominationLife, abominationLifeActions, abominationLifeClosed, abominationLifeMasteryGains, getAbominationCurrentSite, hasAbominationLifeLock,
  projectAbominationLife, validateAbominationActivityCommand, validateAbominationCurrentSite, validateAbominationLifeState, type AbominationCaseId } from '../../src/domain/abomination/life.js';
import { ABOMINATION_ABILITY_IDS } from '../../src/domain/abomination/types.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { ab, directedInitial2, dose, oldChainedRoots, originalAncientEvil, prepareBottle, promoted, ready, rejectAbomination, step } from './abomination-directed-helper.js';
const [BARRIER, CRY] = ABOMINATION_ABILITY_IDS;
const attempt = (s: SliceState, id: AbominationCaseId) => s.abomination.life.cases[id].attempts[0]!;
const piece = (s: SliceState, id: AbominationCaseId) => s.abomination.life.pieces.find(n => n.caseId === id)!;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
type DirectedLife = 'BARRIER_WIN' | 'BARRIER_FAIL' | 'CRY_WIN' | 'CRY_RESIST' | 'CRY_FAIL' | 'THIRD_WIN';
const cache = new Map<string, SliceState>();
/** UNIT-only original-seed cursor selection before any new-stage journal exists.
 * The complete historical642 prefix and natural producer never use this selector. */
function firstCast(kind: DirectedLife, weeklyBudget = 100): SliceState {
  const key = `${kind}:${weeklyBudget}`;
  if (!cache.has(key)) {
    const initial = directedInitial2(); initial.actionsRemaining = initial.weeklyBudget = weeklyBudget;
    const promotionChance = computeCheckChance({ baseAbility: initial.character.coreStats.will, difficulty: 30, modifiers: [] }),
      chance = computeCheckChance({ baseAbility: initial.character.coreStats.will + 1, difficulty: 18, modifiers: [] });
    let chosen: number | null = null;
    for (let cursor = initial.random.cursor; cursor < initial.random.cursor + 2048; cursor++) {
      const rng = new DeterministicActionRandomStream(initial.random.seed, cursor), promotion = rng.nextInt(1, 100);
      if (kind.startsWith('CRY') || kind === 'THIRD_WIN') rng.nextInt(1, 100); // First case's one real ordinary pulse observation.
      const cast = rng.nextInt(1, 100), resistance = rng.nextInt(1, 100), wins = kind !== 'BARRIER_FAIL' && kind !== 'CRY_FAIL';
      if (promotion > 5 && promotion <= promotionChance && ((cast <= chance) === wins) && (kind !== 'CRY_WIN' || resistance > 45) && (kind !== 'CRY_RESIST' || resistance <= 45)) { chosen = cursor; break; }
    }
    expect(chosen).not.toBeNull(); initial.random.cursor = chosen!;
    const s = ab(prepareBottle(initial, dose.bottleId), dose); expect(s.progression.sequence).toBe(1); cache.set(key, s);
  }
  return structuredClone(cache.get(key)!);
}
function start(s: SliceState, id: AbominationCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = ready(s, { ap: 3, cash: 100, mind: 8, spirituality: 8 });
  s = ab(s, { type: 'OBSERVE', caseId: id }); s = ab(s, { type: 'CONSENT', caseId: id, permission: 'OWNER' });
  if (method === 'ABILITY') s = ab(s, { type: 'CONSENT', caseId: id, permission: 'ABILITY' });
  if (s.abomination.life.site.volunteer.location === 'OUTSIDE') s = ab(s, { type: 'INVITE', caseId: id });
  return ab(s, { type: 'PREPARE', caseId: id, method });
}
function reach(s: SliceState, id: AbominationCaseId): SliceState {
  for (const type of ['WALK_TO_A', 'WALK_TO_B', 'READ_ORIGINAL', 'RETURN_TO_A', 'PLACE_PIECE'] as const) s = ab(s, { type, caseId: id }); return s;
}
function castBarrier(s: SliceState, id: 'tray-pulse' | 'withdrawn-input' = 'tray-pulse'): SliceState {
  s = ab(s, { type: 'PREPARE_PULSE', caseId: id }); return ab(s, { type: 'SPIRIT_BARRIER', caseId: id });
}
function finish(s: SliceState, id: AbominationCaseId): SliceState {
  while (s.abomination.life.cue && !s.abomination.life.cue.executed && s.abomination.life.cue.delayRemainingSeconds > 0) s = ab(s, { type: 'WAIT_1', caseId: id });
  if (s.abomination.life.site.playerLocation === 'B') s = ab(s, { type: 'RETURN_TO_A', caseId: id });
  if (!attempt(s, id).verified) {
    if (id === 'spoken-hesitation') {
      if (!attempt(s, id).cuePrepared) s = ab(s, { type: 'PREPARE_CUE', caseId: id });
      s = ab(s, { type: 'PERFORM_CUE', caseId: id });
    } else {
      if (!attempt(s, id).pulsePrepared) s = ab(s, { type: 'PREPARE_PULSE', caseId: id });
      s = ab(s, { type: 'PERFORM_PULSE', caseId: id });
    }
  }
  for (const type of ['TAKE_PIECE', 'RETURN_TO_ENTRY', 'RETURN_PIECE', 'LEAVE'] as const) s = ab(s, { type, caseId: id });
  return ab(ready(s), { type: 'REPORT', caseId: id });
}
function ordinary(s: SliceState, id: AbominationCaseId): SliceState { return finish(reach(start(s, id, 'ORDINARY'), id), id); }
function cryReady(kind: 'CRY_WIN' | 'CRY_RESIST' | 'CRY_FAIL'): SliceState {
  let s = reach(start(ordinary(firstCast(kind), 'tray-pulse'), 'spoken-hesitation'), 'spoken-hesitation');
  return ab(s, { type: 'PREPARE_CUE', caseId: 'spoken-hesitation' });
}

describe('Abomination finite original-room life and exact replay', () => {
  it('projects actual642 originals, with Elsa outside and no invented energy, and clones the source once', () => {
    const original = originalAncientEvil(), s = promoted(), roots = oldChainedRoots(s);
    expect(projectAbominationLife(original).site).toEqual(original.silentDisciple.life);
    expect(projectAbominationLife(original).operation).toEqual(original.ancientEvil.life.operation);
    expect(s.abomination.life.site).toEqual(original.silentDisciple.life); expect(s.abomination.life.site).not.toBe(s.silentDisciple.life);
    expect(s.abomination.life.site).toMatchObject({ playerLocation: 'START', playerTravelMetres: 112, clockSeconds: 4026, volunteer: { id: 'SD3-ELSA', bodyId: 'SD3-ELSA', age: 43, location: 'OUTSIDE', alive: true, willing: true, health: 100, mind: 100, spirituality: 100 }, guide: { location: 'OUTSIDE' } });
    expect(s.abomination.life.operation).toEqual({ door: 'OPEN', inputActive: false, form: null }); expect(s.abomination.life.volunteerEffortSpent).toBe(0);
    for (const body of [s.silentDisciple.life.volunteer, s.abomination.life.site.volunteer]) expect(Object.keys(body).some(key => /energy|effort/i.test(key))).toBe(false);
    expect(oldChainedRoots(s)).toEqual(roots); expect(validateAbominationLifeState(s)).toBe(true);
  }, 120_000);
  it('requires invitation before buying, then physically walks Elsa8m and the player12m while preserving original clothes and bag', () => {
    let s = ab(promoted(), { type: 'OBSERVE', caseId: 'tray-pulse' }); const original = structuredClone(s.abomination.life.site);
    s = ab(s, { type: 'CONSENT', caseId: 'tray-pulse', permission: 'OWNER' }); rejectAbomination(s, { type: 'PREPARE', caseId: 'tray-pulse', method: 'ORDINARY' });
    s = ab(s, { type: 'INVITE', caseId: 'tray-pulse' }); expect(s.abomination.life.site.volunteer.location).toBe('OUTSIDE');
    s = ab(s, { type: 'PREPARE', caseId: 'tray-pulse', method: 'ORDINARY' });
    expect(piece(s, 'tray-pulse')).toMatchObject({ id: 'AB1-PIECE-1', kind: 'ward-piece', location: 'HAND', charges: 1, wear: 0, paidPennies: 20, testCharges: 1, testUses: 0 });
    rejectAbomination(s, { type: 'PLACE_PIECE', caseId: 'tray-pulse' }); rejectAbomination(s, { type: 'SPIRIT_BARRIER', caseId: 'tray-pulse' });
    s = reach(s, 'tray-pulse'); expect(s.abomination.life.site).toMatchObject({ playerLocation: 'A', playerTravelMetres: 124, volunteer: { location: 'A' } });
    const walk = s.abomination.life.journal.find(e => e.command.type === 'WALK_TO_A')!;
    expect(walk.moves).toEqual([
      { actorId: 'SD3-ELSA', from: 'OUTSIDE', to: 'START', metres: 4, seconds: 4, itemIds: ['SD3-CLOTHES', 'SD3-BAG'] },
      { actorId: 'SD3-ELSA', from: 'START', to: 'A', metres: 4, seconds: 4, itemIds: ['SD3-CLOTHES', 'SD3-BAG'] },
      { actorId: 'PLAYER', from: 'START', to: 'A', metres: 4, seconds: 4, itemIds: ['AB1-PIECE-1'] },
    ]); expect(walk.elapsedSeconds).toBe(12);
    expect(s.abomination.life.site.clothing).toEqual(original.clothing); expect(s.abomination.life.site.bag).toEqual(original.bag); expect(s.abomination.life.site.note).toEqual(original.note);
    expect(s.abomination.life.site.guide).toEqual(original.guide); expect(attempt(s, 'tray-pulse')).toMatchObject({ readTray: true, readOriginal: true, playerTravelMetres: 12, volunteerTravelMetres: 8, volunteerEffortSpent: 3 });
    expect(piece(s, 'tray-pulse')).toMatchObject({ location: 'TRAY', travelMetres: 12 }); expect(s.abomination.life.volunteerEffortSpent).toBe(3);
    rejectAbomination(s, { type: 'READ_ORIGINAL', caseId: 'tray-pulse' }); rejectAbomination(s, { type: 'PREPARE', caseId: 'tray-pulse', method: 'ABILITY' });
  }, 180_000);
  it('pays8S2M and applies one20s mental barrier only when its finite pulse actually fires, then reports8 mastery once', () => {
    let s = reach(start(firstCast('BARRIER_WIN'), 'tray-pulse'), 'tray-pulse'); const before = structuredClone(s), roots = oldChainedRoots(s);
    rejectAbomination(s, { type: 'SPIRIT_BARRIER', caseId: 'tray-pulse' }); s = castBarrier(s);
    expect(success(attempt(s, 'tray-pulse').castTier)).toBe(true); expect([s.spirituality, s.mind, s.random.cursor]).toEqual([before.spirituality - 8, before.mind - 2, before.random.cursor + 1]);
    expect(s.abomination.life.pending).toMatchObject({ abilityId: BARRIER, sourceId: 'AB1-PIECE-1-TEST', targetId: 'PLAYER', trayId: 'SD3-TRAY', location: 'A', expiresAt: s.abomination.life.site.clockSeconds + 20 });
    expect(piece(s, 'tray-pulse')).toMatchObject({ charges: 1, testCharges: 1, wear: 0 }); expect(s.progression.mastery[BARRIER]).toBe(0);
    rejectAbomination(s, { type: 'SPIRIT_BARRIER', caseId: 'tray-pulse' }); const pulseBefore = structuredClone(s); s = ab(s, { type: 'PERFORM_PULSE', caseId: 'tray-pulse' });
    const expected = resolveNormalCheck({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty: 20, modifiers: [], roll: new DeterministicActionRandomStream(pulseBefore.random.seed, pulseBefore.random.cursor).nextInt(1, 100) });
    expect(s.lastCheck).toEqual(expected); expect(s.mind).toBe(pulseBefore.mind - 1); expect(s.random.cursor).toBe(pulseBefore.random.cursor + 1);
    expect(attempt(s, 'tray-pulse')).toMatchObject({ baselinePressure: 45, feltPressure: 15, appliedAbilityIds: [BARRIER], applicationDone: true, verified: true, windowEnd: 'APPLIED' });
    expect(piece(s, 'tray-pulse')).toMatchObject({ charges: 0, wear: 1, testCharges: 0, testUses: 1 }); expect(s.abomination.life.pulse).toMatchObject({ kind: 'MENTAL', resolved: true });
    rejectAbomination(s, { type: 'PERFORM_PULSE', caseId: 'tray-pulse' }); rejectAbomination(s, { type: 'PREPARE_PULSE', caseId: 'tray-pulse' }); rejectAbomination(s, { type: 'REPORT', caseId: 'tray-pulse' });
    expect(s.progression.mastery[BARRIER]).toBe(0); s = finish(s, 'tray-pulse'); expect(s.progression.mastery[BARRIER]).toBe(8); expect(s.progression.acting).toBe(25);
    expect(s.abomination.life.site).toMatchObject({ playerLocation: 'START', playerTravelMetres: 128, volunteer: { location: 'A' } }); expect(piece(s, 'tray-pulse')).toMatchObject({ status: 'RETURNED', location: 'RETURNED', travelMetres: 16 });
    expect(oldChainedRoots(s)).toEqual(roots); rejectAbomination(s, { type: 'REPORT', caseId: 'tray-pulse' }); assertValidSliceState(s);
  }, 180_000);
  it('failed cast keeps8S4M cost and ordinary pulse costs3M, consumes only its test source and earns no mastery', () => {
    let s = reach(start(firstCast('BARRIER_FAIL'), 'tray-pulse'), 'tray-pulse'); const before = structuredClone(s); s = castBarrier(s);
    expect(success(attempt(s, 'tray-pulse').castTier)).toBe(false); expect([s.spirituality, s.mind, s.random.cursor]).toEqual([before.spirituality - 8, before.mind - 4, before.random.cursor + 1]);
    expect(s.abomination.life.pending).toBeNull(); s = finish(s, 'tray-pulse'); expect(s.mind).toBe(before.mind - 7);
    expect(piece(s, 'tray-pulse')).toMatchObject({ charges: 1, wear: 0, testCharges: 0, testUses: 1 }); expect(s.progression.mastery[BARRIER]).toBe(0); expect(s.progression.acting).toBe(25);
  }, 180_000);
  it('real movement, stop,20s expiry,遮挡 and withdrawal cancel only unused barriers without refund or refreshed pulse', () => {
    for (const kind of ['MOVE', 'STOP', 'EXPIRY', 'OCCLUDE', 'WITHDRAW'] as const) {
      let s = castBarrier(reach(start(firstCast('BARRIER_WIN'), 'tray-pulse'), 'tray-pulse')); const spirit = s.spirituality, mind = s.mind, clock = s.abomination.life.site.clockSeconds;
      if (kind === 'EXPIRY') { s = ab(s, { type: 'WAIT_10', caseId: 'tray-pulse' }); s = ab(s, { type: 'WAIT_10', caseId: 'tray-pulse' }); expect(s.abomination.life.site.clockSeconds).toBe(clock + 20); }
      else if (kind === 'WITHDRAW') s = ab(s, { type: 'WITHDRAW_CONSENT', caseId: 'tray-pulse', permission: 'ABILITY' });
      else s = ab(s, { type: kind === 'MOVE' ? 'WALK_TO_B' : kind === 'STOP' ? 'STOP_METHOD' : 'OCCLUDE', caseId: 'tray-pulse' });
      expect(s.abomination.life.pending).toBeNull(); expect([s.spirituality, s.mind]).toEqual([spirit, mind]); expect(piece(s, 'tray-pulse')).toMatchObject({ charges: 1, testCharges: 1 });
      rejectAbomination(s, { type: 'SPIRIT_BARRIER', caseId: 'tray-pulse' }); rejectAbomination(s, { type: 'PREPARE_PULSE', caseId: 'tray-pulse' });
      if (kind === 'OCCLUDE') s = ab(s, { type: 'RESTORE_VIEW', caseId: 'tray-pulse' }); s = finish(s, 'tray-pulse');
      expect(attempt(s, 'tray-pulse').feltPressure).toBe(45); expect(s.mind).toBe(mind - 3); expect(s.progression.mastery[BARRIER]).toBe(0); expect(hasAbominationLifeLock(s)).toBe(false); assertValidSliceState(s);
    }
  }, 300_000);
  it('successful cry draws actual45% resistance then applies exactly3 real seconds and one finite voice charge', () => {
    let s = cryReady('CRY_WIN'); const before = structuredClone(s), cursor = s.random.cursor, rng = new DeterministicActionRandomStream(s.random.seed, cursor); rng.nextInt(1, 100); const resistance = rng.nextInt(1, 100);
    s = ab(s, { type: 'BRIEF_CRY', caseId: 'spoken-hesitation' });
    expect(attempt(s, 'spoken-hesitation')).toMatchObject({ resistanceRoll: resistance, resisted: false, applicationDone: true, verified: false, appliedAbilityIds: [CRY] }); expect(resistance).toBeGreaterThan(45);
    expect(s.random.cursor).toBe(cursor + 2); expect([s.spirituality, s.mind]).toEqual([before.spirituality - 8, before.mind - 2]);
    expect(piece(s, 'spoken-hesitation')).toMatchObject({ charges: 0, wear: 1, testCharges: 1, testUses: 0 }); expect(s.abomination.life.cue).toMatchObject({ actorId: 'SD3-ELSA', bodyId: 'SD3-ELSA', delayImposedSeconds: 3, delayRemainingSeconds: 3, executed: false });
    const clock = s.abomination.life.site.clockSeconds; rejectAbomination(s, { type: 'PERFORM_CUE', caseId: 'spoken-hesitation' }); rejectAbomination(s, { type: 'ABORT', caseId: 'spoken-hesitation' });
    for (const remaining of [2, 1, 0]) { expect(projectAbominationLife(s).actions.find(a => a.preferredAction)?.command.type).toBe('WAIT_1'); s = ab(s, { type: 'WAIT_1', caseId: 'spoken-hesitation' }); expect(s.abomination.life.cue!.delayRemainingSeconds).toBe(remaining); }
    expect(s.abomination.life.cue).toMatchObject({ executed: true, executedAt: clock + 3 }); expect(s.abomination.life.site.clockSeconds).toBe(clock + 3);
    expect(piece(s, 'spoken-hesitation')).toMatchObject({ testCharges: 0, testUses: 1 }); expect(s.abomination.life.site.volunteer).toEqual(before.abomination.life.site.volunteer); expect(s.health).toBe(before.health);
    rejectAbomination(s, { type: 'WAIT_1', caseId: 'spoken-hesitation' }); rejectAbomination(s, { type: 'PREPARE_CUE', caseId: 'spoken-hesitation' }); s = finish(s, 'spoken-hesitation'); expect(s.progression.mastery[CRY]).toBe(8);
  }, 180_000);
  it('cast failure draws no resistance; actual successful resistance keeps8S4M and exposes ordinary finite cue', () => {
    for (const kind of ['CRY_FAIL', 'CRY_RESIST'] as const) {
      let s = cryReady(kind); const before = structuredClone(s); s = ab(s, { type: 'BRIEF_CRY', caseId: 'spoken-hesitation' });
      expect(s.random.cursor).toBe(before.random.cursor + (kind === 'CRY_FAIL' ? 1 : 2)); expect([s.spirituality, s.mind]).toEqual([before.spirituality - 8, before.mind - 4]);
      expect(attempt(s, 'spoken-hesitation').resistanceRoll === null).toBe(kind === 'CRY_FAIL'); expect(attempt(s, 'spoken-hesitation').resisted).toBe(kind === 'CRY_RESIST');
      expect(s.abomination.life.cue).toMatchObject({ delayImposedSeconds: 0, delayRemainingSeconds: 0, executed: false }); expect(piece(s, 'spoken-hesitation')).toMatchObject({ charges: 1, wear: 0 });
      expect(blockAbominationLife(s, { type: 'PERFORM_CUE', caseId: 'spoken-hesitation' })).toBeNull(); s = finish(s, 'spoken-hesitation'); expect(s.progression.mastery[CRY]).toBe(0); expect(piece(s, 'spoken-hesitation').testUses).toBe(1);
    }
  }, 240_000);
  it('withdrawal, stop and movement never erase an already imposed delay or its promised original cue', () => {
    for (const action of ['ABILITY', 'OWNER', 'STOP', 'MOVE'] as const) {
      let s = ab(cryReady('CRY_WIN'), { type: 'BRIEF_CRY', caseId: 'spoken-hesitation' }); const clock = s.abomination.life.site.clockSeconds, money = s.cash, spirit = s.spirituality, mind = s.mind;
      if (action === 'OWNER' || action === 'ABILITY') s = ab(s, { type: 'WITHDRAW_CONSENT', caseId: 'spoken-hesitation', permission: action });
      else s = ab(s, { type: action === 'STOP' ? 'STOP_METHOD' : 'WALK_TO_B', caseId: 'spoken-hesitation' });
      expect([s.cash, s.spirituality, s.mind]).toEqual([money, spirit, mind]); expect(s.abomination.life.cue!.delayImposedSeconds).toBe(3);
      if (action === 'MOVE') expect(s.abomination.life.cue).toMatchObject({ delayRemainingSeconds: 0, executed: true, executedAt: clock + 3 });
      else {
        expect(s.abomination.life.cue).toMatchObject({ delayRemainingSeconds: 2, executed: false }); rejectAbomination(s, { type: 'ABORT', caseId: 'spoken-hesitation' });
        for (let n = 0; n < 2; n++) { expect(projectAbominationLife(s).actions.find(a => a.preferredAction)?.command.type).toBe('WAIT_1'); s = ab(s, { type: 'WAIT_1', caseId: 'spoken-hesitation' }); }
        expect(s.abomination.life.cue).toMatchObject({ delayRemainingSeconds: 0, executed: true, executedAt: clock + 3 });
      }
      expect(piece(s, 'spoken-hesitation')).toMatchObject({ charges: 0, wear: 1, testCharges: 0, testUses: 1 }); s = finish(s, 'spoken-hesitation'); expect(s.progression.mastery[CRY]).toBe(8); assertValidSliceState(s);
    }
  }, 300_000);
  it('keeps real WAIT_1 and ordinary cleanup available at0AP after withdrawal, without advancing the week early', () => {
    let s = ordinary(firstCast('CRY_WIN', 3), 'tray-pulse'); s = ready(s, { ap: 3 });
    s = step(s, { type: 'ACTION', action: 'REST' });
    for (const command of [{ type: 'OBSERVE', caseId: 'spoken-hesitation' }, { type: 'CONSENT', caseId: 'spoken-hesitation', permission: 'OWNER' }, { type: 'CONSENT', caseId: 'spoken-hesitation', permission: 'ABILITY' }, { type: 'PREPARE', caseId: 'spoken-hesitation', method: 'ABILITY' }] as const) s = ab(s, command);
    expect(s.actionsRemaining).toBe(0); s = reach(s, 'spoken-hesitation'); s = ab(s, { type: 'PREPARE_CUE', caseId: 'spoken-hesitation' }); s = ab(s, { type: 'BRIEF_CRY', caseId: 'spoken-hesitation' });
    expect(s.abomination.life.cue!.delayRemainingSeconds).toBe(3); const week = s.week, clock = s.abomination.life.site.clockSeconds;
    s = ab(s, { type: 'WITHDRAW_CONSENT', caseId: 'spoken-hesitation', permission: 'ABILITY' });
    for (let n = 0; n < 2; n++) { const wait = projectAbominationLife(s).actions.find(a => a.command.type === 'WAIT_1'); expect(wait).toMatchObject({ enabled: true, preferredAction: true }); s = ab(s, { type: 'WAIT_1', caseId: 'spoken-hesitation' }); expect(s.actionsRemaining).toBe(0); expect(s.week).toBe(week); }
    expect(s.abomination.life.cue).toMatchObject({ executed: true, executedAt: clock + 3 }); s = ab(s, { type: 'ABORT', caseId: 'spoken-hesitation' });
    expect(hasAbominationLifeLock(s)).toBe(false); expect(s.abomination.life.journal.at(-1)!.after.actions).toBe(0); expect(s.week).toBe(week + 1); expect(s.abomination.life.cases['spoken-hesitation'].status).toBe('EXAMINED');
    s = ab(s, { type: 'REPORT', caseId: 'spoken-hesitation' }); expect(s.progression.mastery[CRY]).toBe(8); assertValidSliceState(s);
  }, 240_000);
  it('third case really withdraws before pulse and earns no unused barrier mastery or refund', () => {
    let s = ordinary(ordinary(firstCast('THIRD_WIN'), 'tray-pulse'), 'spoken-hesitation'); s = castBarrier(reach(start(s, 'withdrawn-input'), 'withdrawn-input'), 'withdrawn-input');
    expect(success(attempt(s, 'withdrawn-input').castTier)).toBe(true); const before = structuredClone(s);
    expect(projectAbominationLife(s).actions.find(a => a.preferredAction)?.command).toEqual({ type: 'WITHDRAW_CONSENT', caseId: 'withdrawn-input', permission: 'ABILITY' });
    rejectAbomination(s, { type: 'PERFORM_PULSE', caseId: 'withdrawn-input' }); s = ab(s, { type: 'WITHDRAW_CONSENT', caseId: 'withdrawn-input', permission: 'ABILITY' });
    expect(s.abomination.life.pending).toBeNull(); expect([s.spirituality, s.mind]).toEqual([before.spirituality, before.mind]); expect(s.abomination.life.cases['withdrawn-input'].permission.OWNER).toBe('GRANTED');
    rejectAbomination(s, { type: 'CONSENT', caseId: 'withdrawn-input', permission: 'ABILITY' }); s = finish(s, 'withdrawn-input'); s = ab(ready(s), { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(abominationLifeMasteryGains(s)).toEqual({ [BARRIER]: 0, [CRY]: 0 }); expect(s.abomination.life.volunteerEffortSpent).toBe(9);
    expect(s.abomination.life.site.playerTravelMetres).toBe(160); expect(s.abomination.life.pieces).toHaveLength(3); expect(s.abomination.life.pieces.every(n => n.status === 'RETURNED' && n.charges === 1 && n.testUses === 1)).toBe(true);
    expect(abominationLifeClosed(s)).toBe(true); expect(abominationLifeActions(s)).toEqual([]); expect(projectAbominationLife(s).preferredActionId).toBeNull(); expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]); assertValidSliceState(s);
  }, 240_000);
  it('ordinary route preserves all old roots and body resources, never requires ability consent, and consumes finite sources', () => {
    const original = promoted(); let s = original;
    for (const id of ['tray-pulse', 'spoken-hesitation', 'withdrawn-input'] as const) s = ordinary(s, id);
    s = ab(ready(s), { type: 'REFLECT' }); expect(s.abomination.life.site.volunteer).toEqual({ ...original.abomination.life.site.volunteer, location: 'A' });
    expect(s.abomination.life.site.guide).toEqual(original.abomination.life.site.guide); expect(s.abomination.life.operation).toEqual(original.abomination.life.operation); expect(oldChainedRoots(s)).toEqual(oldChainedRoots(original));
    expect(abominationLifeMasteryGains(s)).toEqual({ [BARRIER]: 0, [CRY]: 0 }); expect(s.abomination.life.journal.filter(e => e.command.type === 'CONSENT').every(e => e.command.type === 'CONSENT' && e.command.permission === 'OWNER')).toBe(true);
    expect(s.abomination.life.pieces.every(p => p.testUses === 1 && p.charges === 1 && p.wear === 0)).toBe(true);
  }, 180_000);
  it('rejects ability permission before buying and still permits ordinary completion without a cast', () => {
    let s = ab(promoted(), { type: 'OBSERVE', caseId: 'tray-pulse' }); s = ab(s, { type: 'CONSENT', caseId: 'tray-pulse', permission: 'OWNER' }); s = ab(s, { type: 'INVITE', caseId: 'tray-pulse' });
    s = ab(s, { type: 'WITHDRAW_CONSENT', caseId: 'tray-pulse', permission: 'ABILITY' }); rejectAbomination(s, { type: 'PREPARE', caseId: 'tray-pulse', method: 'ABILITY' });
    s = ab(s, { type: 'PREPARE', caseId: 'tray-pulse', method: 'ORDINARY' }); s = finish(reach(s, 'tray-pulse'), 'tray-pulse'); expect(attempt(s, 'tray-pulse')).toMatchObject({ castTier: null, manual: true, appliedAbilityIds: [] }); expect(s.progression.acting).toBe(25);
  }, 180_000);
  it('allows owner refusal or invitation refusal to abort before any purchase, even at0AP, without fake成果', () => {
    const initial = directedInitial2(); initial.actionsRemaining = initial.weeklyBudget = 3; let s = ab(prepareBottle(initial, dose.bottleId), dose); s = ready(s, { ap: 1 });
    while (s.actionsRemaining > 1) s = step(s, { type: 'ACTION', action: 'REST' });
    const cash = s.cash, week = s.week; s = ab(s, { type: 'OBSERVE', caseId: 'tray-pulse' }); expect(s.actionsRemaining).toBe(0); expect(s.week).toBe(week);
    s = ab(s, { type: 'WITHDRAW_CONSENT', caseId: 'tray-pulse', permission: 'OWNER' }); expect(blockAbominationLife(s, { type: 'ABORT', caseId: 'tray-pulse' })).toBeNull(); s = ab(s, { type: 'ABORT', caseId: 'tray-pulse' });
    expect(hasAbominationLifeLock(s)).toBe(false); expect(s.abomination.life.pieces).toEqual([]); expect(s.abomination.life.site.volunteer.location).toBe('OUTSIDE'); expect(s.abomination.life.volunteerEffortSpent).toBe(0);
    const abort = s.abomination.life.journal.at(-1)!; expect(abort.paid).toEqual({ actions: 0, pennies: 0, spirituality: 0, mind: 0, volunteerEffort: 0, pieceCharges: 0, testCharges: 0 }); expect(abort.after.cash).toBe(cash);
    expect(s.abomination.life.cases['tray-pulse']).toMatchObject({ status: 'CANCELLED', attempts: [], result: 'NONE' }); rejectAbomination(s, { type: 'REPORT', caseId: 'tray-pulse' }); expect(s.progression.acting).toBe(0); assertValidSliceState(s);
  }, 180_000);
  it('returns a paid unused piece at0AP before any travel, keeps its real price and spends no invented test charge', () => {
    const initial = directedInitial2(); initial.actionsRemaining = initial.weeklyBudget = 3; let s = ab(prepareBottle(initial, dose.bottleId), dose); s = ready(s, { ap: 3 });
    while (s.actionsRemaining > 2) s = step(s, { type: 'ACTION', action: 'REST' });
    s = ab(s, { type: 'OBSERVE', caseId: 'tray-pulse' }); s = ab(s, { type: 'CONSENT', caseId: 'tray-pulse', permission: 'OWNER' }); s = ab(s, { type: 'INVITE', caseId: 'tray-pulse' });
    const cash = s.cash; s = ab(s, { type: 'PREPARE', caseId: 'tray-pulse', method: 'ORDINARY' }); expect(s.actionsRemaining).toBe(0); const old = structuredClone(s.abomination.life.site);
    s = ab(s, { type: 'ABORT', caseId: 'tray-pulse' }); expect(s.abomination.life.journal.at(-1)!.after.cash).toBe(cash - 20); expect(piece(s, 'tray-pulse')).toMatchObject({ location: 'RETURNED', status: 'RETURNED', charges: 1, testCharges: 1, testUses: 0, travelMetres: 0 });
    expect(s.abomination.life.site.volunteer).toEqual(old.volunteer); expect(s.abomination.life.site.playerTravelMetres).toBe(old.playerTravelMetres); expect(s.progression.acting).toBe(0); rejectAbomination(s, { type: 'REPORT', caseId: 'tray-pulse' }); assertValidSliceState(s);
  }, 180_000);
  it('owner withdrawal stops new pulse but permits real no-cost return, with no unperformed report', () => {
    let s = castBarrier(reach(start(firstCast('BARRIER_WIN'), 'tray-pulse'), 'tray-pulse')); const before = structuredClone(s);
    s = ab(s, { type: 'WITHDRAW_CONSENT', caseId: 'tray-pulse', permission: 'OWNER' }); expect(projectSliceState(s).canAct).toBe(false); rejectAbomination(s, { type: 'PERFORM_PULSE', caseId: 'tray-pulse' });
    s = ab(s, { type: 'ABORT', caseId: 'tray-pulse' }); expect(projectSliceState(s).canAct).toBe(true); expect([s.spirituality, s.mind]).toEqual([before.spirituality, before.mind]);
    expect(s.abomination.life.site).toMatchObject({ playerLocation: 'START', volunteer: { location: 'A' } }); expect(piece(s, 'tray-pulse')).toMatchObject({ location: 'RETURNED', testCharges: 1, charges: 1 }); expect(s.abomination.life.cases['tray-pulse'].status).toBe('CANCELLED'); rejectAbomination(s, { type: 'REPORT', caseId: 'tray-pulse' });
  }, 180_000);
  it('uses actual3AP week and the existing debt/bill resolver after the last report action', () => {
    const initial = directedInitial2(); initial.actionsRemaining = initial.weeklyBudget = 3; initial.debts.push({ id: 'AB1-UNIT-EXISTING-DEBT', source: '既有分期', remaining: 10000, weeklyPayment: 7, createdWeek: initial.week - 1 });
    let s = ab(prepareBottle(initial, dose.bottleId), dose); s = reach(start(s, 'tray-pulse', 'ORDINARY'), 'tray-pulse'); expect(s.actionsRemaining).toBe(1); s = finish(s, 'tray-pulse');
    const receipt = s.abomination.life.journal.at(-1)!; expect(receipt.command.type).toBe('REPORT'); expect(receipt.after.actions).toBe(0);
    const expected = resolveSliceWeeklyFinance({ ...receipt.finance, cash: receipt.after.cash, week: receipt.week, revision: receipt.revision, pulse: 'BILL', billAmount: 0 });
    expect(expected.eventId).toBeNull(); expect(s.week).toBe(receipt.week + 1); expect(s.actionsRemaining).toBe(3); expect(s.cash).toBe(expected.state.cash); expect(s.debts).toEqual(expected.state.debts); expect(validateAbominationLifeState(s)).toBe(true); assertValidSliceState(s);
  }, 180_000);
  it('rejects malformed commands and forged identities, charges, source kinds, delay, payments, RNG and consent', () => {
    for (const command of [{ type: 'BRIEF_CRY', caseId: 'spoken-hesitation', targetId: 'NEW-BODY' }, { type: 'CONSENT', caseId: 'tray-pulse' }, { type: 'REFLECT', caseId: 'tray-pulse' }, { type: 'RECOVER_ENERGY' }]) expect(validateAbominationActivityCommand(command)).toBe(false);
    const valid = castBarrier(reach(start(firstCast('BARRIER_WIN'), 'tray-pulse'), 'tray-pulse'));
    const changes: ((s: SliceState) => void)[] = [
      s => { s.abomination.life.site.volunteer.age = 42 as 43; }, s => { s.abomination.life.site.volunteer.location = 'OUTSIDE'; }, s => { s.abomination.life.site.clothing.location = 'TRAY'; },
      s => { s.abomination.life.volunteerEffortSpent = 0; }, s => { s.abomination.life.volunteerEffortSpent = 15; }, s => { s.abomination.life.pending!.expiresAt++; }, s => { s.abomination.life.conditionVersion++; },
      s => { s.abomination.life.cases['tray-pulse'].permission.ABILITY = 'UNASKED'; }, s => { piece(s, 'tray-pulse').testCharges = 0; }, s => { piece(s, 'tray-pulse').charges = 0; },
      s => { s.abomination.life.journal.at(-1)!.paid.spirituality = 0; }, s => { s.abomination.life.journal.at(-1)!.randomAfter!++; }, s => { s.abomination.life.journal.at(-1)!.check!.roll = 1; },
      s => { s.abomination.life.journal.at(-1)!.source!.pulse = null; }, s => { s.progression.mastery[BARRIER] = 8; }, s => { s.abomination.life.operation.inputActive = true; },
    ];
    for (const change of changes) { const s = structuredClone(valid); change(s); expect(validateAbominationState(s), change.toString()).toBe(false); }
    const cry = ab(cryReady('CRY_WIN'), { type: 'BRIEF_CRY', caseId: 'spoken-hesitation' });
    for (const change of [(s: SliceState) => { s.abomination.life.cue!.delayRemainingSeconds = 0; }, (s: SliceState) => { s.abomination.life.cue!.executed = true; }, (s: SliceState) => { s.abomination.life.journal.at(-1)!.resistanceRoll = null; }]) { const s = structuredClone(cry); change(s); expect(validateAbominationState(s)).toBe(false); }
    const extra = structuredClone(valid.abomination.life.site) as unknown as Record<string, unknown>; extra.energy = 100; expect(validateAbominationCurrentSite(extra, valid.abomination.sourceScene!.originals)).toBe(false);
  }, 240_000);
  it('preferred public actions form a bounded honest chain and never recommend recovery after final reflection', () => {
    let s = firstCast('BARRIER_WIN'), count = 0;
    while (!s.abomination.life.reflected && count++ < 100) { const action = projectAbominationLife(s).actions.find(a => a.preferredAction && a.enabled); expect(action).toBeDefined(); s = ab(s, action!.command); }
    expect(count).toBeLessThan(100); expect(s.abomination.life.reflected).toBe(true); expect(s.progression.acting).toBe(100); expect(s.abomination.life.volunteerEffortSpent).toBe(9);
    expect(getAbominationCurrentSite(s)).toMatchObject({ playerLocation: 'START', volunteer: { location: 'A' }, clothing: { location: 'ELSA', worn: true }, bag: { location: 'ELSA' } }); expect(abominationLifeActions(s)).toEqual([]); expect(s.abomination.life.journal.at(-1)!.command.type).toBe('REFLECT');
  }, 240_000);
});
