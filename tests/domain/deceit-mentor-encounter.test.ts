import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { baseAdvantage } from '../../src/domain/slice/combat.js';
import { resolveDeceitMentorCombatRound } from '../../src/domain/slice/deceit-mentor-combat.js';
import { applyDeceitMentorCommand, createDeceitMentorState } from '../../src/domain/deceit-mentor/index.js';
import {
  createDeceitMentorEncounterState, applyDeceitMentorEncounterCommand, blockDeceitMentorEncounter,
  projectDeceitMentorEncounter, validateDeceitMentorEncounter, validateDeceitMentorEncounterCommand,
  hasDeceitMentorDisputeOpponent, hasDeceitMentorEncounterLock, settleDeceitMentorEncounter,
} from '../../src/domain/deceit-mentor/encounter.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No free scene check'); } };
/** Directed S3 arrangement on the genuine natural352-command S4 prefix.
 * Only the S3 unit promotion/resources are arranged; existing original histories remain. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/parasite-v01280/natural.json', 'utf8')).final);
  s.deceitMentor = createDeceitMentorState(); applyDeceitMentorCommand(s, { type: 'LEARN_GUIDANCE' }, context);
  s.deceitMentor.promotionWeek = s.week; s.deceitMentor.parasiteActingAtPromotion = 100;
  s.progression.sequence = 3; s.progression.acting = 0;
  s.progression.mastery['error.s3.law-deceit'] = 0; s.progression.mastery['error.s3.deep-deception'] = 0;
  s.character.coreStats.knowledge = 30;
  s.actionsRemaining = 3; s.spirituality = 120; s.health = 100; s.mind = 100; s.activeEvent = null; s.combat = null; return s;
}
function talk(s: SliceState) { applyDeceitMentorEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); }
function start(s: SliceState) { talk(s); applyDeceitMentorEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); }
function script(...values: number[]) { let index = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${index}: ${n}, ${min}..${max}`); return n;
  }); }
function round(s: SliceState, stance: 'ATTACK' | 'RETREAT', ...values: number[]) {
  script(...values); const result = resolveDeceitMentorCombatRound(s, stance); s.combatHistory.push(result.round); vi.restoreAllMocks();
  settleDeceitMentorEncounter(s, result.outcome, context); return result;
}
const legacy = (s: SliceState) => structuredClone({ marauder: s.marauder, swindler: s.swindler, cryptologist: s.cryptologist,
  fireThief: s.fireThief, dreamStealer: s.dreamStealer, parasite: s.parasite, town: s.town });
afterEach(() => vi.restoreAllMocks());

describe('DeceitMentor original Gideon47 encounter and common consequences', () => {
  it('creates independent Gideon47 H100/M100/S120 while Ralf remains surrendered with his own original club', () => {
    const s = fixture(), old = legacy(s);
    expect(createDeceitMentorEncounterState()).toMatchObject({ targetId: 'DM3-GIDEON', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120,
      enemyStatus: 'RESISTING', weaponLocation: 'HAND', scene: { courtId: 'DM3-COURT', ordinaryExit: 'OPEN', clearanceConfirmed: false }, powerUses: { FORCE_STRIKE: 0, GUARD: 0, DISCERN: 0 } });
    expect(projectDeceitMentorEncounter(s).enemy).toMatchObject({ name: '吉迪恩·哈特', age: 47, sequence: 3, weaponId: 'DM3-GIDEON-ROD', source: 'ORIGINAL_LIMITED_G' });
    expect(s.parasite.encounter).toMatchObject({ targetId: 'PR4-RALF-TOREN', enemyHealth: 70, enemyStatus: 'SURRENDERED', enemySpirituality: 25,
      weapon: { id: 'PR4-RALF-CLUB', location: 'YARD' }, borrowed: [] });
    expect(s.parasite.life.player.presence).toBe('OUTSIDE'); expect(s.parasite.life.host.control).toBe('HOST');
    expect(legacy(s)).toEqual(old); expect(validateDeceitMentorEncounter(s)).toBe(true);
  });
  it('requires real talk1AP and independent explicit fight1AP without automatic combat', () => {
    const s = fixture(); expect(blockDeceitMentorEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toContain('先实际交谈');
    s.actionsRemaining = 1; expect(blockDeceitMentorEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留'); s.actionsRemaining = 2;
    talk(s); expect(s.actionsRemaining).toBe(1); expect(s.combat).toBeNull(); expect(hasDeceitMentorEncounterLock(s)).toBe(true);
    applyDeceitMentorEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context);
    expect(s.actionsRemaining).toBe(0); expect(hasDeceitMentorDisputeOpponent(s)).toBe(true); expect(validateDeceitMentorEncounter(s)).toBe(true);
  });
  it('hides new opponent facts and actions before actual S3', () => {
    const s = fixture(); s.progression.sequence = 4; s.deceitMentor.promotionWeek = null;
    const view = projectDeceitMentorEncounter(s); expect(view.enemy).toBeNull(); expect(view.story).toBe(''); expect(view.facts).toEqual([]); expect(view.actions).toEqual([]);
    expect(view.scene).toBeNull(); expect(JSON.stringify(view)).not.toMatch(/GIDEON|吉迪恩|原杖/); expect(validateDeceitMentorEncounter(s)).toBe(true);
  });
  it('allows peaceful0AP exit even at mind0, preserving refusal, original resources and all legacy bodies', () => {
    const s = fixture(), old = legacy(s), life = structuredClone(s.deceitMentor.life), history = structuredClone(s.combatHistory);
    talk(s); s.actionsRemaining = 0; s.mind = 0; s.spirituality = 87;
    applyDeceitMentorEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context);
    expect(legacy(s)).toEqual(old); expect(s.deceitMentor.life).toEqual(life); expect(s.combatHistory).toEqual(history);
    expect(s.deceitMentor.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'RESISTING', enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(hasDeceitMentorEncounterLock(s)).toBe(false); expect(validateDeceitMentorEncounter(s)).toBe(true); expect(s.progression.acting).toBe(0); expect(s.spirituality).toBe(87);
    s.mind = 100; s.actionsRemaining = 3; expect(blockDeceitMentorEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('不重新');
  });
  it('rejects extra command authority, wrong city and substituting old Ralf for original Gideon', () => {
    expect(validateDeceitMentorEncounterCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    expect(validateDeceitMentorEncounterCommand({ type: 'ENCOUNTER_FIGHT', replaceOldTarget: true })).toBe(false);
    const s = fixture(); s.world.city = 'TINGEN'; expect(blockDeceitMentorEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.world.city = 'BACKLUND'; start(s); s.deceitMentor.encounter.targetId = 'PR4-RALF-TOREN' as 'DM3-GIDEON';
    expect(hasDeceitMentorDisputeOpponent(s)).toBe(false); expect(validateDeceitMentorEncounter(s)).toBe(false);
  });
  it('requires actual cleanup of old contact, deferred decision, prepared case and current original-object work', () => {
    const mutations: ((s: SliceState) => void)[] = [s => { s.parasite.life.player.presence = 'INSIDE_HOST'; },
      s => { s.dreamStealer.practice.targetPaused = true; }, s => { s.parasite.life.thought.pending = 'SIT_ON_PR4_CHAIR_1'; },
      s => { s.parasite.life.cases['shared-senses'].status = 'PREPARED'; }, s => { s.deceitMentor.life.cases['spent-lamp'].status = 'PREPARED'; },
      s => { s.deceitMentor.preparedWeek = s.week; }];
    for (const mutate of mutations) { const s = fixture(); mutate(s); const before = structuredClone(s);
      expect(() => applyDeceitMentorEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context)).toThrow(); expect(s).toEqual(before); }
  });
  it('requires actual original guidance and promotion', () => {
    const s = fixture(); s.deceitMentor.guidanceKnown = false; expect(blockDeceitMentorEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.deceitMentor.guidanceKnown = true; s.deceitMentor.promotionWeek = null; expect(blockDeceitMentorEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.deceitMentor.promotionWeek = s.week; talk(s); expect(validateDeceitMentorEncounter(s)).toBe(true);
  });
  it('actually confirms the original dry court clearance and rejects invented third-party absence', () => {
    const s = fixture(); expect(s.deceitMentor.encounter.scene.clearanceConfirmed).toBe(false); talk(s);
    expect(s.deceitMentor.encounter.scene.clearanceConfirmed).toBe(true); s.deceitMentor.encounter.scene.clearanceConfirmed = false;
    expect(blockDeceitMentorEncounter(s, { type: 'ENCOUNTER_FIGHT' })).not.toBeNull();
    const occupied = fixture(); occupied.deceitMentor.encounter.scene.thirdPartiesInArea = 1 as 0;
    expect(blockDeceitMentorEncounter(occupied, { type: 'ENCOUNTER_TALK' })).not.toBeNull(); expect(validateDeceitMentorEncounter(occupied)).toBe(false);
  });
  it('ordinary retreat preserves old Ralf and host, both original weapons, wounds and spent spirituality', () => {
    const s = fixture(), old = legacy(s); s.spirituality = 93; start(s);
    const result = round(s, 'RETREAT', 1, 1, 1); expect(result.outcome).toBe('RETREATED'); expect(s.combat).toBeNull();
    expect(s.deceitMentor.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(legacy(s)).toEqual(old); expect(s.spirituality).toBe(93); expect(s.deceitMentor.life.clockSeconds).toBe(60); expect(validateDeceitMentorEncounter(s)).toBe(true);
  });
  it('retains35/25/25/15 core1250/floor125 and recovers12S only for CONTINUE', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 100; start(s);
    const result = round(s, 'ATTACK', 1, 1, 281, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(baseAdvantage(22, 100, 100, 100, 1250, 120));
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 120, 1250, 120) - 22.5 - 10);
    expect(result.round.consequenceWeights).toBeNull(); expect(s.spirituality).toBe(112); expect(validateDeceitMentorEncounter(s)).toBe(true);
    const end = round(s, 'RETREAT', 1, 1, 100, 1); expect(end.outcome).toBe('RETREATED'); expect(s.spirituality).toBe(112);
    expect(s.deceitMentor.life.clockSeconds).toBe(120); expect(validateDeceitMentorEncounter(s)).toBe(true);
  });
  it('carries independent enemy paid resources, actual wounds and clocks across successive rounds', () => {
    const s = fixture(); s.spirituality = 100; start(s);
    const first = round(s, 'ATTACK', 1, 1, 181, 36, 1, 1);
    expect(first.outcome).toBe('CONTINUE'); expect(s.deceitMentor.encounter.enemyHealth).toBe(90); expect(s.deceitMentor.encounter.enemySpirituality).toBe(116);
    expect(s.spirituality).toBe(112); expect(validateDeceitMentorEncounter(s)).toBe(true);
    const second = round(s, 'ATTACK', 1, 1, 36, 281, 1);
    expect(second.round.deceitMentorOutcome!.source).toMatchObject({ enemyHealth: 90, enemySpirituality: 116, lifeClockSeconds: 60, powerUses: { GUARD: 1 } });
    expect(second.round.deceitMentorOutcome!.source.enemyInjuries).toHaveLength(1);
    expect(s.deceitMentor.encounter.enemySpirituality).toBe(112); expect(s.spirituality).toBe(120); expect(s.deceitMentor.life.clockSeconds).toBe(120); expect(validateDeceitMentorEncounter(s)).toBe(true);
  });
  it.each([[1, 36], [101, 30]] as const)('new deceit draw%s reduces%s without any injury/control wheel or forced surrender', (draw, reduction) => {
    const s = fixture(), old = legacy(s); start(s); const result = round(s, 'ATTACK', 1, 1, draw, 1, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.consequenceWeights).toBeNull();
    expect(s.deceitMentor.encounter).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING' });
    expect(result.round.deceitMentorOutcome!.playerActions[0]).toMatchObject({ selfGain: 0, enemyReduction: reduction, threatens: false, paidCost: 6 });
    expect(legacy(s)).toEqual(old); expect(validateDeceitMentorEncounter(s)).toBe(true);
  });
  it('failed new deceit retains6S cost and only legitimate CONTINUE replenishes12', () => {
    const s = fixture(); s.spirituality = 100; start(s); const result = round(s, 'ATTACK', 1, 1, 1, 100, 100, 1);
    expect(result.round.deceitMentorOutcome!.playerActions[0]).toMatchObject({ paidCost: 6, enemyReduction: 0, fallback: 'NONE', threatens: false });
    expect(result.round.consequenceWeights).toBeNull(); expect(s.spirituality).toBe(106); expect(validateDeceitMentorEncounter(s)).toBe(true);
  });
  it('the common death wheel can kill only actual new Gideon while old original histories stay intact', () => {
    const s = fixture(), old = legacy(s); start(s); const result = round(s, 'ATTACK', 1, 1, 181, 100, 1, 100);
    expect(result.outcome).toBe('ENEMY_DEAD'); expect(s.deceitMentor.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 0, enemyStatus: 'DEAD', weaponLocation: 'COURT' });
    expect(legacy(s)).toEqual(old); expect(s.progression.acting).toBe(0); expect(s.spirituality).toBe(120); expect(validateDeceitMentorEncounter(s)).toBe(true);
  });
  it('common heavy injury yields living Gideon surrender with the same original rod left in his court', () => {
    const s = fixture(), old = legacy(s); start(s); const result = round(s, 'ATTACK', 1, 1, 181, 1, 1, 70);
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(s.deceitMentor.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 70, enemyStatus: 'SURRENDERED', weaponLocation: 'COURT', enemySpirituality: 115 });
    expect(legacy(s)).toEqual(old); expect(s.deceitMentor.encounter.enemyInjuries).toHaveLength(1); expect(validateDeceitMentorEncounter(s)).toBe(true);
  });
  it('common player death remains real and leaves enemy spent S and old original characters untouched', () => {
    const s = fixture(), old = legacy(s); start(s); const result = round(s, 'ATTACK', 1, 1, 281, 1, 1_000_000, 100); s.status = 'DEAD';
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.combat).toBeNull();
    expect(s.deceitMentor.encounter).toMatchObject({ status: 'LOST', enemyHealth: 100, enemySpirituality: 115, weaponLocation: 'HAND' });
    expect(legacy(s)).toEqual(old); expect(validateDeceitMentorEncounter(s)).toBe(true);
  });
  it('rejects invented terminal victory and silent enemyS refill without actual power history', () => {
    const s = fixture(); start(s); expect(() => settleDeceitMentorEncounter(s, 'ENEMY_DEAD', context)).toThrow();
    expect(() => settleDeceitMentorEncounter(s, 'AUTO_WIN', context)).toThrow(); expect(s.deceitMentor.encounter.status).toBe('FIGHTING');
    s.deceitMentor.encounter.enemySpirituality--; expect(hasDeceitMentorDisputeOpponent(s)).toBe(false); expect(validateDeceitMentorEncounter(s)).toBe(false);
  });
  it('saved history rejects altered costs, injury, clearance, count, sequence and life clock', () => {
    const s = fixture(); start(s); round(s, 'ATTACK', 1, 1, 181, 36, 1, 1); expect(validateDeceitMentorEncounter(s)).toBe(true);
    const mutations: ((copy: SliceState) => void)[] = [copy => { copy.deceitMentor.encounter.enemySpirituality = 120; },
      copy => { copy.combatHistory.at(-1)!.deceitMentorOutcome!.enemyActions[0]!.paidCost = 0; },
      copy => { copy.combatHistory.at(-1)!.deceitMentorOutcome!.playerActions[0]!.threatens = false; },
      copy => { copy.deceitMentor.encounter.scene.clearanceConfirmed = false; }, copy => { copy.deceitMentor.encounter.weaponLocation = 'COURT'; },
      copy => { copy.deceitMentor.encounter.enemyInjuries = []; }, copy => { copy.spirituality--; }, copy => { copy.deceitMentor.life.clockSeconds--; },
      copy => { copy.combatHistory.at(-1)!.first = 'ENEMY'; }, copy => { copy.combatHistory.at(-1)!.playerCountRoll = 100; },
      copy => { copy.combatHistory.at(-1)!.deceitMentorOutcome!.playerActions[0]!.order = 1; }];
    for (const mutate of mutations) { const copy = structuredClone(s); mutate(copy); expect(validateDeceitMentorEncounter(copy)).toBe(false); }
  });
});
