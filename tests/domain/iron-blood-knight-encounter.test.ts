import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createIronBloodKnightState } from '../../src/domain/iron-blood-knight/index.js';
import { applyIronBloodEncounterCommand, blockIronBloodEncounter, hasIronBloodDisputeOpponent,
  isInsideIronBloodEncounter, projectIronBloodEncounter, settleIronBloodEncounter,
  validateIronBloodEncounter, validateIronBloodEncounterCommand } from '../../src/domain/iron-blood-knight/encounter.js';
import { projectIronBloodCombat } from '../../src/domain/iron-blood-knight/combat.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const ctx: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No random persuasion'); } };
/** Explicit scene fixture; does not bypass the natural promotion tests. */
function fixture(): SliceState {
  const s = createSliceRun('iron-blood-encounter-test', sliceDefaultCreationSelection, 'iron-blood-encounter');
  s.activeEvent = null; s.eventQueue = []; s.week = 20; s.actionsRemaining = 3;
  s.progression = { pathwayId: 'hunter', sequence: 4, mastery: {}, acting: 0, promotionWeek: 19 };
  s.ironBloodKnight = createIronBloodKnightState(); s.ironBloodKnight.promotionWeek = 19; s.health = 100; s.mind = 100; s.spirituality = 120;
  for (const m of s.ironBloodKnight.team.members.slice(0, 2)) { m.joined = true; m.joinedWeek = 1; }
  return s;
}
function start(s: SliceState, call = false) {
  applyIronBloodEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, ctx);
  if (call) applyIronBloodEncounterCommand(s, { type: 'CALL_COMPANIONS' }, ctx);
  applyIronBloodEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx);
}
function rolls(...values: number[]) {
  let cursor = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const value = values[cursor++];
    if (value === undefined || value < min || value > max) throw new Error('Unexpected scene draw'); return value;
  });
}
afterEach(() => vi.restoreAllMocks());

