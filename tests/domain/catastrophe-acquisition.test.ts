import { describe, expect, it, vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyCatastropheAcquisition, applyCatastropheCommand, createCatastropheState, hasCatastropheLock,
  isCatastrophe, isCatastropheAcquisitionCommand, isCatastropheAcquisitionStage, hasCatastropheHistory,
  projectCatastrophe, validateCatastropheCommand, validateCatastropheState, catastropheAcquisitionBlock } from '../../src/domain/catastrophe/index.js';
import { CATASTROPHE_FORMULA_STATUS, CATASTROPHE_SOURCE_STATUS, CATASTROPHE_CONSUMPTION_RISK,
  CATASTROPHE_PRICES, CATASTROPHE_POTION_SOURCES } from '../../src/domain/catastrophe/content.js';
import { CATASTROPHE_ABILITY_IDS, CATASTROPHE_PREPARATION_IDS,
  type CatastropheAcquisitionCommand, type CatastropheCommand } from '../../src/domain/catastrophe/types.js';
import { tyrantLegacyKeys, seaKingFixturePath } from './catastrophe-helper.js';

/** Directed domain-only setup from the actual 492-command survivor. No fixture, RNG or natural outcome is rewritten. */
function seaKing(): SliceState {
  const s = migrateSliceState(readObjectEntry<unknown>(seaKingFixturePath, 'final'));
  s.catastrophe = createCatastropheState(); s.week = s.seaKing.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 30;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) =>
    resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: CatastropheAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyCatastropheAcquisition(s, command, c); return c;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyCatastropheAcquisition(s, command as CatastropheAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled(); expect(c.note).not.toHaveBeenCalled();
}
function taught(s = seaKing()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of CATASTROPHE_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const b = s.catastrophe.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.catastrophe.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
const oldRoots = (s: SliceState) => tyrantLegacyKeys.map(key => s[key]);

describe('Catastrophe S2 independent acquisition and exact inherited source boundaries', () => {
  it('starts from the genuine living W121 Sea King with20 original mastery and two light plus one untreated heavy injury', () => {
    const old = readObjectEntry<SliceState>(seaKingFixturePath, 'final'), s = migrateSliceState(old);
    expect(readObjectEntry<unknown[]>(seaKingFixturePath, 'commands')).toHaveLength(492);
    expect(old).toMatchObject({ revision: 493, week: 121, status: 'ACTIVE', health: 50, mind: 100, spirituality: 94, cash: 540,
      actionsRemaining: 3, injuryRisk: 2, random: { seed: 'sailor-natural-v026', cursor: 263 },
      character: { name: '托林', age: 26, gender: 'FEMALE', coreStats: { physique: 33, perception: 26, will: 26, knowledge: 20 } },
      progression: { pathwayId: 'tyrant', sequence: 3, acting: 100, promotionWeek: 7 }, seaKing: { promotionWeek: 113 } });
    expect(Object.keys(old.progression.mastery)).toHaveLength(20); expect(oldRoots(s)).toEqual(oldRoots(old));
    expect(s.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['LIGHT', null], ['LIGHT', null], ['HEAVY', null]]);
    expect(validateCatastropheState(s)).toBe(true); expect(projectCatastrophe(s).digestion).toContain('8/12');
    expect(isCatastropheAcquisitionStage(s)).toBe(true); expect(hasCatastropheHistory(s)).toBe(false);
  });
  it('creates independent originals and hides the channel for ordinary people and every unsupported stage', () => {
    const s = createSliceRun('catastrophe-hidden', sliceDefaultCreationSelection, 'catastrophe-hidden');
    expect(projectCatastrophe(s)).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false,
      formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], resources: null });
    expect(projectCatastrophe(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createCatastropheState(); other.bottles[0]!.labourSteps = 5; other.life.site.water.bayUnits = 0;
    expect(s.catastrophe.bottles[0]!.labourSteps).toBe(0); expect(s.catastrophe.life.site.water.bayUnits).toBe(20);
    expect(validateCatastropheState(s)).toBe(true);
    const forgedS1=seaKing(); forgedS1.progression.sequence=1;
    expect(projectCatastrophe(forgedS1).actions).toEqual([]); reject(forgedS1, {type:'LEARN_GUIDANCE'});
    expect(()=>assertValidSliceState(forgedS1)).toThrow();
    for (const sequence of [9, 8, 7, 6, 5, 4, 0]) {
      const t = seaKing(); t.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>;
      expect(projectCatastrophe(t).discovered).toBe(false); reject(t, { type: 'LEARN_GUIDANCE' });
    }
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'moon', 'darkness', 'white-tower', 'sun', 'death', 'door', 'error', 'warrior', 'demoness', 'hermit', 'hanged-man', 'abyss', 'chained', 'wheel', 'black-emperor', 'justiciar', 'mother'] as const) {
      const t = seaKing(); t.progression.pathwayId = pathwayId;
      expect(projectCatastrophe(t).discovered, pathwayId).toBe(false); reject(t, { type: 'LEARN_GUIDANCE' });
    }
  });
  it('charges real guidance, distinguishes verified names from unknown formula/rite and identifies all finite new rules as G', () => {
    const s = seaKing(), prior = structuredClone(oldRoots(s)), scene = structuredClone(s.catastrophe.life.site);
    apply(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]);
    expect(oldRoots(s)).toEqual(prior); expect(s.catastrophe.life.site).toEqual(scene);
    expect(CATASTROPHE_PRICES).toEqual({ guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 });
    expect(CATASTROPHE_SOURCE_STATUS).toContain('已核天灾2、雷神1'); expect(CATASTROPHE_SOURCE_STATUS).toContain('均为原创G');
    expect(CATASTROPHE_FORMULA_STATUS).toContain('尚未核实'); expect(CATASTROPHE_FORMULA_STATUS).toContain('不能断言无需仪式');
    expect(CATASTROPHE_FORMULA_STATUS).toContain('不复用序列4地震海啸'); expect(CATASTROPHE_FORMULA_STATUS).toContain('序列0挑战神灵');
    expect(CATASTROPHE_CONSUMPTION_RISK).toContain('不保护普通死亡或战斗');
    expect(projectCatastrophe(s)).toMatchObject({ formulaKnown: false, formula: [],
      preparations: CATASTROPHE_PREPARATION_IDS.map(taskId => ({ taskId, completedWeek: null })) });
    expect(s.catastrophe.bottles.map(b => b.source)).toEqual(CATASTROPHE_POTION_SOURCES.map(b => b.source));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five bottle-specific jobs and an independent800 payment without transferring labour or furnishing free preparation', () => {
    const s = taught(), old = structuredClone(oldRoots(s)), b = s.catastrophe.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); const cash = s.cash; buy(s);
    expect(s.cash).toBe(cash - 800); expect(b).toMatchObject({ status: 'PLAYER', acquiredWeek: s.week });
    expect(s.catastrophe.bottles[1]!.labourSteps).toBe(0); expect(s.catastrophe.preparations).toEqual([]);
    expect(s.catastrophe.preparedWeek).toBeNull(); expect(oldRoots(s)).toEqual(old); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount, refurbish or substitute any earlier original bottle', () => {
    const s = taught(), b = s.catastrophe.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6200);
    for (const bottleId of ['sea-king-potion-1', 'cataclysm-priest-potion-1', 'sailor-potion-1']) reject(s, { type: 'BUY_POTION', bottleId });
    s.cash = 6199; reject(s, { type: 'BUY_POTION', bottleId: s.catastrophe.bottles[1]!.id });
  });
  it('requires three distinct tasks, paid current-week inspection and a separate exact bottle confirmation', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [i, taskId] of CATASTROPHE_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId }); expect(s.actionsRemaining).toBe(ap - 1);
      expect(s.catastrophe.preparations[i]).toEqual({ taskId, completedWeek: s.week });
      reject(s, { type: 'PREPARE_TASK', taskId }); if (i < 2) reject(s, { type: 'PREPARE_PROMOTION' });
    }
    const scenes = structuredClone([s.catastrophe.life, s.catastrophe.encounter]), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.cash, s.actionsRemaining, s.catastrophe.preparedWeek]).toEqual([cash - 120, ap - 1, s.week]);
    expect([s.catastrophe.life, s.catastrophe.encounter]).toEqual(scenes); expect(hasCatastropheLock(s)).toBe(true);
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), ritual: true }]) {
      expect(validateCatastropheCommand(command)).toBe(false); reject(s, command);
    }
  });
  it('starts twelve full weeks at the actual Sea King W113 rather than Sailor W7 or Cataclysm Priest W84', () => {
    const s = qualify(taught()); buy(s);
    expect([s.seaKing.promotionWeek, s.cataclysmPriest.promotionWeek, s.progression.promotionWeek]).toEqual([113, 84, 7]);
    s.week = 121; expect(catastropheAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('8/12');
    s.week = 124; reject(s, { type: 'PREPARE_PROMOTION' }); s.week = 125; apply(s, { type: 'PREPARE_PROMOTION' });
    expect(s.catastrophe.preparedWeek).toBe(125); expect(s.progression.promotionWeek).toBe(7);
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 2], [30, 'SUCCESS', 85, 100, 0, 2], [90, 'FAILURE', 75, 85, 30, 3], [100, 'GREAT_FAILURE', 55, 75, 60, 3]] as const)
    ('settles directed roll%s as%s without healing, refilling or rewriting20 old abilities and original people', (roll, tier, mind, health, pollution, sequence) => {
      const s = prepared(), old = structuredClone(oldRoots(s)), mastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats };
      const injuries = structuredClone(s.injuries), risk = s.injuryRisk, history = structuredClone(s.combatHistory), town = structuredClone(s.town), random = structuredClone(s.random), gender = s.character.gender;
      const sources = [...s.seer.completedSources], scene = structuredClone(s.catastrophe.life.site);
      s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
      expect([s.catastrophe.bottles[0]!.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
      expect(s.catastrophe.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week });
      expect(s.catastrophe.preparedWeek).toBeNull(); expect(hasCatastropheLock(s)).toBe(false);
      expect(oldRoots(s)).toEqual(old); expect(s.injuries).toEqual(injuries); expect(s.injuryRisk).toBe(risk);
      expect(s.combatHistory).toEqual(history); expect(s.town).toEqual(town); expect(s.random).toEqual(random); expect(s.character.gender).toBe(gender);
      expect(s.seer.completedSources).toEqual(sources); expect(s.catastrophe.life.site).toEqual(scene);
      for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id], id).toBe(value);
      if (sequence === 2) {
        expect(isCatastrophe(s)).toBe(true); expect(hasCatastropheHistory(s)).toBe(true); expect(isCatastropheAcquisitionStage(s)).toBe(false);
        expect(s.catastrophe.seaKingActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
        expect(Object.keys(s.progression.mastery)).toHaveLength(22); expect(CATASTROPHE_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
        expect(projectCatastrophe(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
        expect(projectCatastrophe(s).actions.some(a => ['BUY_POTION', 'CONSUME', 'PREPARE_TASK'].includes(a.command.type))).toBe(false);
      } else {
        expect(s.progression.acting).toBe(100); expect(s.character.coreStats).toEqual(stats); expect(Object.keys(s.progression.mastery)).toHaveLength(20);
        expect(s.catastrophe.seaKingActingAtPromotion).toBeNull(); expect(s.catastrophe.promotionWeek).toBeNull();
      }
      expect(validateCatastropheState(s)).toBe(true); reject(s, dose(s));
    });
  it('floors only guided rejection and never revives a dead run or treats the old wounds', () => {
    const s = prepared(); s.health = 21; s.mind = 41; const injuries = structuredClone(s.injuries), risk = s.injuryRisk;
    apply(s, dose(s), 100); expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 3]);
    expect(s.injuries).toEqual(injuries); expect(s.injuryRisk).toBe(risk); expect(validateCatastropheState(s)).toBe(true);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead));
  });
  it('allows zero-action exit without refund, healing, draw or a restored preparation', () => {
    const s = prepared(); s.actionsRemaining = 0; s.health = 1; s.mind = 1;
    const cash = s.cash, spirit = s.spirituality, bottles = structuredClone(s.catastrophe.bottles); reject(s, dose(s));
    const c = apply(s, { type: 'LEAVE_PREPARATION' }); expect(c.check).not.toHaveBeenCalled();
    expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, spirit, cash, 0]);
    expect(s.catastrophe.bottles).toEqual(bottles); expect(hasCatastropheLock(s)).toBe(false);
    reject(s, { type: 'LEAVE_PREPARATION' }); reject(s, dose(s));
  });
  it('rejects stale preparation, old scene locks, insufficient vitality and nonexact inherited mastery before any draw', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.progression.acting = 99; }, s => { s.seaKing.promotionWeek = s.week - 11; },
      s => { s.health = 20; }, s => { s.mind = 40; }, s => { s.week++; },
      s => { s.seaKing.encounter.status = 'READY'; }, s => { s.seaKing.preparedWeek = s.week; },
      s => { s.seaKing.life.plate.location = 'PLAYER'; }, s => { s.seaKing.life.playerLocation = 'PIER'; },
      s => { s.seaKing.life.cases['remote-dinghy'].contactOpen = true; },
      s => { s.cataclysmPriest.ritual.activeVisitId = 'CP4-RITUAL-1'; },
      s => { delete s.progression.mastery['tyrant.s3.sea-domain']; }, s => { s.progression.mastery['tyrant.s1.unearned'] = 0; },
      s => { s.progression.mastery['tyrant.s6.wind-control'] = 501; }, s => { s.progression.mastery['tyrant.s6.wind-control'] = 0.5; },
      s => { s.world.city = 'ELSEWHERE'; },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); reject(s, dose(s)); }
  }, 15_000);
  it('retains failed originals, pays for another preparation and waits a real week for independently priced resupply', () => {
    const s = qualify(taught());
    for (let i = 0; i < 3; i++) {
      buy(s, i); reject(s, dose(s, i)); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, i), 100);
      // Explicit directed recovery for this isolated unit test, not public medical or natural-play evidence.
      s.health = 100; s.mind = 100; if (i < 2) reject(s, { type: 'REQUEST_SUPPLY' });
    }
    const bottles = structuredClone(s.catastrophe.bottles), old = structuredClone(oldRoots(s)), ap = s.actionsRemaining, cash = s.cash;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); expect(s.cash).toBe(cash);
    expect(s.catastrophe.bottles).toEqual(bottles); reject(s, { type: 'RECEIVE_SUPPLY' }); s.week++;
    apply(s, { type: 'RECEIVE_SUPPLY' }); expect(s.catastrophe.bottles.slice(0, 3)).toEqual(bottles);
    expect(s.catastrophe.bottles).toHaveLength(6); expect(oldRoots(s)).toEqual(old);
    expect(s.catastrophe.bottles[3]).toMatchObject({ id: 'catastrophe-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(projectCatastrophe(s).actions.find(a => a.id === 'buy-catastrophe-potion-4')!.cost).toContain('6200便士');
    expect(validateCatastropheState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    const beforeBuy = s.cash; buy(s, 3); expect(s.cash).toBe(beforeBuy - 6200); reject(s, dose(s, 3));
    for (const mutate of [
      (t: SliceState) => { t.catastrophe.bottles[3]!.source = t.seaKing.bottles[0]!.source; },
      (t: SliceState) => { t.catastrophe.bottles[4]!.stockedWeek!--; },
      (t: SliceState) => { t.catastrophe.bottles[0]!.consumedWeek = t.week; t.catastrophe.bottles[0]!.preparationWeek = t.week; },
    ]) { const t = structuredClone(s); mutate(t); expect(validateCatastropheState(t)).toBe(false); }
  });
  it('rejects malformed acquisition commands, invented slots, free crafting and extra confirmation fields', () => {
    for (const command of [null, [], {}, { type: 'PREPARE_TASK', taskId: 'FREE_RITUAL' }, { type: 'BUY_POTION', bottleId: 'catastrophe-potion-0' },
      { type: 'LEARN_GUIDANCE', free: true }, { type: 'CONSUME', bottleId: 'catastrophe-potion-1', confirmed: 1 },
      { type: 'MAKE_INHERITED_FLASH' }, { type: 'CRAFT' }]) expect(isCatastropheAcquisitionCommand(command)).toBe(false);
    expect(validateCatastropheCommand({ type: 'MAKE_INHERITED_FLASH' })).toBe(false);
    const s = taught(); reject(s, { type: 'BUY_POTION', bottleId: 'catastrophe-potion-999' });
  });
  it('opens new live practice only for the exact current tyrant S2 with its genuine promotion record', () => {
    const acquired = prepared(); apply(acquired, dose(acquired));
    for (const sequence of [9, 8, 7, 6, 5, 4, 3, 1, 0]) {
      const s = structuredClone(acquired); s.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>;
      const before = structuredClone(s), c = context(s);
      expect(() => applyCatastropheCommand(s, { type: 'OBSERVE', caseId: 'buoy-return' }, c)).toThrow(); expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
    }
    for (const change of [(s: SliceState) => { s.catastrophe.promotionWeek = null; }, (s: SliceState) => { s.progression.pathwayId = 'diviner'; }]) {
      const s = structuredClone(acquired); change(s); const before = structuredClone(s);
      expect(() => applyCatastropheCommand(s, { type: 'OBSERVE', caseId: 'buoy-return' }, context(s))).toThrow(); expect(s).toEqual(before);
    }
    const before = structuredClone(acquired);
    expect(() => applyCatastropheCommand(acquired, { type: 'MAKE_INHERITED_FLASH' } as unknown as CatastropheCommand, context(acquired))).toThrow();
    expect(acquired).toEqual(before);
  });
});
