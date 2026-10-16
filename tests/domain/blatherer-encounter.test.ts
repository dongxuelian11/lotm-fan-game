import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { baseAdvantage } from '../../src/domain/slice/combat.js';
import { resolveBlathererCombatRound } from '../../src/domain/slice/blatherer-combat.js';
import { createBlathererState } from '../../src/domain/blatherer/index.js';
import {
  createBlathererEncounterState, applyBlathererEncounterCommand, blockBlathererEncounter,
  projectBlathererEncounter, validateBlathererEncounter, validateBlathererEncounterCommand,
  hasBlathererCourtOpponent, hasBlathererEncounterLock, settleBlathererEncounter,
} from '../../src/domain/blatherer/encounter.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const K = 'abyss.s3.limited-murmur';
const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No free scene check'); } };
/** Directed boundary setup on genuine434-command Devil4 history; this is not a natural S3 promotion. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/devil-v01330/natural.json', 'utf8')).final);
  s.blatherer = createBlathererState(); s.blatherer.guidanceKnown = true; s.blatherer.promotionWeek = s.week; s.blatherer.devilActingAtPromotion = 100;
  s.progression.sequence = 3; s.progression.acting = 0; s.progression.mastery[K] = 0; s.character.coreStats.knowledge = 18;
  s.actionsRemaining = 3; s.spirituality = 120; s.health = 100; s.mind = 100; s.activeEvent = null; s.combat = null; return s;
}
function talk(s: SliceState) { applyBlathererEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); }
function start(s: SliceState) { talk(s); applyBlathererEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); }
function script(...values: number[]) { let index = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${index}: ${n}, ${min}..${max}`); return n;
  }); }
function round(s: SliceState, stance: SliceStance, ...values: number[]) {
  const spy = script(...values), result = resolveBlathererCombatRound(s, stance); s.combatHistory.push(result.round); expect(spy).toHaveBeenCalledTimes(values.length); vi.restoreAllMocks();
  settleBlathererEncounter(s, result.outcome, context); return result;
}
const legacy = (s: SliceState) => structuredClone({ criminal: s.criminal, unwinged: s.unwinged, serialKiller: s.serialKiller, demon: s.demon, desireApostle: s.desireApostle, devil: s.devil, town: s.town });
afterEach(() => vi.restoreAllMocks());

describe('Blatherer independent originalEdric and shared actual consequences', () => {
  it('creates adult48Edric100/100/120S4 withownrod without replacing surrenderedOriick', () => {
    const s = fixture(), old = legacy(s);
    expect(createBlathererEncounterState()).toMatchObject({ targetId: 'BL3-EDRIC', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120,
      enemyStatus: 'RESISTING', weaponLocation: 'HAND', whisperReady: false, residualSeconds: 0, breathUses: 0,
      scene: { courtId: 'BL3-COURT', playerPosition: 'COURT', distanceMetres: 4, exitMetres: 4, thirdPartiesInArea: 0, targetAwake: true, targetListening: true } });
    expect(projectBlathererEncounter(s).enemy).toMatchObject({ name: '埃德里克·凯尔', age: 48, sequence: 4, weaponId: 'BL3-EDRIC-ROD', source: 'ORIGINAL_LIMITED_G' });
    expect(s.devil.encounter).toMatchObject({ targetId: 'DV4-ORRICK-FANE', enemyHealth: 70, enemyStatus: 'SURRENDERED', enemySpirituality: 32 });
    expect(legacy(s)).toEqual(old); expect(validateBlathererEncounter(s)).toBe(true);
  });
  it('requires actualtalk1AP then explicitfight1AP with no automatic conflict', () => {
    const s = fixture(); expect(blockBlathererEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toContain('先实际交谈');
    s.actionsRemaining = 1; expect(blockBlathererEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留'); s.actionsRemaining = 2;
    talk(s); expect(s.actionsRemaining).toBe(1); expect(s.combat).toBeNull(); expect(hasBlathererEncounterLock(s)).toBe(true); expect(validateBlathererEncounter(s)).toBe(true);
    applyBlathererEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); expect(s.actionsRemaining).toBe(0); expect(hasBlathererCourtOpponent(s)).toBe(true); expect(validateBlathererEncounter(s)).toBe(true);
  });
  it('hides newopponent facts beforeS3 while initialstate remains valid', () => {
    const s = fixture(); s.progression.sequence = 4; s.blatherer.promotionWeek = null; const view = projectBlathererEncounter(s);
    expect(view.enemy).toBeNull(); expect(view.story).toBe(''); expect(view.facts).toEqual([]); expect(view.actions).toEqual([]); expect(view.scene).toBeNull();
    expect(JSON.stringify(view)).not.toMatch(/EDRIC|埃德里克/); expect(validateBlathererEncounter(s)).toBe(true);
  });
  it('zeroAP peacefulexit atzeroMind physicallywalks4m4seconds and neverrespawns', () => {
    const s = fixture(), old = legacy(s); talk(s); s.actionsRemaining = 0; s.mind = 0; s.spirituality = 87;
    applyBlathererEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context);
    expect(s.blatherer.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'RESISTING', enemySpirituality: 120, weaponLocation: 'HAND', scene: { playerPosition: 'EXIT', ordinaryWalkedMetres: 4, targetListening: false } });
    expect(s.blatherer.life.clockSeconds).toBe(4); expect(legacy(s)).toEqual(old); expect(hasBlathererEncounterLock(s)).toBe(false); expect(validateBlathererEncounter(s)).toBe(true);
    expect(s.progression.acting).toBe(0); expect(s.spirituality).toBe(87); s.mind = 100; s.actionsRemaining = 3; expect(blockBlathererEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('不重新');
  });
  it('rejects extraauthority,wrongcity,forgedoriginalcourt,oldtarget and freeenemyS', () => {
    expect(validateBlathererEncounterCommand({ type: 'ENCOUNTER_TALK' })).toBe(true); expect(validateBlathererEncounterCommand({ type: 'ENCOUNTER_FIGHT', forceObedience: true })).toBe(false);
    const s = fixture(); s.world.city = 'TINGEN'; expect(blockBlathererEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull(); s.world.city = 'BACKLUND';
    s.blatherer.encounter.scene.courtId = 'OTHER' as 'BL3-COURT'; expect(blockBlathererEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    const wrong = fixture(); start(wrong); wrong.blatherer.encounter.targetId = 'DV4-ORRICK-FANE' as 'BL3-EDRIC'; expect(hasBlathererCourtOpponent(wrong)).toBe(false); expect(validateBlathererEncounter(wrong)).toBe(false);
    const extra = fixture(); start(extra); extra.blatherer.encounter.enemySpirituality = 121; expect(hasBlathererCourtOpponent(extra)).toBe(false); expect(validateBlathererEncounter(extra)).toBe(false);
  });
  it('requires realguidance,promotion and cleanup oforiginaloldcontacts', () => {
    const changes: ((s: SliceState) => void)[] = [s => { s.blatherer.guidanceKnown = false; }, s => { s.blatherer.promotionWeek = null; }, s => { s.blatherer.preparedWeek = s.week; },
      s => { s.devil.life.cases['stage-decision'].status = 'PREPARED'; }, s => { s.demon.practice.flame = 'LIT'; }];
    for (const change of changes) { const s = fixture(); change(s); const before = structuredClone(s); expect(() => applyBlathererEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context)).toThrow(); expect(s).toEqual(before); }
  });
  it('ordinaryretreat exits4m4seconds afteractual60secondround withouthealingorrefill', () => {
    const s = fixture(), old = legacy(s); s.spirituality = 93; start(s); const result = round(s, 'RETREAT', 1, 1, 1);
    expect(result.outcome).toBe('RETREATED'); expect(s.combat).toBeNull(); expect(s.blatherer.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 120, scene: { playerPosition: 'EXIT', ordinaryWalkedMetres: 4 } });
    expect(result.round.blathererOutcome).toMatchObject({ elapsedSeconds: 64, cleanupWaitSeconds: 0, exitSeconds: 4 });
    expect(legacy(s)).toEqual(old); expect(s.spirituality).toBe(93); expect(s.blatherer.life.clockSeconds).toBe(64); expect(validateBlathererEncounter(s)).toBe(true);
  });
  it('uses actualabyss35/30/15/20 weightedcore1250 and12S recoveryonlyCONTINUE', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 100; start(s);
    const result = round(s, 'ATTACK', 1, 1, 426, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(baseAdvantage(22, 100, 100, 100, 1250, 120) - 22.5);
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(22, 100, 100, 120, 1250, 120)); expect(result.round.consequenceWeights).toBeNull(); expect(s.spirituality).toBe(112); expect(validateBlathererEncounter(s)).toBe(true);
    const end = round(s, 'RETREAT', 1, 1, 100, 1); expect(end.outcome).toBe('RETREATED'); expect(s.spirituality).toBe(112); expect(s.blatherer.life.clockSeconds).toBe(124); expect(validateBlathererEncounter(s)).toBe(true);
  });
  it('successfulwhisper andactualbreath have noinjurythreat or free refund', () => {
    const s = fixture(), old = legacy(s); s.spirituality = 100; start(s); const result = round(s, 'ATTACK', 1, 1, 306, 1, 86, 1);
    expect(result.round.blathererOutcome!.playerActions[0]).toMatchObject({ id: K, paidCost: 4, mindCost: 1, selfGain: 0, enemyReduction: 0, threatens: false });
    expect(result.round.blathererOutcome!.enemyActions[0]).toMatchObject({ actual: 'STEADY_BREATH', paidCost: 0, whisperCleared: true, selfGain: 8, threatens: false });
    expect(result.round.consequenceWeights).toBeNull(); expect(s.health).toBe(100); expect(s.mind).toBe(99); expect(s.spirituality).toBe(108); expect(s.blatherer.encounter.enemySpirituality).toBe(120);
    expect(s.blatherer.encounter.whisperReady).toBe(false); expect(s.blatherer.encounter.residualSeconds).toBe(0); expect(legacy(s)).toEqual(old); expect(validateBlathererEncounter(s)).toBe(true);
  });
  it('failedwhisper retains4S1M and ordinarybreath creates noeffect', () => {
    const s = fixture(); s.spirituality = 100; start(s); const result = round(s, 'ATTACK', 1, 1, 306, 100, 86, 1);
    expect(result.round.blathererOutcome!.playerActions[0]).toMatchObject({ paidCost: 4, mindCost: 1, mode: 'FAILED', prepared: null });
    expect(result.round.blathererOutcome!.enemyActions[0]).toMatchObject({ paidCost: 0, whisperCleared: false, threatens: false });
    expect(result.round.consequenceWeights).toBeNull(); expect(s.spirituality).toBe(108); expect(s.mind).toBe(99); expect(validateBlathererEncounter(s)).toBe(true);
  });
  it('evenround enemyinitiative acts before laterplayerwhisper without retroactive reduction', () => {
    const s = fixture(); start(s); round(s, 'ATTACK', 1, 1, 426, 100, 1);
    const result = round(s, 'ATTACK', 1, 1, 1, 306, 1, 1);
    expect(result.round.first).toBe('ENEMY'); expect(result.round.blathererOutcome!.enemyActions[0]).toMatchObject({ order: 0, selfGain: 70, whisperConsumed: false, paidCost: 5 });
    expect(result.round.blathererOutcome!.playerActions[0]).toMatchObject({ order: 1, prepared: 'WHISPER' });
    expect(result.round.consequenceWeights).toBeNull(); expect(s.blatherer.encounter.whisperReady).toBe(false); expect(validateBlathererEncounter(s)).toBe(true);
  });
  it('retreat mayfail; enemyrealpaidattack still resolves through commoninjurywheel', () => {
    const s = fixture(); start(s); const result = round(s, 'RETREAT', 1, 1, 100, 1, 1_000_000, 1);
    expect(result.round.retreat).toBe('FAILURE'); expect(result.outcome).toBe('CONTINUE'); expect(s.health).toBe(90); expect(s.blatherer.encounter.enemySpirituality).toBe(115);
    expect(result.round.consequenceWeights).toMatchObject({ light: 65, heavy: 30, death: 5 }); expect(validateBlathererEncounter(s)).toBe(true);
  });
  it('shareddeath kills actualEdric and leaves ownrod inoriginalcourt without revivingOriick', () => {
    const s = fixture(), old = legacy(s); start(s); const result = round(s, 'ATTACK', 1, 1, 1, 100, 1, 100);
    expect(result.outcome).toBe('ENEMY_DEAD'); expect(s.blatherer.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 0, enemyStatus: 'DEAD', weaponLocation: 'COURT',
      scene: { playerPosition: 'EXIT', ordinaryWalkedMetres: 4, targetAwake: false, targetListening: false } });
    expect(legacy(s)).toEqual(old); expect(s.spirituality).toBe(120); expect(validateBlathererEncounter(s)).toBe(true); expect(blockBlathererEncounter(s, { type: 'ENCOUNTER_FIGHT' })).not.toBeNull();
    const reset = structuredClone(s); reset.blatherer.encounter = createBlathererEncounterState(); expect(validateBlathererEncounter(reset)).toBe(false); expect(blockBlathererEncounter(reset, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
  });
  it('realheavyinjury produces independent surrender and actualrod drop withenemyspellcost retained', () => {
    const s = fixture(), old = legacy(s); start(s); const result = round(s, 'ATTACK', 1, 1, 1, 1, 1, 70);
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(s.blatherer.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 70, enemyStatus: 'SURRENDERED', weaponLocation: 'COURT', enemySpirituality: 115 });
    expect(legacy(s)).toEqual(old); expect(s.blatherer.encounter.enemyInjuries).toHaveLength(1); expect(s.town.clubLocation).toBe('SHOP'); expect(validateBlathererEncounter(s)).toBe(true);
  });
  it('limitedwhisper isnotinvulnerability: halfarc stillcan kill realplayer', () => {
    const s = fixture(), old = legacy(s); start(s); const result = round(s, 'ATTACK', 1, 1, 306, 1, 1, 1_000_000, 100); s.status = 'DEAD';
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.combat).toBeNull(); expect(s.blatherer.encounter).toMatchObject({ status: 'LOST', enemyHealth: 100, enemySpirituality: 115, weaponLocation: 'HAND', scene: { playerPosition: 'COURT', ordinaryWalkedMetres: 0 } });
    expect(result.round.blathererOutcome!.enemyActions[0]).toMatchObject({ selfGain: 35, paidCost: 5, whisperConsumed: true, threatens: true });
    expect(result.round.blathererOutcome).toMatchObject({ cleanupWaitSeconds: 30, exitSeconds: 0, elapsedSeconds: 90 });
    expect(legacy(s)).toEqual(old); expect(s.spirituality).toBe(116); expect(s.mind).toBe(99); expect(validateBlathererEncounter(s)).toBe(true);
  });
  it('replays actual inheriteddemon strain acrosscontinuedrounds and prevents resets', () => {
    const s = fixture(); s.demon.strain = 0; start(s); round(s, 'ATTACK', 1, 1, 226, 100, 1);
    expect(s.demon.strain).toBe(1); expect(s.combatHistory.at(-1)!.blathererOutcome).toMatchObject({ source: { strain: 0 }, playerStrainAfter: 1 });
    expect(validateBlathererEncounter(s)).toBe(true); const altered = structuredClone(s); altered.demon.strain = 0; expect(validateBlathererEncounter(altered)).toBe(false);
    round(s, 'ATTACK', 1, 1, 100, 226, 1); expect(s.demon.strain).toBe(2); expect(validateBlathererEncounter(s)).toBe(true);
  });
  it('rejects fabricatedterminal,costs,counts,initiative,clock,carryover and refunds', () => {
    const s = fixture(); start(s); expect(() => settleBlathererEncounter(s, 'ENEMY_DEAD', context)).toThrow(); expect(() => settleBlathererEncounter(s, 'AUTO_WIN', context)).toThrow();
    round(s, 'ATTACK', 1, 1, 306, 1, 86, 1); expect(validateBlathererEncounter(s)).toBe(true);
    const changes: ((copy: SliceState) => void)[] = [c => { c.blatherer.encounter.enemySpirituality = 119; }, c => { c.blatherer.encounter.whisperReady = true; }, c => { c.blatherer.encounter.residualSeconds = 30; },
      c => { c.combatHistory.at(-1)!.blathererOutcome!.playerActions[0]!.paidCost = 0; }, c => { c.combatHistory.at(-1)!.blathererOutcome!.enemyActions[0]!.whisperCleared = false; },
      c => { c.blatherer.encounter.scene.clearanceConfirmed = false; }, c => { c.blatherer.encounter.weaponLocation = 'COURT'; }, c => { c.spirituality--; }, c => { c.mind++; },
      c => { c.blatherer.life.clockSeconds--; }, c => { c.combatHistory.at(-1)!.first = 'ENEMY'; }, c => { c.combatHistory.at(-1)!.playerCountRoll = 100; },
      c => { c.combatHistory.at(-1)!.blathererOutcome!.playerActions[0]!.order = 1; }, c => { c.blatherer.encounter.enemyHealth = 99; }, c => { c.blatherer.encounter.breathUses = 0; }];
    for (const change of changes) { const copy = structuredClone(s); change(copy); expect(validateBlathererEncounter(copy)).toBe(false); }
  });
});
