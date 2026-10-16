import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createArcaneScholarState } from '../../src/domain/arcane-scholar/index.js';
import { findArcaneScholarOriginalCreation } from '../../src/domain/arcane-scholar/life.js';
import { createArcaneScholarEncounterState, applyArcaneScholarEncounterCommand, blockArcaneScholarEncounter,
  projectArcaneScholarEncounter, validateArcaneScholarEncounter, validateArcaneScholarEncounterCommand,
  hasArcaneScholarDisputeOpponent, hasArcaneScholarEncounterLock, settleArcaneScholarEncounter } from '../../src/domain/arcane-scholar/encounter.js';
import { resolveArcaneScholarCombatRound } from '../../src/domain/slice/arcane-scholar-combat.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No scene check in this fixture'); } };
/** Directed post-promotion encounter fixture, retaining the old dead Osric,
 * returned original parcel, and actual box2/100 + frame0/95. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/alchemist-v01200/natural.json', 'utf8')).final);
  s.arcaneScholar = createArcaneScholarState(); s.arcaneScholar.promotionWeek = s.week; s.progression.sequence = 3; s.progression.acting = 0;
  s.progression.mastery['paragon.s3.bounded-analysis'] = 0; s.progression.mastery['paragon.s3.construct-coordination'] = 0;
  s.character.coreStats.knowledge = 30; s.actionsRemaining = 2; s.cash = 400; s.spirituality = 120; s.health = 100; s.mind = 100; s.activeEvent = null; s.combat = null; return s;
}
function start(s: SliceState): void { applyArcaneScholarEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); applyArcaneScholarEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); }
function script(...values: number[]) { let index = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${index}: ${n}, ${min}..${max}`); return n;
  }); }
function round(s: SliceState, stance: 'ATTACK' | 'RETREAT', ...values: number[]) {
  script(...values); const result = resolveArcaneScholarCombatRound(s, stance); s.combatHistory.push(result.round); vi.restoreAllMocks();
  settleArcaneScholarEncounter(s, result.outcome, context); return result;
}
afterEach(() => vi.restoreAllMocks());
describe('Arcane Scholar independent original workshop-yard encounter', () => {
  it('creates original Corwin47 with independent H/M/S120 and exactly one original club', () => {
    const s = fixture(), e = createArcaneScholarEncounterState();
    expect(e).toMatchObject({ status: 'AVAILABLE', targetId: 'AR3-CORWIN', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND', carriedIds: [] });
    expect(projectArcaneScholarEncounter(s).enemy).toMatchObject({ name: '科尔温', age: 47, sequence: 3, weaponId: 'AR3-CORWIN-CLUB' });
    expect(validateArcaneScholarEncounter(s)).toBe(true); expect(validateArcaneScholarEncounterCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    expect(validateArcaneScholarEncounterCommand({ type: 'ENCOUNTER_FIGHT', resetEnemy: true })).toBe(false);
  });
  it('does not disclose new people outside actual Paragon3', () => {
    const s = fixture(); s.progression.sequence = 4; s.arcaneScholar.promotionWeek = null;
    const view = projectArcaneScholarEncounter(s); expect(view.enemy).toBeNull(); expect(view.story).toBe(''); expect(view.actions).toEqual([]); expect(view.facts).toEqual([]);
    expect(JSON.stringify(view)).not.toMatch(/CORWIN|科尔温|工院/); expect(validateArcaneScholarEncounter(s)).toBe(true);
  });
  it('TALK physically carries the same originals and preserves a separate explicit fight choice', () => {
    const s = fixture(), originals = s.alchemist.life.creations, before = structuredClone(originals), old = structuredClone(s.alchemist.encounter);
    s.actionsRemaining = 1; expect(blockArcaneScholarEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留'); s.actionsRemaining = 2;
    applyArcaneScholarEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); expect(s.actionsRemaining).toBe(1); expect(s.combat).toBeNull(); expect(hasArcaneScholarEncounterLock(s)).toBe(true);
    expect(s.alchemist.life.creations).toBe(originals); expect(originals.map(x => x.location)).toEqual(['YARD', 'YARD']); expect(originals.map(x => [x.charge, x.durability])).toEqual(before.map(x => [x.charge, x.durability]));
    expect(s.arcaneScholar.encounter.carriedIds).toEqual(['AL4-BOX-1', 'AL4-FRAME-1']); expect(s.alchemist.encounter).toEqual(old); expect(validateArcaneScholarEncounter(s)).toBe(true);
  });
  it('peaceful ordinary exit physically returns originals and neither reopens nor rewards the dispute', () => {
    const s = fixture(), old = structuredClone(s.alchemist), history = structuredClone(s.combatHistory); applyArcaneScholarEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context);
    s.actionsRemaining = 0; applyArcaneScholarEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context);
    expect(s.actionsRemaining).toBe(0); expect(s.alchemist).toEqual(old); expect(s.combatHistory).toEqual(history); expect(s.arcaneScholar.encounter.status).toBe('RESOLVED');
    expect(blockArcaneScholarEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull(); expect(hasArcaneScholarEncounterLock(s)).toBe(false); expect(validateArcaneScholarEncounter(s)).toBe(true);
  });
  it('blocks unrelated preparation, wrong city, inadequate mind and forged original opponents', () => {
    for (const change of [(s: SliceState) => { s.arcaneScholar.preparedWeek = s.week; }, (s: SliceState) => { s.world.city = 'TINGEN'; }, (s: SliceState) => { s.mind = 0; },
      (s: SliceState) => { s.arcaneScholar.life.cases['tolerance-map'].status = 'PREPARED'; }]) {
      const s = fixture(); change(s); expect(blockArcaneScholarEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    }
    const s = fixture(); start(s); expect(hasArcaneScholarDisputeOpponent(s)).toBe(true); s.arcaneScholar.encounter.targetId = 'AL4-OSRIC' as 'AR3-CORWIN';
    expect(hasArcaneScholarDisputeOpponent(s)).toBe(false); expect(validateArcaneScholarEncounter(s)).toBe(false);
  });
  it('retreat returns original objects with no spirit recharge and leaves old dead Osric untouched', () => {
    const s = fixture(), old = structuredClone(s.alchemist), history = s.combatHistory.length; start(s);
    expect(s.arcaneScholar.encounter.startHistoryIndex).toBe(history); expect(s.combat?.encounterId).toBe('ARCANE_SCHOLAR_DISPUTE');
    const result = round(s, 'RETREAT', 1, 1, 1); expect(result.outcome).toBe('RETREATED'); expect(s.combat).toBeNull(); expect(s.alchemist).toEqual(old);
    expect(s.arcaneScholar.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(s.alchemist.encounter.enemy).toMatchObject({ health: 0, status: 'DEAD', weaponLocation: 'YARD' }); expect(validateArcaneScholarEncounter(s)).toBe(true);
  });
  it('CONTINUE alone restores12 playerS, keeps enemy spend, and persists originals through next retreat', () => {
    const s = fixture(); s.spirituality = 100; start(s);
    const first = round(s, 'ATTACK', 1, 1, 410, 91, 1); // Both observe, no common injury draw.
    expect(first.outcome).toBe('CONTINUE'); expect(s.spirituality).toBe(112); expect(first.round.arcaneScholarOutcome!.playerSpiritualityAfter).toBe(100); expect(validateArcaneScholarEncounter(s)).toBe(true);
    const last = round(s, 'RETREAT', 1, 1, 1, 1); // Even round: enemy arc bolt, then actual retreat.
    expect(last.outcome).toBe('RETREATED'); expect(s.spirituality).toBe(112); expect(s.arcaneScholar.encounter.enemySpirituality).toBe(115);
    expect(s.alchemist.life.creations.map(x => [x.location, x.charge, x.durability])).toEqual([['PLAYER', 2, 100], ['PLAYER', 0, 95]]); expect(validateArcaneScholarEncounter(s)).toBe(true);
  });
  it('does not fabricate a terminal until the actual current round is appended', () => {
    const s = fixture(); start(s); expect(() => settleArcaneScholarEncounter(s, 'ENEMY_SURRENDERED', context)).toThrow();
    script(1, 1, 1); const result = resolveArcaneScholarCombatRound(s, 'RETREAT'); vi.restoreAllMocks();
    expect(() => settleArcaneScholarEncounter(s, result.outcome, context)).toThrow(); s.combatHistory.push(result.round);
    const originalBox = findArcaneScholarOriginalCreation(s, 'AL4-BOX-1')!; originalBox.charge++; expect(() => settleArcaneScholarEncounter(s, result.outcome, context)).toThrow(); originalBox.charge--;
    settleArcaneScholarEncounter(s, result.outcome, context);
    expect(validateArcaneScholarEncounter(s)).toBe(true); s.arcaneScholar.encounter.enemySpirituality--; expect(validateArcaneScholarEncounter(s)).toBe(false);
  });
  it('common real player death leaves both original objects stopped in this yard without resurrection', () => {
    const s = fixture(), old = structuredClone(s.alchemist.encounter); start(s);
    const result = round(s, 'ATTACK', 1, 1, 410, 1, 1_000_000, 100);
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.arcaneScholar.encounter.status).toBe('LOST'); expect(s.combat).toBeNull();
    expect(s.alchemist.life.creations.map(x => [x.location, x.active, x.charge])).toEqual([['YARD', false, 2], ['YARD', false, 0]]); expect(s.alchemist.encounter).toEqual(old); expect(validateArcaneScholarEncounter(s)).toBe(true);
    expect(blockArcaneScholarEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
  });
  it('common enemy physical death keeps Corwin and his club here and returns only the player originals', () => {
    const s = fixture(), old = structuredClone(s.alchemist.encounter); start(s);
    const result = round(s, 'ATTACK', 1, 1, 340, 91, 1, 100);
    expect(result.outcome).toBe('ENEMY_DEAD'); expect(s.arcaneScholar.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 0, enemyStatus: 'DEAD', weaponLocation: 'YARD' });
    expect(s.alchemist.life.creations.every(x => x.location === 'PLAYER' && !x.active)).toBe(true); expect(s.alchemist.encounter).toEqual(old); expect(validateArcaneScholarEncounter(s)).toBe(true);
    expect(findArcaneScholarOriginalCreation(s, 'AL4-FRAME-1')!.charge).toBe(0);
  });
});
