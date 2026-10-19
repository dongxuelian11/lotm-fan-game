import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { baseAdvantage } from '../../src/domain/slice/combat.js';
import { resolveInsightScholarCombatRound } from '../../src/domain/slice/insight-scholar-combat.js';
import { createInsightScholarState } from '../../src/domain/insight-scholar/index.js';
import {
  createInsightScholarEncounterState, applyInsightScholarEncounterCommand, blockInsightScholarEncounter,
  projectInsightScholarEncounter, validateInsightScholarEncounter, validateInsightScholarEncounterCommand,
  hasInsightScholarDisputeOpponent, hasInsightScholarEncounterLock, settleInsightScholarEncounter,
} from '../../src/domain/insight-scholar/encounter.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No free scene check'); } };
/** Directed candidate3 fixture keeps the actual S4 Harold surrender, old people and all original materials. */
function fixture(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/prophet-v01230/natural.json', 'utf8')).final);
  s.insightScholar = createInsightScholarState(); s.insightScholar.promotionWeek = s.week; s.progression.sequence = 3; s.progression.acting = 0;
  s.character.coreStats.knowledge = 30; s.actionsRemaining = 3; s.spirituality = 120; s.health = 100; s.mind = 100;
  s.activeEvent = null; s.combat = null; return s;
}
function talk(s: SliceState) { applyInsightScholarEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context); }
function start(s: SliceState) { talk(s); applyInsightScholarEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context); }
function script(...values: number[]) { let index = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const n = values[index++]; if (n === undefined || n < min || n > max) throw new Error(`Unexpected draw ${index}: ${n}, ${min}..${max}`); return n;
  }); }
function round(s: SliceState, stance: 'ATTACK' | 'RETREAT', ...values: number[]) {
  script(...values); const result = resolveInsightScholarCombatRound(s, stance); s.combatHistory.push(result.round); vi.restoreAllMocks();
  settleInsightScholarEncounter(s, result.outcome, context); return result;
}
afterEach(() => vi.restoreAllMocks());

