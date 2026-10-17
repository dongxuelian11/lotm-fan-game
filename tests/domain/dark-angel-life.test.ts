import { describe, expect, it } from 'vitest';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { validateDarkAngelState } from '../../src/domain/dark-angel/index.js';
import { blockDarkAngelLife, darkAngelLifeActions, darkAngelLifeClosed, darkAngelLifeMasteryGains, getDarkAngelCurrentSite, hasDarkAngelLifeLock,
  projectDarkAngelLife, validateDarkAngelActivityCommand, validateDarkAngelCurrentSite, validateDarkAngelLifeState, type DarkAngelCaseId } from '../../src/domain/dark-angel/life.js';
import { DARK_ANGEL_ABILITY_IDS } from '../../src/domain/dark-angel/types.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { da, directedInitial2, dose, oldHangedManRoots, originalElder, prepareBottle, promoted, ready, rejectDarkAngel } from './dark-angel-directed-helper.js';
const [GUIDANCE, SHELTER] = DARK_ANGEL_ABILITY_IDS;
const attempt = (s: SliceState, id: DarkAngelCaseId) => s.darkAngel.life.cases[id].attempts[0]!;
const strip = (s: SliceState, id: DarkAngelCaseId) => s.darkAngel.life.strips.find(n => n.caseId === id)!;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const cache = new Map<boolean, SliceState>();
/** Directed UNIT inputs selected before any new-stage evidence; natural615
 * producer keeps its original RNG, complete old roots, and finite budgets. */
function firstCast(wins: boolean): SliceState {
  if (!cache.has(wins)) {
    const initial = directedInitial2(), promotionChance = computeCheckChance({ baseAbility: initial.character.coreStats.will, difficulty: 30, modifiers: [] }),
      chance = computeCheckChance({ baseAbility: initial.character.coreStats.knowledge + 1, difficulty: 18, modifiers: [] });
    let chosen: number | null = null;
    for (let cursor = initial.random.cursor; cursor < initial.random.cursor + 512; cursor++) {
      const rng = new DeterministicActionRandomStream(initial.random.seed, cursor), promotion = rng.nextInt(1, 100), cast = rng.nextInt(1, 100);
      if (promotion > 5 && promotion <= promotionChance && ((cast <= chance) === wins)) { chosen = cursor; break; }
    }
    expect(chosen).not.toBeNull(); initial.random.cursor = chosen!;
    const s = da(prepareBottle(initial, dose.bottleId), dose); expect(s.progression.sequence).toBe(1); cache.set(wins, s);
  }
  return structuredClone(cache.get(wins)!);
}
function start(s: SliceState, id: DarkAngelCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = ready(s, { ap: 3, cash: 100, mind: 10, spirituality: 20 });
  s = da(s, { type: 'OBSERVE', caseId: id }); s = da(s, { type: 'CONSENT', caseId: id, permission: 'OWNER' });
  if (method === 'ABILITY') s = da(s, { type: 'CONSENT', caseId: id, permission: 'ABILITY' });
  return da(s, { type: 'PREPARE', caseId: id, method });
}
function reach(s: SliceState, id: DarkAngelCaseId): SliceState {
  for (const type of ['WALK_TO_A', 'TAKE_CARD', 'WALK_TO_B'] as const) s = da(s, { type, caseId: id }); return s;
}
function finish(s: SliceState, id: DarkAngelCaseId): SliceState {
  for (const type of ['RETURN_TO_A', 'RETURN_CARD', 'RETURN_TO_ENTRY', 'RETURN_STRIP', 'LEAVE'] as const) s = da(s, { type, caseId: id });
  return da(ready(s), { type: 'REPORT', caseId: id });
}
function ordinary(s: SliceState, id: DarkAngelCaseId): SliceState {
  s = reach(start(s, id, 'ORDINARY'), id); s = da(s, { type: 'READ_ORIGINAL', caseId: id });
  if (id === 'guarded-pulse') s = da(s, { type: 'PERFORM_OPERATION', caseId: id }); return finish(s, id);
}

