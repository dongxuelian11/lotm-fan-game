import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createNightwatcherState } from '../../src/domain/nightwatcher/index.js';
import { applyNightwatcherActivity, validateNightwatcherLife } from '../../src/domain/nightwatcher/life.js';
import { applyNightwatcherEncounter, blockNightwatcherEncounter, hasNightwatcherDisputeOpponent, hasNightwatcherEncounterLock, projectNightwatcherEncounter, settleNightwatcherEncounter, validateNightwatcherEncounter, validateNightwatcherEncounterCommand } from '../../src/domain/nightwatcher/encounter.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
const context = (s: SliceState): SeerContext => ({ roll: min => min, note: () => {}, check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: 1 }) });
/** Original-scene unit fixture; natural promotion has separate replay coverage. No spirit is manufactured here. */
function fixture(): SliceState {
  const s = createSliceRun('nightwatcher-encounter', sliceDefaultCreationSelection, 'nightwatcher-encounter'); s.nightwatcher = createNightwatcherState(); s.week = 20; s.nightwatcher.promotionWeek = 19; s.progression = { pathwayId: 'darkness', sequence: 4, acting: 0, mastery: {}, promotionWeek: 19 };
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.cash = 1000; s.actionsRemaining = 50; s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.actionsRemaining = 3; return s;
}
function start(s: SliceState) { applyNightwatcherEncounter(s, { type: 'ENCOUNTER_TALK' }, context(s)); applyNightwatcherEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context(s)); }
function rolls(...values: number[]) { let i = 0; const original = DeterministicActionRandomStream.prototype.nextInt; return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) { original.call(this, min, max); const v = values[i++]; if (v === undefined || v < min || v > max) throw new Error(`Unexpected encounter draw ${i}`); return v; }); }
afterEach(() => vi.restoreAllMocks());

