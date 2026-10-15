import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createWitchKingState } from '../../src/domain/witch-king/index.js';
import { applyWitchKingActivity, validateWitchKingLife } from '../../src/domain/witch-king/life.js';
import { applyWitchKingEncounter, blockWitchKingEncounter, hasWitchKingDisputeOpponent, hasWitchKingEncounterLock, projectWitchKingEncounter, settleWitchKingEncounter, validateWitchKingEncounter, validateWitchKingEncounterCommand } from '../../src/domain/witch-king/encounter.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
const context = (s: SliceState): SeerContext => ({ roll: min => min, note: () => {}, check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: 1 }) });
/** Original-scene unit fixture; natural promotion has separate replay coverage. */
function fixture(paper = false): SliceState {
  const s = createSliceRun('witch-king-encounter', sliceDefaultCreationSelection, 'witch-king-encounter'); s.witchKing = createWitchKingState(); s.week = 20; s.witchKing.promotionWeek = 19; s.progression = { pathwayId: 'moon', sequence: 4, acting: 0, mastery: {}, promotionWeek: 19 };
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.cash = 1000; s.actionsRemaining = 50; s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  if (paper) { applyWitchKingActivity(s, { type: 'BUY_PAPERS' }, context(s)); applyWitchKingActivity(s, { type: 'PREPARE_PAPER', paperId: 'WK4-PAPER-1-1' }, context(s)); } s.actionsRemaining = 3; return s;
}
function start(s: SliceState) { applyWitchKingEncounter(s, { type: 'ENCOUNTER_TALK' }, context(s)); applyWitchKingEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context(s)); }
function rolls(...values: number[]) { let i = 0; const original = DeterministicActionRandomStream.prototype.nextInt; return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) { original.call(this, min, max); const v = values[i++]; if (v === undefined || v < min || v > max) throw new Error(`Unexpected encounter draw ${i}`); return v; }); }
afterEach(() => vi.restoreAllMocks());