describe('Iron Blood Knight original optional encounter', () => {
  it('requires an actual paid conversation and never starts combat or summons people on its own', () => {
    const s = fixture(); expect(validateIronBloodEncounter(s)).toBe(true);
    expect(() => applyIronBloodEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx)).toThrow('先实际交谈');
    applyIronBloodEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, ctx);
    expect(s.actionsRemaining).toBe(2); expect(s.combat).toBeNull(); expect(isInsideIronBloodEncounter(s)).toBe(true);
    expect(s.ironBloodKnight.encounter.status).toBe('READY');
    expect(s.ironBloodKnight.team.members.filter(m => m.present)).toHaveLength(0);
    expect(validateIronBloodEncounter(s)).toBe(true);
  });
  it('reserves the next real action rather than trapping a paid arrival at zero actions', () => {
    const s = fixture(); s.actionsRemaining = 1;
    expect(blockIronBloodEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留1行动');
    s.actionsRemaining = 2; applyIronBloodEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, ctx);
    expect(blockIronBloodEncounter(s, { type: 'CALL_COMPANIONS' })).toContain('另留1行动');
    expect(blockIronBloodEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toBeNull();
    applyIronBloodEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, ctx); expect(s.actionsRemaining).toBe(1);
  });
  it('calls only the same eligible original01/02, keeps their costs, and leaves a solo choice', () => {
    const s = fixture(), original = s.ironBloodKnight.team.members[0]!;
    original.health = 84; original.energy = 9;
    applyIronBloodEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, ctx);
    applyIronBloodEncounterCommand(s, { type: 'CALL_COMPANIONS' }, ctx);
    expect(s.ironBloodKnight.team.members[0]).toBe(original);
    expect(s.ironBloodKnight.team.members.filter(m => m.present).map(m => m.id)).toEqual(['IB4-01', 'IB4-02']);
    expect(original).toMatchObject({ health: 84, energy: 9, location: 'YARD' });
    expect(projectIronBloodEncounter(s).companions.map(m => m.present)).toEqual([true, true]);
    applyIronBloodEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx);
    expect(s.actionsRemaining).toBe(0); expect(hasIronBloodDisputeOpponent(s)).toBe(true);
    expect(projectIronBloodCombat(s).companions).toHaveLength(2);
    const solo = fixture(); solo.ironBloodKnight.team.members[0]!.willing = false;
    applyIronBloodEncounterCommand(solo, { type: 'ENCOUNTER_TALK' }, ctx);
    expect(blockIronBloodEncounter(solo, { type: 'CALL_COMPANIONS' })).toContain('自愿');
    applyIronBloodEncounterCommand(solo, { type: 'ENCOUNTER_FIGHT' }, ctx);
    expect(projectIronBloodCombat(solo).companions).toEqual([]);
  });
  it('offers a zero-action peaceful departure with no future duplicate opponent', () => {
    const s = fixture(); applyIronBloodEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, ctx);
    applyIronBloodEncounterCommand(s, { type: 'CALL_COMPANIONS' }, ctx);
    s.ironBloodKnight.team.members[0]!.health = 83; s.ironBloodKnight.team.members[0]!.energy = 12; s.actionsRemaining = 0;
    applyIronBloodEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, ctx);
    expect(s.ironBloodKnight.encounter.status).toBe('RESOLVED');
    expect(s.ironBloodKnight.team.members[0]).toMatchObject({ health: 83, energy: 12, present: false, location: 'HOME' });
    expect(s.ironBloodKnight.encounter.enemy).toMatchObject({ id: 'IB4-GARRICK', health: 100, status: 'RESISTING', weaponLocation: 'HAND' });
    expect(validateIronBloodEncounter(s)).toBe(true); s.actionsRemaining = 3;
    expect(() => applyIronBloodEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, ctx)).toThrow('不重新生成');
  });
  it('retreats along the actual exit and dismisses original people without healing', () => {
    const s = fixture(); start(s, true); const original = s.ironBloodKnight.team.members[0]!;
    original.health = 85; original.energy = 11;
    const spy = rolls(1, 1, 1); const result = resolveSliceCombatRound(s, 'RETREAT');
    expect(spy).toHaveBeenCalledTimes(3); expect(result.outcome).toBe('RETREATED');
    s.combatHistory.push(structuredClone(result.round)); settleIronBloodEncounter(s, result.outcome, ctx);
    expect(s.combat).toBeNull(); expect(s.ironBloodKnight.encounter.status).toBe('RETREATED');
    expect(original).toMatchObject({ health: 85, energy: 11, present: false, location: 'HOME' });
    expect(validateIronBloodEncounter(s)).toBe(true);
    // A later life practice may invite the same original member again. The old
    // encounter cannot claim his new presence or permanently forbid it.
    original.present = true; original.location = 'YARD';
    expect(validateIronBloodEncounter(s)).toBe(true); expect(projectIronBloodEncounter(s).companions[0]!.present).toBe(false);
  });
  it('persists real enemy death and its original weapon without reopening or rewarding the scene', () => {
    const s = fixture(); start(s); const before = s.progression.acting;
    const spy = rolls(1, 1, 1, 1, 1, 100); const result = resolveSliceCombatRound(s, 'ATTACK');
    expect(spy).toHaveBeenCalledTimes(6); expect(result.outcome).toBe('ENEMY_DEAD');
    s.combatHistory.push(structuredClone(result.round)); settleIronBloodEncounter(s, result.outcome, ctx);
    expect(s.ironBloodKnight.encounter.enemy).toMatchObject({ health: 0, status: 'DEAD', weaponId: 'IB4-GARRICK-CLUB', weaponLocation: 'YARD' });
    expect(s.progression.acting).toBe(before); expect(validateIronBloodEncounter(s)).toBe(true);
    s.actionsRemaining = 3; expect(() => applyIronBloodEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx)).toThrow();
  });
  it('keeps command surface finite and rejects cloned body or phantom member facts', () => {
    expect(validateIronBloodEncounterCommand({ type: 'CALL_COMPANIONS' })).toBe(true);
    expect(validateIronBloodEncounterCommand({ type: 'CALL_COMPANIONS', count: 30 })).toBe(false);
    expect(validateIronBloodEncounterCommand({ type: 'ENCOUNTER_FIGHT', autoWin: true })).toBe(false);
    const s = fixture(); start(s, true); expect(validateIronBloodEncounter(s)).toBe(true);
    s.ironBloodKnight.encounter.companionIds.push('IB4-03'); expect(validateIronBloodEncounter(s)).toBe(false);
    s.ironBloodKnight.encounter.companionIds.pop(); Object.assign(s.ironBloodKnight.encounter.enemy, { id: 'COPY' });
    expect(hasIronBloodDisputeOpponent(s)).toBe(false); expect(validateIronBloodEncounter(s)).toBe(false);
  });
  it('names the same original Garrick and club on surrender without borrowing the first-case box', () => {
    const s = fixture(); start(s);
    rolls(1, 1, 1, 1, 1, 70);
    const result = resolveSliceCombatRound(s, 'ATTACK');
    expect(result.outcome).toBe('ENEMY_SURRENDERED');
    expect(result.round.consequence).toContain('加里克仍然活着');
    expect(result.round.consequence).toContain('IB4-GARRICK-CLUB');
    expect(result.round.consequence).not.toMatch(/携铃者|箱子|与加里克的冲突/);
  });
});
