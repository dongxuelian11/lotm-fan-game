import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { baseAdvantage } from '../../src/domain/slice/combat.js';
import { resolveJusticeMentorCombatRound } from '../../src/domain/slice/justice-mentor-combat.js';
import { createJusticeMentorState } from '../../src/domain/justice-mentor/index.js';
import {
  createJusticeMentorEncounterState, applyJusticeMentorEncounterCommand, blockJusticeMentorEncounter,
  projectJusticeMentorEncounter, validateJusticeMentorEncounter, validateJusticeMentorEncounterCommand,
  hasJusticeMentorDisputeOpponent, hasJusticeMentorEncounterLock, settleJusticeMentorEncounter,
} from '../../src/domain/justice-mentor/encounter.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No free scene check'); } };
/** Directed S3 fixture keeps the actual S4 Edmund surrender, old people and original materials unchanged. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/unshadowed-v01250/natural.json', 'utf8')).final);
  s.justiceMentor = createJusticeMentorState(); s.justiceMentor.promotionWeek = s.week; s.progression.sequence = 3; s.progression.acting = 0;
  s.character.coreStats.knowledge = 30; s.character.coreStats.will = 30;
  s.actionsRemaining = 3; s.spirituality = 120; s.health = 100; s.mind = 100; s.activeEvent = null; s.combat = null; return s;
}
function talk(s: SliceState) { applyJusticeMentorEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); }
function start(s: SliceState) { talk(s); applyJusticeMentorEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); }
function script(...values: number[]) { let index = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${index}: ${n}, ${min}..${max}`); return n;
  }); }
function round(s: SliceState, stance: 'ATTACK' | 'RETREAT', ...values: number[]) {
  script(...values); const result = resolveJusticeMentorCombatRound(s, stance); s.combatHistory.push(result.round); vi.restoreAllMocks();
  settleJusticeMentorEncounter(s, result.outcome, context); return result;
}
afterEach(() => vi.restoreAllMocks());

describe('Justice Mentor independent original Corwin49 encounter and common consequences', () => {
  it('creates independent Corwin49 H100/M100/S120 with a different original club while old Edmund remains surrendered', () => {
    const s = fixture(), old = structuredClone(s.unshadowed), older = structuredClone(s.priestOfLight);
    expect(createJusticeMentorEncounterState()).toMatchObject({ targetId: 'JM3-CORWIN', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120,
      enemyStatus: 'RESISTING', weaponLocation: 'HAND', scene: { courtId: 'JM3-COURT', ordinaryExit: 'OPEN', clearanceConfirmed: false }, powerUses: { LIGHT_STRIKE: 0, LIGHT_WARD: 0, FOCUS: 0 } });
    expect(projectJusticeMentorEncounter(s).enemy).toMatchObject({ name: '科温', age: 49, sequence: 3, weaponId: 'JM3-CORWIN-CLUB' });
    expect(projectJusticeMentorEncounter(s).story).toContain('不赋予太阳自动友军免疫');
    expect(s.unshadowed.encounter.enemy).toMatchObject({ id: 'UD4-EDMUND', age: 47, health: 60, status: 'SURRENDERED', weaponLocation: 'COURTYARD' });
    expect(s.unshadowed.life.ally).toMatchObject({ location: 'LOW', moves: 3, returns: 3 });
    expect(s.unshadowed.life.characteristic).toMatchObject({ contamination: 0, containment: 'BENCH' });
    expect(s.unshadowed.life.tile).toMatchObject({ scorchMarks: 1, coolingSeconds: 60 });
    expect(s.unshadowed).toEqual(old); expect(s.priestOfLight).toEqual(older); expect(validateJusticeMentorEncounter(s)).toBe(true);
  });
  it('requires actual talk1AP followed by separately explicit fight1AP and preserves the real old returned-emotion OUTSIDE endpoint', () => {
    const s = fixture(); expect(s.unshadowed.ritual.playerLocation).toBe('OUTSIDE');
    expect(blockJusticeMentorEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toContain('先实际交谈');
    s.actionsRemaining = 1; expect(blockJusticeMentorEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留'); s.actionsRemaining = 2;
    talk(s); expect(s.actionsRemaining).toBe(1); expect(s.combat).toBeNull(); expect(hasJusticeMentorEncounterLock(s)).toBe(true);
    applyJusticeMentorEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context);
    expect(s.actionsRemaining).toBe(0); expect(hasJusticeMentorDisputeOpponent(s)).toBe(true); expect(validateJusticeMentorEncounter(s)).toBe(true);
  });
  it('hides new opponent facts and actions before actual S3', () => {
    const s = fixture(); s.progression.sequence = 4; s.justiceMentor.promotionWeek = null;
    const view = projectJusticeMentorEncounter(s); expect(view.enemy).toBeNull(); expect(view.story).toBe(''); expect(view.facts).toEqual([]); expect(view.actions).toEqual([]);
    expect(view.scene).toBeNull(); expect(JSON.stringify(view)).not.toMatch(/CORWIN|科温|原棍/); expect(validateJusticeMentorEncounter(s)).toBe(true);
  });
  it('permits real peaceful0AP exit despite low mind without reward, refill or reopening the opponent', () => {
    const s = fixture(), old = structuredClone(s.unshadowed), life = structuredClone(s.justiceMentor.life), history = structuredClone(s.combatHistory);
    talk(s); s.actionsRemaining = 0; s.mind = 0; s.spirituality = 87;
    applyJusticeMentorEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context);
    expect(s.unshadowed).toEqual(old); expect(s.justiceMentor.life).toEqual(life); expect(s.combatHistory).toEqual(history);
    expect(s.justiceMentor.encounter.status).toBe('RESOLVED'); expect(hasJusticeMentorEncounterLock(s)).toBe(false);
    expect(validateJusticeMentorEncounter(s)).toBe(true); expect(s.progression.acting).toBe(0); expect(s.spirituality).toBe(87);
    s.mind = 100; s.actionsRemaining = 3; expect(blockJusticeMentorEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('不重新');
  });
  it('rejects extra command authority, wrong city and a substituted old surrendered opponent', () => {
    expect(validateJusticeMentorEncounterCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    expect(validateJusticeMentorEncounterCommand({ type: 'ENCOUNTER_FIGHT', replaceEdmund: true })).toBe(false);
    const s = fixture(); s.world.city = 'TINGEN'; expect(blockJusticeMentorEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.world.city = 'BACKLUND'; start(s); s.justiceMentor.encounter.targetId = 'UD4-EDMUND' as 'JM3-CORWIN';
    expect(hasJusticeMentorDisputeOpponent(s)).toBe(false); expect(validateJusticeMentorEncounter(s)).toBe(false);
  });
  it('requires cleanup of old original bodies, rituals, heat, borrowed props and prepared cases', () => {
    const mutations: ((s: SliceState) => void)[] = [s => { s.unshadowed.life.ally.location = 'OUTSIDE'; },
      s => { s.unshadowed.ritual.playerLocation = 'HALL'; }, s => { s.unshadowed.life.tile.heat = 'HOT'; },
      s => { s.unshadowed.life.cases['open-domain'].status = 'PREPARED'; },
      s => { s.justiceMentor.life.cases['paired-lift'].status = 'PREPARED'; }, s => { s.justiceMentor.preparedWeek = s.week; }];
    for (const mutate of mutations) { const s = fixture(); mutate(s); const before = structuredClone(s);
      expect(() => applyJusticeMentorEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context)).toThrow(); expect(s).toEqual(before); }
  });
  it('actually confirms the cleared original court before fighting and rejects fabricated clearance', () => {
    const s = fixture(); expect(s.justiceMentor.encounter.scene.clearanceConfirmed).toBe(false); talk(s);
    expect(s.justiceMentor.encounter.scene.clearanceConfirmed).toBe(true); s.justiceMentor.encounter.scene.clearanceConfirmed = false;
    expect(blockJusticeMentorEncounter(s, { type: 'ENCOUNTER_FIGHT' })).not.toBeNull();
    const occupied = fixture(); occupied.justiceMentor.encounter.scene.thirdPartiesInArea = 1 as 0;
    expect(blockJusticeMentorEncounter(occupied, { type: 'ENCOUNTER_TALK' })).not.toBeNull(); expect(validateJusticeMentorEncounter(occupied)).toBe(false);
  });
  it('ordinary retreat preserves old surrendered Edmund, both original clubs, independent resources and wounds', () => {
    const s = fixture(), old = structuredClone(s.unshadowed), older = structuredClone(s.priestOfLight); s.spirituality = 93; start(s);
    const result = round(s, 'RETREAT', 1, 1, 1); expect(result.outcome).toBe('RETREATED'); expect(s.combat).toBeNull();
    expect(s.justiceMentor.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(s.unshadowed).toEqual(old); expect(s.priestOfLight).toEqual(older); expect(s.spirituality).toBe(93); expect(validateJusticeMentorEncounter(s)).toBe(true);
  });
  it('retains actual35/25/25/15 core1250/floor125 and restores12 only after CONTINUE', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 100; start(s);
    const result = round(s, 'ATTACK', 1, 1, 346, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(baseAdvantage(22, 100, 100, 100, 1250, 120));
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 120, 1250, 120) - 22.5 - 10);
    expect(result.round.consequenceWeights).toBeNull(); expect(s.spirituality).toBe(112); expect(validateJusticeMentorEncounter(s)).toBe(true);
    const end = round(s, 'RETREAT', 1, 1, 100, 1); expect(end.outcome).toBe('RETREATED'); expect(s.spirituality).toBe(112);
    expect(validateJusticeMentorEncounter(s)).toBe(true);
  });
  it('carries independent paid enemy resources and real injuries across consecutive rounds', () => {
    const s = fixture(); s.spirituality = 100; start(s);
    const first = round(s, 'ATTACK', 1, 1, 266, 1, 36, 1, 1);
    expect(first.outcome).toBe('CONTINUE'); expect(s.justiceMentor.encounter.enemyHealth).toBe(90); expect(s.justiceMentor.encounter.enemySpirituality).toBe(116);
    expect(s.spirituality).toBe(106); expect(validateJusticeMentorEncounter(s)).toBe(true);
    const second = round(s, 'ATTACK', 1, 1, 36, 346, 1);
    expect(second.round.justiceMentorOutcome!.source.enemyHealth).toBe(90); expect(second.round.justiceMentorOutcome!.source.enemySpirituality).toBe(116);
    expect(second.round.justiceMentorOutcome!.source.enemyInjuries).toHaveLength(1); expect(second.round.justiceMentorOutcome!.source.powerUses.LIGHT_WARD).toBe(1);
    expect(s.justiceMentor.encounter.enemySpirituality).toBe(112); expect(s.spirituality).toBe(118); expect(validateJusticeMentorEncounter(s)).toBe(true);
  });
  it('clarity reduction without actual threatening attacks does not get a separate injury or mental wheel', () => {
    const s = fixture(); start(s); const result = round(s, 'ATTACK', 1, 1, 126, 1, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.consequenceWeights).toBeNull();
    expect(s.justiceMentor.encounter).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING' });
    expect(result.round.justiceMentorOutcome!.playerActions[0]!.enemyReduction).toBe(32); expect(validateJusticeMentorEncounter(s)).toBe(true);
  });
  it('shared self-encouragement alone cannot create an injury or summon another attacker', () => {
    const s = fixture(); start(s); const result = round(s, 'ATTACK', 1, 1, 1, 1, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.consequenceWeights).toBeNull();
    expect(result.round.justiceMentorOutcome!.playerActions[0]).toMatchObject({ selfGain: 65, threatens: false });
    expect(s.justiceMentor.encounter.enemyHealth).toBe(100); expect(validateJusticeMentorEncounter(s)).toBe(true);
  });
  it('the common death wheel kills only new Corwin and preserves actual old Edmund surrender and originals', () => {
    const s = fixture(), old = structuredClone(s.unshadowed), older = structuredClone(s.priestOfLight); start(s);
    const result = round(s, 'ATTACK', 1, 1, 266, 1, 100, 1, 100);
    expect(result.outcome).toBe('ENEMY_DEAD'); expect(s.justiceMentor.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 0, enemyStatus: 'DEAD', weaponLocation: 'COURT' });
    expect(s.unshadowed).toEqual(old); expect(s.priestOfLight).toEqual(older); expect(s.progression.acting).toBe(0); expect(s.spirituality).toBe(114);
    expect(validateJusticeMentorEncounter(s)).toBe(true);
  });
  it('common heavy injury produces living Corwin surrender with his same original club left in this court', () => {
    const s = fixture(), old = structuredClone(s.unshadowed); start(s);
    const result = round(s, 'ATTACK', 1, 1, 266, 1, 1, 1, 70);
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(s.justiceMentor.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 70, enemyStatus: 'SURRENDERED', weaponLocation: 'COURT', enemySpirituality: 115 });
    expect(s.unshadowed).toEqual(old); expect(s.justiceMentor.encounter.enemyInjuries).toHaveLength(1); expect(s.spirituality).toBe(114); expect(validateJusticeMentorEncounter(s)).toBe(true);
  });
  it('common player death remains real and does not rewrite Edmund or reset Corwin resources', () => {
    const s = fixture(), old = structuredClone(s.unshadowed); start(s);
    const result = round(s, 'ATTACK', 1, 1, 346, 1, 1_000_000, 100); s.status = 'DEAD';
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.combat).toBeNull();
    expect(s.justiceMentor.encounter).toMatchObject({ status: 'LOST', enemyHealth: 100, enemySpirituality: 115, weaponLocation: 'HAND' });
    expect(s.unshadowed).toEqual(old); expect(validateJusticeMentorEncounter(s)).toBe(true);
  });
  it('rejects forged terminals and a pool silently refilled without actual paid history', () => {
    const s = fixture(); start(s); expect(() => settleJusticeMentorEncounter(s, 'ENEMY_DEAD', context)).toThrow();
    expect(() => settleJusticeMentorEncounter(s, 'AUTO_WIN', context)).toThrow(); expect(s.justiceMentor.encounter.status).toBe('FIGHTING');
    s.justiceMentor.encounter.enemySpirituality--; expect(hasJusticeMentorDisputeOpponent(s)).toBe(false); expect(validateJusticeMentorEncounter(s)).toBe(false);
  });
  it('saved history rejects altered costs, court clearance, original injuries and silently refilled pools', () => {
    const s = fixture(); start(s); round(s, 'ATTACK', 1, 1, 266, 1, 36, 1, 1); expect(validateJusticeMentorEncounter(s)).toBe(true);
    const mutations: ((copy: SliceState) => void)[] = [copy => { copy.justiceMentor.encounter.enemySpirituality = 120; },
      copy => { copy.combatHistory.at(-1)!.justiceMentorOutcome!.enemyActions[0]!.paidCost = 0; },
      copy => { copy.combatHistory.at(-1)!.justiceMentorOutcome!.playerActions[0]!.paidCost = 0; },
      copy => { copy.justiceMentor.encounter.scene.clearanceConfirmed = false; }, copy => { copy.justiceMentor.encounter.weaponLocation = 'COURT'; },
      copy => { copy.justiceMentor.encounter.enemyInjuries = []; }, copy => { copy.spirituality--; },
      copy => { copy.combatHistory.at(-1)!.first = 'ENEMY'; }, copy => { copy.combatHistory.at(-1)!.playerCountRoll = 100; },
      copy => { copy.combatHistory.at(-1)!.justiceMentorOutcome!.playerActions[0]!.order = 1; }];
    for (const mutate of mutations) { const copy = structuredClone(s); mutate(copy); expect(validateJusticeMentorEncounter(copy)).toBe(false); }
  });
});
