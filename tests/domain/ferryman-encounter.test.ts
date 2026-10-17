import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { baseAdvantage } from '../../src/domain/slice/combat.js';
import { resolveFerrymanCombatRound } from '../../src/domain/slice/ferryman-combat.js';
import { applyFerrymanCommand, createFerrymanState } from '../../src/domain/ferryman/index.js';
import { applyLongChapterCommand } from '../../src/domain/long-chapter/index.js';
import {
  createFerrymanEncounterState, applyFerrymanEncounterCommand, blockFerrymanEncounter,
  projectFerrymanEncounter, validateFerrymanEncounter, validateFerrymanEncounterCommand,
  hasFerrymanDisputeOpponent, hasFerrymanEncounterLock, settleFerrymanEncounter,
} from '../../src/domain/ferryman/encounter.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No free scene check'); } };
/** Directed S3 unit setup preserves the actual422-command dead-Owen history or428-command
 * post-cycle history, then uses a real current-channel introduction. It is not a natural promotion replay. */
function fixture(postCycle = false): SliceState {
  const path = postCycle ? 'long-chapter-v01390' : 'undying-v01260';
  const s = migrateSliceState(JSON.parse(readFileSync(`tests/fixtures/${path}/natural.json`, 'utf8')).final);
  s.ferryman = createFerrymanState();
  if (postCycle) applyLongChapterCommand(s, { type: 'CONTINUE_FERRYMAN' }, context);
  applyFerrymanCommand(s, { type: 'LEARN_GUIDANCE' }, context);
  s.ferryman.promotionWeek = s.week; s.ferryman.promotionDate = structuredClone(s.date); s.ferryman.undyingActingAtPromotion = 100;
  s.progression.sequence = 3; s.progression.acting = 0;
  s.progression.mastery['death.s3.bounded-ferry'] = 0; s.progression.mastery['death.s3.departure-ward'] = 0;
  s.character.coreStats.knowledge = 30; s.character.coreStats.will = 30;
  s.actionsRemaining = 3; s.spirituality = 120; s.health = 100; s.mind = 100; s.activeEvent = null; s.combat = null; return s;
}
function talk(s: SliceState) { applyFerrymanEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); }
function start(s: SliceState) { talk(s); applyFerrymanEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); }
function script(...values: number[]) { let index = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${index}: ${n}, ${min}..${max}`); return n;
  }); }
function round(s: SliceState, stance: 'ATTACK' | 'RETREAT', ...values: number[]) {
  script(...values); const result = resolveFerrymanCombatRound(s, stance); s.combatHistory.push(result.round); vi.restoreAllMocks();
  settleFerrymanEncounter(s, result.outcome, context); return result;
}
afterEach(() => vi.restoreAllMocks());

describe('Ferryman independent original Rowan51 encounter and common consequences', () => {
  it('creates independent Rowan51 H100/M100/S120 with a new club while original Owen stays really dead', () => {
    const s = fixture(), old = structuredClone(s.undying), older = structuredClone(s.gatekeeper);
    expect(createFerrymanEncounterState()).toMatchObject({ targetId: 'FR3-ROWAN', sourceEpoch: null, enemyHealth: 100, enemyMind: 100, enemySpirituality: 120,
      enemyStatus: 'RESISTING', weaponLocation: 'HAND', scene: { courtId: 'FR3-COURT', ordinaryExit: 'OPEN', clearanceConfirmed: false }, powerUses: { ECHO_STRIKE: 0, SEAL_WARD: 0, FOCUS: 0 } });
    expect(projectFerrymanEncounter(s).enemy).toMatchObject({ name: '罗温·谢尔', age: 51, sequence: 3, weaponId: 'FR3-ROWAN-CLUB' });
    expect(projectFerrymanEncounter(s).story).toContain('当地原芦羽不是战宠');
    expect(s.undying.encounter.enemy).toMatchObject({ id: 'UDY4-OWEN', age: 46, health: 0, status: 'DEAD', weaponLocation: 'YARD' });
    expect(s.gatekeeper.companion.status).toBe('INSIDE');
    expect(s.undying).toEqual(old); expect(s.gatekeeper).toEqual(older); expect(validateFerrymanEncounter(s)).toBe(true);
  });
  it('requires actual talk1AP followed by separately explicit fight1AP and preserves the real old ritual OUTSIDE endpoint', () => {
    const s = fixture(); expect(s.undying.ritual.playerLocation).toBe('OUTSIDE');
    expect(blockFerrymanEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toContain('先实际交谈');
    s.actionsRemaining = 1; expect(blockFerrymanEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留'); s.actionsRemaining = 2;
    talk(s); expect(s.actionsRemaining).toBe(1); expect(s.combat).toBeNull(); expect(hasFerrymanEncounterLock(s)).toBe(true);
    applyFerrymanEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context);
    expect(s.actionsRemaining).toBe(0); expect(hasFerrymanDisputeOpponent(s)).toBe(true); expect(validateFerrymanEncounter(s)).toBe(true);
  });
  it('hides new opponent facts and actions before actual S3', () => {
    const s = fixture(); s.progression.sequence = 4; s.ferryman.promotionWeek = null;
    const view = projectFerrymanEncounter(s); expect(view.enemy).toBeNull(); expect(view.story).toBe(''); expect(view.facts).toEqual([]); expect(view.actions).toEqual([]);
    expect(view.scene).toBeNull(); expect(JSON.stringify(view)).not.toMatch(/ROWAN|罗温·谢尔|原棍/); expect(validateFerrymanEncounter(s)).toBe(true);
  });
  it('permits real peaceful0AP exit despite low mind without reward, refill or reopening the opponent', () => {
    const s = fixture(), old = structuredClone(s.undying), life = structuredClone(s.ferryman.life), history = structuredClone(s.combatHistory);
    talk(s); s.actionsRemaining = 0; s.mind = 0; s.spirituality = 87;
    applyFerrymanEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context);
    expect(s.undying).toEqual(old); expect(s.ferryman.life).toEqual(life); expect(s.combatHistory).toEqual(history);
    expect(s.ferryman.encounter.status).toBe('RESOLVED'); expect(hasFerrymanEncounterLock(s)).toBe(false);
    expect(validateFerrymanEncounter(s)).toBe(true); expect(s.progression.acting).toBe(0); expect(s.spirituality).toBe(87);
    s.mind = 100; s.actionsRemaining = 3; expect(blockFerrymanEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('不重新');
  });
  it('rejects extra command authority, wrong city and a substituted old dead opponent', () => {
    expect(validateFerrymanEncounterCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    expect(validateFerrymanEncounterCommand({ type: 'ENCOUNTER_FIGHT', replaceOwen: true })).toBe(false);
    const s = fixture(); s.world.city = 'TINGEN'; expect(blockFerrymanEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.world.city = 'BACKLUND'; start(s); s.ferryman.encounter.targetId = 'UDY4-OWEN' as 'FR3-ROWAN';
    expect(hasFerrymanDisputeOpponent(s)).toBe(false); expect(validateFerrymanEncounter(s)).toBe(false);
  });
  it('requires cleanup of current preparation, current life and original-era borrowed objects', () => {
    const mutations: ((s: SliceState) => void)[] = [s => { s.undying.life.book.location = 'DESK'; },
      s => { s.gatekeeper.practice.gateOpen = true; }, s => { s.gatekeeper.companion.status = 'DEPLOYED'; },
      s => { s.undying.life.cases['bounded-seal'].status = 'PREPARED'; },
      s => { s.ferryman.life.cases['passage-out'].status = 'PREPARED'; }, s => { s.ferryman.channels[0]!.preparedWeek = s.week; }];
    for (const mutate of mutations) { const s = fixture(); mutate(s); const before = structuredClone(s);
      expect(() => applyFerrymanEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context)).toThrow(); expect(s).toEqual(before); }
  });
  it('registers the actual current epoch on talk and rejects a missing, closed or substituted current channel', () => {
    for (const postCycle of [false, true]) { const s = fixture(postCycle); talk(s);
      expect(s.ferryman.encounter.sourceEpoch).toBe(postCycle ? 'POST_CYCLE' : 'ORIGINAL'); expect(validateFerrymanEncounter(s)).toBe(true);
      const missing = structuredClone(s); missing.ferryman.channels = []; expect(blockFerrymanEncounter(missing, { type: 'ENCOUNTER_FIGHT' })).not.toBeNull();
      const closed = structuredClone(s); closed.ferryman.channels[0]!.agreementClosedDate = structuredClone(s.date);
      expect(blockFerrymanEncounter(closed, { type: 'ENCOUNTER_FIGHT' })).not.toBeNull();
      const substituted = structuredClone(s); substituted.ferryman.encounter.sourceEpoch = postCycle ? 'ORIGINAL' : 'POST_CYCLE';
      expect(blockFerrymanEncounter(substituted, { type: 'ENCOUNTER_FIGHT' })).not.toBeNull(); expect(validateFerrymanEncounter(substituted)).toBe(false);
    }
  });
  it('post-cycle encounter requires the actual new reception and never reopens old living scenes', () => {
    const s = fixture(true), history = structuredClone(s.longChapter), old = structuredClone(s.undying), gray = structuredClone(s.gatekeeper.companion);
    expect(s.ferryman.era.location).toBe('RECEPTION'); expect(s.gatekeeper.companion.status).toBe('OUTSIDE');
    s.ferryman.era.location = 'OUTSIDE'; expect(blockFerrymanEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.ferryman.era.location = 'RECEPTION'; start(s); expect(hasFerrymanDisputeOpponent(s)).toBe(true);
    expect(s.longChapter).toEqual(history); expect(s.undying).toEqual(old); expect(s.gatekeeper.companion).toEqual(gray);
  });
  it('actually confirms the cleared original court before fighting and rejects fabricated clearance', () => {
    const s = fixture(); expect(s.ferryman.encounter.scene.clearanceConfirmed).toBe(false); talk(s);
    expect(s.ferryman.encounter.scene.clearanceConfirmed).toBe(true); s.ferryman.encounter.scene.clearanceConfirmed = false;
    expect(blockFerrymanEncounter(s, { type: 'ENCOUNTER_FIGHT' })).not.toBeNull();
    const occupied = fixture(); occupied.ferryman.encounter.scene.thirdPartiesInArea = 1 as 0;
    expect(blockFerrymanEncounter(occupied, { type: 'ENCOUNTER_TALK' })).not.toBeNull(); expect(validateFerrymanEncounter(occupied)).toBe(false);
  });
  it('ordinary retreat preserves old dead Owen, both original clubs, independent resources and wounds', () => {
    const s = fixture(), old = structuredClone(s.undying), older = structuredClone(s.gatekeeper); s.spirituality = 93; start(s);
    const result = round(s, 'RETREAT', 1, 1, 1); expect(result.outcome).toBe('RETREATED'); expect(s.combat).toBeNull();
    expect(s.ferryman.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(s.undying).toEqual(old); expect(s.gatekeeper).toEqual(older); expect(s.spirituality).toBe(93); expect(validateFerrymanEncounter(s)).toBe(true);
  });
  it('retains actual35/25/25/15 core1250/floor125 and restores12 only after CONTINUE', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 100; start(s);
    const result = round(s, 'ATTACK', 1, 1, 346, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(baseAdvantage(22, 100, 100, 100, 1250, 120));
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 120, 1250, 120) - 22.5 - 10);
    expect(result.round.consequenceWeights).toBeNull(); expect(s.spirituality).toBe(112); expect(validateFerrymanEncounter(s)).toBe(true);
    const end = round(s, 'RETREAT', 1, 1, 100, 1); expect(end.outcome).toBe('RETREATED'); expect(s.spirituality).toBe(112);
    expect(validateFerrymanEncounter(s)).toBe(true);
  });
  it('carries independent paid enemy resources and real injuries across consecutive rounds', () => {
    const s = fixture(); s.spirituality = 100; start(s);
    const first = round(s, 'ATTACK', 1, 1, 266, 1, 36, 1, 1);
    expect(first.outcome).toBe('CONTINUE'); expect(s.ferryman.encounter.enemyHealth).toBe(90); expect(s.ferryman.encounter.enemySpirituality).toBe(116);
    expect(s.spirituality).toBe(106); expect(validateFerrymanEncounter(s)).toBe(true);
    const second = round(s, 'ATTACK', 1, 1, 36, 346, 1);
    expect(second.round.ferrymanOutcome!.source.enemyHealth).toBe(90); expect(second.round.ferrymanOutcome!.source.enemySpirituality).toBe(116);
    expect(second.round.ferrymanOutcome!.source.enemyInjuries).toHaveLength(1); expect(second.round.ferrymanOutcome!.source.powerUses.SEAL_WARD).toBe(1);
    expect(s.ferryman.encounter.enemySpirituality).toBe(112); expect(s.spirituality).toBe(118); expect(validateFerrymanEncounter(s)).toBe(true);
  });
  it('departure ward reduction without actual threatening attacks does not get a separate injury or mental wheel', () => {
    const s = fixture(); start(s); const result = round(s, 'ATTACK', 1, 1, 126, 1, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.consequenceWeights).toBeNull();
    expect(s.ferryman.encounter).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING' });
    expect(result.round.ferrymanOutcome!.playerActions[0]!.enemyReduction).toBe(32); expect(validateFerrymanEncounter(s)).toBe(true);
  });
  it('bounded ferry reduction alone cannot create injury, force surrender or summon another attacker', () => {
    const s = fixture(); start(s); const result = round(s, 'ATTACK', 1, 1, 1, 1, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.consequenceWeights).toBeNull();
    expect(result.round.ferrymanOutcome!.playerActions[0]).toMatchObject({ selfGain: 0, enemyReduction: 36, threatens: false });
    expect(s.ferryman.encounter.enemyHealth).toBe(100); expect(s.ferryman.encounter.enemyStatus).toBe('RESISTING'); expect(validateFerrymanEncounter(s)).toBe(true);
  });
  it('the common death wheel kills only new Rowan and preserves actual old Owen death and originals', () => {
    const s = fixture(), old = structuredClone(s.undying), older = structuredClone(s.gatekeeper); start(s);
    const result = round(s, 'ATTACK', 1, 1, 266, 1, 100, 1, 100);
    expect(result.outcome).toBe('ENEMY_DEAD'); expect(s.ferryman.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 0, enemyStatus: 'DEAD', weaponLocation: 'COURT' });
    expect(s.undying).toEqual(old); expect(s.gatekeeper).toEqual(older); expect(s.progression.acting).toBe(0); expect(s.spirituality).toBe(114);
    expect(validateFerrymanEncounter(s)).toBe(true);
  });
  it('common heavy injury produces living Rowan surrender with his same original club left in this court', () => {
    const s = fixture(), old = structuredClone(s.undying); start(s);
    const result = round(s, 'ATTACK', 1, 1, 266, 1, 1, 1, 70);
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(s.ferryman.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 70, enemyStatus: 'SURRENDERED', weaponLocation: 'COURT', enemySpirituality: 115 });
    expect(s.undying).toEqual(old); expect(s.ferryman.encounter.enemyInjuries).toHaveLength(1); expect(s.spirituality).toBe(114); expect(validateFerrymanEncounter(s)).toBe(true);
  });
  it('common player death remains real and does not rewrite Owen or reset Rowan resources', () => {
    const s = fixture(), old = structuredClone(s.undying); start(s);
    const result = round(s, 'ATTACK', 1, 1, 346, 1, 1_000_000, 100); s.status = 'DEAD';
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.combat).toBeNull();
    expect(s.ferryman.encounter).toMatchObject({ status: 'LOST', enemyHealth: 100, enemySpirituality: 115, weaponLocation: 'HAND' });
    expect(s.undying).toEqual(old); expect(validateFerrymanEncounter(s)).toBe(true);
  });
  it('new post-cycle ordinary death preserves old recovery and released spirits rather than reviving on the old curse', () => {
    const s = fixture(true), residence = structuredClone(s.longChapter), lifecycle = structuredClone(s.undying.lifecycle), gray = structuredClone(s.gatekeeper.companion);
    start(s); const result = round(s, 'ATTACK', 1, 1, 346, 1, 1_000_000, 100); s.status = 'DEAD';
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.ferryman.encounter.status).toBe('LOST');
    expect(s.longChapter).toEqual(residence); expect(s.undying.lifecycle).toEqual(lifecycle); expect(s.gatekeeper.companion).toEqual(gray);
    expect(validateFerrymanEncounter(s)).toBe(true); expect(blockFerrymanEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
  });
  it('rejects forged terminals and a pool silently refilled without actual paid history', () => {
    const s = fixture(); start(s); expect(() => settleFerrymanEncounter(s, 'ENEMY_DEAD', context)).toThrow();
    expect(() => settleFerrymanEncounter(s, 'AUTO_WIN', context)).toThrow(); expect(s.ferryman.encounter.status).toBe('FIGHTING');
    s.ferryman.encounter.enemySpirituality--; expect(hasFerrymanDisputeOpponent(s)).toBe(false); expect(validateFerrymanEncounter(s)).toBe(false);
  });
  it('saved history rejects altered costs, court clearance, original injuries and silently refilled pools', () => {
    const s = fixture(); start(s); round(s, 'ATTACK', 1, 1, 266, 1, 36, 1, 1); expect(validateFerrymanEncounter(s)).toBe(true);
    const mutations: ((copy: SliceState) => void)[] = [copy => { copy.ferryman.encounter.enemySpirituality = 120; },
      copy => { copy.combatHistory.at(-1)!.ferrymanOutcome!.enemyActions[0]!.paidCost = 0; },
      copy => { copy.combatHistory.at(-1)!.ferrymanOutcome!.playerActions[0]!.paidCost = 0; },
      copy => { copy.ferryman.encounter.scene.clearanceConfirmed = false; }, copy => { copy.ferryman.encounter.weaponLocation = 'COURT'; },
      copy => { copy.ferryman.encounter.enemyInjuries = []; }, copy => { copy.spirituality--; },
      copy => { copy.combatHistory.at(-1)!.first = 'ENEMY'; }, copy => { copy.combatHistory.at(-1)!.playerCountRoll = 100; },
      copy => { copy.combatHistory.at(-1)!.ferrymanOutcome!.playerActions[0]!.order = 1; }];
    for (const mutate of mutations) { const copy = structuredClone(s); mutate(copy); expect(validateFerrymanEncounter(copy)).toBe(false); }
  });
});
