import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { baseAdvantage } from '../../src/domain/slice/combat.js';
import { resolveSeaKingCombatRound } from '../../src/domain/slice/sea-king-combat.js';
import { createSeaKingState } from '../../src/domain/sea-king/index.js';
import {
  createSeaKingEncounterState, applySeaKingEncounterCommand, blockSeaKingEncounter,
  projectSeaKingEncounter, validateSeaKingEncounter, validateSeaKingEncounterCommand,
  hasSeaKingDisputeOpponent, hasSeaKingEncounterLock, settleSeaKingEncounter,
} from '../../src/domain/sea-king/encounter.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No free scene check'); } };
/** Directed S3 fixture keeps the actual S4 Benedict death, old people and original materials unchanged. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/cataclysm-priest-v01240/natural.json', 'utf8')).final);
  s.seaKing = createSeaKingState(); s.seaKing.promotionWeek = s.week; s.progression.sequence = 3; s.progression.acting = 0;
  s.character.coreStats.knowledge = 30; s.character.coreStats.will = 30;
  s.actionsRemaining = 3; s.spirituality = 120; s.health = 100; s.mind = 100; s.activeEvent = null; s.combat = null; return s;
}
function talk(s: SliceState) { applySeaKingEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); }
function start(s: SliceState) { talk(s); applySeaKingEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); }
function script(...values: number[]) { let index = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${index}: ${n}, ${min}..${max}`); return n;
  }); }
function round(s: SliceState, stance: 'ATTACK' | 'RETREAT', ...values: number[]) {
  script(...values); const result = resolveSeaKingCombatRound(s, stance); s.combatHistory.push(result.round); vi.restoreAllMocks();
  settleSeaKingEncounter(s, result.outcome, context); return result;
}
afterEach(() => vi.restoreAllMocks());

describe('Sea King independent original Quentin49 encounter and common consequences', () => {
  it('creates independent Quentin49 H100/M100/S120 with a different original club while old Benedict remains dead', () => {
    const s = fixture(), old = structuredClone(s.cataclysmPriest), older = structuredClone(s.oceanSinger);
    expect(createSeaKingEncounterState()).toMatchObject({ targetId: 'SK3-QUENTIN', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120,
      enemyStatus: 'RESISTING', weaponLocation: 'HAND', waterSource: 'SEAWATER', powerUses: { WIND: 0, WATER_WARD: 0, FOCUS: 0 } });
    expect(projectSeaKingEncounter(s).enemy).toMatchObject({ name: '昆廷', age: 49, sequence: 3, weaponId: 'SK3-QUENTIN-CLUB' });
    expect(projectSeaKingEncounter(s).story).toContain('不赋予风水自动友军免疫');
    expect(s.cataclysmPriest.encounter.enemy).toMatchObject({ id: 'CP4-BENEDICT', age: 48, health: 0, status: 'DEAD', weaponLocation: 'QUAY' });
    expect(s.cataclysmPriest.life.float.location).toBe('BANK'); expect(s.cataclysmPriest.life.rope.durability).toBe(90);
    expect(s.cataclysmPriest).toEqual(old); expect(s.oceanSinger).toEqual(older); expect(validateSeaKingEncounter(s)).toBe(true);
  });
  it('requires actual talk1AP followed by separately explicit fight1AP and permits the real old RIDGE endpoint', () => {
    const s = fixture(); expect(s.cataclysmPriest.ritual.playerLocation).toBe('RIDGE');
    expect(blockSeaKingEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toContain('先实际交谈');
    s.actionsRemaining = 1; expect(blockSeaKingEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留'); s.actionsRemaining = 2;
    talk(s); expect(s.actionsRemaining).toBe(1); expect(s.combat).toBeNull(); expect(hasSeaKingEncounterLock(s)).toBe(true);
    applySeaKingEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context);
    expect(s.actionsRemaining).toBe(0); expect(hasSeaKingDisputeOpponent(s)).toBe(true); expect(validateSeaKingEncounter(s)).toBe(true);
  });
  it('hides new opponent facts and actions before actual S3', () => {
    const s = fixture(); s.progression.sequence = 4; s.seaKing.promotionWeek = null;
    const view = projectSeaKingEncounter(s); expect(view.enemy).toBeNull(); expect(view.story).toBe(''); expect(view.facts).toEqual([]); expect(view.actions).toEqual([]);
    expect(view.waterSource).toBeNull(); expect(JSON.stringify(view)).not.toMatch(/QUENTIN|昆廷|原棍/); expect(validateSeaKingEncounter(s)).toBe(true);
  });
  it('permits real peaceful0AP exit despite low mind without reward, refill or reopening the opponent', () => {
    const s = fixture(), old = structuredClone(s.cataclysmPriest), life = structuredClone(s.seaKing.life), history = structuredClone(s.combatHistory);
    talk(s); s.actionsRemaining = 0; s.mind = 0; s.spirituality = 87;
    applySeaKingEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context);
    expect(s.cataclysmPriest).toEqual(old); expect(s.seaKing.life).toEqual(life); expect(s.combatHistory).toEqual(history);
    expect(s.seaKing.encounter.status).toBe('RESOLVED'); expect(hasSeaKingEncounterLock(s)).toBe(false);
    expect(validateSeaKingEncounter(s)).toBe(true); expect(s.progression.acting).toBe(0); expect(s.spirituality).toBe(87);
    s.mind = 100; s.actionsRemaining = 3; expect(blockSeaKingEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('不重新');
  });
  it('rejects extra command authority, wrong city and a substituted old dead opponent', () => {
    expect(validateSeaKingEncounterCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    expect(validateSeaKingEncounterCommand({ type: 'ENCOUNTER_FIGHT', resurrectBenedict: true })).toBe(false);
    const s = fixture(); s.world.city = 'TINGEN'; expect(blockSeaKingEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.world.city = 'BACKLUND'; start(s); s.seaKing.encounter.targetId = 'CP4-BENEDICT' as 'SK3-QUENTIN';
    expect(hasSeaKingDisputeOpponent(s)).toBe(false); expect(validateSeaKingEncounter(s)).toBe(false);
  });
  it('requires actual cleanup of old floating originals, open sea-song, prepared cases and ritual platform', () => {
    const mutations: ((s: SliceState) => void)[] = [s => { s.cataclysmPriest.life.float.location = 'MARK'; },
      s => { s.cataclysmPriest.life.ally.location = 'RIDGE'; }, s => { s.cataclysmPriest.ritual.playerLocation = 'PLATFORM'; },
      s => { s.cataclysmPriest.life.cases['sea-eddy'].status = 'PREPARED'; }, s => { s.oceanSinger.practice.songOpen = true; },
      s => { s.seaKing.life.cases['remote-dinghy'].status = 'PREPARED'; }, s => { s.seaKing.preparedWeek = s.week; }];
    for (const mutate of mutations) { const s = fixture(); mutate(s); const before = structuredClone(s);
      expect(() => applySeaKingEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context)).toThrow(); expect(s).toEqual(before); }
  });
  it('ordinary retreat preserves old dead Benedict, both original clubs, sea resources and wounds', () => {
    const s = fixture(), old = structuredClone(s.cataclysmPriest), older = structuredClone(s.oceanSinger); s.spirituality = 93; start(s);
    const result = round(s, 'RETREAT', 1, 1, 1); expect(result.outcome).toBe('RETREATED'); expect(s.combat).toBeNull();
    expect(s.seaKing.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 120, weaponLocation: 'HAND', waterSource: 'SEAWATER' });
    expect(s.cataclysmPriest).toEqual(old); expect(s.oceanSinger).toEqual(older); expect(s.spirituality).toBe(93); expect(validateSeaKingEncounter(s)).toBe(true);
  });
  it('retains actual35/25/25/15 core1250/floor125 and restores12 only after CONTINUE', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 100; start(s);
    const result = round(s, 'ATTACK', 1, 1, 346, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(baseAdvantage(22, 100, 100, 100, 1250, 120));
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 120, 1250, 120) - 22.5 - 10);
    expect(result.round.consequenceWeights).toBeNull(); expect(s.spirituality).toBe(112); expect(validateSeaKingEncounter(s)).toBe(true);
    const end = round(s, 'RETREAT', 1, 1, 100, 1); expect(end.outcome).toBe('RETREATED'); expect(s.spirituality).toBe(112);
    expect(validateSeaKingEncounter(s)).toBe(true);
  });
  it('carries independent paid enemy resources and real injuries across consecutive rounds', () => {
    const s = fixture(); s.spirituality = 100; start(s);
    const first = round(s, 'ATTACK', 1, 1, 266, 1, 36, 1, 1);
    expect(first.outcome).toBe('CONTINUE'); expect(s.seaKing.encounter.enemyHealth).toBe(90); expect(s.seaKing.encounter.enemySpirituality).toBe(116);
    expect(s.spirituality).toBe(106); expect(validateSeaKingEncounter(s)).toBe(true);
    const second = round(s, 'ATTACK', 1, 1, 36, 346, 1);
    expect(second.round.seaKingOutcome!.source.enemyHealth).toBe(90); expect(second.round.seaKingOutcome!.source.enemySpirituality).toBe(116);
    expect(second.round.seaKingOutcome!.source.enemyInjuries).toHaveLength(1); expect(second.round.seaKingOutcome!.source.powerUses.WATER_WARD).toBe(1);
    expect(s.seaKing.encounter.enemySpirituality).toBe(112); expect(s.spirituality).toBe(118); expect(validateSeaKingEncounter(s)).toBe(true);
  });
  it('domain reduction without actual threatening attacks does not get a separate injury or mental wheel', () => {
    const s = fixture(); start(s); const result = round(s, 'ATTACK', 1, 1, 126, 1, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.consequenceWeights).toBeNull();
    expect(s.seaKing.encounter).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING' });
    expect(result.round.seaKingOutcome!.playerActions[0]!.enemyReduction).toBe(32); expect(validateSeaKingEncounter(s)).toBe(true);
  });
  it('the common death wheel kills only new Quentin and preserves actual old Benedict death and originals', () => {
    const s = fixture(), old = structuredClone(s.cataclysmPriest), older = structuredClone(s.oceanSinger); start(s);
    const result = round(s, 'ATTACK', 1, 1, 1, 1, 100, 1, 100);
    expect(result.outcome).toBe('ENEMY_DEAD'); expect(s.seaKing.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 0, enemyStatus: 'DEAD', weaponLocation: 'QUAY' });
    expect(s.cataclysmPriest).toEqual(old); expect(s.oceanSinger).toEqual(older); expect(s.progression.acting).toBe(0); expect(s.spirituality).toBe(114);
    expect(validateSeaKingEncounter(s)).toBe(true);
  });
  it('common heavy injury produces living Quentin surrender with his same original club left on this quay', () => {
    const s = fixture(), old = structuredClone(s.cataclysmPriest); start(s);
    const result = round(s, 'ATTACK', 1, 1, 1, 1, 1, 1, 70);
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(s.seaKing.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 70, enemyStatus: 'SURRENDERED', weaponLocation: 'QUAY', enemySpirituality: 115 });
    expect(s.cataclysmPriest).toEqual(old); expect(s.seaKing.encounter.enemyInjuries).toHaveLength(1); expect(s.spirituality).toBe(114); expect(validateSeaKingEncounter(s)).toBe(true);
  });
  it('common player death remains real and does not revive Benedict or reset Quentin resources', () => {
    const s = fixture(), old = structuredClone(s.cataclysmPriest); start(s);
    const result = round(s, 'ATTACK', 1, 1, 346, 1, 1_000_000, 100); s.status = 'DEAD';
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.combat).toBeNull();
    expect(s.seaKing.encounter).toMatchObject({ status: 'LOST', enemyHealth: 100, enemySpirituality: 115, weaponLocation: 'HAND' });
    expect(s.cataclysmPriest).toEqual(old); expect(validateSeaKingEncounter(s)).toBe(true);
  });
  it('rejects forged terminals and a pool silently refilled without actual paid history', () => {
    const s = fixture(); start(s); expect(() => settleSeaKingEncounter(s, 'ENEMY_DEAD', context)).toThrow();
    expect(() => settleSeaKingEncounter(s, 'AUTO_WIN', context)).toThrow(); expect(s.seaKing.encounter.status).toBe('FIGHTING');
    s.seaKing.encounter.enemySpirituality--; expect(hasSeaKingDisputeOpponent(s)).toBe(false); expect(validateSeaKingEncounter(s)).toBe(false);
  });
  it('saved history rejects altered costs, source water, original injuries and silently refilled pools', () => {
    const s = fixture(); start(s); round(s, 'ATTACK', 1, 1, 266, 1, 36, 1, 1); expect(validateSeaKingEncounter(s)).toBe(true);
    const mutations: ((copy: SliceState) => void)[] = [copy => { copy.seaKing.encounter.enemySpirituality = 120; },
      copy => { copy.combatHistory.at(-1)!.seaKingOutcome!.enemyActions[0]!.paidCost = 0; },
      copy => { copy.combatHistory.at(-1)!.seaKingOutcome!.playerActions[0]!.paidCost = 0; },
      copy => { copy.seaKing.encounter.waterSource = 'NONE'; }, copy => { copy.seaKing.encounter.weaponLocation = 'QUAY'; },
      copy => { copy.seaKing.encounter.enemyInjuries = []; }, copy => { copy.spirituality--; }];
    for (const mutate of mutations) { const copy = structuredClone(s); mutate(copy); expect(validateSeaKingEncounter(copy)).toBe(false); }
  });
});