describe('Nightwatcher optional original Bram encounter', () => {
  it('requires paid actual conversation and a separate fight decision, creating no spirit or overrank enemy', () => {
    const s = fixture(); expect(validateNightwatcherEncounter(s)).toBe(true); expect(() => applyNightwatcherEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context(s))).toThrow('先实际交谈'); applyNightwatcherEncounter(s, { type: 'ENCOUNTER_TALK' }, context(s)); expect(s.actionsRemaining).toBe(2); expect(s.combat).toBeNull(); expect(hasNightwatcherEncounterLock(s)).toBe(true); expect(s.spiritWarlock.companion.acquiredWeek).toBeNull(); expect(projectNightwatcherEncounter(s).enemy).toMatchObject({ id: 'NW4-BRAM', age: 45, source: 'ORIGINAL_PRACTICE_YARD_ADULT', weaponId: 'NW4-BRAM-CLUB', weaponLocation: 'HAND' }); expect(validateNightwatcherEncounter(s)).toBe(true); applyNightwatcherEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context(s)); expect(hasNightwatcherDisputeOpponent(s)).toBe(true); expect(s.actionsRemaining).toBe(1);
  });
  it('reserves a second action and lets actual arrival leave peacefully at zero resources without rewards', () => {
    const s = fixture(); s.actionsRemaining = 1; expect(blockNightwatcherEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留1行动'); s.actionsRemaining = 2; applyNightwatcherEncounter(s, { type: 'ENCOUNTER_TALK' }, context(s)); s.actionsRemaining = 0; s.mind = 0; applyNightwatcherEncounter(s, { type: 'LEAVE_ENCOUNTER' }, context(s)); expect(s.nightwatcher.encounter.status).toBe('RESOLVED'); expect(s.nightwatcher.encounter.enemy).toMatchObject({ health: 100, status: 'RESISTING', weaponLocation: 'HAND' }); expect(s.seer.completedSources).not.toContain('nightwatcher-dispute'); expect(validateNightwatcherEncounter(s)).toBe(true); s.actionsRemaining = 3; s.mind = 100; expect(() => applyNightwatcherEncounter(s, { type: 'ENCOUNTER_TALK' }, context(s))).toThrow('不重新生成');
  });
  it('keeps the inherited old original unchanged on entry and never grants a free spirit', () => {
    const s = fixture(), old = structuredClone(s.spiritWarlock); start(s); expect(s.spiritWarlock).toEqual(old); expect(validateNightwatcherLife(s)).toBe(true); expect(validateNightwatcherEncounter(s)).toBe(true);
  });
  it('retreats through the real original exit without pursuit, spirit gifts or refunds', () => {
    const s = fixture(); start(s); const sp = s.spirituality, old = structuredClone(s.spiritWarlock); const spy = rolls(1, 1, 1); const result = resolveSliceCombatRound(s, 'RETREAT'); expect(spy).toHaveBeenCalledTimes(3); expect(result.outcome).toBe('RETREATED'); s.combatHistory.push(structuredClone(result.round)); settleNightwatcherEncounter(s, result.outcome, context(s)); expect(s.combat).toBeNull(); expect(s.nightwatcher.encounter.status).toBe('RETREATED'); expect(s.spiritWarlock).toEqual(old); expect(s.spirituality).toBe(sp); expect(validateNightwatcherEncounter(s)).toBe(true); expect(result.round.consequence).toContain('净空普通出口');
  });
  it('preserves true original enemy death and his own club without awarding mastery in settlement', () => {
    const s = fixture(); start(s); const spy = rolls(1, 1, 1, 1, 1, 100); const result = resolveSliceCombatRound(s, 'ATTACK'); expect(spy).toHaveBeenCalledTimes(6); expect(result.outcome).toBe('ENEMY_DEAD'); s.combatHistory.push(structuredClone(result.round)); settleNightwatcherEncounter(s, result.outcome, context(s)); expect(s.nightwatcher.encounter.enemy).toMatchObject({ id: 'NW4-BRAM', health: 0, status: 'DEAD', weaponId: 'NW4-BRAM-CLUB', weaponLocation: 'YARD' }); expect(validateNightwatcherEncounter(s)).toBe(true); expect(s.progression.acting).toBe(0); expect(s.seer.completedSources).not.toContain('nightwatcher-dispute'); expect(() => applyNightwatcherEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context(s))).toThrow();
  });
  it('names the same adult on actual surrender and never borrows Olin or first-case objects', () => {
    const s = fixture(); start(s); rolls(1, 1, 1, 1, 1, 70); const result = resolveSliceCombatRound(s, 'ATTACK'); expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(result.round.consequence).toContain('NW4-BRAM-CLUB'); expect(result.round.consequence).toContain('仍活着'); expect(result.round.consequence).not.toMatch(/携铃者|箱子|西德|奥斯里克/); s.combatHistory.push(structuredClone(result.round)); settleNightwatcherEncounter(s, result.outcome, context(s)); expect(s.nightwatcher.encounter.enemy.health).toBe(70); expect(validateNightwatcherEncounter(s)).toBe(true);
  });
  it('player death persists without dream escape, revival or a new original body', () => {
    const s = fixture(); start(s); rolls(1, 1, 1, 1, 1_000_000, 100); const result = resolveSliceCombatRound(s, 'ATTACK'); expect(result.outcome).toBe('PLAYER_DEAD'); s.combatHistory.push(structuredClone(result.round)); settleNightwatcherEncounter(s, result.outcome, context(s)); s.status = 'DEAD'; expect(s.health).toBe(0); expect(s.spiritWarlock.companion.acquiredWeek).toBeNull(); expect(validateNightwatcherLife(s)).toBe(true); expect(validateNightwatcherEncounter(s)).toBe(true);
  });
  it('refuses open real practices, fake opponents, stale rounds and extra command power', () => {
    const s = fixture(); applyNightwatcherActivity(s, { type: 'OBSERVE', caseId: 'uneven-cart' }, context(s)); applyNightwatcherActivity(s, { type: 'PREPARE', caseId: 'uneven-cart', method: 'ORDINARY' }, context(s)); expect(blockNightwatcherEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('收束'); applyNightwatcherActivity(s, { type: 'WITHDRAW', caseId: 'uneven-cart' }, context(s)); s.actionsRemaining = 3; start(s);
    expect(validateNightwatcherEncounterCommand({ type: 'ENCOUNTER_FIGHT', autoWin: true })).toBe(false); expect(validateNightwatcherEncounterCommand({ type: 'CREATE_ENEMY' })).toBe(false); expect(validateNightwatcherEncounterCommand({ type: 'LEAVE_ENCOUNTER' })).toBe(true); expect(() => settleNightwatcherEncounter(s, 'ENEMY_DEAD', context(s))).toThrow(); Object.assign(s.nightwatcher.encounter.enemy, { id: 'COPY' }); expect(hasNightwatcherDisputeOpponent(s)).toBe(false); expect(validateNightwatcherEncounter(s)).toBe(false);
  });
  it('accepts semantically identical saves whose object keys were reordered', () => {
    const s = fixture(); s.nightwatcher.encounter = Object.fromEntries(Object.entries(s.nightwatcher.encounter).reverse()) as typeof s.nightwatcher.encounter; s.nightwatcher.encounter.enemy = Object.fromEntries(Object.entries(s.nightwatcher.encounter.enemy).reverse()) as typeof s.nightwatcher.encounter.enemy; expect(validateNightwatcherEncounter(s)).toBe(true); applyNightwatcherEncounter(s, { type: 'ENCOUNTER_TALK' }, context(s)); expect(validateNightwatcherEncounter(s)).toBe(true);
  });
});