describe('Insight Scholar distinct original Alton47 G encounter and common consequences', () => {
  it('creates independent Alton47 H100/M100/S120 and leaves old Harold70 surrendered with his own club', () => {
    const s = fixture(), old = structuredClone(s.prophet), crafts = structuredClone(s.mysticismMagister), samples = structuredClone(s.polymath);
    expect(createInsightScholarEncounterState()).toMatchObject({ targetId: 'IS3-ALTON', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120,
      enemyStatus: 'RESISTING', weaponLocation: 'HAND', powerUses: { FLASH: 0, WARD: 0, FOCUS: 0 }, seenPowers: [] });
    expect(projectInsightScholarEncounter(s).enemy).toMatchObject({ name: '阿尔顿', age: 47, sequence: 3, weaponId: 'IS3-ALTON-CLUB' });
    expect(projectInsightScholarEncounter(s).story).toContain('候选为G扩展');
    expect(s.prophet.encounter.enemy).toMatchObject({ id: 'PF4-HAROLD', age: 46, health: 70, status: 'SURRENDERED', weaponLocation: 'YARD' });
    expect(s.prophet).toEqual(old); expect(s.mysticismMagister).toEqual(crafts); expect(s.polymath).toEqual(samples); expect(validateInsightScholarEncounter(s)).toBe(true);
  });
  it('requires actual talk1AP with a separate explicit fight1AP', () => {
    const s = fixture(); expect(blockInsightScholarEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toContain('先实际交谈');
    s.actionsRemaining = 1; expect(blockInsightScholarEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('另留'); s.actionsRemaining = 2;
    talk(s); expect(s.actionsRemaining).toBe(1); expect(s.combat).toBeNull(); expect(hasInsightScholarEncounterLock(s)).toBe(true);
    applyInsightScholarEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context);
    expect(s.actionsRemaining).toBe(0); expect(hasInsightScholarDisputeOpponent(s)).toBe(true); expect(validateInsightScholarEncounter(s)).toBe(true);
  });
  it('hides candidate opponent identity, facts and actions before actual S3', () => {
    const s = fixture(); s.progression.sequence = 4; s.insightScholar.promotionWeek = null;
    const view = projectInsightScholarEncounter(s); expect(view.enemy).toBeNull(); expect(view.story).toBe(''); expect(view.facts).toEqual([]); expect(view.actions).toEqual([]);
    expect(JSON.stringify(view)).not.toMatch(/ALTON|阿尔顿|原棍/); expect(validateInsightScholarEncounter(s)).toBe(true);
  });
  it('permits real peaceful0AP exit despite low mind without reward, refill or reopened enemy', () => {
    const s = fixture(), old = structuredClone(s.prophet), inherited = structuredClone(s.mysticismMagister), history = structuredClone(s.combatHistory);
    talk(s); s.actionsRemaining = 0; s.mind = 0; s.spirituality = 87;
    applyInsightScholarEncounterCommand(s, { type: 'LEAVE_ENCOUNTER' }, context);
    expect(s.prophet).toEqual(old); expect(s.mysticismMagister).toEqual(inherited); expect(s.combatHistory).toEqual(history);
    expect(s.insightScholar.encounter.status).toBe('RESOLVED'); expect(hasInsightScholarEncounterLock(s)).toBe(false);
    expect(validateInsightScholarEncounter(s)).toBe(true); expect(s.progression.acting).toBe(0); expect(s.spirituality).toBe(87);
    s.mind = 100; s.actionsRemaining = 3; expect(blockInsightScholarEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('不重新');
  });
  it('rejects extra command authority, wrong city, live old practice and substituted old opponent', () => {
    expect(validateInsightScholarEncounterCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    expect(validateInsightScholarEncounterCommand({ type: 'ENCOUNTER_FIGHT', freeInsight: true })).toBe(false);
    const s = fixture(); s.world.city = 'TINGEN'; expect(blockInsightScholarEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.world.city = 'BACKLUND'; s.mysticismMagister.practice.token = 'PLAYER'; expect(blockInsightScholarEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull();
    s.mysticismMagister.practice.token = 'OWNER'; start(s); s.insightScholar.encounter.targetId = 'PF4-HAROLD' as 'IS3-ALTON';
    expect(hasInsightScholarDisputeOpponent(s)).toBe(false); expect(validateInsightScholarEncounter(s)).toBe(false);
  });
  it('requires cleanup of open old dream, actual borrowed token and old prepared cases without silently fixing them', () => {
    const mutations: ((s: SliceState) => void)[] = [s => { s.mysticismMagister.practice.dreamOpen = true; },
      s => { s.mysticismMagister.practice.token = 'PLAYER'; }, s => { s.prophet.ritual.playerLocation = 'HALL'; },
      s => { s.mysticismMagister.cases['modest-craft']!.status = 'PREPARED'; }];
    for (const mutate of mutations) { const s = fixture(); mutate(s); const before = structuredClone(s);
      expect(() => applyInsightScholarEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context)).toThrow(); expect(s).toEqual(before); }
  });
  it('ordinary retreat preserves both original enemies, all old originals and actual resources', () => {
    const s = fixture(), old = structuredClone(s.prophet), inherited = structuredClone(s.mysticismMagister); s.spirituality = 93; start(s);
    const result = round(s, 'RETREAT', 1, 1, 1); expect(result.outcome).toBe('RETREATED'); expect(s.combat).toBeNull();
    expect(s.insightScholar.encounter).toMatchObject({ status: 'RETREATED', enemyHealth: 100, enemySpirituality: 120, weaponLocation: 'HAND', seenPowers: [] });
    expect(s.prophet).toEqual(old); expect(s.mysticismMagister).toEqual(inherited); expect(s.spirituality).toBe(93); expect(validateInsightScholarEncounter(s)).toBe(true);
  });
  it('retains actual35/25/25/15 core1250/floor125 and restores12 only after CONTINUE', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 100; start(s);
    // Unseen analysis is ordinary10/0S, enemy accident does not threaten either body.
    const result = round(s, 'ATTACK', 1, 1, 126, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(baseAdvantage(22, 100, 100, 100, 1250, 120));
    expect(result.round.enemyAdvantage).toBe(baseAdvantage(20, 100, 100, 120, 1250, 120) - 22.5 - 10);
    expect(result.round.consequenceWeights).toBeNull(); expect(s.spirituality).toBe(112); expect(validateInsightScholarEncounter(s)).toBe(true);
    const end = round(s, 'RETREAT', 1, 1, 100, 1); expect(end.outcome).toBe('RETREATED'); expect(s.spirituality).toBe(112);
    expect(validateInsightScholarEncounter(s)).toBe(true);
  });
  it('actual witnessed methods carry between rounds and precede any paid analysis', () => {
    const s = fixture(); s.spirituality = 100; start(s);
    const first = round(s, 'ATTACK', 1, 1, 126, 36, 1);
    expect(first.round.insightScholarOutcome!.playerActions[0]).toMatchObject({ paidCost: 0, observedPower: null, enemyReduction: 10 });
    expect(s.insightScholar.encounter.seenPowers).toEqual(['WARD']); expect(s.insightScholar.encounter.enemySpirituality).toBe(116);
    const second = round(s, 'ATTACK', 1, 1, 1, 126, 1, 1);
    expect(second.round.insightScholarOutcome!.source.seenPowers).toEqual(['WARD']);
    expect(second.round.insightScholarOutcome!.playerActions[0]).toMatchObject({ paidCost: 5, observedPower: 'FLASH', enemyReduction: 35 });
    expect(s.insightScholar.encounter.seenPowers).toEqual(['FLASH', 'WARD']); expect(s.insightScholar.encounter.enemySpirituality).toBe(111);
    expect(s.spirituality).toBe(119); expect(s.insightScholar.encounter.enemyHealth).toBe(100); expect(validateInsightScholarEncounter(s)).toBe(true);
    expect(projectInsightScholarEncounter(s).facts.join(' ')).toContain('本场实际亲见方法：FLASH、WARD');
  });
  it('inherited FLASH pressure alone gets no separate mental injury, surrender or death wheel', () => {
    const s = fixture(); start(s); const result = round(s, 'ATTACK', 1, 1, 286, 1, 100, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.consequenceWeights).toBeNull();
    expect(s.insightScholar.encounter).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING' });
    expect(result.round.insightScholarOutcome!.playerActions[0]!.enemyReduction).toBeGreaterThan(0); expect(validateInsightScholarEncounter(s)).toBe(true);
  });
  it('the common death wheel kills only new Alton and preserves old Harold70 and originals', () => {
    const s = fixture(), old = structuredClone(s.prophet), inherited = structuredClone(s.mysticismMagister); start(s);
    const result = round(s, 'ATTACK', 1, 1, 1, 100, 1, 100);
    expect(result.outcome).toBe('ENEMY_DEAD'); expect(s.insightScholar.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 0, enemyStatus: 'DEAD', weaponLocation: 'YARD' });
    expect(s.prophet).toEqual(old); expect(s.mysticismMagister).toEqual(inherited); expect(s.progression.acting).toBe(0); expect(s.spirituality).toBe(120);
    expect(validateInsightScholarEncounter(s)).toBe(true);
  });
  it('actual common heavy injury produces a living new surrender with the original club left in this court', () => {
    const s = fixture(), old = structuredClone(s.prophet); start(s);
    const result = round(s, 'ATTACK', 1, 1, 1, 1, 1, 70);
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(s.insightScholar.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 70, enemyStatus: 'SURRENDERED', weaponLocation: 'YARD', enemySpirituality: 115 });
    expect(s.prophet).toEqual(old); expect(s.insightScholar.encounter.enemyInjuries).toHaveLength(1); expect(validateInsightScholarEncounter(s)).toBe(true);
  });
  it('common player death keeps actual consumed original3 and never replaces it with exhausted original1', () => {
    const s = fixture(), old = structuredClone(s.prophet), original1 = structuredClone(s.mysticismMagister.crafts.find(c => c.id === 'MM5-FLASH-1')); start(s);
    const result = round(s, 'ATTACK', 1, 1, 366, 1, 1_000_000, 100); s.status = 'DEAD';
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.combat).toBeNull(); expect(s.insightScholar.encounter.status).toBe('LOST');
    expect(s.mysticismMagister.crafts.find(c => c.id === 'MM5-FLASH-3')).toMatchObject({ status: 'CONSUMED', usedWeek: s.week, sourceKitId: 'MM5-KIT-3' });
    expect(s.mysticismMagister.crafts.find(c => c.id === 'MM5-FLASH-1')).toEqual(original1);
    expect(s.prophet).toEqual(old); expect(validateInsightScholarEncounter(s)).toBe(true);
  });
  it('rejects forged terminals, added observations or an enemy pool silently refilled without history', () => {
    const s = fixture(); start(s); expect(() => settleInsightScholarEncounter(s, 'ENEMY_DEAD', context)).toThrow();
    expect(() => settleInsightScholarEncounter(s, 'AUTO_WIN', context)).toThrow(); expect(s.insightScholar.encounter.status).toBe('FIGHTING');
    const fakeSeen = structuredClone(s); fakeSeen.insightScholar.encounter.seenPowers.push('WARD'); expect(hasInsightScholarDisputeOpponent(fakeSeen)).toBe(false); expect(validateInsightScholarEncounter(fakeSeen)).toBe(false);
    s.insightScholar.encounter.enemySpirituality--; expect(hasInsightScholarDisputeOpponent(s)).toBe(false); expect(validateInsightScholarEncounter(s)).toBe(false);
  });
  it('saved history retains actual costs, original consumption and inter-round observations', () => {
    const s = fixture(); start(s); round(s, 'ATTACK', 1, 1, 366, 36, 1); expect(validateInsightScholarEncounter(s)).toBe(true);
    const mutations: ((copy: SliceState) => void)[] = [copy => { copy.mysticismMagister.crafts.find(c => c.id === 'MM5-FLASH-3')!.status = 'PLAYER'; },
      copy => { copy.combatHistory.at(-1)!.insightScholarOutcome!.consumedCraftIds = []; },
      copy => { copy.combatHistory.at(-1)!.insightScholarOutcome!.enemyActions[0]!.paidCost = 0; },
      copy => { copy.insightScholar.encounter.seenPowers.push('FLASH'); }, copy => { copy.insightScholar.encounter.weaponLocation = 'YARD'; }];
    for (const mutate of mutations) { const copy = structuredClone(s); mutate(copy); expect(validateInsightScholarEncounter(copy)).toBe(false); }
  });
});
