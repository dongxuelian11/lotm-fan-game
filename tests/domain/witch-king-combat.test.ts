import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createWitchKingState } from '../../src/domain/witch-king/index.js';
import { applyWitchKingActivity, validateWitchKingLife } from '../../src/domain/witch-king/life.js';
import { applyWitchKingEncounter } from '../../src/domain/witch-king/encounter.js';
import { WITCH_KING_COUNT_WHEEL, witchKingAbilityWheel, witchKingActionCount, beginWitchKingCombatRound, currentWitchKingCombatSource, drawWitchKingAbility, finishWitchKingCombatRound, resolveWitchKingCombatAbility, type WitchKingCombatSource, type WitchKingMoveId } from '../../src/domain/witch-king/combat.js';
import { crimsonScholarAbilityWheel } from '../../src/domain/crimson-scholar/combat.js';
import { alchemistAbilityWheel } from '../../src/domain/alchemist/combat.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
const context = (s: SliceState): SeerContext => ({ roll: min => min, note: () => {}, check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: 1 }) });
/** Original scene fixture. Papers are actually purchased and explicitly prepared via commands. */
function fixture(paper: 'NONE' | 'HELD' | 'PREPARED' = 'PREPARED'): SliceState {
  const s = createSliceRun('witch-king-combat', sliceDefaultCreationSelection, 'witch-king-combat'); s.witchKing = createWitchKingState(); s.week = 20; s.witchKing.promotionWeek = 19;
  s.progression = { pathwayId: 'moon', sequence: 4, mastery: { 'moon.s4.blood-moon-arrow': 0, 'moon.s4.moon-paper-substitute': 0, 'moon.s7.abyss-shackles': 0 }, acting: 0, promotionWeek: 19 };
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 }; s.health = 100; s.mind = 100; s.spirituality = 120; s.cash = 1000; s.actionsRemaining = 50;
  if (paper !== 'NONE') applyWitchKingActivity(s, { type: 'BUY_PAPERS' }, context(s));
  if (paper === 'PREPARED') applyWitchKingActivity(s, { type: 'PREPARE_PAPER', paperId: 'WK4-PAPER-1-2' }, context(s));
  s.spirituality = 120; s.actionsRemaining = 3; applyWitchKingEncounter(s, { type: 'ENCOUNTER_TALK' }, context(s)); applyWitchKingEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context(s)); s.town.clubLocation = 'SHOP'; return s;
}
const random = (roll = 1): ActionRandomStream => ({ seed: 'unit', cursor: 0, nextInt: () => roll });
function script(...values: number[]) { let i = 0; const original = DeterministicActionRandomStream.prototype.nextInt; return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) { original.call(this, min, max); const v = values[i++]; if (v === undefined || v < min || v > max) throw new Error(`Unexpected combat draw ${i}: ${v}`); return v; }); }
afterEach(() => vi.restoreAllMocks());

