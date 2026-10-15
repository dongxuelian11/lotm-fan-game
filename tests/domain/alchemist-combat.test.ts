import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createAlchemistState } from '../../src/domain/alchemist/index.js';
import { applyAlchemistActivity, findAlchemistFrame } from '../../src/domain/alchemist/life.js';
import { applyAlchemistEncounter } from '../../src/domain/alchemist/encounter.js';
import { ALCHEMIST_COUNT_WHEEL, alchemistAbilityWheel, alchemistActionCount, beginAlchemistCombatRound, consumeAlchemistGuard, currentAlchemistCombatSource, drawAlchemistAbility, finishAlchemistCombatRound, resolveAlchemistCombatAbility, type AlchemistCombatSource, type AlchemistMoveId } from '../../src/domain/alchemist/combat.js';
import { astronomerAbilityWheel } from '../../src/domain/astronomer/combat.js';
import { bizarroSorcererAbilityWheel } from '../../src/domain/bizarro-sorcerer/combat.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
const context = (s: SliceState): SeerContext => ({ roll: min => min, note: () => {}, check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: 1 }) });
/** Scene fixture makes both actual originals through their commands; no natural promotion claim. */
function fixture(withFrame = true): SliceState {
  const s = createSliceRun('alchemist-combat', sliceDefaultCreationSelection, 'alchemist-combat'); s.alchemist = createAlchemistState(); s.week = 20; s.alchemist.promotionWeek = 19;
  s.progression = { pathwayId: 'paragon', sequence: 4, mastery: { 'paragon.s4.animate-made-object': 0, 'paragon.s4.direct-creation': 0, 'paragon.s5.precision-focus': 0 }, acting: 0, promotionWeek: 19 };
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 }; s.health = 100; s.mind = 100; s.spirituality = 120; s.cash = 1000; s.actionsRemaining = 50;
  const ctx = context(s);
  if (withFrame) {
    for (const caseId of ['messenger-box', 'guard-frame'] as const) {
      applyAlchemistActivity(s, { type: 'OBSERVE', caseId }, ctx); applyAlchemistActivity(s, { type: 'BUY_KIT', caseId }, ctx); applyAlchemistActivity(s, { type: 'PREPARE', caseId, method: 'ORDINARY' }, ctx); applyAlchemistActivity(s, { type: 'ASSEMBLE', caseId }, ctx); applyAlchemistActivity(s, { type: 'PERFORM', caseId }, ctx); applyAlchemistActivity(s, { type: caseId === 'messenger-box' ? 'MOVE_CREATION' : 'GUARD_CREATION', caseId }, ctx); applyAlchemistActivity(s, { type: 'RETURN_CREATION', caseId }, ctx); applyAlchemistActivity(s, { type: 'CLOSE', caseId }, ctx); applyAlchemistActivity(s, { type: 'REPORT', caseId }, ctx);
    }
    applyAlchemistActivity(s, { type: 'RECHARGE_FRAME' }, ctx);
  }
  s.spirituality = 120; s.actionsRemaining = 3; applyAlchemistEncounter(s, { type: 'ENCOUNTER_TALK' }, ctx); applyAlchemistEncounter(s, { type: 'ENCOUNTER_FIGHT' }, ctx); s.town.clubLocation = 'SHOP'; return s;
}
const random = (roll = 1): ActionRandomStream => ({ seed: 'unit', cursor: 0, nextInt: () => roll });
function script(...values: number[]) { let i = 0; const original = DeterministicActionRandomStream.prototype.nextInt; return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) { original.call(this, min, max); const v = values[i++]; if (v === undefined || v < min || v > max) throw new Error(`Unexpected combat draw ${i}: ${v}`); return v; }); }
afterEach(() => vi.restoreAllMocks());

