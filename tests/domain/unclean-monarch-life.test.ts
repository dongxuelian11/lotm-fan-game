import { describe, expect, it } from 'vitest';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { validateUncleanMonarchState } from '../../src/domain/unclean-monarch/index.js';
import { blockUncleanMonarchLife, uncleanMonarchLifeActions, uncleanMonarchLifeClosed, uncleanMonarchLifeMasteryGains, getUncleanMonarchCurrentSite, hasUncleanMonarchLifeLock,
  projectUncleanMonarchLife, validateUncleanMonarchActivityCommand, validateUncleanMonarchCurrentSite, validateUncleanMonarchLifeState, type UncleanMonarchCaseId } from '../../src/domain/unclean-monarch/life.js';
import { UNCLEAN_MONARCH_ABILITY_IDS } from '../../src/domain/unclean-monarch/types.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { um, directedInitial2, dose, oldAbyssRoots, originalBloodDuke, prepareBottle, promoted, ready, rejectUncleanMonarch, step } from './unclean-monarch-directed-helper.js';
const [BINDING, INTERFERENCE] = UNCLEAN_MONARCH_ABILITY_IDS;
const attempt = (s: SliceState, id: UncleanMonarchCaseId) => s.uncleanMonarch.life.cases[id].attempts[0]!;
const piece = (s: SliceState, id: UncleanMonarchCaseId) => s.uncleanMonarch.life.pieces.find(n => n.caseId === id)!;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const cache = new Map<string, SliceState>();
/** UNIT-only original-seed selection before a new-stage journal. The historical
 * 718 prefix and natural producer never use this selector or refill resources. */
function firstCast(wins: boolean, followingCheckFails = false): SliceState {
  const key = `${wins}:${followingCheckFails}`;
  if (!cache.has(key)) {
    const initial = directedInitial2(), promotionChance = computeCheckChance({ baseAbility: initial.character.coreStats.will, difficulty: 30, modifiers: [] }),
      chance = computeCheckChance({ baseAbility: initial.character.coreStats.will + 1, difficulty: 18, modifiers: [] });
    let chosen: number | null = null;
    for (let cursor = initial.random.cursor; cursor < initial.random.cursor + 2048; cursor++) {
      const rng = new DeterministicActionRandomStream(initial.random.seed, cursor), promotion = rng.nextInt(1, 100), cast = rng.nextInt(1, 100), check = rng.nextInt(1, 100);
      if (promotion > 5 && promotion <= promotionChance && ((cast <= chance) === wins) && (!followingCheckFails || check >= 96)) { chosen = cursor; break; }
    }
    expect(chosen).not.toBeNull(); initial.random.cursor = chosen!;
    const s = um(prepareBottle(initial, dose.bottleId), dose); expect(s.progression.sequence).toBe(1); cache.set(key, s);
  }
  return structuredClone(cache.get(key)!);
}
function start(s: SliceState, id: UncleanMonarchCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = ready(s, { ap: 3, cash: 100, mind: 4, spirituality: 8 });
  s = um(s, { type: 'OBSERVE', caseId: id }); s = um(s, { type: 'CONSENT', caseId: id, permission: 'OWNER' });
  if (method === 'ABILITY') s = um(s, { type: 'CONSENT', caseId: id, permission: 'ABILITY' });
  return um(s, { type: 'PREPARE', caseId: id, method });
}
function reach(s: SliceState, id: UncleanMonarchCaseId): SliceState {
  for (const type of ['WALK_TO_A', 'TAKE_CARD', 'WALK_TO_B', 'READ_ORIGINAL'] as const) s = um(s, { type, caseId: id }); return s;
}
function castBinding(s: SliceState, id: 'measured-reading' | 'withdrawn-input' = 'measured-reading'): SliceState {
  s = um(s, { type: 'NOTICE_IMPULSE', caseId: id }); return um(s, { type: 'IMPULSE_BINDING', caseId: id });
}
function finish(s: SliceState, id: UncleanMonarchCaseId): SliceState {
  if (!attempt(s, id).verified) s = um(s, { type: 'MANUAL_OPERATION', caseId: id });
  for (const type of ['RETURN_TO_A', 'RETURN_CARD', 'RETURN_TO_ENTRY', 'RETURN_PIECE', 'LEAVE'] as const) s = um(s, { type, caseId: id });
  return um(ready(s), { type: 'REPORT', caseId: id });
}
function ordinary(s: SliceState, id: UncleanMonarchCaseId): SliceState {
  s = reach(start(s, id, 'ORDINARY'), id); s = um(s, { type: 'MANUAL_OPERATION', caseId: id }); return finish(s, id);
}

