import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { baseAdvantage } from '../../src/domain/slice/combat.js';
import { resolveWandererCombatRound } from '../../src/domain/slice/wanderer-combat.js';
import { applyWandererCommand, createWandererState } from '../../src/domain/wanderer/index.js';
import {
  createWandererEncounterState, applyWandererEncounterCommand, blockWandererEncounter,
  projectWandererEncounter, validateWandererEncounter, validateWandererEncounterCommand,
  hasWandererDisputeOpponent, hasWandererEncounterLock, settleWandererEncounter,
} from '../../src/domain/wanderer/encounter.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No free scene check'); } };
/** Directed S3 unit setup starts from the explicitly directed S4 fixture and preserves its
 * original60-command history. It makes no claim of a natural ordinary-person-to-S3 replay. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/secrets-sorcerer-v01270/directed.json', 'utf8')).final);
  s.wanderer = createWandererState(); applyWandererCommand(s, { type: 'LEARN_GUIDANCE' }, context);
  s.wanderer.promotionWeek = s.week; s.wanderer.secretsSorcererActingAtPromotion = 100;
  s.progression.sequence = 3; s.progression.acting = 0;
  s.progression.mastery['door.s3.star-wandering'] = 0; s.progression.mastery['door.s3.astral-positioning'] = 0;
  s.character.coreStats.knowledge = 30; s.character.coreStats.perception = 30;
  s.actionsRemaining = 3; s.spirituality = 120; s.health = 100; s.mind = 100; s.activeEvent = null; s.combat = null; return s;
}
function talk(s: SliceState) { applyWandererEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); }
function start(s: SliceState) { talk(s); applyWandererEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); }
function script(...values: number[]) { let index = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${index}: ${n}, ${min}..${max}`); return n;
  }); }
function round(s: SliceState, stance: 'ATTACK' | 'RETREAT', ...values: number[]) {
  script(...values); const result = resolveWandererCombatRound(s, stance); s.combatHistory.push(result.round); vi.restoreAllMocks();
  settleWandererEncounter(s, result.outcome, context); return result;
}
afterEach(() => vi.restoreAllMocks());

describe('Wanderer independent original Cassian49 encounter and common consequences', () => {
  it('creates independent Cassian49 H100/M100/S120 while original A stays sealed and original B stays alive', () => {
    const s = fixture(), old = structuredClone(s.secretsSorcerer), records = structuredClone(s.recorder);
    expect(createWandererEncounterState()).toMatchObject({ targetId: 'WN3-CASSIAN', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120,
      enemyStatus: 'RESISTING', weaponLocation: 'HAND', scene: { courtId: 'WN3-COURT', ordinaryExit: 'OPEN', clearanceConfirmed: false, playerPosition: 'ORIGIN' }, powerUses: { VECTOR_STRIKE: 0, REFRACT_WARD: 0, PARALLAX: 0 } });
    expect(projectWandererEncounter(s).enemy).toMatchObject({ name: '卡西安·格里夫', age: 49, sequence: 3, weaponId: 'WN3-CASSIAN-ROD' });
    expect(s.secretsSorcerer.ritual.targets.find(t => t.id === 'SS4-ARCH-A')!.status).toBe('SEALED');
    expect(s.secretsSorcerer.ritual.targets.find(t => t.id === 'SS4-ARCH-B')!.body.health).toBeGreaterThan(0);
    expect(s.secretsSorcerer.ritual.cases.find(c => c.targetId === 'SS4-ARCH-A')!.custody).toBe('ARCHIVE');
    expect(s.secretsSorcerer).toEqual(old); expect(s.recorder).toEqual(records); expect(validateWandererEncounter(s)).toBe(true);
  });
  it('requires actual talk1AP followed by separately explicit fight1AP and preserves the real old ritual CLOSED endpoint', () => {
    const s = fixture(); expect(s.secretsSorcerer.ritual.phase).toBe('CLOSED');
    expect(blockWandererEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toContain('先实际交谈');
    s.actionsRemaining = 1; expect(blockWandererEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留'); s.actionsRemaining = 2;
    talk(s); expect(s.actionsRemaining).toBe(1); expect(s.combat).toBeNull(); expect(hasWandererEncounterLock(s)).toBe(true);
    applyWandererEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context);
    expect(s.actionsRemaining).toBe(0); expect(hasWandererDisputeOpponent(s)).toBe(true); expect(validateWandererEncounter(s)).toBe(true);
  });
  it('hides new opponent facts and actions before actual S3', () => {
    const s = fixture(); s.progression.sequence = 4; s.wanderer.promotionWeek = null;
    const view = projectWandererEncounter(s); expect(view.enemy).toBeNull(); expect(view.story).toBe(''); expect(view.facts).toEqual([]); expect(view.actions).toEqual([]);
    expect(view.scene).toBeNull(); expect(JSON.stringify(view)).not.toMatch(/CASSIAN|卡西安·格里夫|原杖/); expect(validateWandererEncounter(s)).toBe(true);
  });
  it('permits real peaceful0AP exit despite low mind without reward, refill or reopening the opponent', () => {
    const s = fixture(), old = structuredClone(s.secretsSorcerer), life = structuredClone(s.wanderer.life), history = structuredClone(s.combatHistory);
    talk(s); s.actionsRemaining = 0; s.mind = 0; s.spirituality = 87;
    applyWandererEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context);
    expect(s.secretsSorcerer).toEqual(old); expect(s.wanderer.life).toEqual(life); expect(s.combatHistory).toEqual(history);
    expect(s.wanderer.encounter.status).toBe('RESOLVED'); expect(hasWandererEncounterLock(s)).toBe(false);
    expect(validateWandererEncounter(s)).toBe(true); expect(s.progression.acting).toBe(0); expect(s.spirituality).toBe(87);
    s.mind = 100; s.actionsRemaining = 3; expect(blockWandererEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('不重新');
  });
  it('rejects extra command authority, wrong city and a substituted old S4 opponent', () => {
    expect(validateWandererEncounterCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    expect(validateWandererEncounterCommand({ type: 'ENCOUNTER_FIGHT', replaceOldTarget: true })).toBe(false);
    const s = fixture(); s.world.city = 'TINGEN'; expect(blockWandererEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.world.city = 'BACKLUND'; start(s); s.wanderer.encounter.targetId = 'SS4-ARCH-B' as 'WN3-CASSIAN';
    expect(hasWandererDisputeOpponent(s)).toBe(false); expect(validateWandererEncounter(s)).toBe(false);
  });
  it('requires cleanup of current preparation, remote travel and old suspended original pocket', () => {
    const mutations: ((s: SliceState) => void)[] = [s => { s.secretsSorcerer.life.room.hidden = true; },
      s => { s.secretsSorcerer.life.pocket.linked = true; }, s => { s.secretsSorcerer.life.cases['original-pocket'].suspended = true; },
      s => { s.secretsSorcerer.ritual.phase = 'PREPARED'; }, s => { s.wanderer.life.cases['anchor-check'].status = 'PREPARED'; },
      s => { s.wanderer.life.playerLocation = 'REMOTE'; }, s => { s.wanderer.preparedWeek = s.week; }];
    for (const mutate of mutations) { const s = fixture(); mutate(s); const before = structuredClone(s);
      expect(() => applyWandererEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context)).toThrow(); expect(s).toEqual(before); }
  });
  it('requires actual prior guidance and promotion without inventing a second era channel', () => {
    const s = fixture(); s.wanderer.guidanceKnown = false; expect(blockWandererEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.wanderer.guidanceKnown = true; s.wanderer.promotionWeek = null; expect(blockWandererEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.wanderer.promotionWeek = s.week; talk(s); expect(s.wanderer.encounter).not.toHaveProperty('sourceEpoch'); expect(validateWandererEncounter(s)).toBe(true);
  });
  it('actually confirms the cleared original court before fighting and rejects fabricated clearance', () => {
    const s = fixture(); expect(s.wanderer.encounter.scene.clearanceConfirmed).toBe(false); talk(s);
    expect(s.wanderer.encounter.scene.clearanceConfirmed).toBe(true); s.wanderer.encounter.scene.clearanceConfirmed = false;
    expect(blockWandererEncounter(s, { type: 'ENCOUNTER_FIGHT' })).not.toBeNull();
    const occupied = fixture(); occupied.wanderer.encounter.scene.thirdPartiesInArea = 1 as 0;
    expect(blockWandererEncounter(occupied, { type: 'ENCOUNTER_TALK' })).not.toBeNull(); expect(validateWandererEncounter(occupied)).toBe(false);
  });
  it('ordinary retreat preserves original sealed A and living B, both original weapons, independent resources and wounds', () => {
    const s = fixture(), old = structuredClone(s.secretsSorcerer), older = structuredClone(s.recorder); s.spirituality = 93; start(s);
    const result = round(s, 'RETREAT', 1, 1, 1); expect(result.outcome).toBe('RETREATED'); expect(s.combat).toBeNull();
    expect(s.wanderer.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(s.secretsSorcerer).toEqual(old); expect(s.recorder).toEqual(older); expect(s.spirituality).toBe(93); expect(validateWandererEncounter(s)).toBe(true);
  });
  it('retains actual35/25/25/15 core1250/floor125 and restores12 only after CONTINUE', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 100; start(s);
    const result = round(s, 'ATTACK', 1, 1, 346, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(baseAdvantage(22, 100, 100, 100, 1250, 120));
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 120, 1250, 120) - 22.5 - 10);
    expect(result.round.consequenceWeights).toBeNull(); expect(s.spirituality).toBe(112); expect(validateWandererEncounter(s)).toBe(true);
    const end = round(s, 'RETREAT', 1, 1, 100, 1); expect(end.outcome).toBe('RETREATED'); expect(s.spirituality).toBe(112);
    expect(validateWandererEncounter(s)).toBe(true);
  });
  it('carries independent paid enemy resources and real injuries across consecutive rounds', () => {
    const s = fixture(); s.spirituality = 100; start(s);
    const first = round(s, 'ATTACK', 1, 1, 266, 1, 36, 1, 1);
    expect(first.outcome).toBe('CONTINUE'); expect(s.wanderer.encounter.enemyHealth).toBe(90); expect(s.wanderer.encounter.enemySpirituality).toBe(116);
    expect(s.spirituality).toBe(106); expect(validateWandererEncounter(s)).toBe(true);
    const second = round(s, 'ATTACK', 1, 1, 36, 346, 1);
    expect(second.round.wandererOutcome!.source.enemyHealth).toBe(90); expect(second.round.wandererOutcome!.source.enemySpirituality).toBe(116);
    expect(second.round.wandererOutcome!.source.enemyInjuries).toHaveLength(1); expect(second.round.wandererOutcome!.source.powerUses.REFRACT_WARD).toBe(1);
    expect(s.wanderer.encounter.enemySpirituality).toBe(112); expect(s.spirituality).toBe(118); expect(validateWandererEncounter(s)).toBe(true);
  });
  it('positioning advantage without actual threatening attacks does not get a separate injury or mental wheel', () => {
    const s = fixture(); start(s); const result = round(s, 'ATTACK', 1, 1, 126, 1, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.consequenceWeights).toBeNull();
    expect(s.wanderer.encounter).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING' });
    expect(result.round.wandererOutcome!.playerActions[0]).toMatchObject({ selfGain: 30, enemyReduction: 0, threatens: false }); expect(validateWandererEncounter(s)).toBe(true);
  });
  it('same-slot side-step reduction alone cannot create injury, force surrender or summon another attacker', () => {
    const s = fixture(); start(s); const result = round(s, 'ATTACK', 1, 1, 1, 1, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.consequenceWeights).toBeNull();
    expect(result.round.wandererOutcome!.playerActions[0]).toMatchObject({ selfGain: 0, enemyReduction: 36, threatens: false });
    expect(s.wanderer.encounter.enemyHealth).toBe(100); expect(s.wanderer.encounter.enemyStatus).toBe('RESISTING'); expect(validateWandererEncounter(s)).toBe(true);
    expect(result.round.wandererOutcome).toMatchObject({ movementCount: 2, totalMetres: 2, playerPositionAfter: 'ORIGIN', enemyDistanceAfter: 2 });
    expect(s.wanderer.life.clockSeconds).toBe(60); expect(projectWandererEncounter(s).facts.join(' ')).toContain('侧避2段，共2米');
  });
  it('the common death wheel kills only new Cassian and preserves actual old target statuses and originals', () => {
    const s = fixture(), old = structuredClone(s.secretsSorcerer), older = structuredClone(s.recorder); start(s);
    const result = round(s, 'ATTACK', 1, 1, 266, 1, 100, 1, 100);
    expect(result.outcome).toBe('ENEMY_DEAD'); expect(s.wanderer.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 0, enemyStatus: 'DEAD', weaponLocation: 'COURT' });
    expect(s.secretsSorcerer).toEqual(old); expect(s.recorder).toEqual(older); expect(s.progression.acting).toBe(0); expect(s.spirituality).toBe(114);
    expect(validateWandererEncounter(s)).toBe(true);
  });
  it('common heavy injury produces living Cassian surrender with his same original rod left in this court', () => {
    const s = fixture(), old = structuredClone(s.secretsSorcerer); start(s);
    const result = round(s, 'ATTACK', 1, 1, 266, 1, 1, 1, 70);
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(s.wanderer.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 70, enemyStatus: 'SURRENDERED', weaponLocation: 'COURT', enemySpirituality: 115 });
    expect(s.secretsSorcerer).toEqual(old); expect(s.wanderer.encounter.enemyInjuries).toHaveLength(1); expect(s.spirituality).toBe(114); expect(validateWandererEncounter(s)).toBe(true);
  });
  it('common player death remains real and does not rewrite old targets or reset Cassian resources', () => {
    const s = fixture(), old = structuredClone(s.secretsSorcerer); start(s);
    const result = round(s, 'ATTACK', 1, 1, 346, 1, 1_000_000, 100); s.status = 'DEAD';
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.combat).toBeNull();
    expect(s.wanderer.encounter).toMatchObject({ status: 'LOST', enemyHealth: 100, enemySpirituality: 115, weaponLocation: 'HAND' });
    expect(s.secretsSorcerer).toEqual(old); expect(validateWandererEncounter(s)).toBe(true);
  });
  it('rejects forged terminals and a pool silently refilled without actual paid history', () => {
    const s = fixture(); start(s); expect(() => settleWandererEncounter(s, 'ENEMY_DEAD', context)).toThrow();
    expect(() => settleWandererEncounter(s, 'AUTO_WIN', context)).toThrow(); expect(s.wanderer.encounter.status).toBe('FIGHTING');
    s.wanderer.encounter.enemySpirituality--; expect(hasWandererDisputeOpponent(s)).toBe(false); expect(validateWandererEncounter(s)).toBe(false);
  });
  it('saved history rejects altered costs, court clearance, original injuries and silently refilled pools', () => {
    const s = fixture(); start(s); round(s, 'ATTACK', 1, 1, 266, 1, 36, 1, 1); expect(validateWandererEncounter(s)).toBe(true);
    const mutations: ((copy: SliceState) => void)[] = [copy => { copy.wanderer.encounter.enemySpirituality = 120; },
      copy => { copy.combatHistory.at(-1)!.wandererOutcome!.enemyActions[0]!.paidCost = 0; },
      copy => { copy.combatHistory.at(-1)!.wandererOutcome!.playerActions[0]!.paidCost = 0; },
      copy => { copy.wanderer.encounter.scene.clearanceConfirmed = false; }, copy => { copy.wanderer.encounter.weaponLocation = 'COURT'; },
      copy => { copy.wanderer.encounter.enemyInjuries = []; }, copy => { copy.spirituality--; },
      copy => { copy.combatHistory.at(-1)!.first = 'ENEMY'; }, copy => { copy.combatHistory.at(-1)!.playerCountRoll = 100; },
      copy => { copy.combatHistory.at(-1)!.wandererOutcome!.playerActions[0]!.order = 1; }];
    for (const mutate of mutations) { const copy = structuredClone(s); mutate(copy); expect(validateWandererEncounter(copy)).toBe(false); }
  });
});