describe('Alchemist same-original finite guard combat', () => {
  it('selects its finite S4 wheel and old count distribution without altering Astronomer5 or Diviner4', () => { const s = fixture(); expect(playerCountWheel(s)).toEqual(ALCHEMIST_COUNT_WHEEL); expect(playerAbilityWheel(s, null)).toEqual(alchemistAbilityWheel(s, null)); expect(alchemistAbilityWheel(s, null).map(a => a.weight)).toEqual([25, 5, 25, 20, 10, 10, 5]); expect(alchemistAbilityWheel(s, 'DEFEND').reduce((sum, a) => sum + a.weight, 0)).toBeCloseTo(100); expect(drawAlchemistAbility(random(), s, null)).toBe('paragon.s4.animate-made-object'); for (const [roll, count] of [[1, 1], [11, 2], [26, 3], [51, 4], [76, 5], [91, 6]]) expect(alchemistActionCount(roll!)).toBe(count); s.progression.sequence = 5; expect(playerAbilityWheel(s, null)).toEqual(astronomerAbilityWheel(s, null)); s.progression.pathwayId = 'diviner'; s.progression.sequence = 4; expect(playerAbilityWheel(s, null)).toEqual(bizarroSorcererAbilityWheel(s, null)); });
  it('H really consumes SP and existing original charge, J uses the same active frame, and only actual contact loses durability', () => {
    const s = fixture(), f = findAlchemistFrame(s)!, round = beginAlchemistCombatRound(s); expect(f).toMatchObject({ location: 'YARD', active: false, charge: 3, durability: 95 });
    expect(resolveAlchemistCombatAbility(s, 'paragon.s4.direct-creation', 1, random(), round).enemyReduction).toBe(10); expect(f.charge).toBe(3);
    expect(resolveAlchemistCombatAbility(s, 'paragon.s4.animate-made-object', 1, random(), round).selfGain).toBe(26); expect(s.spirituality).toBe(116); expect(f).toMatchObject({ charge: 2, active: true });
    expect(resolveAlchemistCombatAbility(s, 'paragon.s4.direct-creation', 1, random(), round).enemyReduction).toBe(26); expect(s.spirituality).toBe(114); expect(f).toMatchObject({ charge: 1, durability: 95 });
    expect(consumeAlchemistGuard(s, round, 'BLOCK', 0, false)).toBeNull(); expect(consumeAlchemistGuard(s, round, 'STRIKE', 16, true)).toBeNull(); expect(f.durability).toBe(95);
    expect(consumeAlchemistGuard(s, round, 'STRIKE', 16, false)).toContain('耐久−5至90'); expect(f.durability).toBe(90); expect(consumeAlchemistGuard(s, round, 'STRIKE', 16, false)).toBeNull(); expect(findAlchemistFrame(s)).toBe(f);
  });
  it('exhaustion ends animation, no successful H or ordinary regeneration fills the original charge', () => {
    const s = fixture(), f = findAlchemistFrame(s)!, r = beginAlchemistCombatRound(s);
    resolveAlchemistCombatAbility(s, 'paragon.s4.animate-made-object', 1, random(), r); resolveAlchemistCombatAbility(s, 'paragon.s4.direct-creation', 1, random(), r); resolveAlchemistCombatAbility(s, 'paragon.s4.direct-creation', 1, random(), r); const sp = s.spirituality;
    expect(f).toMatchObject({ charge: 0, active: false }); expect(resolveAlchemistCombatAbility(s, 'paragon.s4.animate-made-object', 1, random(), r).selfGain).toBe(12); expect(s.spirituality).toBe(sp);
    expect(finishAlchemistCombatRound(s, r, true)).toContain('不补原件储能'); expect(r.outcome).toMatchObject({ creationId: 'AL4-FRAME-1', charge: 0, durability: 95, active: false }); expect(r.pendingGuards).toBe(0);
  });
  it('failed knowledge spends actual4SP and one finite charge without free activation or attack', () => { const s = fixture(), f = findAlchemistFrame(s)!, r = beginAlchemistCombatRound(s); const e = resolveAlchemistCombatAbility(s, 'paragon.s4.animate-made-object', 1, random(100), r); expect(e).toMatchObject({ selfGain: 0, threatens: false }); expect(s.spirituality).toBe(116); expect(f).toMatchObject({ charge: 2, active: false, durability: 95 }); });
  it('missing, bought, foreign or broken frames use the actual ordinary body instead of cloning a helper', () => { const empty = fixture(false), er = beginAlchemistCombatRound(empty); expect(resolveAlchemistCombatAbility(empty, 'paragon.s4.animate-made-object', 1, random(), er).selfGain).toBe(12); expect(resolveAlchemistCombatAbility(empty, 'paragon.s4.direct-creation', 1, random(), er).enemyReduction).toBe(10); expect(empty.spirituality).toBe(120); expect(empty.alchemist.life.creations).toEqual([]);
    for (const mutation of [(s: SliceState) => { findAlchemistFrame(s)!.madeBy = 'OTHER'; }, (s: SliceState) => { findAlchemistFrame(s)!.durability = 0; }, (s: SliceState) => { s.alchemist.life.materials[1]!.status = 'PLAYER'; }, (s: SliceState) => { findAlchemistFrame(s)!.location = 'PLAYER'; }]) { const s = fixture(), r = beginAlchemistCombatRound(s); mutation(s); const before = s.spirituality; expect(resolveAlchemistCombatAbility(s, 'paragon.s4.animate-made-object', 1, random(), r).selfGain).toBe(12); expect(s.spirituality).toBe(before); }
  });
  it('stale or substituted sources cannot pay for a copied enemy or draw another result', () => { const s = fixture(), r = beginAlchemistCombatRound(s), source = currentAlchemistCombatSource(s)!; for (const bad of [null, { ...source, round: 99 }, { ...source, enemyId: 'COPY' }, { ...source, weaponId: 'COPY' }]) { const before = structuredClone(s); expect(resolveAlchemistCombatAbility(s, 'paragon.s4.animate-made-object', 1, random(), r, bad as AlchemistCombatSource | null).selfGain).toBe(0); expect(s).toEqual(before); } s.combat!.encounterId = 'ASTRONOMER_DISPUTE'; expect(currentAlchemistCombatSource(s)).toBeNull(); });
  it('inherits actual Astronomer budget and keeps observation0 and fixed accident', () => { const s = fixture(false), r = beginAlchemistCombatRound(s); const effect = (id: AlchemistMoveId) => resolveAlchemistCombatAbility(s, id, 1, random(), r); expect(effect('paragon.s5.precision-focus').selfGain).toBeCloseTo(12 * .65); expect(s.spirituality).toBe(118); expect(effect('OBSERVE').selfGain).toBe(0); expect(effect('ACCIDENT').selfGain).toBe(-22.5); expect(effect('STRIKE').selfGain).toBe(12); s.town.clubLocation = 'HAND'; expect(effect('STRIKE').selfGain).toBe(16); });
  it('shared actual rounds use1250/floor125 and regenerate12 only on continuing rounds, never charge', () => { const s = fixture(), f = findAlchemistFrame(s)!; s.spirituality = 80; const spy = script(1, 1, 1, 1, 1, 1_000_000, 1); const result = resolveSliceCombatRound(s, 'ATTACK'); expect(spy).toHaveBeenCalledTimes(7); expect(result.outcome).toBe('CONTINUE'); expect(s.health).toBe(90); expect(s.spirituality).toBe(88); expect(f.charge).toBe(2); expect(result.round.alchemistOutcome).toMatchObject({ creationId: f.id, charge: 2, durability: 95, active: true, enemyId: 'AL4-OSRIC' }); });
  it('does not grant guard immunity or refund charge when common physical death occurs', () => { const s = fixture(), f = findAlchemistFrame(s)!; const spy = script(1, 1, 1, 1, 1, 1_000_000, 100); const result = resolveSliceCombatRound(s, 'ATTACK'); expect(spy).toHaveBeenCalledTimes(7); expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.spirituality).toBe(116); expect(f).toMatchObject({ charge: 2, active: false }); expect(result.round.consequence).toContain('没有替死'); });
});
