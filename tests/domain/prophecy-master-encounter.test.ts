import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { baseAdvantage } from '../../src/domain/slice/combat.js';
import { resolveProphecyMasterCombatRound } from '../../src/domain/slice/prophecy-master-combat.js';
import { createProphecyMasterState } from '../../src/domain/prophecy-master/index.js';
import {
  createProphecyMasterEncounterState, applyProphecyMasterEncounterCommand, blockProphecyMasterEncounter,
  projectProphecyMasterEncounter, validateProphecyMasterEncounter, validateProphecyMasterEncounterCommand,
  hasProphecyMasterDisputeOpponent, hasProphecyMasterEncounterLock, settleProphecyMasterEncounter,
} from '../../src/domain/prophecy-master/encounter.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const G = 'hermit.s3.prophetic-glimpse';
const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No free scene check'); } };
/** Directed S3 setup on actual unchanged411-command Mystic4 prefix, never a claimed natural promotion. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/mystic-v01310/natural.json', 'utf8')).final);
  s.prophecyMaster = createProphecyMasterState(); s.prophecyMaster.guidanceKnown = true; s.prophecyMaster.promotionWeek = s.week; s.prophecyMaster.mysticActingAtPromotion = 100;
  s.progression.sequence = 3; s.progression.acting = 0; s.progression.mastery[G] = 0; s.character.coreStats.knowledge = 30;
  s.actionsRemaining = 3; s.spirituality = 120; s.health = 100; s.mind = 100; s.activeEvent = null; s.combat = null; return s;
}
function talk(s: SliceState) { applyProphecyMasterEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); }
function start(s: SliceState) { talk(s); applyProphecyMasterEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); }
function script(...values: number[]) { let index = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${index}: ${n}, ${min}..${max}`); return n;
  }); }
function round(s: SliceState, stance: SliceStance, ...values: number[]) {
  const spy = script(...values), result = resolveProphecyMasterCombatRound(s, stance); s.combatHistory.push(result.round); expect(spy).toHaveBeenCalledTimes(values.length); vi.restoreAllMocks();
  settleProphecyMasterEncounter(s, result.outcome, context); return result;
}
const legacy = (s: SliceState) => structuredClone({ pryer: s.pryer, combatScholar: s.combatScholar, wizard: s.wizard, scrollProfessor: s.scrollProfessor, starMystic: s.starMystic, mystic: s.mystic, town: s.town });
afterEach(() => vi.restoreAllMocks());

describe('ProphecyMaster independent originalOsric and shared actualconsequences', () => {
  it('creates48yearOsric100/100/120 withownrod, leavesoldLucan70H17S surrendered', () => {
    const s = fixture(), old = legacy(s);
    expect(createProphecyMasterEncounterState()).toMatchObject({ targetId: 'PM3-OSRIC', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120,
      enemyStatus: 'RESISTING', weaponLocation: 'HAND', cageReady: false, echoReady: false, propheticWindow: false,
      scene: { courtId: 'PM3-COURT', playerPosition: 'COURT', distanceMetres: 4, exitMetres: 4, thirdPartiesInArea: 0 } });
    expect(projectProphecyMasterEncounter(s).enemy).toMatchObject({ name: '奥斯里克·盖尔', age: 48, sequence: 3, weaponId: 'PM3-OSRIC-ROD', source: 'ORIGINAL_LIMITED_G' });
    expect(s.mystic.encounter).toMatchObject({ targetId: 'MY4-LUCAN-VEY', enemyHealth: 70, enemyStatus: 'SURRENDERED', enemySpirituality: 17 });
    expect(s.mystic.life.publicDisclosed).toBe(true); expect(legacy(s)).toEqual(old); expect(validateProphecyMasterEncounter(s)).toBe(true);
  });
  it('requiresactualtalk1AP and explicitfight1AP withoutautomaticcombat', () => {
    const s = fixture(); expect(blockProphecyMasterEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toContain('先实际交谈');
    s.actionsRemaining = 1; expect(blockProphecyMasterEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留'); s.actionsRemaining = 2;
    talk(s); expect(s.actionsRemaining).toBe(1); expect(s.combat).toBeNull(); expect(s.prophecyMaster.encounter.scene.clearanceConfirmed).toBe(true); expect(hasProphecyMasterEncounterLock(s)).toBe(true);
    applyProphecyMasterEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); expect(s.actionsRemaining).toBe(0); expect(hasProphecyMasterDisputeOpponent(s)).toBe(true); expect(validateProphecyMasterEncounter(s)).toBe(true);
  });
  it('hidesnewopponentfacts beforeS3 and leavesinitialstatevalid', () => {
    const s = fixture(); s.progression.sequence = 4; s.prophecyMaster.promotionWeek = null; const view = projectProphecyMasterEncounter(s);
    expect(view.enemy).toBeNull(); expect(view.story).toBe(''); expect(view.facts).toEqual([]); expect(view.actions).toEqual([]); expect(view.scene).toBeNull(); expect(JSON.stringify(view)).not.toMatch(/OSRIC|奥斯里克/); expect(validateProphecyMasterEncounter(s)).toBe(true);
  });
  it('zeroAP peacefulexit atzeroMindwalks4m4seconds and neverrespawns or rewards', () => {
    const s = fixture(), old = legacy(s); talk(s); s.actionsRemaining = 0; s.mind = 0; s.spirituality = 87;
    applyProphecyMasterEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context);
    expect(s.prophecyMaster.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'RESISTING', enemySpirituality: 120, weaponLocation: 'HAND', scene: { playerPosition: 'EXIT', ordinaryWalkedMetres: 4 } });
    expect(s.prophecyMaster.life.clockSeconds).toBe(4); expect(legacy(s)).toEqual(old); expect(hasProphecyMasterEncounterLock(s)).toBe(false); expect(validateProphecyMasterEncounter(s)).toBe(true);
    expect(s.progression.acting).toBe(0); expect(s.spirituality).toBe(87); s.mind = 100; s.actionsRemaining = 3; expect(blockProphecyMasterEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('不重新');
  });
  it('rejectsextraauthority, wrongcity, forgedcourt, oldLucan substitution and freeS', () => {
    expect(validateProphecyMasterEncounterCommand({ type: 'ENCOUNTER_TALK' })).toBe(true); expect(validateProphecyMasterEncounterCommand({ type: 'ENCOUNTER_FIGHT', revealFuture: true })).toBe(false);
    const s = fixture(); s.world.city = 'TINGEN'; expect(blockProphecyMasterEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull(); s.world.city = 'BACKLUND';
    s.prophecyMaster.encounter.scene.courtId = 'OTHER' as 'PM3-COURT'; expect(blockProphecyMasterEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    const wrong = fixture(); start(wrong); wrong.prophecyMaster.encounter.targetId = 'MY4-LUCAN-VEY' as 'PM3-OSRIC'; expect(hasProphecyMasterDisputeOpponent(wrong)).toBe(false); expect(validateProphecyMasterEncounter(wrong)).toBe(false);
    const extra = fixture(); start(extra); extra.prophecyMaster.encounter.enemySpirituality = 121; expect(hasProphecyMasterDisputeOpponent(extra)).toBe(false); expect(validateProphecyMasterEncounter(extra)).toBe(false);
  });
  it('requiresrealguidance, promotion and cleanup ofcurrent/oldpreparedcases', () => {
    const changes: ((s: SliceState) => void)[] = [s => { s.prophecyMaster.guidanceKnown = false; }, s => { s.prophecyMaster.promotionWeek = null; }, s => { s.prophecyMaster.preparedWeek = s.week; },
      s => { s.prophecyMaster.life.cases['bell-schedule'].status = 'PREPARED'; }, s => { s.mystic.life.cases['sealed-story'].status = 'PREPARED'; }];
    for (const change of changes) { const s = fixture(); change(s); const before = structuredClone(s); expect(() => applyProphecyMasterEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context)).toThrow(); expect(s).toEqual(before); }
  });
  it('ordinaryretreat walks4m within60seconds withouthealing/refill or touchedoldroots', () => {
    const s = fixture(), old = legacy(s); s.spirituality = 93; start(s); const result = round(s, 'RETREAT', 1, 1, 1);
    expect(result.outcome).toBe('RETREATED'); expect(s.combat).toBeNull(); expect(s.prophecyMaster.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 120, scene: { playerPosition: 'EXIT', ordinaryWalkedMetres: 4 } });
    expect(legacy(s)).toEqual(old); expect(s.spirituality).toBe(93); expect(s.prophecyMaster.life.clockSeconds).toBe(60); expect(validateProphecyMasterEncounter(s)).toBe(true);
  });
  it('usesactualMystic10/30/25/35 core1250/floor125 and12S recoveryonlyCONTINUE', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 100; start(s);
    const result = round(s, 'ATTACK', 1, 1, 426, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(baseAdvantage(28.5, 100, 100, 100, 1250, 120) - 22.5);
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 120, 1250, 120)); expect(result.round.consequenceWeights).toBeNull(); expect(s.spirituality).toBe(112); expect(validateProphecyMasterEncounter(s)).toBe(true);
    const end = round(s, 'RETREAT', 1, 1, 100, 1); expect(end.outcome).toBe('RETREATED'); expect(s.spirituality).toBe(112); expect(validateProphecyMasterEncounter(s)).toBe(true);
  });
  it('omenplusactualfeint hasnoinjurywheel, bothpaidresources retained andwindowcleared', () => {
    const s = fixture(), old = legacy(s); s.spirituality = 100; start(s); const result = round(s, 'ATTACK', 1, 1, 406, 1, 81, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.prophecyMasterOutcome!.playerActions[0]).toMatchObject({ id: G, paidCost: 6, mindCost: 2, selfGain: 0, enemyReduction: 0, threatens: false });
    expect(result.round.prophecyMasterOutcome!.enemyActions[0]).toMatchObject({ actual: 'FEINT', paidCost: 3, windowConsumed: true, selfGain: 0, threatens: false });
    expect(result.round.consequenceWeights).toBeNull(); expect(s.health).toBe(100); expect(s.mind).toBe(98); expect(s.spirituality).toBe(106); expect(s.prophecyMaster.encounter.enemySpirituality).toBe(117);
    expect(s.prophecyMaster.encounter.propheticWindow).toBe(false); expect(legacy(s)).toEqual(old); expect(validateProphecyMasterEncounter(s)).toBe(true);
    round(s, 'RETREAT', 1, 1, 100, 1); expect(s.mind).toBe(98); expect(s.prophecyMaster.life.clockSeconds).toBe(120); expect(validateProphecyMasterEncounter(s)).toBe(true);
  });
  it('failedomen retains6S2M withoutguessbecomingactualknowledge orfreefeintcost', () => {
    const s = fixture(); s.spirituality = 100; start(s); const result = round(s, 'ATTACK', 1, 1, 406, 100, 81, 1);
    expect(result.round.prophecyMasterOutcome!.playerActions[0]).toMatchObject({ paidCost: 6, mindCost: 2, mode: 'FAILED', prepared: null });
    expect(result.round.prophecyMasterOutcome!.enemyActions[0]).toMatchObject({ mode: 'NO_WINDOW', paidCost: 0, threatens: false });
    expect(result.round.consequenceWeights).toBeNull(); expect(s.spirituality).toBe(106); expect(s.mind).toBe(98); expect(s.prophecyMaster.encounter.enemySpirituality).toBe(120); expect(validateProphecyMasterEncounter(s)).toBe(true);
  });
  it('shareddeath killsactualOsric, leavesownrod inoriginalcourt, neverrevivesoldLucan', () => {
    const s = fixture(), old = legacy(s); start(s); const result = round(s, 'ATTACK', 1, 1, 1, 100, 1, 100);
    expect(result.outcome).toBe('ENEMY_DEAD'); expect(s.prophecyMaster.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 0, enemyStatus: 'DEAD', weaponLocation: 'COURT', scene: { playerPosition: 'EXIT', ordinaryWalkedMetres: 4 } });
    expect(legacy(s)).toEqual(old); expect(s.spirituality).toBe(118); expect(validateProphecyMasterEncounter(s)).toBe(true); expect(blockProphecyMasterEncounter(s, { type: 'ENCOUNTER_FIGHT' })).not.toBeNull();
    const reset = structuredClone(s); reset.prophecyMaster.encounter = createProphecyMasterEncounterState();
    expect(validateProphecyMasterEncounter(reset)).toBe(false); expect(blockProphecyMasterEncounter(reset, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
  });
  it('sharedheavyinjury yieldsactualsurrender withrealenemyspellcost andretainedrod', () => {
    const s = fixture(), old = legacy(s); start(s); const result = round(s, 'ATTACK', 1, 1, 1, 1, 1, 70);
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(s.prophecyMaster.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 70, enemyStatus: 'SURRENDERED', weaponLocation: 'COURT', enemySpirituality: 115 });
    expect(legacy(s)).toEqual(old); expect(s.prophecyMaster.encounter.enemyInjuries).toHaveLength(1); expect(validateProphecyMasterEncounter(s)).toBe(true);
  });
  it('successfulomenisnotautomaticinvulnerability: actualpaidarc canstillkill', () => {
    const s = fixture(), old = legacy(s); start(s); const result = round(s, 'ATTACK', 1, 1, 406, 1, 1, 1_000_000, 100); s.status = 'DEAD';
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.combat).toBeNull(); expect(s.prophecyMaster.encounter).toMatchObject({ status: 'LOST', enemyHealth: 100, enemySpirituality: 115, weaponLocation: 'HAND', scene: { playerPosition: 'COURT', ordinaryWalkedMetres: 0 } });
    expect(result.round.prophecyMasterOutcome!.enemyActions[0]).toMatchObject({ selfGain: 49, paidCost: 5, windowConsumed: true, threatens: true });
    expect(legacy(s)).toEqual(old); expect(s.spirituality).toBe(114); expect(s.mind).toBe(98); expect(validateProphecyMasterEncounter(s)).toBe(true);
  });
  it('rejectsfabricatedterminal,costs,counts,initiative,clock,windowcarryover andrefunds', () => {
    const s = fixture(); start(s); expect(() => settleProphecyMasterEncounter(s, 'ENEMY_DEAD', context)).toThrow(); expect(() => settleProphecyMasterEncounter(s, 'AUTO_WIN', context)).toThrow();
    round(s, 'ATTACK', 1, 1, 406, 1, 81, 1); expect(validateProphecyMasterEncounter(s)).toBe(true);
    const changes: ((copy: SliceState) => void)[] = [c => { c.prophecyMaster.encounter.enemySpirituality = 120; }, c => { c.prophecyMaster.encounter.propheticWindow = true; },
      c => { c.combatHistory.at(-1)!.prophecyMasterOutcome!.playerActions[0]!.paidCost = 0; }, c => { c.combatHistory.at(-1)!.prophecyMasterOutcome!.enemyActions[0]!.windowConsumed = false; },
      c => { c.prophecyMaster.encounter.scene.clearanceConfirmed = false; }, c => { c.prophecyMaster.encounter.weaponLocation = 'COURT'; }, c => { c.spirituality--; }, c => { c.mind++; },
      c => { c.prophecyMaster.life.clockSeconds--; }, c => { c.combatHistory.at(-1)!.first = 'ENEMY'; }, c => { c.combatHistory.at(-1)!.playerCountRoll = 100; },
      c => { c.combatHistory.at(-1)!.prophecyMasterOutcome!.playerActions[0]!.order = 1; }, c => { c.prophecyMaster.encounter.enemyHealth = 99; }];
    for (const change of changes) { const copy = structuredClone(s); change(copy); expect(validateProphecyMasterEncounter(copy)).toBe(false); }
  });
});