describe('Witch King finite paper and blood moon arrow combat', () => {
  it('selects its seven-slot S4 wheel and ordinary1–6 count without changing prior wheels', () => {
    const s = fixture(); expect(playerCountWheel(s)).toEqual(WITCH_KING_COUNT_WHEEL); expect(playerAbilityWheel(s, null)).toEqual(witchKingAbilityWheel(s, null)); expect(witchKingAbilityWheel(s, null).map(a => a.weight)).toEqual([25, 5, 25, 20, 10, 10, 5]); expect(witchKingAbilityWheel(s, 'DEFEND').reduce((sum, a) => sum + a.weight, 0)).toBeCloseTo(100); expect(drawWitchKingAbility(random(), s, null)).toBe('moon.s4.blood-moon-arrow');
    for (const [roll, count] of [[1, 1], [11, 2], [26, 3], [51, 4], [76, 5], [91, 6]]) expect(witchKingActionCount(roll!)).toBe(count);
    s.progression.sequence = 5; expect(playerAbilityWheel(s, null)).toEqual(crimsonScholarAbilityWheel(s, null)); s.progression.pathwayId = 'paragon'; s.progression.sequence = 4; expect(playerAbilityWheel(s, null)).toEqual(alchemistAbilityWheel(s, null));
  });
  it('H succeeds only after spending4SP and a real check, using45×mastery while leaving old powers intact', () => {
    const s = fixture(), r = beginWitchKingCombatRound(s); const before = structuredClone(s.crimsonScholar), blood = structuredClone(s.vampire);
    const e = resolveWitchKingCombatAbility(s, 'moon.s4.blood-moon-arrow', 1, random(), r); expect(e).toMatchObject({ selfGain: 45 * .65, enemyReduction: 0, threatens: true }); expect(s.spirituality).toBe(116); expect(s.crimsonScholar).toEqual(before); expect(s.vampire).toEqual(blood);
  });
  it('failed paid H and K checks cost resources and produce exactly0 effects, without ordinary consolation attacks', () => {
    const s = fixture(), r = beginWitchKingCombatRound(s); for (const id of ['moon.s4.blood-moon-arrow', 'moon.s7.abyss-shackles'] as const) { const e = resolveWitchKingCombatAbility(s, id, 1, random(100), r); expect(e).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(e.label).toContain('0效果'); } expect(s.spirituality).toBe(113); expect(s.witchKing.life.papers[1]!.status).toBe('PREPARED');
  });
  it('J consumes exactly the explicitly prepared original and3SP once, then honestly falls back to ordinary evade', () => {
    const s = fixture(), r = beginWitchKingCombatRound(s), paper = s.witchKing.life.papers[1]!;
    expect(resolveWitchKingCombatAbility(s, 'moon.s4.moon-paper-substitute', 1, random(), r).enemyReduction).toBe(35); expect(s.spirituality).toBe(117); expect(paper).toMatchObject({ id: 'WK4-PAPER-1-2', status: 'CONSUMED', consumedBy: 'COMBAT', combatRound: 1, consumedWeek: 20 }); expect(r.outcome).toMatchObject({ paperId: paper.id, papersConsumed: [paper.id] });
    expect(resolveWitchKingCombatAbility(s, 'moon.s4.moon-paper-substitute', 1, random(), r).enemyReduction).toBe(10); expect(s.spirituality).toBe(117); expect(s.witchKing.life.papers.filter(p => p.status === 'HELD')).toHaveLength(2); expect(s.witchKing.life.papers[1]).toBe(paper);
  });
  it('held but unprepared paper, no paper, and lowSP J never auto-arm or consume another original', () => {
    for (const stock of ['NONE', 'HELD'] as const) { const s = fixture(stock), r = beginWitchKingCombatRound(s), papers = structuredClone(s.witchKing.life.papers); expect(resolveWitchKingCombatAbility(s, 'moon.s4.moon-paper-substitute', 1, random(), r).enemyReduction).toBe(10); expect(s.spirituality).toBe(120); expect(s.witchKing.life.papers).toEqual(papers); }
    const s = fixture(), r = beginWitchKingCombatRound(s); s.spirituality = 2; expect(resolveWitchKingCombatAbility(s, 'moon.s4.moon-paper-substitute', 1, random(), r).enemyReduction).toBe(10); expect(s.spirituality).toBe(2); expect(s.witchKing.life.papers[1]!.status).toBe('PREPARED');
  });
  it('insufficient H resources use only the actual original body or original held club', () => {
    const s = fixture('NONE'), r = beginWitchKingCombatRound(s); s.spirituality = 3; expect(resolveWitchKingCombatAbility(s, 'moon.s4.blood-moon-arrow', .5, random(), r).selfGain).toBe(6); s.town.clubLocation = 'HAND'; expect(resolveWitchKingCombatAbility(s, 'moon.s4.blood-moon-arrow', .5, random(), r).selfGain).toBe(8); expect(s.spirituality).toBe(3); expect(s.witchKing.life.papers).toEqual([]);
  });
  it('inherits the original shackles ID with resistible limited reduction14 and no full stun or fresh chain ability', () => {
    const s = fixture(), r = beginWitchKingCombatRound(s); expect(resolveWitchKingCombatAbility(s, 'moon.s7.abyss-shackles', 1, random(), r)).toMatchObject({ enemyReduction: 14, selfGain: 0, threatens: false }); expect(s.spirituality).toBe(117); expect(witchKingAbilityWheel(s, null).filter(a => a.id.includes('shackle')).map(a => a.id)).toEqual(['moon.s7.abyss-shackles']);
    expect(resolveWitchKingCombatAbility(s, 'moon.s4.abyss-shackles' as WitchKingMoveId, 1, random(), r).enemyReduction).toBe(0); expect(s.spirituality).toBe(117);
  });
  it('R is ordinary observation and accident is exactly−22.5; no paper-based healing or summoning', () => {
    const s = fixture(), r = beginWitchKingCombatRound(s); s.health = 40; expect(resolveWitchKingCombatAbility(s, 'OBSERVE', 1, random(), r).selfGain).toBe(0); expect(resolveWitchKingCombatAbility(s, 'ACCIDENT', 1, random(), r).selfGain).toBe(-22.5); expect(s.health).toBe(40); expect(s.spirituality).toBe(120);
  });
  it('stale or substituted original source cannot spend any resource or reroll', () => {
    const s = fixture(), r = beginWitchKingCombatRound(s), source = currentWitchKingCombatSource(s)!;
    for (const bad of [null, { ...source, round: 99 }, { ...source, enemyId: 'COPY' }, { ...source, weaponId: 'COPY' }]) { const before = structuredClone(s); expect(resolveWitchKingCombatAbility(s, 'moon.s4.moon-paper-substitute', 1, random(), r, bad as WitchKingCombatSource | null).enemyReduction).toBe(0); expect(s).toEqual(before); }
    s.combat!.encounterId = 'CRIMSON_SCHOLAR_DISPUTE'; expect(currentWitchKingCombatSource(s)).toBeNull();
  });
  it('shared continuing round uses1250/floor125 and regeneration12, with only the paid arrow reducing spirituality', () => {
    const s = fixture(); s.spirituality = 80; const spy = script(1, 1, 1, 1, 1, 1_000_000, 1); const result = resolveSliceCombatRound(s, 'ATTACK'); expect(spy).toHaveBeenCalledTimes(7); expect(result.outcome).toBe('CONTINUE'); expect(s.health).toBe(90); expect(s.spirituality).toBe(88); expect(result.round.witchKingOutcome).toMatchObject({ enemyId: 'WK4-DORIAN', paperId: 'WK4-PAPER-1-2', papersConsumed: [] }); expect(s.witchKing.life.papers[1]!.status).toBe('PREPARED');
  });
  it('real common death still occurs after a paid paper substitution, with no refund, resurrection or full immunity', () => {
    const s = fixture(), paper = s.witchKing.life.papers[1]!; const spy = script(1, 1, 151, 1, 1_000_000, 100); const result = resolveSliceCombatRound(s, 'ATTACK'); expect(spy).toHaveBeenCalledTimes(6); expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.spirituality).toBe(117); expect(result.round.witchKingOutcome?.papersConsumed).toEqual([paper.id]); expect(paper.status).toBe('CONSUMED'); expect(result.round.consequence).toContain('不自动复活'); s.combatHistory.push(structuredClone(result.round)); expect(validateWitchKingLife(s)).toBe(true);
  });
  it('round finish keeps consumed originals and finite outcomes rather than granting stock from regeneration', () => {
    const s = fixture(), r = beginWitchKingCombatRound(s); resolveWitchKingCombatAbility(s, 'moon.s4.moon-paper-substitute', 1, random(), r); expect(finishWitchKingCombatRound(s, r, true)).toContain('回灵不补纸'); expect(r.outcome.papersConsumed).toEqual(['WK4-PAPER-1-2']); expect(s.witchKing.life.papers).toHaveLength(3); expect(s.witchKing.life.papers.filter(p => p.status === 'CONSUMED')).toHaveLength(1);
  });
});