// Each test exercises complete real command sequences. Finite per-test budgets
// account for exact eight-root validation and receipt replay, never global skips.
describe('Unclean Monarch finite original-room life and exact replay', () => {
  it('projects current718 originals and clones the same room and operation once, without an old energy balance', () => {
    const original = originalBloodDuke(), s = promoted(), roots = oldAbyssRoots(s);
    expect(projectUncleanMonarchLife(original).site).toEqual(original.blatherer.life);
    expect(projectUncleanMonarchLife(original).operation).toEqual(original.bloodDuke.life.operation);
    expect(s.uncleanMonarch.life.site).toEqual(original.blatherer.life); expect(s.uncleanMonarch.life.site).not.toBe(s.blatherer.life);
    expect(s.uncleanMonarch.life.operation).toEqual(original.bloodDuke.life.operation); expect(s.uncleanMonarch.life.volunteerEffortSpent).toBe(0);
    expect(s.uncleanMonarch.life.site.volunteer).toEqual({ id: 'BL3-NORA', name: '诺拉·温特', age: 46, alive: true, willing: true, location: 'A' });
    expect(s.uncleanMonarch.life.site.guide).toEqual(original.blatherer.life.guide);
    for (const body of [s.blatherer.life.volunteer, s.uncleanMonarch.life.site.volunteer]) expect(Object.keys(body).some(key => /energy|effort/i.test(key))).toBe(false);
    expect(oldAbyssRoots(s)).toEqual(roots); expect(validateUncleanMonarchLifeState(s)).toBe(true);
  }, 120_000);
  it('requires actual original-card pickup and walks, purchases one case piece, and charges effort only on real collaboration', () => {
    let s = promoted(); const original = structuredClone(s); s = start(s, 'measured-reading');
    expect(s.uncleanMonarch.life.volunteerEffortSpent).toBe(0); expect(s.uncleanMonarch.life.site.volunteer).toEqual(original.uncleanMonarch.life.site.volunteer);
    expect(piece(s, 'measured-reading')).toMatchObject({ id: 'UM1-PIECE-1', kind: 'impulse-piece', charges: 1, wear: 0, paidPennies: 20 });
    rejectUncleanMonarch(s, { type: 'TAKE_CARD', caseId: 'measured-reading' }); rejectUncleanMonarch(s, { type: 'IMPULSE_BINDING', caseId: 'measured-reading' });
    s = reach(s, 'measured-reading'); expect(s.uncleanMonarch.life.site).toMatchObject({ playerLocation: 'B', playerTravelMetres: 104, card: { location: 'PLAYER', travelMetres: 44 } });
    expect(piece(s, 'measured-reading').travelMetres).toBe(8); expect(s.uncleanMonarch.life.volunteerEffortSpent).toBe(3); expect(attempt(s, 'measured-reading').volunteerEffortSpent).toBe(3);
    expect(s.uncleanMonarch.life.journal.find(e => e.command.type === 'PREPARE')!.paid).toMatchObject({ actions: 1, pennies: 20, volunteerEffort: 0 });
    expect(s.uncleanMonarch.life.journal.find(e => e.command.type === 'READ_ORIGINAL')!.paid.volunteerEffort).toBe(3);
    rejectUncleanMonarch(s, { type: 'READ_ORIGINAL', caseId: 'measured-reading' }); rejectUncleanMonarch(s, { type: 'PREPARE', caseId: 'measured-reading', method: 'ABILITY' });
  }, 120_000);
  it('pays8S2M, binds a real own impulse and consumes one charge only on the next actual knowledge20 check', () => {
    let s = reach(start(firstCast(true), 'measured-reading'), 'measured-reading'); const before = structuredClone(s), roots = oldAbyssRoots(s);
    rejectUncleanMonarch(s, { type: 'IMPULSE_BINDING', caseId: 'measured-reading' });
    s = castBinding(s); expect(success(attempt(s, 'measured-reading').castTier)).toBe(true);
    expect([s.spirituality, s.mind, s.random.cursor]).toEqual([before.spirituality - 8, before.mind - 2, before.random.cursor + 1]);
    expect(s.uncleanMonarch.life.pending).toMatchObject({ sourceId: 'PLAYER', targetId: 'PLAYER', cardId: 'BL3-CARD', location: 'B', expiresAt: s.uncleanMonarch.life.site.clockSeconds + 20 });
    expect(piece(s, 'measured-reading').charges).toBe(1); expect(s.progression.mastery[BINDING]).toBe(0);
    rejectUncleanMonarch(s, { type: 'IMPULSE_BINDING', caseId: 'measured-reading' });
    const checkBefore = structuredClone(s); s = um(s, { type: 'CHECK_ORIGINAL', caseId: 'measured-reading' });
    const expected = resolveNormalCheck({ ability: 'knowledge', baseAbility: Math.min(500, s.character.coreStats.knowledge + 35), difficulty: 20, modifiers: [], roll: new DeterministicActionRandomStream(checkBefore.random.seed, checkBefore.random.cursor).nextInt(1, 100) });
    expect(s.lastCheck).toEqual(expected); expect(s.random.cursor).toBe(checkBefore.random.cursor + 1);
    expect(attempt(s, 'measured-reading')).toMatchObject({ checkBonus: 35, checkBase: expected.baseAbility, appliedAbilityIds: [BINDING], windowEnd: 'APPLIED' });
    expect(piece(s, 'measured-reading')).toMatchObject({ charges: 0, wear: 1 }); expect(s.progression.mastery[BINDING]).toBe(0);
    rejectUncleanMonarch(s, { type: 'CHECK_ORIGINAL', caseId: 'measured-reading' }); rejectUncleanMonarch(s, { type: 'REPORT', caseId: 'measured-reading' });
    s = finish(s, 'measured-reading'); expect(s.progression.mastery[BINDING]).toBe(8);
    expect(s.uncleanMonarch.life.site).toMatchObject({ playerLocation: 'START', playerTravelMetres: 112, volunteer: { location: 'A' }, card: { location: 'NORA', travelMetres: 48 } });
    expect(piece(s, 'measured-reading')).toMatchObject({ status: 'RETURNED', location: 'OWNER', travelMetres: 16 });
    expect(s.uncleanMonarch.encounter.strain).toBe(3); expect(oldAbyssRoots(s)).toEqual(roots); assertValidSliceState(s);
  }, 180_000);
  it('a boosted next check can still genuinely fail; ordinary completion retains the actual application before reporting', () => {
    let s = castBinding(reach(start(firstCast(true, true), 'measured-reading'), 'measured-reading'));
    s = um(s, { type: 'CHECK_ORIGINAL', caseId: 'measured-reading' });
    expect(attempt(s, 'measured-reading')).toMatchObject({ checkTier: 'GREAT_FAILURE', checkBonus: 35, verified: false, appliedAbilityIds: [BINDING] });
    expect(s.progression.mastery[BINDING]).toBe(0); s = finish(s, 'measured-reading');
    expect(attempt(s, 'measured-reading').manual).toBe(true); expect(s.progression.mastery[BINDING]).toBe(8);
  }, 180_000);
  it('failed cast always spends8S4M, then ordinary work can report without a new mastery or charge loss', () => {
    let s = reach(start(firstCast(false), 'measured-reading'), 'measured-reading'); const before = structuredClone(s);
    s = castBinding(s); expect(success(attempt(s, 'measured-reading').castTier)).toBe(false);
    expect([s.spirituality, s.mind, s.random.cursor]).toEqual([before.spirituality - 8, before.mind - 4, before.random.cursor + 1]);
    expect(s.uncleanMonarch.life.pending).toBeNull(); s = finish(s, 'measured-reading');
    expect(s.progression.mastery[BINDING]).toBe(0); expect(piece(s, 'measured-reading')).toMatchObject({ charges: 1, wear: 0 }); expect(s.progression.acting).toBe(25);
  }, 120_000);
  it('movement, stop,20 real seconds, physical遮挡 and withdrawal clear paid unused windows without refund or recast', () => {
    for (const kind of ['MOVE', 'STOP', 'EXPIRY', 'OCCLUDE', 'WITHDRAW'] as const) {
      let s = castBinding(reach(start(firstCast(true), 'measured-reading'), 'measured-reading'));
      const spirit = s.spirituality, mind = s.mind, clock = s.uncleanMonarch.life.site.clockSeconds;
      if (kind === 'EXPIRY') { s = um(s, { type: 'WAIT_10', caseId: 'measured-reading' }); s = um(s, { type: 'WAIT_10', caseId: 'measured-reading' }); expect(s.uncleanMonarch.life.site.clockSeconds).toBe(clock + 20); }
      else if (kind === 'WITHDRAW') s = um(s, { type: 'WITHDRAW_CONSENT', caseId: 'measured-reading', permission: 'ABILITY' });
      else s = um(s, { type: kind === 'MOVE' ? 'RETURN_TO_A' : kind === 'STOP' ? 'STOP_METHOD' : 'OCCLUDE', caseId: 'measured-reading' });
      expect(s.uncleanMonarch.life.pending).toBeNull(); expect([s.spirituality, s.mind]).toEqual([spirit, mind]); expect(piece(s, 'measured-reading').charges).toBe(1);
      rejectUncleanMonarch(s, { type: 'IMPULSE_BINDING', caseId: 'measured-reading' });
      if (kind === 'MOVE') { s = um(s, { type: 'ABORT', caseId: 'measured-reading' }); expect(s.uncleanMonarch.life.cases['measured-reading'].status).toBe('CANCELLED'); rejectUncleanMonarch(s, { type: 'REPORT', caseId: 'measured-reading' }); }
      else { if (kind === 'OCCLUDE') s = um(s, { type: 'RESTORE_VIEW', caseId: 'measured-reading' }); s = finish(s, 'measured-reading'); }
      expect(s.progression.mastery[BINDING]).toBe(0); expect(hasUncleanMonarchLifeLock(s)).toBe(false); assertValidSliceState(s);
    }
  }, 240_000);
  it('requires actual voluntary rehearsal and confirmed strong emotion, then reduces precisely one current45pressure event to15', () => {
    let s = ordinary(firstCast(true), 'measured-reading'); s = reach(start(s, 'observed-tension'), 'observed-tension'); const before = structuredClone(s);
    rejectUncleanMonarch(s, { type: 'FOCUSED_INTERFERENCE', caseId: 'observed-tension' }); rejectUncleanMonarch(s, { type: 'CONFIRM_EMOTION', caseId: 'observed-tension' });
    s = um(s, { type: 'REHEARSE_BELL', caseId: 'observed-tension' });
    expect(s.uncleanMonarch.life.operation.bellRehearsals).toBe(before.uncleanMonarch.life.operation.bellRehearsals + 1);
    expect(s.uncleanMonarch.life.emotion).toMatchObject({ subjectId: 'BL3-NORA', triggerId: 'BL3-BELL', kind: 'STRONG_TENSION', confirmedAt: null });
    expect(s.uncleanMonarch.life.volunteerEffortSpent).toBe(6);
    rejectUncleanMonarch(s, { type: 'FOCUSED_INTERFERENCE', caseId: 'observed-tension' });
    s = um(s, { type: 'CONFIRM_EMOTION', caseId: 'observed-tension' }); s = um(s, { type: 'FOCUSED_INTERFERENCE', caseId: 'observed-tension' });
    expect(success(attempt(s, 'observed-tension').castTier)).toBe(true); const version = s.uncleanMonarch.life.conditionVersion;
    s = um(s, { type: 'PERFORM_OPERATION', caseId: 'observed-tension' });
    expect(attempt(s, 'observed-tension')).toMatchObject({ baselinePressure: 45, feltPressure: 15, appliedAbilityIds: [INTERFERENCE], verified: true });
    expect(s.uncleanMonarch.life.conditionVersion).toBe(version + 1); expect(s.uncleanMonarch.life.pulse?.resolved).toBe(true); expect(s.uncleanMonarch.life.emotion).toBeNull();
    expect(s.uncleanMonarch.life.site.volunteer).toEqual(before.uncleanMonarch.life.site.volunteer); expect(s.health).toBe(before.health);
    rejectUncleanMonarch(s, { type: 'PERFORM_OPERATION', caseId: 'observed-tension' }); rejectUncleanMonarch(s, { type: 'REHEARSE_BELL', caseId: 'observed-tension' });
    s = finish(s, 'observed-tension'); expect(s.progression.mastery[INTERFERENCE]).toBe(8); expect(s.uncleanMonarch.life.operation).toEqual({ ...before.uncleanMonarch.life.operation, bellRehearsals: before.uncleanMonarch.life.operation.bellRehearsals + 1 });
  }, 180_000);
  it('third case casts then actually withdraws before applying, and uses ordinary completion with no mastery or refund', () => {
    let s = ordinary(ordinary(firstCast(true), 'measured-reading'), 'observed-tension'); s = reach(start(s, 'withdrawn-input'), 'withdrawn-input'); s = castBinding(s, 'withdrawn-input');
    const paid = structuredClone(s); expect(success(attempt(s, 'withdrawn-input').castTier)).toBe(true);
    expect(projectUncleanMonarchLife(s).actions.find(a => a.preferredAction)?.command).toEqual({ type: 'WITHDRAW_CONSENT', caseId: 'withdrawn-input', permission: 'ABILITY' });
    rejectUncleanMonarch(s, { type: 'CHECK_ORIGINAL', caseId: 'withdrawn-input' });
    s = um(s, { type: 'WITHDRAW_CONSENT', caseId: 'withdrawn-input', permission: 'ABILITY' });
    expect(s.uncleanMonarch.life.pending).toBeNull(); expect([s.spirituality, s.mind]).toEqual([paid.spirituality, paid.mind]);
    expect(attempt(s, 'withdrawn-input')).toMatchObject({ withdrawn: true, stopped: true, appliedAbilityIds: [] });
    expect(s.uncleanMonarch.life.cases['withdrawn-input'].permission.OWNER).toBe('GRANTED'); expect(s.uncleanMonarch.life.site.volunteer.willing).toBe(true);
    rejectUncleanMonarch(s, { type: 'CONSENT', caseId: 'withdrawn-input', permission: 'ABILITY' });
    s = um(s, { type: 'CHECK_ORIGINAL', caseId: 'withdrawn-input' }); expect(attempt(s, 'withdrawn-input').checkBonus).toBe(0); s = finish(s, 'withdrawn-input'); s = um(ready(s), { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(uncleanMonarchLifeMasteryGains(s)).toEqual({ [BINDING]: 0, [INTERFERENCE]: 0 });
    expect(s.uncleanMonarch.life.volunteerEffortSpent).toBe(9); expect(s.uncleanMonarch.life.site.playerTravelMetres).toBe(144); expect(s.uncleanMonarch.life.site.card.travelMetres).toBe(64);
    expect(s.uncleanMonarch.life.pieces).toHaveLength(3); expect(s.uncleanMonarch.life.pieces.every(n => n.status === 'RETURNED' && n.charges === 1)).toBe(true);
    expect(uncleanMonarchLifeClosed(s)).toBe(true); expect(hasUncleanMonarchLifeLock(s)).toBe(false); expect(uncleanMonarchLifeActions(s)).toEqual([]); expect(projectUncleanMonarchLife(s).preferredActionId).toBeNull();
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]); assertValidSliceState(s);
  }, 180_000);
  it('ordinary three-case completion preserves old strain, conscience and bodies and never needs ability consent', () => {
    const original = promoted(); let s = original;
    for (const id of ['measured-reading', 'observed-tension', 'withdrawn-input'] as const) s = ordinary(s, id);
    s = um(ready(s), { type: 'REFLECT' }); expect(s.uncleanMonarch.life.site.volunteer).toEqual(original.uncleanMonarch.life.site.volunteer);
    expect(s.uncleanMonarch.life.site.guide).toEqual(original.uncleanMonarch.life.site.guide); expect(s.uncleanMonarch.life.operation).toEqual(original.uncleanMonarch.life.operation);
    expect(s.uncleanMonarch.encounter.strain).toBe(3); expect(oldAbyssRoots(s)).toEqual(oldAbyssRoots(original)); expect(uncleanMonarchLifeMasteryGains(s)).toEqual({ [BINDING]: 0, [INTERFERENCE]: 0 });
    expect(s.uncleanMonarch.life.journal.filter(e => e.command.type === 'CONSENT').every(e => e.command.type === 'CONSENT' && e.command.permission === 'OWNER')).toBe(true);
  }, 180_000);
  it('allows rejecting ability permission before purchase and completes by ordinary method without any cast', () => {
    let s = um(promoted(), { type: 'OBSERVE', caseId: 'measured-reading' }); s = um(s, { type: 'CONSENT', caseId: 'measured-reading', permission: 'OWNER' });
    s = um(s, { type: 'WITHDRAW_CONSENT', caseId: 'measured-reading', permission: 'ABILITY' });
    rejectUncleanMonarch(s, { type: 'PREPARE', caseId: 'measured-reading', method: 'ABILITY' });
    s = um(s, { type: 'PREPARE', caseId: 'measured-reading', method: 'ORDINARY' }); s = finish(reach(s, 'measured-reading'), 'measured-reading');
    expect(attempt(s, 'measured-reading')).toMatchObject({ castTier: null, manual: true, appliedAbilityIds: [] }); expect(s.progression.acting).toBe(25);
  }, 120_000);
  it('OWNER withdrawal ends new contact but allows genuine no-cost return; an unfinished task earns no report', () => {
    let s = castBinding(reach(start(firstCast(true), 'measured-reading'), 'measured-reading')); const before = structuredClone(s);
    s = um(s, { type: 'WITHDRAW_CONSENT', caseId: 'measured-reading', permission: 'OWNER' });
    expect(projectSliceState(s).canAct).toBe(false); rejectUncleanMonarch(s, { type: 'MANUAL_OPERATION', caseId: 'measured-reading' }); expect(s.uncleanMonarch.life.pending).toBeNull();
    s = um(s, { type: 'ABORT', caseId: 'measured-reading' }); expect(projectSliceState(s).canAct).toBe(true);
    expect([s.spirituality, s.mind]).toEqual([before.spirituality, before.mind]); expect(s.uncleanMonarch.life.site).toMatchObject({ playerLocation: 'START', volunteer: { location: 'A' }, card: { location: 'NORA', travelMetres: 48 } });
    expect(s.uncleanMonarch.life.cases['measured-reading'].status).toBe('CANCELLED'); rejectUncleanMonarch(s, { type: 'REPORT', caseId: 'measured-reading' }); expect(s.progression.mastery[BINDING]).toBe(0);
  }, 120_000);
  it('can exit immediately after OBSERVE at AP0 before any purchase, effort, permission or completed work', () => {
    const initial = directedInitial2(); initial.weeklyBudget = 3; initial.actionsRemaining = 3;
    let s = um(prepareBottle(initial, dose.bottleId), dose); s = ready(s, { ap: 1 });
    while (s.actionsRemaining > 1) s = step(s, { type: 'ACTION', action: 'REST' });
    const cash = s.cash, week = s.week; s = um(s, { type: 'OBSERVE', caseId: 'measured-reading' });
    expect(s.actionsRemaining).toBe(0); expect(s.week).toBe(week); expect(hasUncleanMonarchLifeLock(s)).toBe(true);
    expect(blockUncleanMonarchLife(s, { type: 'ABORT', caseId: 'measured-reading' })).toBeNull();
    s = um(s, { type: 'ABORT', caseId: 'measured-reading' });
    expect(hasUncleanMonarchLifeLock(s)).toBe(false); expect(s.uncleanMonarch.life.pieces).toEqual([]); expect(s.uncleanMonarch.life.volunteerEffortSpent).toBe(0);
    const abort = s.uncleanMonarch.life.journal.at(-1)!; expect(abort.paid).toEqual({ actions: 0, pennies: 0, spirituality: 0, mind: 0, volunteerEffort: 0, pieceCharges: 0 }); expect(abort.after.cash).toBe(cash);
    expect(s.uncleanMonarch.life.cases['measured-reading']).toMatchObject({ status: 'CANCELLED', attempts: [], result: 'NONE' });
    rejectUncleanMonarch(s, { type: 'REPORT', caseId: 'measured-reading' }); expect(s.progression.acting).toBe(0); assertValidSliceState(s);
  }, 180_000);
  it('uses the actual3AP week and existing bill/debt resolver after reporting, with no finance resets', () => {
    const initial = directedInitial2(); initial.weeklyBudget = 3; initial.actionsRemaining = 3;
    initial.debts.push({ id: 'UM1-UNIT-EXISTING-DEBT', source: '既有分期', remaining: 10000, weeklyPayment: 7, createdWeek: initial.week - 1 });
    let s = um(prepareBottle(initial, dose.bottleId), dose); s = reach(start(s, 'measured-reading', 'ORDINARY'), 'measured-reading');
    expect(s.actionsRemaining).toBe(1); s = finish(s, 'measured-reading');
    const receipt = s.uncleanMonarch.life.journal.at(-1)!; expect(receipt.command.type).toBe('REPORT'); expect(receipt.after.actions).toBe(0);
    const expected = resolveSliceWeeklyFinance({ ...receipt.finance, cash: receipt.after.cash, week: receipt.week, revision: receipt.revision, pulse: 'BILL', billAmount: 0 });
    expect(expected.eventId).toBeNull(); expect(s.week).toBe(receipt.week + 1); expect(s.actionsRemaining).toBe(3); expect(s.cash).toBe(expected.state.cash); expect(s.debts).toEqual(expected.state.debts);
    expect(validateUncleanMonarchLifeState(s)).toBe(true); assertValidSliceState(s);
  }, 180_000);
  it('rejects malformed commands and forged finite identities, effort, payments, RNG, consent, windows, conditions and mastery', () => {
    for (const command of [{ type: 'IMPULSE_BINDING', caseId: 'measured-reading', spiritId: 'NEW-SOUL' }, { type: 'CONSENT', caseId: 'measured-reading' }, { type: 'REFLECT', caseId: 'measured-reading' }, { type: 'RECOVER_ENERGY' }]) expect(validateUncleanMonarchActivityCommand(command)).toBe(false);
    const valid = castBinding(reach(start(firstCast(true), 'measured-reading'), 'measured-reading'));
    const changes: ((s: SliceState) => void)[] = [
      s => { s.uncleanMonarch.life.site.volunteer.age = 45 as 46; }, s => { s.uncleanMonarch.life.site.card.travelMetres--; },
      s => { s.uncleanMonarch.life.site.guide.travelMetres++; }, s => { s.uncleanMonarch.life.volunteerEffortSpent = 0; },
      s => { s.uncleanMonarch.life.volunteerEffortSpent = 15; }, s => { s.uncleanMonarch.life.pending!.expiresAt++; },
      s => { s.uncleanMonarch.life.pending!.targetId = 'BL3-NORA'; }, s => { s.uncleanMonarch.life.pending!.conditionVersion++; },
      s => { s.uncleanMonarch.life.conditionVersion++; }, s => { s.uncleanMonarch.life.cases['measured-reading'].permission.ABILITY = 'UNASKED'; },
      s => { s.uncleanMonarch.life.cases['measured-reading'].permissionWeek.OWNER = s.week - 1; }, s => { piece(s, 'measured-reading').charges = 0; },
      s => { s.uncleanMonarch.life.journal.at(-1)!.paid.spirituality = 0; }, s => { s.uncleanMonarch.life.journal.at(-1)!.randomAfter!++; },
      s => { s.uncleanMonarch.life.journal.at(-1)!.check!.roll = 1; }, s => { s.uncleanMonarch.life.journal.at(-1)!.source!.impulse = null; },
      s => { s.progression.mastery[BINDING] = 8; }, s => { s.uncleanMonarch.life.operation.bellRehearsals = 0; },
    ];
    for (const change of changes) { const s = structuredClone(valid); change(s); expect(validateUncleanMonarchState(s), change.toString()).toBe(false); }
    const extra = structuredClone(valid.uncleanMonarch.life.site) as unknown as Record<string, unknown>; extra.energy = 100;
    expect(validateUncleanMonarchCurrentSite(extra, valid.uncleanMonarch.sourceScene!.originals)).toBe(false);
  }, 180_000);
  it('preferred actions follow a finite truthful chain and leave no unnecessary paid recovery after all reports', () => {
    let s = firstCast(true); let count = 0;
    while (!s.uncleanMonarch.life.reflected && count++ < 100) {
      const action = projectUncleanMonarchLife(s).actions.find(a => a.preferredAction && a.enabled); expect(action).toBeDefined(); s = um(s, action!.command);
    }
    expect(count).toBeLessThan(100); expect(s.uncleanMonarch.life.reflected).toBe(true); expect(s.progression.acting).toBe(100);
    expect(s.uncleanMonarch.life.volunteerEffortSpent).toBe(9); expect(getUncleanMonarchCurrentSite(s)).toMatchObject({ playerLocation: 'START', card: { location: 'NORA' } });
    expect(uncleanMonarchLifeActions(s)).toEqual([]); expect(s.uncleanMonarch.life.journal.at(-1)!.command.type).toBe('REFLECT');
  }, 240_000);
});