describe('Dark Angel finite original-court life and exact replay', () => {
  it('projects the actual615 court before promotion and clones its two spirits and spent old supplies exactly once', () => {
    const original = originalElder(), s = promoted(), roots = oldHangedManRoots(s);
    expect(projectDarkAngelLife(original).site).toEqual(original.threeHeadedTemplar.life);
    expect(projectDarkAngelLife(original).operation).toEqual(original.elder.life.operation);
    expect(s.darkAngel.life.site).toEqual(original.threeHeadedTemplar.life); expect(s.darkAngel.life.site).not.toBe(s.threeHeadedTemplar.life);
    expect(s.darkAngel.life.operation).toEqual(original.elder.life.operation); expect(s.darkAngel.life.ownerTravelMetres).toBe(0);
    expect(s.darkAngel.life.site.spirits['THT3-HELENA']).toMatchObject({ spirituality: 18, integrity: 60, interrupted: true, location: 'INTERNAL' });
    expect(s.darkAngel.life.site.spirits['THT3-ROLAND']).toMatchObject({ spirituality: 21, integrity: 100, location: 'INTERNAL' });
    expect(oldHangedManRoots(s)).toEqual(roots); expect(validateDarkAngelLifeState(s)).toBe(true); expect('playerEnergy' in s.darkAngel.life.site).toBe(false);
  }, 120_000);
  it('buys one distinct strip, requires actual card pickup and walks, and records Mara actual arrival', () => {
    let s = promoted(); const before = structuredClone(s); s = start(s, 'guided-reading');
    expect(s.darkAngel.life.site.owner.location).toBe('START'); expect(s.darkAngel.life.ownerTravelMetres).toBe(2);
    expect(s.darkAngel.life.journal.find(e => e.command.type === 'CONSENT' && e.command.permission === 'OWNER')!.moves).toEqual([
      { actorId: 'THT3-MARA', from: 'OUTSIDE', to: 'START', metres: 2, seconds: 2, itemIds: [] },
    ]);
    expect(strip(s, 'guided-reading')).toMatchObject({ id: 'DA1-SEAL-STRIP-1', charges: 1, wear: 0, paidPennies: 20 });
    rejectDarkAngel(s, { type: 'TAKE_CARD', caseId: 'guided-reading' }); rejectDarkAngel(s, { type: 'GUIDANCE', caseId: 'guided-reading', spiritId: 'THT3-HELENA' });
    s = reach(s, 'guided-reading'); expect(s.darkAngel.life.site).toMatchObject({ playerLocation: 'B', playerTravelMetres: 96, card: { location: 'PLAYER', travelMetres: 44 } });
    expect(strip(s, 'guided-reading').travelMetres).toBe(8); expect(s.darkAngel.life.operation.materials).toEqual(before.elder.life.operation.materials);
    expect(s.darkAngel.life.journal.find(e => e.command.type === 'PREPARE')!.paid).toMatchObject({ actions: 1, pennies: 20 });
    rejectDarkAngel(s, { type: 'PREPARE', caseId: 'guided-reading', method: 'ABILITY' });
  }, 120_000);
  it('pays original3S and owner8S2M, preserves old interrupted history, and awards8 only after actual guided read and report', () => {
    let s = reach(start(firstCast(true), 'guided-reading'), 'guided-reading'); const before = structuredClone(s), roots = oldHangedManRoots(s);
    s = da(s, { type: 'GUIDANCE', caseId: 'guided-reading', spiritId: 'THT3-HELENA' });
    expect(success(attempt(s, 'guided-reading').castTier)).toBe(true);
    expect([s.spirituality, s.mind, s.random.cursor]).toEqual([before.spirituality - 8, before.mind - 2, before.random.cursor + 1]);
    expect(s.darkAngel.life.site.spirits['THT3-HELENA']).toMatchObject({ spirituality: 15, integrity: 60, interrupted: true, location: 'INTERNAL' });
    expect(s.darkAngel.life.site.spirits['THT3-HELENA'].history).toEqual(before.darkAngel.life.site.spirits['THT3-HELENA'].history);
    expect(s.darkAngel.life.pending).toMatchObject({ spiritId: 'THT3-HELENA', selectedMethod: 'SIGNAL', cardId: 'THT3-CARD', location: 'B', expiresAt: s.darkAngel.life.site.clockSeconds + 20 });
    expect(strip(s, 'guided-reading').charges).toBe(1); expect(s.progression.mastery[GUIDANCE]).toBe(0);
    rejectDarkAngel(s, { type: 'GUIDANCE', caseId: 'guided-reading', spiritId: 'THT3-ROLAND' });
    s = da(s, { type: 'READ_ORIGINAL', caseId: 'guided-reading' }); expect(attempt(s, 'guided-reading')).toMatchObject({ readingQuality: 6, appliedAbilityIds: [GUIDANCE], windowEnd: 'APPLIED' });
    expect(strip(s, 'guided-reading')).toMatchObject({ charges: 0, wear: 1 }); expect(s.progression.mastery[GUIDANCE]).toBe(0);
    rejectDarkAngel(s, { type: 'REPORT', caseId: 'guided-reading' }); s = finish(s, 'guided-reading');
    expect(s.progression.mastery[GUIDANCE]).toBe(8); expect(s.darkAngel.life.site).toMatchObject({ playerLocation: 'START', playerTravelMetres: 104, owner: { location: 'OUTSIDE' }, card: { location: 'TABLE', travelMetres: 48 } });
    expect(s.darkAngel.life.ownerTravelMetres).toBe(4); expect(strip(s, 'guided-reading')).toMatchObject({ status: 'RETURNED', location: 'OWNER', travelMetres: 16 });
    expect(oldHangedManRoots(s)).toEqual(roots); assertValidSliceState(s);
  }, 120_000);
  it('failed cast still spends8S4M and original3S, then ordinary reading works without new mastery or charge loss', () => {
    let s = reach(start(firstCast(false), 'guided-reading'), 'guided-reading'); const before = structuredClone(s);
    s = da(s, { type: 'GUIDANCE', caseId: 'guided-reading', spiritId: 'THT3-ROLAND' }); expect(success(attempt(s, 'guided-reading').castTier)).toBe(false);
    expect([s.spirituality, s.mind, s.random.cursor]).toEqual([before.spirituality - 8, before.mind - 4, before.random.cursor + 1]);
    expect(s.darkAngel.life.site.spirits['THT3-ROLAND'].spirituality).toBe(18); expect(s.darkAngel.life.pending).toBeNull();
    s = da(s, { type: 'READ_ORIGINAL', caseId: 'guided-reading' }); expect(attempt(s, 'guided-reading').readingQuality).toBe(3);
    s = finish(s, 'guided-reading'); expect(s.progression.mastery[GUIDANCE]).toBe(0); expect(strip(s, 'guided-reading')).toMatchObject({ charges: 1, wear: 0 });
  }, 120_000);
  it('movement, stop and real20-second expiry void the paid unused window without refunds or recasting', () => {
    for (const kind of ['MOVE', 'STOP', 'EXPIRY'] as const) {
      let s = reach(start(firstCast(true), 'guided-reading'), 'guided-reading'); s = da(s, { type: 'GUIDANCE', caseId: 'guided-reading', spiritId: 'THT3-HELENA' });
      const spirit = s.spirituality, clock = s.darkAngel.life.site.clockSeconds;
      if (kind === 'EXPIRY') { s = da(s, { type: 'WAIT_10', caseId: 'guided-reading' }); s = da(s, { type: 'WAIT_10', caseId: 'guided-reading' }); expect(s.darkAngel.life.site.clockSeconds).toBe(clock + 20); }
      else s = da(s, { type: kind === 'MOVE' ? 'RETURN_TO_A' : 'STOP_METHOD', caseId: 'guided-reading' });
      expect(s.darkAngel.life.pending).toBeNull(); expect(s.spirituality).toBe(spirit); expect(strip(s, 'guided-reading').charges).toBe(1);
      rejectDarkAngel(s, { type: 'GUIDANCE', caseId: 'guided-reading', spiritId: 'THT3-HELENA' });
      s = da(s, { type: 'ABORT', caseId: 'guided-reading' }); s = da(ready(s), { type: 'REPORT', caseId: 'guided-reading' }); expect(s.progression.mastery[GUIDANCE]).toBe(0);
    }
  }, 120_000);
  it('actual original light only harms the selected original spirit by20 and requires actual light/card cleanup', () => {
    let s = reach(start(firstCast(true), 'guided-reading'), 'guided-reading'); s = da(s, { type: 'GUIDANCE', caseId: 'guided-reading', spiritId: 'THT3-HELENA' });
    const roland = structuredClone(s.darkAngel.life.site.spirits['THT3-ROLAND']); s = da(s, { type: 'OPEN_LIGHT', caseId: 'guided-reading' });
    expect(s.darkAngel.life.pending).toBeNull(); expect(s.darkAngel.life.site.spirits['THT3-HELENA']).toMatchObject({ integrity: 40, spirituality: 15, interrupted: true });
    expect(s.darkAngel.life.site.spirits['THT3-ROLAND']).toEqual(roland); expect(attempt(s, 'guided-reading')).toMatchObject({ spiritIntegrityLost: 20, windowEnd: 'LIGHT' });
    s = da(s, { type: 'CLOSE_LIGHT', caseId: 'guided-reading' }); s = da(s, { type: 'READ_ORIGINAL', caseId: 'guided-reading' }); s = finish(s, 'guided-reading');
    expect(s.progression.mastery[GUIDANCE]).toBe(0); expect(s.darkAngel.life.site).toMatchObject({ lamp: { on: false }, shutter: { state: 'CLOSED' }, card: { location: 'TABLE' } });
  }, 120_000);
  it('shelter uses one actual chosen ward and actual contained pulse; base pressure and all old kits remain', () => {
    let s = ordinary(firstCast(true), 'guided-reading'); s = reach(start(s, 'guarded-pulse'), 'guarded-pulse');
    rejectDarkAngel(s, { type: 'SHELTER', caseId: 'guarded-pulse', spiritId: 'THT3-ROLAND' });
    s = da(s, { type: 'READ_ORIGINAL', caseId: 'guarded-pulse' }); const before = structuredClone(s);
    s = da(s, { type: 'SHELTER', caseId: 'guarded-pulse', spiritId: 'THT3-ROLAND' }); expect(attempt(s, 'guarded-pulse').selectedMethod).toBe('SCREEN');
    expect(s.darkAngel.life.site.spirits['THT3-ROLAND'].spirituality).toBe(before.darkAngel.life.site.spirits['THT3-ROLAND'].spirituality - 3);
    s = da(s, { type: 'PERFORM_OPERATION', caseId: 'guarded-pulse' }); expect(attempt(s, 'guarded-pulse')).toMatchObject({ baselinePressure: 3, feltPressure: 1, appliedAbilityIds: [SHELTER] });
    expect(s.darkAngel.life.operation).toEqual({ ...before.darkAngel.life.operation, sealWear: before.darkAngel.life.operation.sealWear + 1 });
    expect(s.health).toBe(before.health); expect(s.darkAngel.life.site.owner).toEqual(before.darkAngel.life.site.owner);
    s = finish(s, 'guarded-pulse'); expect(s.progression.mastery[SHELTER]).toBe(8); expect(s.darkAngel.life.operation).toMatchObject({ contained: true, residualPressure: 3, focus: null, suppressedUntil: null });
  }, 120_000);
  it('third case really withdraws after paid guidance then ordinarily reads/returns; final recommendation buys nothing', () => {
    let s = ordinary(ordinary(firstCast(true), 'guided-reading'), 'guarded-pulse'); s = reach(start(s, 'withdrawn-guidance'), 'withdrawn-guidance');
    s = da(s, { type: 'GUIDANCE', caseId: 'withdrawn-guidance', spiritId: 'THT3-HELENA' }); const paid = structuredClone(s);
    expect(projectDarkAngelLife(s).actions.find(a => a.preferredAction)?.command).toEqual({ type: 'WITHDRAW_CONSENT', caseId: 'withdrawn-guidance', permission: 'ABILITY' });
    s = da(s, { type: 'WITHDRAW_CONSENT', caseId: 'withdrawn-guidance', permission: 'ABILITY' });
    expect(s.darkAngel.life.pending).toBeNull(); expect([s.spirituality, s.mind]).toEqual([paid.spirituality, paid.mind]);
    expect(attempt(s, 'withdrawn-guidance')).toMatchObject({ withdrawn: true, stopped: true, appliedAbilityIds: [] });
    rejectDarkAngel(s, { type: 'CONSENT', caseId: 'withdrawn-guidance', permission: 'ABILITY' });
    s = da(s, { type: 'READ_ORIGINAL', caseId: 'withdrawn-guidance' }); expect(attempt(s, 'withdrawn-guidance').readingQuality).toBe(3);
    s = finish(s, 'withdrawn-guidance'); s = da(ready(s), { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(darkAngelLifeMasteryGains(s)).toEqual({ [GUIDANCE]: 0, [SHELTER]: 0 });
    expect(s.darkAngel.life.ownerTravelMetres).toBe(12); expect(s.darkAngel.life.site.playerTravelMetres).toBe(136); expect(s.darkAngel.life.site.card.travelMetres).toBe(64);
    expect(s.darkAngel.life.strips).toHaveLength(3); expect(s.darkAngel.life.strips.every(n => n.status === 'RETURNED' && n.charges === 1)).toBe(true);
    expect(darkAngelLifeClosed(s)).toBe(true); expect(hasDarkAngelLifeLock(s)).toBe(false); expect(darkAngelLifeActions(s)).toEqual([]); expect(projectDarkAngelLife(s).preferredActionId).toBeNull();
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]); assertValidSliceState(s);
  }, 120_000);
  it('ordinary three-case path neither uses nor restores any finite original spiritual resource', () => {
    const original = promoted(); let s = original;
    for (const id of ['guided-reading', 'guarded-pulse', 'withdrawn-guidance'] as const) s = ordinary(s, id);
    s = da(ready(s), { type: 'REFLECT' }); expect(s.darkAngel.life.site.spirits).toEqual(original.darkAngel.life.site.spirits);
    expect(s.darkAngel.encounter.grazing).toEqual(original.darkAngel.encounter.grazing); expect(s.darkAngel.encounter.reserve).toEqual(original.darkAngel.encounter.reserve);
    expect(oldHangedManRoots(s)).toEqual(oldHangedManRoots(original)); expect(darkAngelLifeMasteryGains(s)).toEqual({ [GUIDANCE]: 0, [SHELTER]: 0 });
  }, 120_000);
  it('current OWNER withdrawal blocks further contact yet permits physical card return with paid costs retained', () => {
    let s = reach(start(firstCast(true), 'guided-reading'), 'guided-reading');
    s = da(s, { type: 'GUIDANCE', caseId: 'guided-reading', spiritId: 'THT3-HELENA' }); const before = structuredClone(s);
    s = da(s, { type: 'WITHDRAW_CONSENT', caseId: 'guided-reading', permission: 'OWNER' });
    expect(projectSliceState(s).canAct).toBe(false); expect(projectSliceState(s).actionBlockedReason).not.toBeNull();
    rejectDarkAngel(s, { type: 'READ_ORIGINAL', caseId: 'guided-reading' }); expect(s.darkAngel.life.pending).toBeNull();
    s = da(s, { type: 'ABORT', caseId: 'guided-reading' });
    expect(projectSliceState(s).canAct).toBe(true); expect(projectSliceState(s).actionBlockedReason).toBeNull();
    expect([s.spirituality, s.mind]).toEqual([before.spirituality, before.mind]);
    expect(s.darkAngel.life.site).toMatchObject({ playerLocation: 'START', owner: { location: 'OUTSIDE' }, card: { location: 'TABLE', travelMetres: 48 } });
    s = da(ready(s), { type: 'REPORT', caseId: 'guided-reading' }); expect(s.progression.mastery[GUIDANCE]).toBe(0);
  }, 120_000);
  it('uses an actual three-action weekly budget and the existing bill/debt resolver after the report', () => {
    // Explicit pre-journal UNIT finances, never a per-action refill. The complete
    // acquisition, clinic and life routes consume the actual3AP budget thereafter.
    const initial = directedInitial2(); initial.weeklyBudget = 3; initial.actionsRemaining = 3;
    initial.debts.push({ id: 'DA1-UNIT-EXISTING-DEBT', source: '既有分期', remaining: 10000, weeklyPayment: 7, createdWeek: initial.week - 1 });
    let s = da(prepareBottle(initial, dose.bottleId), dose); s = reach(start(s, 'guided-reading', 'ORDINARY'), 'guided-reading');
    expect(s.actionsRemaining).toBe(1); s = da(s, { type: 'READ_ORIGINAL', caseId: 'guided-reading' }); s = finish(s, 'guided-reading');
    const receipt = s.darkAngel.life.journal.at(-1)!; expect(receipt.command.type).toBe('REPORT'); expect(receipt.after.actions).toBe(0);
    const expected = resolveSliceWeeklyFinance({ ...receipt.finance, cash: receipt.after.cash, week: receipt.week, revision: receipt.revision, pulse: 'BILL', billAmount: 0 });
    expect(expected.eventId).toBeNull(); expect(s.week).toBe(receipt.week + 1); expect(s.actionsRemaining).toBe(3);
    expect(s.cash).toBe(expected.state.cash); expect(s.debts).toEqual(expected.state.debts); expect(validateDarkAngelLifeState(s)).toBe(true); assertValidSliceState(s);
  }, 120_000);
  it('rejects malformed commands and forged live identities, costs, RNG, permissions, charge, mastery and movement', () => {
    for (const command of [{ type: 'GUIDANCE', caseId: 'guided-reading' }, { type: 'GUIDANCE', caseId: 'guided-reading', spiritId: 'NEW-SOUL' }, { type: 'REFLECT', caseId: 'guided-reading' }, { type: 'RECOVER_ENERGY' }]) expect(validateDarkAngelActivityCommand(command)).toBe(false);
    let valid = reach(start(firstCast(true), 'guided-reading'), 'guided-reading'); valid = da(valid, { type: 'GUIDANCE', caseId: 'guided-reading', spiritId: 'THT3-HELENA' });
    const changes: ((s: SliceState) => void)[] = [
      s => { s.darkAngel.life.site.spirits['THT3-HELENA'].spirituality++; }, s => { s.darkAngel.life.site.spirits['THT3-HELENA'].interrupted = false; },
      s => { s.darkAngel.life.pending!.expiresAt++; }, s => { s.darkAngel.life.pending!.selectedMethod = 'LOW_GLOW'; },
      s => { s.darkAngel.life.pending!.permissionVersion++; }, s => { s.darkAngel.life.site.card.travelMetres++; }, s => { s.darkAngel.life.ownerTravelMetres++; },
      s => { s.darkAngel.life.strips[0]!.charges = 0; }, s => { s.darkAngel.life.journal.at(-1)!.paid.spiritSpirituality = 0; },
      s => { s.darkAngel.life.journal.at(-1)!.randomAfter!++; }, s => { s.darkAngel.life.operation.sealWear--; },
      s => { s.darkAngel.life.site.owner.age = 52 as 51; }, s => { s.darkAngel.life.journal.at(-1)!.source!.spirit!.spirituality++; },
    ];
    for (const change of changes) { const s = structuredClone(valid); change(s); expect(validateDarkAngelLifeState(s), change.toString()).toBe(false); expect(validateDarkAngelState(s), change.toString()).toBe(false); }
    expect(validateDarkAngelCurrentSite(valid.darkAngel.life.site, valid.darkAngel.sourceScene!.originals)).toBe(true); expect(getDarkAngelCurrentSite(valid)).toBe(valid.darkAngel.life.site);
    expect(blockDarkAngelLife(valid, { type: 'GUIDANCE', caseId: 'guided-reading', spiritId: 'THT3-ROLAND' })).not.toBeNull();
  }, 120_000);
});
