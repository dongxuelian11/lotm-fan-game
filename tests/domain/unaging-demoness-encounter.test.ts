import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { baseAdvantage } from '../../src/domain/slice/combat.js';
import { resolveUnagingDemonessCombatRound } from '../../src/domain/slice/unaging-demoness-combat.js';
import { createUnagingDemonessState } from '../../src/domain/unaging-demoness/index.js';
import {
  createUnagingDemonessEncounterState, applyUnagingDemonessEncounterCommand, blockUnagingDemonessEncounter,
  projectUnagingDemonessEncounter, validateUnagingDemonessEncounter, validateUnagingDemonessEncounterCommand,
  hasUnagingDemonessDisputeOpponent, hasUnagingDemonessEncounterLock, settleUnagingDemonessEncounter,
} from '../../src/domain/unaging-demoness/encounter.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No free scene check'); } };
/** Explicit directed S3 setup on genuine natural361-command S4 prefix; no old actor resets. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/despair-v01300/natural.json', 'utf8')).final);
  s.unagingDemoness = createUnagingDemonessState(); s.unagingDemoness.guidanceKnown = true; s.unagingDemoness.promotionWeek = s.week; s.unagingDemoness.despairActingAtPromotion = 100;
  s.progression.sequence = 3; s.progression.acting = 0; s.progression.mastery['assassin.s3.mirror-passage'] = 0; s.character.coreStats.knowledge = 30;
  s.actionsRemaining = 3; s.spirituality = 120; s.health = 100; s.mind = 100; s.activeEvent = null; s.combat = null; return s;
}
function talk(s: SliceState) { applyUnagingDemonessEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); }
function start(s: SliceState) { talk(s); applyUnagingDemonessEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); }
function script(...values: number[]) { let index = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${index}: ${n}, ${min}..${max}`); return n;
  }); }
function round(s: SliceState, stance: 'ATTACK' | 'RETREAT', ...values: number[]) {
  script(...values); const result = resolveUnagingDemonessCombatRound(s, stance); s.combatHistory.push(result.round); vi.restoreAllMocks();
  settleUnagingDemonessEncounter(s, result.outcome, context); return result;
}
const legacy = (s: SliceState) => structuredClone({ assassin: s.assassin, instigator: s.instigator, witch: s.witch, pleasure: s.pleasure, pain: s.pain, despair: s.despair, town: s.town });
afterEach(() => vi.restoreAllMocks());

describe('UnagingDemoness original Corbin49 encounter and common consequences', () => {
  it('creates independentCorbin100/100/120 while originalValen60H12S surrendered and diseasecare0 remain', () => {
    const s = fixture(), old = legacy(s);
    expect(createUnagingDemonessEncounterState()).toMatchObject({ targetId: 'UD3-CORBIN', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120,
      enemyStatus: 'RESISTING', weaponLocation: 'HAND', scene: { playerPosition: 'A', mirrorA: { id: 'UD3-COMBAT-A', intact: true }, mirrorB: { id: 'UD3-COMBAT-B', intact: true } } });
    expect(projectUnagingDemonessEncounter(s).enemy).toMatchObject({ name: '科宾·里德', age: 49, sequence: 3, weaponId: 'UD3-CORBIN-ROD', source: 'ORIGINAL_LIMITED_G' });
    expect(s.despair.encounter).toMatchObject({ targetId: 'DP4-VALEN-HOLT', enemyHealth: 60, enemyStatus: 'SURRENDERED', enemySpirituality: 12, enemyDisease: 0 });
    expect(s.despair.encounter.careVisits).toHaveLength(1); expect(legacy(s)).toEqual(old); expect(validateUnagingDemonessEncounter(s)).toBe(true);
  });
  it('requires realtalk1AP and explicitfight1AP with actual two mirror confirmation', () => {
    const s = fixture(); expect(blockUnagingDemonessEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toContain('先实际交谈');
    s.actionsRemaining = 1; expect(blockUnagingDemonessEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留'); s.actionsRemaining = 2;
    talk(s); expect(s.actionsRemaining).toBe(1); expect(s.combat).toBeNull(); expect(s.unagingDemoness.encounter.scene.clearanceConfirmed).toBe(true); expect(hasUnagingDemonessEncounterLock(s)).toBe(true);
    applyUnagingDemonessEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); expect(s.actionsRemaining).toBe(0); expect(hasUnagingDemonessDisputeOpponent(s)).toBe(true); expect(validateUnagingDemonessEncounter(s)).toBe(true);
  });
  it('hides new opponent facts and scene beforeS3', () => {
    const s = fixture(); s.progression.sequence = 4; s.unagingDemoness.promotionWeek = null; const view = projectUnagingDemonessEncounter(s);
    expect(view.enemy).toBeNull(); expect(view.story).toBe(''); expect(view.facts).toEqual([]); expect(view.actions).toEqual([]); expect(view.scene).toBeNull(); expect(JSON.stringify(view)).not.toMatch(/CORBIN|科宾/); expect(validateUnagingDemonessEncounter(s)).toBe(true);
  });
  it('allows0AP peaceful exit atmind0 with actual2m and original resources preserved', () => {
    const s = fixture(), old = legacy(s); talk(s); s.actionsRemaining = 0; s.mind = 0; s.spirituality = 87;
    applyUnagingDemonessEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context);
    expect(s.unagingDemoness.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'RESISTING', enemySpirituality: 120, weaponLocation: 'HAND', scene: { playerPosition: 'EXIT', ordinaryWalkedMetres: 2, mirrorPassedMetres: 0 } });
    expect(legacy(s)).toEqual(old); expect(hasUnagingDemonessEncounterLock(s)).toBe(false); expect(validateUnagingDemonessEncounter(s)).toBe(true); expect(s.progression.acting).toBe(0); expect(s.spirituality).toBe(87);
    s.mind = 100; s.actionsRemaining = 3; expect(blockUnagingDemonessEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('不重新');
  });
  it('rejects extra command authority, wrong city, missingoriginalmirror and substitutedValen', () => {
    expect(validateUnagingDemonessEncounterCommand({ type: 'ENCOUNTER_TALK' })).toBe(true); expect(validateUnagingDemonessEncounterCommand({ type: 'ENCOUNTER_FIGHT', repairMirror: true })).toBe(false);
    const s = fixture(); s.world.city = 'TINGEN'; expect(blockUnagingDemonessEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull(); s.world.city = 'BACKLUND';
    s.unagingDemoness.encounter.scene.mirrorB.id = 'NEW-B' as 'UD3-COMBAT-B'; expect(blockUnagingDemonessEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    const old = fixture(); start(old); old.unagingDemoness.encounter.targetId = 'DP4-VALEN-HOLT' as 'UD3-CORBIN'; expect(hasUnagingDemonessDisputeOpponent(old)).toBe(false); expect(validateUnagingDemonessEncounter(old)).toBe(false);
  });
  it('requires original guidance/promotion and real cleanup of prepared current/old cases', () => {
    const mutations: ((s: SliceState) => void)[] = [s => { s.unagingDemoness.guidanceKnown = false; }, s => { s.unagingDemoness.promotionWeek = null; },
      s => { s.unagingDemoness.preparedWeek = s.week; }, s => { s.unagingDemoness.life.cases['dated-record'].status = 'PREPARED'; }, s => { s.despair.life.cases['room-clearance'].status = 'PREPARED'; }];
    for (const mutate of mutations) { const s = fixture(); mutate(s); const before = structuredClone(s); expect(() => applyUnagingDemonessEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context)).toThrow(); expect(s).toEqual(before); }
  });
  it('ordinary retreat actually walksA2m with60seconds and keeps wounds/resources without continuation refill', () => {
    const s = fixture(), old = legacy(s); s.spirituality = 93; start(s); const result = round(s, 'RETREAT', 1, 1, 1);
    expect(result.outcome).toBe('RETREATED'); expect(s.combat).toBeNull(); expect(s.unagingDemoness.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 120, scene: { playerPosition: 'EXIT', ordinaryWalkedMetres: 2 } });
    expect(legacy(s)).toEqual(old); expect(s.spirituality).toBe(93); expect(s.unagingDemoness.life.clockSeconds).toBe(60); expect(validateUnagingDemonessEncounter(s)).toBe(true);
  });
  it('retainsactual25/30/30/15 core1250/floor125 and recovers12S onlyforCONTINUE', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 100; start(s);
    const result = round(s, 'ATTACK', 1, 1, 426, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(baseAdvantage(23.5, 100, 100, 100, 1250, 120) - 22.5);
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 120, 1250, 120) - 22.5); expect(result.round.consequenceWeights).toBeNull(); expect(s.spirituality).toBe(112); expect(validateUnagingDemonessEncounter(s)).toBe(true);
    const end = round(s, 'RETREAT', 1, 1, 100, 1); expect(end.outcome).toBe('RETREATED'); expect(s.spirituality).toBe(112); expect(validateUnagingDemonessEncounter(s)).toBe(true);
  });
  it('actual mirrorpass2m adds no injury threat; next round brokenB fallback retains originalBpoint and costs', () => {
    const s = fixture(), old = legacy(s); start(s); const first = round(s, 'ATTACK', 1, 1, 306, 1, 100, 1);
    expect(first.round.unagingDemonessOutcome!.playerActions[0]).toMatchObject({ id: 'assassin.s3.mirror-passage', paidCost: 6, enemyReduction: 36, threatens: false, from: 'A', to: 'B' });
    expect(first.round.consequenceWeights).toBeNull(); expect(s.unagingDemoness.encounter.scene).toMatchObject({ playerPosition: 'B', mirrorPassedMetres: 2 }); expect(validateUnagingDemonessEncounter(s)).toBe(true);
    const second = round(s, 'ATTACK', 1, 1, 81, 306, 1);
    expect(second.round.unagingDemonessOutcome!.playerActions[0]).toMatchObject({ paidCost: 0, mode: 'BROKEN_MIRROR', from: 'B', to: 'B' });
    expect(s.unagingDemoness.encounter).toMatchObject({ enemySpirituality: 115, powerUses: { BREAK_MIRROR: 1 }, scene: { playerPosition: 'B', mirrorB: { intact: false } } }); expect(validateUnagingDemonessEncounter(s)).toBe(true);
    round(s, 'RETREAT', 1, 1, 1); expect(s.unagingDemoness.encounter.scene).toMatchObject({ playerPosition: 'EXIT', ordinaryWalkedMetres: 4, mirrorPassedMetres: 2, mirrorB: { intact: false } });
    expect(legacy(s)).toEqual(old); expect(validateUnagingDemonessEncounter(s)).toBe(true);
  });
  it('failedmirror retains6S and originalA with no injury or free traversal', () => {
    const s = fixture(); s.spirituality = 100; start(s); const result = round(s, 'ATTACK', 1, 1, 306, 100, 100, 1);
    expect(result.round.unagingDemonessOutcome!.playerActions[0]).toMatchObject({ paidCost: 6, enemyReduction: 0, mode: 'MIRROR_FAILURE', from: 'A', to: 'A' });
    expect(result.round.consequenceWeights).toBeNull(); expect(s.spirituality).toBe(106); expect(s.unagingDemoness.encounter.scene.mirrorPassedMetres).toBe(0); expect(validateUnagingDemonessEncounter(s)).toBe(true);
  });
  it('shareddeath kills actualCorbin and leaves originalrod while oldValen staysalive', () => {
    const s = fixture(); s.town.clubLocation = 'SHOP'; const old = legacy(s); start(s); const result = round(s, 'ATTACK', 1, 1, 1, 100, 1, 100);
    expect(result.outcome).toBe('ENEMY_DEAD'); expect(s.unagingDemoness.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 0, enemyStatus: 'DEAD', weaponLocation: 'COURT', scene: { playerPosition: 'EXIT', ordinaryWalkedMetres: 2 } });
    expect(legacy(s)).toEqual(old); expect(s.spirituality).toBe(118); expect(validateUnagingDemonessEncounter(s)).toBe(true);
  });
  it('commonheavy injury yields livingCorbin surrender with realrod and spentS', () => {
    const s = fixture(), old = legacy(s); start(s); const result = round(s, 'ATTACK', 1, 1, 1, 1, 1, 70);
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(s.unagingDemoness.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 70, enemyStatus: 'SURRENDERED', weaponLocation: 'COURT', enemySpirituality: 115 });
    expect(legacy(s)).toEqual(old); expect(s.unagingDemoness.encounter.enemyInjuries).toHaveLength(1); expect(validateUnagingDemonessEncounter(s)).toBe(true);
  });
  it('commonplayerdeath remains actualdeath at originalpoint without free resurrection or return', () => {
    const s = fixture(), old = legacy(s); start(s); const result = round(s, 'ATTACK', 1, 1, 426, 1, 1_000_000, 100); s.status = 'DEAD';
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.combat).toBeNull(); expect(s.unagingDemoness.encounter).toMatchObject({ status: 'LOST', enemyHealth: 100, enemySpirituality: 115, weaponLocation: 'HAND', scene: { playerPosition: 'A', ordinaryWalkedMetres: 0 } });
    expect(legacy(s)).toEqual(old); expect(validateUnagingDemonessEncounter(s)).toBe(true);
  });
  it('rejects fabricatedterminal, costs, samebodypoints, repairs, counts, initiative, clock and resource refunds', () => {
    const s = fixture(); start(s); expect(() => settleUnagingDemonessEncounter(s, 'ENEMY_DEAD', context)).toThrow(); expect(() => settleUnagingDemonessEncounter(s, 'AUTO_WIN', context)).toThrow();
    round(s, 'ATTACK', 1, 1, 306, 1, 81, 1); expect(validateUnagingDemonessEncounter(s)).toBe(true);
    const mutations: ((copy: SliceState) => void)[] = [c => { c.unagingDemoness.encounter.enemySpirituality = 120; }, c => { c.unagingDemoness.encounter.scene.mirrorB.intact = true; },
      c => { c.combatHistory.at(-1)!.unagingDemonessOutcome!.playerActions[0]!.paidCost = 0; }, c => { c.unagingDemoness.encounter.scene.playerPosition = 'A'; },
      c => { c.unagingDemoness.encounter.scene.clearanceConfirmed = false; }, c => { c.unagingDemoness.encounter.weaponLocation = 'COURT'; }, c => { c.spirituality--; },
      c => { c.unagingDemoness.life.clockSeconds--; }, c => { c.combatHistory.at(-1)!.first = 'ENEMY'; }, c => { c.combatHistory.at(-1)!.playerCountRoll = 100; },
      c => { c.combatHistory.at(-1)!.unagingDemonessOutcome!.playerActions[0]!.order = 1; }];
    for (const mutate of mutations) { const copy = structuredClone(s); mutate(copy); expect(validateUnagingDemonessEncounter(copy)).toBe(false); }
  });
});