describe('Witch King optional original Dorian encounter', () => {
  it('requires paid actual conversation and a separate fight decision, creating no paper or overrank enemy', () => {
    const s = fixture(); expect(validateWitchKingEncounter(s)).toBe(true); expect(() => applyWitchKingEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context(s))).toThrow('先实际交谈'); applyWitchKingEncounter(s, { type: 'ENCOUNTER_TALK' }, context(s)); expect(s.actionsRemaining).toBe(2); expect(s.combat).toBeNull(); expect(hasWitchKingEncounterLock(s)).toBe(true); expect(s.witchKing.life.papers).toEqual([]); expect(projectWitchKingEncounter(s).enemy).toMatchObject({ id: 'WK4-DORIAN', age: 42, source: 'ORIGINAL_PRACTICE_YARD_ADULT', weaponId: 'WK4-DORIAN-CLUB', weaponLocation: 'HAND' }); expect(validateWitchKingEncounter(s)).toBe(true); applyWitchKingEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context(s)); expect(hasWitchKingDisputeOpponent(s)).toBe(true); expect(s.actionsRemaining).toBe(1);
  });
  it('reserves a second action and lets actual arrival leave peacefully at zero resources without rewards', () => {
    const s = fixture(); s.actionsRemaining = 1; expect(blockWitchKingEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留1行动'); s.actionsRemaining = 2; applyWitchKingEncounter(s, { type: 'ENCOUNTER_TALK' }, context(s)); s.actionsRemaining = 0; s.mind = 0; applyWitchKingEncounter(s, { type: 'LEAVE_ENCOUNTER' }, context(s)); expect(s.witchKing.encounter.status).toBe('RESOLVED'); expect(s.witchKing.encounter.enemy).toMatchObject({ health: 100, status: 'RESISTING', weaponLocation: 'HAND' }); expect(s.seer.completedSources).not.toContain('witch-king-dispute'); expect(validateWitchKingEncounter(s)).toBe(true); s.actionsRemaining = 3; s.mind = 100; expect(() => applyWitchKingEncounter(s, { type: 'ENCOUNTER_TALK' }, context(s))).toThrow('不重新生成');
  });
  it('keeps explicitly prepared originals unchanged through entry; it never arms remaining held stock', () => {
    const s = fixture(true), papers = structuredClone(s.witchKing.life.papers); start(s); expect(s.witchKing.life.papers).toEqual(papers); expect(s.witchKing.life.papers.filter(p => p.status === 'PREPARED')).toHaveLength(1); expect(validateWitchKingLife(s)).toBe(true); expect(validateWitchKingEncounter(s)).toBe(true);
  });
  it('retreats along the real original exit without refund, pursuit or consuming unused paper', () => {
    const s = fixture(true); start(s); const sp = s.spirituality, papers = structuredClone(s.witchKing.life.papers); const spy = rolls(1, 1, 1); const result = resolveSliceCombatRound(s, 'RETREAT'); expect(spy).toHaveBeenCalledTimes(3); expect(result.outcome).toBe('RETREATED'); s.combatHistory.push(structuredClone(result.round)); settleWitchKingEncounter(s, result.outcome, context(s)); expect(s.combat).toBeNull(); expect(s.witchKing.encounter.status).toBe('RETREATED'); expect(s.witchKing.life.papers).toEqual(papers); expect(s.spirituality).toBe(sp); expect(validateWitchKingEncounter(s)).toBe(true); expect(result.round.consequence).toContain('净空普通出口');
  });
  it('preserves true original enemy death and his own club without awarding mastery in settlement', () => {
    const s = fixture(); start(s); const spy = rolls(1, 1, 126, 1, 1, 100); const result = resolveSliceCombatRound(s, 'ATTACK'); expect(spy).toHaveBeenCalledTimes(6); expect(result.outcome).toBe('ENEMY_DEAD'); s.combatHistory.push(structuredClone(result.round)); settleWitchKingEncounter(s, result.outcome, context(s)); expect(s.witchKing.encounter.enemy).toMatchObject({ id: 'WK4-DORIAN', health: 0, status: 'DEAD', weaponId: 'WK4-DORIAN-CLUB', weaponLocation: 'YARD' }); expect(validateWitchKingEncounter(s)).toBe(true); expect(s.progression.acting).toBe(0); expect(s.seer.completedSources).not.toContain('witch-king-dispute'); expect(() => applyWitchKingEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context(s))).toThrow();
  });
  it('names the same adult on actual surrender and never borrows Sid or first-case objects', () => {
    const s = fixture(); start(s); rolls(1, 1, 126, 1, 1, 70); const result = resolveSliceCombatRound(s, 'ATTACK'); expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(result.round.consequence).toContain('WK4-DORIAN-CLUB'); expect(result.round.consequence).toContain('仍活着'); expect(result.round.consequence).not.toMatch(/携铃者|箱子|西德|奥斯里克/); s.combatHistory.push(structuredClone(result.round)); settleWitchKingEncounter(s, result.outcome, context(s)); expect(s.witchKing.encounter.enemy.health).toBe(70); expect(validateWitchKingEncounter(s)).toBe(true);
  });
  it('player death persists even when prepared paper remains unused, with no automatic resurrection', () => {
    const s = fixture(true); start(s); rolls(1, 1, 126, 1, 1_000_000, 100); const result = resolveSliceCombatRound(s, 'ATTACK'); expect(result.outcome).toBe('PLAYER_DEAD'); s.combatHistory.push(structuredClone(result.round)); settleWitchKingEncounter(s, result.outcome, context(s)); s.status = 'DEAD'; expect(s.health).toBe(0); expect(s.witchKing.life.papers[0]!.status).toBe('PREPARED'); expect(validateWitchKingLife(s)).toBe(true); expect(validateWitchKingEncounter(s)).toBe(true);
  });
  it('refuses open real practices, fake opponents, stale rounds and extra command power', () => {
    const s = fixture(); applyWitchKingActivity(s, { type: 'OBSERVE', caseId: 'paper-trial' }, context(s)); applyWitchKingActivity(s, { type: 'PREPARE', caseId: 'paper-trial', method: 'ORDINARY' }, context(s)); expect(blockWitchKingEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('收束'); applyWitchKingActivity(s, { type: 'WITHDRAW', caseId: 'paper-trial' }, context(s)); s.actionsRemaining = 3; start(s);
    expect(validateWitchKingEncounterCommand({ type: 'ENCOUNTER_FIGHT', autoWin: true })).toBe(false); expect(validateWitchKingEncounterCommand({ type: 'CREATE_ENEMY' })).toBe(false); expect(validateWitchKingEncounterCommand({ type: 'LEAVE_ENCOUNTER' })).toBe(true); expect(() => settleWitchKingEncounter(s, 'ENEMY_DEAD', context(s))).toThrow(); Object.assign(s.witchKing.encounter.enemy, { id: 'COPY' }); expect(hasWitchKingDisputeOpponent(s)).toBe(false); expect(validateWitchKingEncounter(s)).toBe(false);
  });
  it('accepts semantically identical saves whose object keys were reordered', () => {
    const s = fixture(); s.witchKing.encounter = Object.fromEntries(Object.entries(s.witchKing.encounter).reverse()) as typeof s.witchKing.encounter; s.witchKing.encounter.enemy = Object.fromEntries(Object.entries(s.witchKing.encounter.enemy).reverse()) as typeof s.witchKing.encounter.enemy; expect(validateWitchKingEncounter(s)).toBe(true); applyWitchKingEncounter(s, { type: 'ENCOUNTER_TALK' }, context(s)); expect(validateWitchKingEncounter(s)).toBe(true);
  });
});
