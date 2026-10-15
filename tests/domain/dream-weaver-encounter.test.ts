import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createDreamWeaverState } from '../../src/domain/dream-weaver/index.js';
import { createDreamWeaverEncounterState, applyDreamWeaverEncounterCommand, blockDreamWeaverEncounter,
  projectDreamWeaverEncounter, validateDreamWeaverEncounter, validateDreamWeaverEncounterCommand,
  hasDreamWeaverDisputeOpponent, hasDreamWeaverEncounterLock, settleDreamWeaverEncounter } from '../../src/domain/dream-weaver/encounter.js';
import { resolveDreamWeaverCombatRound } from '../../src/domain/slice/dream-weaver-combat.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No scene check in this fixture'); } };
/** Directed post-promotion encounter fixture, not a natural promotion claim. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/manipulator-v01190/natural.json', 'utf8')).final);
  s.dreamWeaver = createDreamWeaverState(); s.dreamWeaver.promotionWeek = s.week; s.progression.sequence = 3; s.progression.acting = 0;
  s.progression.mastery['audience.s3.external-identity'] = 0; s.progression.mastery['audience.s3.woven-image'] = 0;
  s.character.coreStats.will = 30; s.actionsRemaining = 2; s.cash = 400; s.spirituality = 120; s.health = 100; s.mind = 100; s.activeEvent = null; s.combat = null; return s;
}
function start(s: SliceState): void { applyDreamWeaverEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); applyDreamWeaverEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); }
function script(...values: number[]) { let index = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${index}: ${n}, ${min}..${max}`); return n;
  }); }
function round(s: SliceState, stance: 'ATTACK' | 'RETREAT', ...values: number[]) {
  script(...values); const result = resolveDreamWeaverCombatRound(s, stance); s.combatHistory.push(result.round); vi.restoreAllMocks();
  settleDreamWeaverEncounter(s, result.outcome, context); return result;
}
afterEach(() => vi.restoreAllMocks());
describe('Dream Weaver independent original encounter', () => {
  it('has one original45-year-old G3 caster with independent H/M/S and a single original club', () => {
    const s = fixture(), e = createDreamWeaverEncounterState();
    expect(e).toMatchObject({ status: 'AVAILABLE', targetId: 'DWV3-OSMOND', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(projectDreamWeaverEncounter(s).enemy).toMatchObject({ name: '奥斯蒙德', age: 45, sequence: 3, weaponId: 'DWV3-OSMOND-CLUB' });
    expect(validateDreamWeaverEncounter(s)).toBe(true); expect(validateDreamWeaverEncounterCommand({ type: 'AID_ENEMY' })).toBe(true);
    expect(validateDreamWeaverEncounterCommand({ type: 'ENCOUNTER_FIGHT', resetEnemy: true })).toBe(false);
  });
  it('hides new people and the scene outside actual Audience3', () => {
    const s = fixture(); s.progression.sequence = 4; s.dreamWeaver.promotionWeek = null;
    const publicView = projectDreamWeaverEncounter(s); expect(publicView.enemy).toBeNull(); expect(publicView.story).toBe(''); expect(publicView.actions).toEqual([]); expect(publicView.facts).toEqual([]);
    expect(JSON.stringify(publicView)).not.toMatch(/OSMOND|奥斯蒙德|石院/); expect(validateDreamWeaverEncounter(s)).toBe(true);
  });
  it('reserves an explicit fight choice, supports ordinary peaceful exit and cannot reset the original', () => {
    const s = fixture(), old = structuredClone(s.manipulator), history = structuredClone(s.combatHistory);
    s.actionsRemaining = 1; expect(blockDreamWeaverEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留');
    s.actionsRemaining = 2; applyDreamWeaverEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context);
    expect(s.actionsRemaining).toBe(1); expect(hasDreamWeaverEncounterLock(s)).toBe(true); expect(s.combat).toBeNull();
    applyDreamWeaverEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context); expect(s.actionsRemaining).toBe(1); expect(hasDreamWeaverEncounterLock(s)).toBe(false);
    expect(s.dreamWeaver.encounter.status).toBe('RESOLVED'); expect(blockDreamWeaverEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    expect(s.manipulator).toEqual(old); expect(s.combatHistory).toEqual(history); expect(validateDreamWeaverEncounter(s)).toBe(true);
  });
  it('blocks unrelated preparation, wrong city, absent current mental capacity and forged bodies', () => {
    for (const change of [(s: SliceState) => { s.dreamWeaver.preparedWeek = s.week; }, (s: SliceState) => { s.world.city = 'TINGEN'; }, (s: SliceState) => { s.mind = 0; }]) {
      const s = fixture(); change(s); expect(blockDreamWeaverEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    }
    const s = fixture(); start(s); expect(hasDreamWeaverDisputeOpponent(s)).toBe(true);
    s.dreamWeaver.encounter.targetId = 'MP4-RULAN' as 'DWV3-OSMOND'; expect(hasDreamWeaverDisputeOpponent(s)).toBe(false); expect(validateDreamWeaverEncounter(s)).toBe(false);
  });
  it('really leaves on the ordinary exit without borrowing the old surrendered Rulan or restoring SP', () => {
    const s = fixture(), old = structuredClone(s.manipulator), historyLength = s.combatHistory.length; start(s);
    expect(s.dreamWeaver.encounter.startHistoryIndex).toBe(historyLength); expect(s.combat?.encounterId).toBe('DREAM_WEAVER_DISPUTE');
    const result = round(s, 'RETREAT', 1, 1, 1);
    expect(result.outcome).toBe('RETREATED'); expect(s.combat).toBeNull(); expect(s.dreamWeaver.encounter.status).toBe('RETREATED');
    expect(s.dreamWeaver.encounter).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(s.manipulator).toEqual(old); expect(s.manipulator.encounter).toMatchObject({ mentalPlague: 0, enemy: { health: 100, mind: 0, status: 'SURRENDERED', weaponLocation: 'YARD' } });
    expect(validateDreamWeaverEncounter(s)).toBe(true);
  });
  it('keeps infection after retreat and pays time/money for new original voluntary stability once per real week', () => {
    const s = fixture(), old = structuredClone(s.manipulator); start(s);
    expect(round(s, 'ATTACK', 1, 1, 355, 1, 91, 1).outcome).toBe('CONTINUE'); expect(validateDreamWeaverEncounter(s)).toBe(true);
    expect(round(s, 'RETREAT', 1, 1, 91, 1).outcome).toBe('RETREATED');
    expect(s.dreamWeaver.encounter).toMatchObject({ mentalPlague: 2, enemyMind: 96, enemyHealth: 100 }); expect(validateDreamWeaverEncounter(s)).toBe(true);
    s.actionsRemaining = 2; const cash = s.cash, mind = s.dreamWeaver.encounter.enemyMind;
    applyDreamWeaverEncounterCommand(s, { type: 'AID_ENEMY' }, context);
    expect(s.cash).toBe(cash - 40); expect(s.actionsRemaining).toBe(1); expect(s.dreamWeaver.encounter.mentalPlague).toBe(1); expect(s.dreamWeaver.encounter.enemyMind).toBe(mind);
    expect(blockDreamWeaverEncounter(s, { type: 'AID_ENEMY' })).toContain('本真实周'); expect(validateDreamWeaverEncounter(s)).toBe(true);
    s.week++; s.actionsRemaining = 1; applyDreamWeaverEncounterCommand(s, { type: 'AID_ENEMY' }, context);
    expect(s.dreamWeaver.encounter.mentalPlague).toBe(0); expect(s.dreamWeaver.encounter.enemyMind).toBe(mind); expect(s.manipulator).toEqual(old);
    expect(s.dreamWeaver.encounter.helpHistory.map(h => [h.before, h.after, h.fee])).toEqual([[2, 1, 40], [1, 0, 40]]); expect(validateDreamWeaverEncounter(s)).toBe(true);
  });
  it('does not fabricate a terminal without the actual matching current round', () => {
    const s = fixture(); start(s); expect(() => settleDreamWeaverEncounter(s, 'ENEMY_SURRENDERED', context)).toThrow();
    script(1, 1, 1); const result = resolveDreamWeaverCombatRound(s, 'RETREAT'); vi.restoreAllMocks();
    expect(() => settleDreamWeaverEncounter(s, result.outcome, context)).toThrow(); s.combatHistory.push(result.round);
    settleDreamWeaverEncounter(s, result.outcome, context); expect(validateDreamWeaverEncounter(s)).toBe(true);
    s.dreamWeaver.encounter.enemySpirituality--; expect(validateDreamWeaverEncounter(s)).toBe(false);
  });
  it('keeps common physical death possible without identity substitution or resurrection', () => {
    const s = fixture(), old = structuredClone(s.manipulator); start(s);
    const result = round(s, 'ATTACK', 1, 1, 410, 1, 1_000_000, 100);
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.dreamWeaver.encounter.status).toBe('LOST'); expect(s.dreamWeaver.encounter.enemyHealth).toBe(100);
    expect(s.manipulator).toEqual(old); expect(s.combat).toBeNull(); expect(validateDreamWeaverEncounter(s)).toBe(true);
    expect(blockDreamWeaverEncounter(s, { type: 'AID_ENEMY' })).not.toBeNull();
  });
  it('rejects forged post-battle infection healing, owner mind ledger and enemy power charges', () => {
    const s = fixture(); start(s); round(s, 'ATTACK', 1, 1, 355, 1, 91, 1); round(s, 'RETREAT', 1, 1, 91, 1);
    for (const edit of [(x: SliceState) => { x.dreamWeaver.encounter.mentalPlague = 0; }, (x: SliceState) => { x.dreamWeaver.encounter.totalOwnerMindSpent = 2; },
      (x: SliceState) => { x.dreamWeaver.encounter.powerUses.COMPOSE++; }, (x: SliceState) => { x.dreamWeaver.encounter.helpHistory.push({ week: x.week, before: 2, after: 0, fee: 40 }); }]) {
      const forged = structuredClone(s); edit(forged); expect(validateDreamWeaverEncounter(forged)).toBe(false);
    }
  });
});
