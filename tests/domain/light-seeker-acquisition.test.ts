import { describe, expect, it, vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyLightSeekerAcquisition, applyLightSeekerCommand, createLightSeekerState, hasLightSeekerLock,
  isLightSeeker, isLightSeekerAcquisitionCommand, isLightSeekerAcquisitionStage, hasLightSeekerHistory,
  projectLightSeeker, validateLightSeekerCommand, validateLightSeekerState, lightSeekerAcquisitionBlock } from '../../src/domain/light-seeker/index.js';
import { LIGHT_SEEKER_FORMULA_STATUS, LIGHT_SEEKER_SOURCE_STATUS, LIGHT_SEEKER_CONSUMPTION_RISK,
  LIGHT_SEEKER_PRICES, LIGHT_SEEKER_POTION_SOURCES } from '../../src/domain/light-seeker/content.js';
import { LIGHT_SEEKER_ABILITY_IDS, LIGHT_SEEKER_PREPARATION_IDS,
  type LightSeekerAcquisitionCommand, type LightSeekerCommand } from '../../src/domain/light-seeker/types.js';
import { sunLegacyKeys, justiceMentorFixturePath } from './light-seeker-helper.js';

/** Directed domain-only setup from the actual 582-command peaceful survivor. No fixture, RNG or natural outcome is rewritten. */
function justiceMentor(): SliceState {
  const s = migrateSliceState(readObjectEntry<unknown>(justiceMentorFixturePath, 'final'));
  s.lightSeeker = createLightSeekerState(); s.week = s.justiceMentor.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 30;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) =>
    resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: LightSeekerAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyLightSeekerAcquisition(s, command, c); return c;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyLightSeekerAcquisition(s, command as LightSeekerAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled(); expect(c.note).not.toHaveBeenCalled();
}
function taught(s = justiceMentor()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of LIGHT_SEEKER_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const b = s.lightSeeker.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.lightSeeker.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
const oldRoots = (s: SliceState) => sunLegacyKeys.map(key => s[key]);

describe('LightSeeker S2 independent acquisition and exact inherited source boundaries', () => {
  it('starts from the actual582-command peaceful living Sun without changing the original history', () => {
    const old=readObjectEntry<SliceState>(justiceMentorFixturePath,'final'), s=migrateSliceState(old);
    expect(readObjectEntry<unknown[]>(justiceMentorFixturePath,'commands')).toHaveLength(582);
    expect(old).toMatchObject({revision:583,week:143,status:'ACTIVE',health:100,mind:100,spirituality:120,cash:620,actionsRemaining:1,injuryRisk:0,
      random:{seed:'bard-natural-v029',cursor:171},progression:{pathwayId:'sun',sequence:3,acting:100},justiceMentor:{promotionWeek:136}});
    expect(Object.keys(old.progression.mastery)).toHaveLength(18);expect(oldRoots(s)).toEqual(oldRoots(old));expect(s.injuries).toEqual([]);
    expect(validateLightSeekerState(s)).toBe(true);expect(projectLightSeeker(s).digestion).toContain('7/12');
    expect(isLightSeekerAcquisitionStage(s)).toBe(true);expect(hasLightSeekerHistory(s)).toBe(false);
  });
  it('creates independent originals and hides the channel for ordinary people and every unsupported stage', () => {
    const s = createSliceRun('lightSeeker-hidden', sliceDefaultCreationSelection, 'lightSeeker-hidden');
    expect(projectLightSeeker(s)).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false,
      formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], resources: null });
    expect(projectLightSeeker(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createLightSeekerState(); other.bottles[0]!.labourSteps = 5; other.life.site.lamp.oil = 0;
    expect(s.lightSeeker.bottles[0]!.labourSteps).toBe(0); expect(s.lightSeeker.life.site.lamp.oil).toBe(3);
    expect(validateLightSeekerState(s)).toBe(true);
    for (const sequence of [9, 8, 7, 6, 5, 4, 0]) {
      const t = justiceMentor(); t.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>;
      expect(projectLightSeeker(t).discovered).toBe(false); expect(projectLightSeeker(t).actions).toEqual([]);
      reject(t, { type: 'LEARN_GUIDANCE' });
    }
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'moon', 'darkness', 'white-tower', 'tyrant', 'death', 'door', 'error', 'warrior', 'demoness', 'hermit', 'hanged-man', 'abyss', 'chained', 'wheel', 'black-emperor', 'justiciar', 'mother'] as const) {
      const t = justiceMentor(); t.progression.pathwayId = pathwayId;
      expect(projectLightSeeker(t).discovered, pathwayId).toBe(false); expect(projectLightSeeker(t).actions).toEqual([]);
      reject(t, { type: 'LEARN_GUIDANCE' });
    }
  });
  it('keeps genuine Sun S1 LightSeeker history read-only without reopening old actions', () => {
    const s = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/pure-white-angel-v01940/natural.json', 'final'));
    assertValidSliceState(s);
    expect(s.progression).toMatchObject({ pathwayId: 'sun', sequence: 1 });
    expect(hasLightSeekerHistory(s)).toBe(true); expect(isLightSeeker(s)).toBe(false);
    expect(isLightSeekerAcquisitionStage(s)).toBe(false);
    const before = structuredClone(s), view = projectLightSeeker(s);
    expect(view).toMatchObject({ discovered: true, promoted: true, guidanceKnown: true, acting: 100, actions: [] });
    expect(view.bottles.map(bottle => bottle.id)).toEqual(s.lightSeeker.bottles.map(bottle => bottle.id));
    expect(view.abilities.map(ability => ability.id)).toEqual(LIGHT_SEEKER_ABILITY_IDS);
    // New S1 practice legitimately changes the same live gallery; only its
    // frozen source snapshot represents the original S2 site history.
    const history = structuredClone(s.lightSeeker);
    history.life.site = structuredClone(s.pureWhiteAngel.sourceHistory!.lightSeeker.life.site);
    expect(history).toEqual(s.pureWhiteAngel.sourceHistory!.lightSeeker);
    expect(s.lightSeeker.life.site).toEqual(before.lightSeeker.life.site);
    expect(s.pureWhiteAngel.sourceHistory).toEqual(before.pureWhiteAngel.sourceHistory);
    expect(s).toEqual(before);
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'PREPARE_PROMOTION' },
      { type: 'BUY_POTION', bottleId: s.lightSeeker.bottles[0]!.id }, dose(s),
    ] as const) reject(s, command);
    for (const command of [{ type: 'REFLECT' }, { type: 'ENCOUNTER_TALK' }, { type: 'ENCOUNTER_FIGHT' }] as const) {
      const c = context(s);
      expect(() => applyLightSeekerCommand(s, command, c)).toThrow(); expect(s).toEqual(before);
      expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled(); expect(c.note).not.toHaveBeenCalled();
    }
  });
  it('charges real guidance and preserves original scene and real costs', () => {
    const s = justiceMentor(), prior = structuredClone(oldRoots(s)), scene = structuredClone(s.lightSeeker.life.site);
    apply(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]);
    expect(oldRoots(s)).toEqual(prior); expect(s.lightSeeker.life.site).toEqual(scene);
    expect(LIGHT_SEEKER_PRICES).toEqual({ guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 });
    expect(LIGHT_SEEKER_CONSUMPTION_RISK.length).toBeGreaterThan(10);
    expect(projectLightSeeker(s)).toMatchObject({ formulaKnown: false, formula: [],
      preparations: LIGHT_SEEKER_PREPARATION_IDS.map(taskId => ({ taskId, completedWeek: null })) });
    expect(s.lightSeeker.bottles.map(b => b.source)).toEqual(LIGHT_SEEKER_POTION_SOURCES.map(b => b.source));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five bottle-specific jobs and an independent800 payment without transferring labour or furnishing free preparation', () => {
    const s = taught(), old = structuredClone(oldRoots(s)), b = s.lightSeeker.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); const cash = s.cash; buy(s);
    expect(s.cash).toBe(cash - 800); expect(b).toMatchObject({ status: 'PLAYER', acquiredWeek: s.week });
    expect(s.lightSeeker.bottles[1]!.labourSteps).toBe(0); expect(s.lightSeeker.preparations).toEqual([]);
    expect(s.lightSeeker.preparedWeek).toBeNull(); expect(oldRoots(s)).toEqual(old); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount, refurbish or substitute any earlier original bottle', () => {
    const s = taught(), b = s.lightSeeker.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6200);
    for (const bottleId of ['sea-king-potion-1', 'cataclysm-priest-potion-1', 'sailor-potion-1']) reject(s, { type: 'BUY_POTION', bottleId });
    s.cash = 6199; reject(s, { type: 'BUY_POTION', bottleId: s.lightSeeker.bottles[1]!.id });
  });
  it('requires three distinct tasks, paid current-week inspection and a separate exact bottle confirmation', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [i, taskId] of LIGHT_SEEKER_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId }); expect(s.actionsRemaining).toBe(ap - 1);
      expect(s.lightSeeker.preparations[i]).toEqual({ taskId, completedWeek: s.week });
      reject(s, { type: 'PREPARE_TASK', taskId }); if (i < 2) reject(s, { type: 'PREPARE_PROMOTION' });
    }
    const scenes = structuredClone([s.lightSeeker.life, s.lightSeeker.encounter]), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.cash, s.actionsRemaining, s.lightSeeker.preparedWeek]).toEqual([cash - 120, ap - 1, s.week]);
    expect([s.lightSeeker.life, s.lightSeeker.encounter]).toEqual(scenes); expect(hasLightSeekerLock(s)).toBe(true);
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), ritual: true }]) {
      expect(validateLightSeekerCommand(command)).toBe(false); reject(s, command);
    }
  });
  it('starts twelve whole weeks at the real Justice Mentor promotion rather than the old first dose', () => {
    const s=qualify(taught());buy(s);expect(s.justiceMentor.promotionWeek).toBe(136);expect(s.progression.promotionWeek).toBe(5);
    s.week=143;expect(lightSeekerAcquisitionBlock(s,{type:'PREPARE_PROMOTION'})).toContain('7/12');
    s.week=147;reject(s,{type:'PREPARE_PROMOTION'});s.week=148;apply(s,{type:'PREPARE_PROMOTION'});expect(s.lightSeeker.preparedWeek).toBe(148);
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 2], [30, 'SUCCESS', 85, 100, 0, 2], [90, 'FAILURE', 75, 85, 30, 3], [100, 'GREAT_FAILURE', 55, 75, 60, 3]] as const)
    ('settles directed roll%s as%s without healing, refilling or rewriting20 old abilities and original people', (roll, tier, mind, health, pollution, sequence) => {
      const s = prepared(), old = structuredClone(oldRoots(s)), mastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats };
      const injuries = structuredClone(s.injuries), risk = s.injuryRisk, history = structuredClone(s.combatHistory), town = structuredClone(s.town), random = structuredClone(s.random), gender = s.character.gender;
      const sources = [...s.seer.completedSources], scene = structuredClone(s.lightSeeker.life.site);
      s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
      expect([s.lightSeeker.bottles[0]!.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
      expect(s.lightSeeker.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week });
      expect(s.lightSeeker.preparedWeek).toBeNull(); expect(hasLightSeekerLock(s)).toBe(false);
      expect(oldRoots(s)).toEqual(old); expect(s.injuries).toEqual(injuries); expect(s.injuryRisk).toBe(risk);
      expect(s.combatHistory).toEqual(history); expect(s.town).toEqual(town); expect(s.random).toEqual(random); expect(s.character.gender).toBe(gender);
      expect(s.seer.completedSources).toEqual(sources); expect(s.lightSeeker.life.site).toEqual(scene);
      for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id], id).toBe(value);
      if (sequence === 2) {
        expect(isLightSeeker(s)).toBe(true); expect(hasLightSeekerHistory(s)).toBe(true); expect(isLightSeekerAcquisitionStage(s)).toBe(false);
        expect(s.lightSeeker.justiceMentorActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
        expect(Object.keys(s.progression.mastery)).toHaveLength(20); expect(LIGHT_SEEKER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
        expect(projectLightSeeker(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
        expect(projectLightSeeker(s).actions.some(a => ['BUY_POTION', 'CONSUME', 'PREPARE_TASK'].includes(a.command.type))).toBe(false);
      } else {
        expect(s.progression.acting).toBe(100); expect(s.character.coreStats).toEqual(stats); expect(Object.keys(s.progression.mastery)).toHaveLength(18);
        expect(s.lightSeeker.justiceMentorActingAtPromotion).toBeNull(); expect(s.lightSeeker.promotionWeek).toBeNull();
      }
      expect(validateLightSeekerState(s)).toBe(true); reject(s, dose(s));
    });
  it('floors only guided rejection and never revives a dead run or treats the old wounds', () => {
    const s = prepared(); s.health = 21; s.mind = 41; const injuries = structuredClone(s.injuries), risk = s.injuryRisk;
    apply(s, dose(s), 100); expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 3]);
    expect(s.injuries).toEqual(injuries); expect(s.injuryRisk).toBe(risk); expect(validateLightSeekerState(s)).toBe(true);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead));
  });
  it('allows zero-action exit without refund, healing, draw or a restored preparation', () => {
    const s = prepared(); s.actionsRemaining = 0; s.health = 1; s.mind = 1;
    const cash = s.cash, spirit = s.spirituality, bottles = structuredClone(s.lightSeeker.bottles); reject(s, dose(s));
    const c = apply(s, { type: 'LEAVE_PREPARATION' }); expect(c.check).not.toHaveBeenCalled();
    expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, spirit, cash, 0]);
    expect(s.lightSeeker.bottles).toEqual(bottles); expect(hasLightSeekerLock(s)).toBe(false);
    reject(s, { type: 'LEAVE_PREPARATION' }); reject(s, dose(s));
  });
  it('rejects stale preparation, old scene locks, insufficient vitality and nonexact inherited mastery before any draw', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.progression.acting = 99; }, s => { s.justiceMentor.promotionWeek = s.week - 11; },
      s => { s.health = 20; }, s => { s.mind = 40; }, s => { s.week++; },
      s => { s.justiceMentor.encounter.status = 'READY'; }, s => { s.justiceMentor.preparedWeek = s.week; },
      s => { delete s.progression.mastery['sun.s3.shared-radiance']; }, s => { s.progression.mastery['sun.s1.unearned'] = 0; },
      s => { s.progression.mastery['sun.s6.notarization'] = 501; }, s => { s.progression.mastery['sun.s6.notarization'] = 0.5; },
      s => { s.world.city = 'ELSEWHERE'; },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); reject(s, dose(s)); }
  });
  it('retains failed originals, pays for another preparation and waits a real week for independently priced resupply', () => {
    const s = qualify(taught());
    for (let i = 0; i < 3; i++) {
      buy(s, i); reject(s, dose(s, i)); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, i), 100);
      // Explicit directed recovery for this isolated unit test, not public medical or natural-play evidence.
      s.health = 100; s.mind = 100; if (i < 2) reject(s, { type: 'REQUEST_SUPPLY' });
    }
    const bottles = structuredClone(s.lightSeeker.bottles), old = structuredClone(oldRoots(s)), ap = s.actionsRemaining, cash = s.cash;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); expect(s.cash).toBe(cash);
    expect(s.lightSeeker.bottles).toEqual(bottles); reject(s, { type: 'RECEIVE_SUPPLY' }); s.week++;
    apply(s, { type: 'RECEIVE_SUPPLY' }); expect(s.lightSeeker.bottles.slice(0, 3)).toEqual(bottles);
    expect(s.lightSeeker.bottles).toHaveLength(6); expect(oldRoots(s)).toEqual(old);
    expect(s.lightSeeker.bottles[3]).toMatchObject({ id: 'light-seeker-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(projectLightSeeker(s).actions.find(a => a.id === 'buy-light-seeker-potion-4')!.cost).toContain('6200便士');
    expect(validateLightSeekerState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    const beforeBuy = s.cash; buy(s, 3); expect(s.cash).toBe(beforeBuy - 6200); reject(s, dose(s, 3));
    for (const mutate of [
      (t: SliceState) => { t.lightSeeker.bottles[3]!.source = t.justiceMentor.bottles[0]!.source; },
      (t: SliceState) => { t.lightSeeker.bottles[4]!.stockedWeek!--; },
      (t: SliceState) => { t.lightSeeker.bottles[0]!.consumedWeek = t.week; t.lightSeeker.bottles[0]!.preparationWeek = t.week; },
    ]) { const t = structuredClone(s); mutate(t); expect(validateLightSeekerState(t)).toBe(false); }
  });
  it('rejects malformed acquisition commands, invented slots, free crafting and extra confirmation fields', () => {
    for (const command of [null, [], {}, { type: 'PREPARE_TASK', taskId: 'FREE_RITUAL' }, { type: 'BUY_POTION', bottleId: 'light-seeker-potion-0' },
      { type: 'LEARN_GUIDANCE', free: true }, { type: 'CONSUME', bottleId: 'light-seeker-potion-1', confirmed: 1 },
      { type: 'MAKE_INHERITED_FLASH' }, { type: 'CRAFT' }]) expect(isLightSeekerAcquisitionCommand(command)).toBe(false);
    expect(validateLightSeekerCommand({ type: 'MAKE_INHERITED_FLASH' })).toBe(false);
    const s = taught(); reject(s, { type: 'BUY_POTION', bottleId: 'light-seeker-potion-999' });
  });
  it('opens new live practice only for the exact current Sun S2 with its genuine promotion record', () => {
    const acquired = prepared(); apply(acquired, dose(acquired));
    for (const sequence of [9, 8, 7, 6, 5, 4, 3, 1, 0]) {
      const s = structuredClone(acquired); s.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>;
      const before = structuredClone(s), c = context(s);
      expect(() => applyLightSeekerCommand(s, { type: 'OBSERVE', caseId: 'marker-path' }, c)).toThrow(); expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
    }
    for (const change of [(s: SliceState) => { s.lightSeeker.promotionWeek = null; }, (s: SliceState) => { s.progression.pathwayId = 'diviner'; }]) {
      const s = structuredClone(acquired); change(s); const before = structuredClone(s);
      expect(() => applyLightSeekerCommand(s, { type: 'OBSERVE', caseId: 'marker-path' }, context(s))).toThrow(); expect(s).toEqual(before);
    }
    const before = structuredClone(acquired);
    expect(() => applyLightSeekerCommand(acquired, { type: 'MAKE_INHERITED_FLASH' } as unknown as LightSeekerCommand, context(acquired))).toThrow();
    expect(acquired).toEqual(before);
  });
});
