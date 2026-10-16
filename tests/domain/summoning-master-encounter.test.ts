import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { baseAdvantage } from '../../src/domain/slice/combat.js';
import { resolveSummoningMasterCombatRound } from '../../src/domain/slice/summoning-master-combat.js';
import { createSummoningMasterState } from '../../src/domain/summoning-master/index.js';
import {
  createSummoningMasterEncounterState, applySummoningMasterEncounterCommand, blockSummoningMasterEncounter,
  projectSummoningMasterEncounter, validateSummoningMasterEncounter, validateSummoningMasterEncounterCommand,
  hasSummoningMasterDisputeOpponent, hasSummoningMasterEncounterLock, hasSummoningMasterGuestPermit, settleSummoningMasterEncounter,
} from '../../src/domain/summoning-master/encounter.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No free scene random check'); } };
/** Directed post-promotion fixture retains the real prior Dorian outcome, blood, animals and original paper. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/witch-king-v01210/natural.json', 'utf8')).final);
  s.summoningMaster = createSummoningMasterState(); s.summoningMaster.promotionWeek = s.week; s.progression.sequence = 3; s.progression.acting = 0;
  s.summoningMaster.life.partner.metWeek = s.week; s.character.coreStats.knowledge = 30; s.actionsRemaining = 3; s.cash = 400;
  s.spirituality = 120; s.health = 100; s.mind = 100; s.activeEvent = null; s.combat = null; return s;
}
function talk(s: SliceState) { applySummoningMasterEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); }
function start(s: SliceState, help = false) {
  talk(s); if (help) applySummoningMasterEncounterCommand(s, { type: 'SET_GUEST_POLICY', policy: 'ASK_HELP' }, context);
  applySummoningMasterEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context);
}
function script(...values: number[]) { let index = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${index}: ${n}, ${min}..${max}`); return n;
  }); }
function round(s: SliceState, stance: 'ATTACK' | 'RETREAT', ...values: number[]) {
  script(...values); const result = resolveSummoningMasterCombatRound(s, stance); s.combatHistory.push(result.round); vi.restoreAllMocks();
  settleSummoningMasterEncounter(s, result.outcome, context); return result;
}
afterEach(() => vi.restoreAllMocks());

describe('Summoning Master independent Edwin encounter and explicit guest policy', () => {
  it('creates only the distinct Edwin46 G3 original opponent and preserves the real old Dorian', () => {
    const s = fixture(), old = structuredClone(s.witchKing), initial = createSummoningMasterEncounterState();
    expect(initial).toMatchObject({ targetId: 'SM3-EDWIN', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, guestPolicy: 'HOME', guestPermit: null, gateOpen: false });
    expect(projectSummoningMasterEncounter(s).enemy).toMatchObject({ name: '埃德温', age: 46, sequence: 3, weaponId: 'SM3-EDWIN-CLUB' });
    expect(s.witchKing).toEqual(old); expect(s.witchKing.encounter.enemy).toMatchObject({ id: 'WK4-DORIAN', health: 70, status: 'SURRENDERED', weaponLocation: 'YARD' });
    expect(validateSummoningMasterEncounter(s)).toBe(true);
  });
  it('requires a real paid talk and a separate explicit fight choice', () => {
    const s = fixture(); expect(blockSummoningMasterEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toContain('先实际交谈');
    s.actionsRemaining = 1; expect(blockSummoningMasterEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留'); s.actionsRemaining = 2;
    talk(s); expect(s.actionsRemaining).toBe(1); expect(s.combat).toBeNull(); expect(hasSummoningMasterEncounterLock(s)).toBe(true);
    expect(s.summoningMaster.life.partner.location).toBe('HOME'); expect(validateSummoningMasterEncounter(s)).toBe(true);
    applySummoningMasterEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); expect(s.actionsRemaining).toBe(0); expect(hasSummoningMasterDisputeOpponent(s)).toBe(true);
    expect(validateSummoningMasterEncounter(s)).toBe(true);
  });
  it('does not disclose the new original opponent before the actual S3 stage', () => {
    const s = fixture(); s.progression.sequence = 4; s.summoningMaster.promotionWeek = null;
    const view = projectSummoningMasterEncounter(s); expect(view.enemy).toBeNull(); expect(view.story).toBe(''); expect(view.facts).toEqual([]); expect(view.actions).toEqual([]);
    expect(JSON.stringify(view)).not.toMatch(/EDWIN|埃德温|原棍/); expect(validateSummoningMasterEncounter(s)).toBe(true);
  });
  it('HOME never silently buys consent, summons, copies a guest or spends its energy', () => {
    const s = fixture(), p = s.summoningMaster.life.partner, before = structuredClone(p), cash = s.cash, old = structuredClone(s.witchKing);
    start(s); expect(s.summoningMaster.encounter.guestPolicy).toBe('HOME'); expect(hasSummoningMasterGuestPermit(s)).toBe(false);
    expect(s.cash).toBe(cash); expect(s.summoningMaster.life.partner).toBe(p); expect(p).toEqual(before); expect(s.witchKing).toEqual(old);
  });
  it('ASK_HELP walks the player60m/60s to obtain current face-to-face20p consent without moving the guest', () => {
    const s = fixture(), p = s.summoningMaster.life.partner, before = structuredClone(p); talk(s); const ap = s.actionsRemaining;
    applySummoningMasterEncounterCommand(s, { type: 'SET_GUEST_POLICY', policy: 'ASK_HELP' }, context);
    expect(s.cash).toBe(380); expect(s.actionsRemaining).toBe(ap); expect(s.spirituality).toBe(120); expect(p).toEqual(before);
    expect(s.summoningMaster.life).toMatchObject({ playerLocation: 'YARD', playerTravelMetres: 60, clockSeconds: 60 });
    expect(s.summoningMaster.encounter.guestPermit).toMatchObject({ partnerId: 'SM3-LUMEN', paidPence: 20, paidWeek: s.week, approachWeek: s.week, negotiationTravelMetres: 60, negotiationSeconds: 60 });
    expect(hasSummoningMasterGuestPermit(s)).toBe(true); expect(validateSummoningMasterEncounter(s)).toBe(true);
    expect(() => applySummoningMasterEncounterCommand(s, { type: 'SET_GUEST_POLICY', policy: 'ASK_HELP' }, context)).toThrow('已经'); expect(s.cash).toBe(380);
  });
  it('refuses unseen, unwilling, dead, absent or depleted original guests without charging', () => {
    const changes: ((s: SliceState) => void)[] = [s => { s.summoningMaster.life.partner.metWeek = null; }, s => { s.summoningMaster.life.partner.willing = false; },
      s => { s.summoningMaster.life.partner.health = 0; s.summoningMaster.life.partner.status = 'DEAD'; }, s => { s.summoningMaster.life.partner.location = 'YARD'; },
      s => { s.summoningMaster.life.partner.stamina = 19; }, s => { s.summoningMaster.life.partner.mind = 29; }, s => { s.cash = 19; }];
    for (const change of changes) { const s = fixture(); talk(s); change(s); const before = structuredClone(s);
      expect(() => applySummoningMasterEncounterCommand(s, { type: 'SET_GUEST_POLICY', policy: 'ASK_HELP' }, context)).toThrow(); expect(s).toEqual(before); }
  });
  it('explicitly changing back to HOME closes permission with no refund or coerced presence', () => {
    const s = fixture(); talk(s); applySummoningMasterEncounterCommand(s, { type: 'SET_GUEST_POLICY', policy: 'ASK_HELP' }, context);
    applySummoningMasterEncounterCommand(s, { type: 'SET_GUEST_POLICY', policy: 'HOME' }, context);
    expect(s.cash).toBe(380); expect(s.summoningMaster.encounter.guestPermit).toBeNull(); expect(hasSummoningMasterGuestPermit(s)).toBe(false);
    expect(s.summoningMaster.life.partner.location).toBe('HOME'); expect(validateSummoningMasterEncounter(s)).toBe(true);
  });
  it('peaceful0AP exit preserves old outcomes/resources and never reopens or rewards the dispute', () => {
    const s = fixture(), old = structuredClone(s.witchKing), history = structuredClone(s.combatHistory); talk(s); s.actionsRemaining = 0; s.mind = 0;
    applySummoningMasterEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context);
    expect(s.witchKing).toEqual(old); expect(s.combatHistory).toEqual(history); expect(s.summoningMaster.encounter.status).toBe('RESOLVED');
    expect(hasSummoningMasterEncounterLock(s)).toBe(false); expect(validateSummoningMasterEncounter(s)).toBe(true); expect(s.progression.acting).toBe(0);
    s.mind = 100; s.actionsRemaining = 3; expect(blockSummoningMasterEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('不重新');
  });
  it('rejects extra command authority, wrong city, open practice and substituted old opponents', () => {
    expect(validateSummoningMasterEncounterCommand({ type: 'SET_GUEST_POLICY', policy: 'ASK_HELP' })).toBe(true);
    expect(validateSummoningMasterEncounterCommand({ type: 'SET_GUEST_POLICY', policy: 'ASK_HELP', free: true })).toBe(false);
    expect(validateSummoningMasterEncounterCommand({ type: 'ENCOUNTER_FIGHT', summon: true })).toBe(false);
    const s = fixture(); s.world.city = 'TINGEN'; expect(blockSummoningMasterEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.world.city = 'BACKLUND'; s.summoningMaster.life.cases['source-visit'].status = 'PREPARED'; expect(blockSummoningMasterEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.summoningMaster.life.cases['source-visit'].status = 'AVAILABLE'; start(s); s.summoningMaster.encounter.targetId = 'WK4-DORIAN' as 'SM3-EDWIN';
    expect(hasSummoningMasterDisputeOpponent(s)).toBe(false); expect(validateSummoningMasterEncounter(s)).toBe(false);
  });
  it('real ordinary retreat keeps old papers, original Dorian and all original guest resources', () => {
    const s = fixture(), old = structuredClone(s.witchKing), p = structuredClone(s.summoningMaster.life.partner); start(s, true);
    const result = round(s, 'RETREAT', 1, 1, 1); expect(result.outcome).toBe('RETREATED'); expect(s.combat).toBeNull();
    expect(s.summoningMaster.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(s.witchKing).toEqual(old); expect(s.summoningMaster.life.partner).toEqual(p); expect(s.spirituality).toBe(120);
    expect(validateSummoningMasterEncounter(s)).toBe(true);
  });
  it('keeps Moon35/25/25/15 core and1250/floor125, restores12 only on an actual continuing round', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 100; start(s);
    const result = round(s, 'ATTACK', 1, 1, 206, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(baseAdvantage(22, 100, 100, 100, 1250, 120));
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 120, 1250, 120) - 32.5);
    expect(s.spirituality).toBe(112); expect(validateSummoningMasterEncounter(s)).toBe(true);
    // Second round starts enemy-first: one ordinary enemy accident occurs before the player leaves.
    const end = round(s, 'RETREAT', 1, 1, 100, 1); expect(end.outcome).toBe('RETREATED'); expect(s.spirituality).toBe(112);
    expect(validateSummoningMasterEncounter(s)).toBe(true);
  });
  it('real enemy death preserves its unique body/club and does not overwrite the old Dorian', () => {
    const s = fixture(), old = structuredClone(s.witchKing); start(s);
    const result = round(s, 'ATTACK', 1, 1, 1, 1, 100, 1, 100);
    expect(result.outcome).toBe('ENEMY_DEAD'); expect(s.summoningMaster.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 0, enemyStatus: 'DEAD', weaponLocation: 'YARD' });
    expect(s.witchKing).toEqual(old); expect(validateSummoningMasterEncounter(s)).toBe(true); expect(s.progression.acting).toBe(0);
  });
  it('a real heavy wound produces a living surrender with exact unchanged old materials', () => {
    const s = fixture(), old = structuredClone(s.witchKing); start(s);
    const result = round(s, 'ATTACK', 1, 1, 1, 1, 100, 1, 70);
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(s.summoningMaster.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 70, enemyStatus: 'SURRENDERED', weaponLocation: 'YARD' });
    expect(s.witchKing).toEqual(old); expect(validateSummoningMasterEncounter(s)).toBe(true);
  });
  it('common player death remains real after a successful summon while the living guest walks home alone', () => {
    const s = fixture(), old = structuredClone(s.witchKing); start(s, true);
    const result = round(s, 'ATTACK', 1, 1, 206, 1, 1, 1_000_000, 100); s.status = 'DEAD';
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.summoningMaster.encounter.status).toBe('LOST'); expect(s.combat).toBeNull();
    expect(s.summoningMaster.life.partner).toMatchObject({ location: 'HOME', status: 'ALIVE', stamina: 94, ordinaryDistanceM: 30 });
    expect(s.spirituality).toBe(114); expect(s.witchKing).toEqual(old); expect(validateSummoningMasterEncounter(s)).toBe(true);
  });
  it('does not accept a forged terminal before an actual common round', () => {
    const s = fixture(); start(s); expect(() => settleSummoningMasterEncounter(s, 'ENEMY_DEAD', context)).toThrow();
    expect(() => settleSummoningMasterEncounter(s, 'AUTO_WIN', context)).toThrow(); expect(s.summoningMaster.encounter.status).toBe('FIGHTING');
  });
});
