import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createWarBishopState } from '../../src/domain/war-bishop/index.js';
import { WAR_BISHOP_MEMBER_IDS } from '../../src/domain/war-bishop/life.js';
import { applyWarBishopEncounterCommand as act, blockWarBishopEncounter, createWarBishopEncounterState, hasWarBishopDisputeOpponent,
  projectWarBishopEncounter, settleWarBishopEncounter, validateWarBishopEncounter, validateWarBishopEncounterCommand } from '../../src/domain/war-bishop/encounter.js';
import { resolveWarBishopCombatRound } from '../../src/domain/slice/war-bishop-combat.js';
import { validateWarBishopRoundOutcome } from '../../src/domain/war-bishop/combat.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No normal check here'); } };
/** Directed post-promotion fixture, not a claim about the natural sequence3 run. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/iron-blood-knight-v01180/natural.json', 'utf8')).final);
  s.warBishop = createWarBishopState(); s.warBishop.promotionWeek = s.week; s.progression.sequence = 3; s.progression.acting = 0;
  s.actionsRemaining = 3; s.cash = 400; s.spirituality = 120; s.activeEvent = null; s.combat = null; return s;
}
function battle() { const s = fixture(); act(s, { type: 'ENCOUNTER_TALK' }, context); act(s, { type: 'CALL_COMPANIONS' }, context); act(s, { type: 'ENCOUNTER_FIGHT' }, context); return s; }
function script(...values: number[]) {
  let i = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const value = values[i++]; if (value === undefined || value < min || value > max) throw new Error(`Unexpected directed draw ${i}:${value}`); return value;
  });
}
function completeRound(s: SliceState, stance: 'ATTACK' | 'RETREAT', policy: 'HOLD' | 'LINK_IF_READY' = 'HOLD') {
  const result = resolveWarBishopCombatRound(s, stance, policy); s.combatHistory.push(structuredClone(result.round));
  settleWarBishopEncounter(s, result.outcome, context); return result;
}
afterEach(() => vi.restoreAllMocks());

describe('War Bishop original encounter, real exits and unchanged shared injury wheel', () => {
  it('starts with all original members still HOME and enemy resources independent of old Garrick', () => {
    const s = fixture(), e = createWarBishopEncounterState(); expect(e).toMatchObject({ status: 'AVAILABLE', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, companionIds: [], policy: 'HOLD' });
    expect(s.ironBloodKnight.team.members.every(m => !m.present && m.location === 'HOME')).toBe(true);
    expect(projectWarBishopEncounter(s).companions.map(m => [m.health, m.energy, m.present])).toEqual([[99, 18, false], [99, 18, false], [100, 18, false], [100, 18, false], [100, 18, false]]);
    expect(s.ironBloodKnight.encounter.enemy).toMatchObject({ id: 'IB4-GARRICK', status: 'SURRENDERED', health: 60, weaponLocation: 'YARD' }); expect(validateWarBishopEncounter(s)).toBe(true);
  });
  it('strictly accepts only four public original encounter commands', () => {
    for (const type of ['ENCOUNTER_TALK', 'CALL_COMPANIONS', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']) expect(validateWarBishopEncounterCommand({ type })).toBe(true);
    expect(validateWarBishopEncounterCommand({ type: 'CALL_COMPANIONS', copies: 30 })).toBe(false); expect(validateWarBishopEncounterCommand({ type: 'RESTORE_ENEMY' })).toBe(false);
    const s = fixture(); s.progression.sequence = 4; expect(blockWarBishopEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('战争主教3');
  });
  it('has actual talk, separate paid voluntary invitation, and no resets or phantom25', () => {
    const s = fixture(), old = structuredClone(s.ironBloodKnight), health = s.ironBloodKnight.team.members.map(m => m.health);
    expect(blockWarBishopEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toContain('交谈'); act(s, { type: 'ENCOUNTER_TALK' }, context);
    expect(s.actionsRemaining).toBe(2); expect(s.warBishop.encounter.companionIds).toEqual([]); expect(validateWarBishopEncounter(s)).toBe(true);
    act(s, { type: 'CALL_COMPANIONS' }, context); expect(s.actionsRemaining).toBe(1); expect(s.cash).toBe(360); expect(s.warBishop.encounter.companionIds).toEqual(WAR_BISHOP_MEMBER_IDS);
    expect(s.ironBloodKnight.team.members.filter(m => m.present).map(m => m.id)).toEqual(WAR_BISHOP_MEMBER_IDS); expect(s.ironBloodKnight.team.members.map(m => m.health)).toEqual(health);
    expect(s.ironBloodKnight.team.members.slice(5)).toEqual(old.team.members.slice(5)); expect(s.ironBloodKnight.encounter).toEqual(old.encounter); expect(validateWarBishopEncounter(s)).toBe(true);
  });
  it('refusal, fatigue or poverty block the whole invitation without AP/cash mutation', () => {
    for (const change of [(s: SliceState) => { s.ironBloodKnight.team.members[0]!.willing = false; }, (s: SliceState) => { s.ironBloodKnight.team.members[1]!.energy = 5; }, (s: SliceState) => { s.cash = 39; }]) {
      const s = fixture(); act(s, { type: 'ENCOUNTER_TALK' }, context); change(s); const before = structuredClone(s);
      expect(blockWarBishopEncounter(s, { type: 'CALL_COMPANIONS' })).not.toBeNull(); expect(() => act(s, { type: 'CALL_COMPANIONS' }, context)).toThrow(); expect(s).toEqual(before);
      act(s, { type: 'LEAVE_ENCOUNTER' }, context); expect(s.combat).toBeNull(); expect(s.warBishop.encounter.enemyHealth).toBe(100);
    }
  });
  it('allows a zero-action peaceful exit with real dismissal, no refund and no reopening', () => {
    const s = fixture(); act(s, { type: 'ENCOUNTER_TALK' }, context); act(s, { type: 'CALL_COMPANIONS' }, context); s.actionsRemaining = 0;
    const old = structuredClone(s.ironBloodKnight.encounter); act(s, { type: 'LEAVE_ENCOUNTER' }, context);
    expect(s.cash).toBe(360); expect(s.actionsRemaining).toBe(0); expect(s.ironBloodKnight.team.members.every(m => !m.present && m.location === 'HOME')).toBe(true);
    expect(s.warBishop.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 100, enemySpirituality: 120, terminal: null });
    expect(s.ironBloodKnight.encounter).toEqual(old); expect(validateWarBishopEncounter(s)).toBe(true); s.actionsRemaining = 3; expect(blockWarBishopEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('不重开');
  });
  it('projects a detached copy and discloses actual depletion and ordinary original source limits', () => {
    const s = fixture(), before = structuredClone(s), p = projectWarBishopEncounter(s); p.enemy.spirituality = 999; p.companions[0]!.health = 0;
    expect(s).toEqual(before); expect(p.story).toContain('原创成年非凡者'); expect(p.facts.join('')).toContain('默认保留联系'); expect(p.facts.join('')).toContain('没有免费');
  });
  it('uses the existing actual Hunter4 core and transfers a shared light injury without erasing injury', () => {
    const s = battle(), stats = s.character.coreStats, core = stats.physique * .35 + stats.perception * .3 + stats.will * .2 + stats.knowledge * .15;
    const spy = script(1, 1, 1, 1, 1_000_000, 1); const first = completeRound(s, 'ATTACK', 'LINK_IF_READY');
    expect(spy).toHaveBeenCalledTimes(6); expect(first.outcome).toBe('CONTINUE'); expect(first.round.playerAdvantage).toBeGreaterThan(core);
    expect(s.health).toBe(92); expect(s.injuries).toHaveLength(1); expect(s.mind).toBe(100); expect(s.ironBloodKnight.team.members[0]!.health).toBe(97);
    expect(first.round.warBishopOutcome).toMatchObject({ policy: 'LINK_IF_READY', sharedHealthDamage: 2, linkCost: 5, playerHealthAfter: 92, enemySpirituality: 115 });
    expect(validateWarBishopRoundOutcome(first.round.warBishopOutcome)).toBe(true); expect(validateWarBishopEncounter(s)).toBe(true); expect(hasWarBishopDisputeOpponent(s)).toBe(true);
    spy.mockRestore(); const nextSpy = script(1, 1, 1, 1, 1_000_000, 1); const next = completeRound(s, 'ATTACK');
    expect(nextSpy).toHaveBeenCalledTimes(6); expect(next.round.warBishopOutcome?.policy).toBe('HOLD'); expect(s.health).toBe(82); expect(s.injuryRisk).toBe(1); expect(s.ironBloodKnight.team.members[0]!.health).toBe(97); expect(validateWarBishopEncounter(s)).toBe(true);
  });
  it('keeps ordinary retreat without healing members, replacing the enemy or taking his club', () => {
    const s = battle(), old = structuredClone(s.ironBloodKnight.encounter); script(1, 1, 1); const result = completeRound(s, 'RETREAT', 'LINK_IF_READY');
    expect(result.outcome).toBe('RETREATED'); expect(s.combat).toBeNull(); expect(s.spirituality).toBe(115); expect(s.warBishop.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(s.ironBloodKnight.team.members.slice(0, 5).map(m => [m.energy, m.present, m.location])).toEqual(Array.from({ length: 5 }, () => [16, false, 'HOME']));
    expect(s.ironBloodKnight.encounter).toEqual(old); expect(validateWarBishopEncounter(s)).toBe(true);
  });
  it('preserves real enemy surrender and direct death sectors rather than guaranteed victory', () => {
    const s = battle(); script(1, 1, 1, 1, 1, 80); const win = completeRound(s, 'ATTACK');
    expect(win.outcome).toBe('ENEMY_SURRENDERED'); expect(s.warBishop.encounter).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED', weaponLocation: 'YARD', enemySpirituality: 115 });
    expect(validateWarBishopEncounter(s)).toBe(true); vi.restoreAllMocks();
    const dead = battle(), memberHealth = dead.ironBloodKnight.team.members.map(m => m.health); script(1, 1, 1, 1, 1_000_000, 100); const loss = completeRound(dead, 'ATTACK', 'LINK_IF_READY');
    expect(loss.outcome).toBe('PLAYER_DEAD'); expect(dead.health).toBe(0); expect(dead.warBishop.encounter.status).toBe('LOST'); expect(loss.round.warBishopOutcome?.sharedHealthDamage).toBe(0);
    expect(dead.spirituality).toBe(111); expect(dead.ironBloodKnight.team.members.map(m => m.health)).toEqual(memberHealth); expect(validateWarBishopEncounter(dead)).toBe(true);
  });
});
