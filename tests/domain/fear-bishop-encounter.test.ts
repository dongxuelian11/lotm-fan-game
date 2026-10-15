import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { baseAdvantage } from '../../src/domain/slice/combat.js';
import { resolveFearBishopCombatRound } from '../../src/domain/slice/fear-bishop-combat.js';
import { createFearBishopState } from '../../src/domain/fear-bishop/index.js';
import {
  createFearBishopEncounterState, applyFearBishopEncounterCommand, blockFearBishopEncounter,
  projectFearBishopEncounter, validateFearBishopEncounter, validateFearBishopEncounterCommand,
  hasFearBishopDisputeOpponent, hasFearBishopEncounterLock, settleFearBishopEncounter,
} from '../../src/domain/fear-bishop/encounter.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No free scene random check'); } };
/** Directed post-promotion fixture keeps the actual previous Bram death, people, objects and original Leaf. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/nightwatcher-v01220/natural.json', 'utf8')).final);
  s.fearBishop = createFearBishopState(); s.fearBishop.promotionWeek = s.week; s.progression.sequence = 3; s.progression.acting = 0;
  s.character.coreStats.knowledge = 30; s.actionsRemaining = 3; s.spirituality = 120; s.health = 100; s.mind = 100;
  s.activeEvent = null; s.combat = null; return s;
}
function talk(s: SliceState) { applyFearBishopEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); }
function start(s: SliceState) { talk(s); applyFearBishopEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); }
function script(...values: number[]) { let index = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${index}: ${n}, ${min}..${max}`); return n;
  }); }
function round(s: SliceState, stance: 'ATTACK' | 'RETREAT', ...values: number[]) {
  script(...values); const result = resolveFearBishopCombatRound(s, stance); s.combatHistory.push(result.round); vi.restoreAllMocks();
  settleFearBishopEncounter(s, result.outcome, context); return result;
}
afterEach(() => vi.restoreAllMocks());

describe('Fear Bishop distinct Harlan48 original encounter and common consequences', () => {
  it('creates only distinct Harlan48 G3 while preserving the actual dead Bram and original objects', () => {
    const s = fixture(), old = structuredClone(s.nightwatcher), spirit = structuredClone(s.spiritWarlock);
    expect(createFearBishopEncounterState()).toMatchObject({ targetId: 'FB3-HARLAN', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120,
      enemyStatus: 'RESISTING', weaponLocation: 'HAND', powerUses: { DARK_BOLT: 0, WARD: 0, FOCUS: 0 } });
    expect(projectFearBishopEncounter(s).enemy).toMatchObject({ name: '哈兰', age: 48, sequence: 3, weaponId: 'FB3-HARLAN-CLUB' });
    expect(s.nightwatcher).toEqual(old); expect(s.spiritWarlock).toEqual(spirit);
    expect(s.nightwatcher.encounter.enemy).toMatchObject({ id: 'NW4-BRAM', health: 0, status: 'DEAD', weaponLocation: 'YARD' });
    expect(validateFearBishopEncounter(s)).toBe(true);
  });
  it('requires actual talk1AP with room for a separate explicit fight1AP', () => {
    const s = fixture(); expect(blockFearBishopEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toContain('先实际交谈');
    s.actionsRemaining = 1; expect(blockFearBishopEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留'); s.actionsRemaining = 2;
    talk(s); expect(s.actionsRemaining).toBe(1); expect(s.combat).toBeNull(); expect(hasFearBishopEncounterLock(s)).toBe(true);
    expect(s.spiritWarlock.companion.status).toBe('SEALED'); expect(validateFearBishopEncounter(s)).toBe(true);
    applyFearBishopEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context);
    expect(s.actionsRemaining).toBe(0); expect(hasFearBishopDisputeOpponent(s)).toBe(true); expect(validateFearBishopEncounter(s)).toBe(true);
  });
  it('hides new original-opponent identity, facts and actions before actual S3', () => {
    const s = fixture(); s.progression.sequence = 4; s.fearBishop.promotionWeek = null;
    const view = projectFearBishopEncounter(s); expect(view.enemy).toBeNull(); expect(view.story).toBe(''); expect(view.facts).toEqual([]); expect(view.actions).toEqual([]);
    expect(JSON.stringify(view)).not.toMatch(/HARLAN|哈兰|原棍/); expect(validateFearBishopEncounter(s)).toBe(true);
  });
  it('allows actual peaceful0AP exit despite low mind and gives no reward, refill or reopened enemy', () => {
    const s = fixture(), old = structuredClone(s.nightwatcher), spirit = structuredClone(s.spiritWarlock), history = structuredClone(s.combatHistory);
    talk(s); s.actionsRemaining = 0; s.mind = 0; s.spirituality = 87;
    applyFearBishopEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context);
    expect(s.nightwatcher).toEqual(old); expect(s.spiritWarlock).toEqual(spirit); expect(s.combatHistory).toEqual(history);
    expect(s.fearBishop.encounter.status).toBe('RESOLVED'); expect(hasFearBishopEncounterLock(s)).toBe(false);
    expect(validateFearBishopEncounter(s)).toBe(true); expect(s.progression.acting).toBe(0); expect(s.spirituality).toBe(87);
    s.mind = 100; s.actionsRemaining = 3; expect(blockFearBishopEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('不重新');
  });
  it('rejects extra command authority, wrong city, open practice and substituted old opponents', () => {
    expect(validateFearBishopEncounterCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    expect(validateFearBishopEncounterCommand({ type: 'ENCOUNTER_FIGHT', freeSpirit: true })).toBe(false);
    const s = fixture(); s.world.city = 'TINGEN'; expect(blockFearBishopEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.world.city = 'BACKLUND'; s.fearBishop.life.cases['contained-residue'].status = 'PREPARED';
    expect(blockFearBishopEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.fearBishop.life.cases['contained-residue'].status = 'AVAILABLE'; start(s); s.fearBishop.encounter.targetId = 'NW4-BRAM' as 'FB3-HARLAN';
    expect(hasFearBishopDisputeOpponent(s)).toBe(false); expect(validateFearBishopEncounter(s)).toBe(false);
  });
  it('requires prior old-body, old-object and old-spirit cleanup rather than silently resetting it', () => {
    const mutations: ((s: SliceState) => void)[] = [s => { s.nightwatcher.life.people.mason.asleep = true; },
      s => { s.nightwatcher.life.cart.location = 'END'; }, s => { s.nightwatcher.life.practice.note.location = 'RECIPIENT'; },
      s => { s.spiritWarlock.companion.status = 'DEPLOYED'; s.spiritWarlock.companion.deployments++; }];
    for (const mutate of mutations) { const s = fixture(); mutate(s); const before = structuredClone(s);
      expect(() => applyFearBishopEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context)).toThrow(); expect(s).toEqual(before); }
  });
  it('permits a released original Leaf to remain released while the player can fight and ordinarily leave', () => {
    const s = fixture(); s.spiritWarlock.companion.status = 'RELEASED'; s.spiritWarlock.companion.invitedWeek = null; s.spiritWarlock.companion.releases++;
    const spirit = structuredClone(s.spiritWarlock.companion); start(s);
    const result = round(s, 'RETREAT', 1, 1, 1); expect(result.outcome).toBe('RETREATED'); expect(s.spiritWarlock.companion).toEqual(spirit);
    expect(validateFearBishopEncounter(s)).toBe(true);
  });
  it('actual ordinary retreat preserves both original enemy bodies, old objects and all paid resources', () => {
    const s = fixture(), old = structuredClone(s.nightwatcher), spirit = structuredClone(s.spiritWarlock); s.spirituality = 93; start(s);
    const result = round(s, 'RETREAT', 1, 1, 1); expect(result.outcome).toBe('RETREATED'); expect(s.combat).toBeNull();
    expect(s.fearBishop.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(s.nightwatcher).toEqual(old); expect(s.spiritWarlock).toEqual(spirit); expect(s.spirituality).toBe(93); expect(validateFearBishopEncounter(s)).toBe(true);
  });
  it('retains Darkness35/25/25/15 core1250/floor125 and restores12 only after actual CONTINUE', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 100; start(s);
    // Real first Leaf slot is paid deployment with no contribution; enemy accident cannot inflict a wound.
    const result = round(s, 'ATTACK', 1, 1, 366, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(baseAdvantage(22, 100, 100, 100, 1250, 120));
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 120, 1250, 120) - 22.5);
    expect(result.round.consequenceWeights).toBeNull(); expect(s.spirituality).toBe(110); expect(validateFearBishopEncounter(s)).toBe(true);
    expect(s.spiritWarlock.companion).toMatchObject({ status: 'SEALED', deployments: 11, recalls: 11 });
    const end = round(s, 'RETREAT', 1, 1, 100, 1); expect(end.outcome).toBe('RETREATED'); expect(s.spirituality).toBe(110);
    expect(validateFearBishopEncounter(s)).toBe(true);
  });
  it('sleep-fear pressure alone does not get a separate mental injury or death wheel', () => {
    const s = fixture(); start(s);
    const result = round(s, 'ATTACK', 1, 1, 226, 1, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.consequenceWeights).toBeNull();
    expect(s.fearBishop.encounter).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING' });
    expect(result.round.fearBishopOutcome!.playerActions[0]!.enemyReduction).toBe(32); expect(validateFearBishopEncounter(s)).toBe(true);
  });
  it('real common-wheel enemy death keeps Harlan body/club and does not resurrect or overwrite old Bram', () => {
    const s = fixture(), old = structuredClone(s.nightwatcher), spirit = structuredClone(s.spiritWarlock); start(s);
    const result = round(s, 'ATTACK', 1, 1, 101, 1, 100, 1, 100);
    expect(result.outcome).toBe('ENEMY_DEAD'); expect(s.fearBishop.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 0, enemyStatus: 'DEAD', weaponLocation: 'YARD' });
    expect(s.spirituality).toBe(114); expect(s.nightwatcher).toEqual(old); expect(s.spiritWarlock).toEqual(spirit); expect(s.progression.acting).toBe(0);
    expect(validateFearBishopEncounter(s)).toBe(true);
  });
  it('the actual common heavy wound produces a living surrender with unchanged old materials', () => {
    const s = fixture(), old = structuredClone(s.nightwatcher); start(s);
    const result = round(s, 'ATTACK', 1, 1, 101, 1, 100, 1, 70);
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(s.fearBishop.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 70, enemyStatus: 'SURRENDERED', weaponLocation: 'YARD' });
    expect(s.nightwatcher).toEqual(old); expect(s.fearBishop.encounter.enemyInjuries).toHaveLength(1); expect(validateFearBishopEncounter(s)).toBe(true);
  });
  it('common player death remains real while the same actually deployed Leaf is recalled once', () => {
    const s = fixture(), old = structuredClone(s.nightwatcher), spirit = structuredClone(s.spiritWarlock); start(s);
    const result = round(s, 'ATTACK', 1, 1, 366, 1, 1_000_000, 100); s.status = 'DEAD';
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.combat).toBeNull(); expect(s.fearBishop.encounter.status).toBe('LOST');
    expect(s.spiritWarlock).toEqual({ ...spirit, companion: { ...spirit.companion, deployments: 11, recalls: 11 } });
    expect(s.spirituality).toBe(118); expect(s.nightwatcher).toEqual(old); expect(validateFearBishopEncounter(s)).toBe(true);
  });
  it('does not accept a forged terminal or refill an independent depleted enemy pool', () => {
    const s = fixture(); start(s); expect(() => settleFearBishopEncounter(s, 'ENEMY_DEAD', context)).toThrow();
    expect(() => settleFearBishopEncounter(s, 'AUTO_WIN', context)).toThrow(); expect(s.fearBishop.encounter.status).toBe('FIGHTING');
    s.fearBishop.encounter.enemySpirituality--; expect(hasFearBishopDisputeOpponent(s)).toBe(false); expect(validateFearBishopEncounter(s)).toBe(false);
  });
  it('rejects edits to persisted action costs, old-spirit counts and inter-round continuity', () => {
    const s = fixture(); start(s); round(s, 'ATTACK', 1, 1, 366, 100, 1);
    expect(validateFearBishopEncounter(s)).toBe(true);
    const mutations: ((copy: SliceState) => void)[] = [copy => { copy.spiritWarlock.companion.recalls--; },
      copy => { copy.combatHistory.at(-1)!.fearBishopOutcome!.playerActions[0]!.paidCost = 0; },
      copy => { copy.combatHistory.at(-1)!.fearBishopOutcome!.companionAfter.releases++; },
      copy => { copy.fearBishop.encounter.weaponLocation = 'YARD'; }];
    for (const mutate of mutations) { const copy = structuredClone(s); mutate(copy); expect(validateFearBishopEncounter(copy)).toBe(false); }
  });
});
