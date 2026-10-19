import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  applyAlchemistAcquisition, applyAlchemistCommand, createAlchemistState,
  projectAlchemist, validateAlchemistCommand, validateAlchemistState, isAlchemistAcquisitionCommand,
} from '../../src/domain/alchemist/index.js';
import {
  ALCHEMIST_FORMULA_STATUS, ALCHEMIST_PRICES, ALCHEMIST_RITUAL_SOURCE, ALCHEMIST_SOURCE_STATUS,
} from '../../src/domain/alchemist/content.js';
import { ALCHEMIST_ABILITY_IDS, type AlchemistAcquisitionCommand } from '../../src/domain/alchemist/types.js';
import { applyAlchemistRitualCommand, currentAlchemistPlot, type AlchemistRitualCommand } from '../../src/domain/alchemist/ritual.js';

/** Preserve the historical complete Astronomer fixture; resources/time below are explicit unit setup, not a natural-play claim. */
function astronomer(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/astronomer-v0980/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.alchemist = createAlchemistState();
  s.week = Math.max(s.week, s.astronomer.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: AlchemistAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyAlchemistAcquisition(s, command, c); return c;
}
function ritual(s: SliceState, command: AlchemistRitualCommand) { applyAlchemistRitualCommand(s, command, context(s)); }
function taught(s = astronomer()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.alchemist.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.alchemist.bottles[index]!.id, confirmed: true }) as const;
function prepareRitual(s: SliceState) {
  ritual(s, { type: 'PURCHASE_PLOT' }); s.week += 1;
  ritual(s, { type: 'OPEN_RITUAL' }); ritual(s, { type: 'SURVEY' }); ritual(s, { type: 'DRAIN_LIFE', confirmed: true }); return s;
}
function ready() { const s = taught(); buy(s); return prepareRitual(s); }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyAlchemistAcquisition(s, command as AlchemistAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Alchemist S4 original bottles and permanent living-garden cost', () => {
  it('creates independent originals and hides the channel before Astronomer', () => {
    const s = createSliceRun('alchemist-hidden', sliceDefaultCreationSelection, 'alchemist-hidden');
    expect(validateAlchemistState(s)).toBe(true);
    expect(projectAlchemist(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], supplies: '' });
    expect(projectAlchemist(s).story).toBeUndefined();
    const other = createAlchemistState(); other.bottles[0]!.labourSteps = 5;
    expect(s.alchemist.bottles[0]!.labourSteps).toBe(0); expect(s.alchemist.ritual.plots).toEqual([]);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges520 and one action while keeping complete formula and ritual conditions unknown', () => {
    const s = astronomer(), old = structuredClone([s.savant, s.archaeologist, s.appraiser, s.artisan, s.astronomer]);
    apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99480, 99]);
    expect([s.savant, s.archaeologist, s.appraiser, s.artisan, s.astronomer]).toEqual(old);
    expect(ALCHEMIST_PRICES).toEqual({ guidance: 520, potion: 7200, labourCredit: 6300 });
    expect(ALCHEMIST_FORMULA_STATUS).toContain('完整配方'); expect(ALCHEMIST_FORMULA_STATUS).toContain('完整条件待核');
    expect(ALCHEMIST_RITUAL_SOURCE).toContain('全部生命力'); expect(ALCHEMIST_SOURCE_STATUS).toContain('高达');
    expect(projectAlchemist(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(s.alchemist.bottles).toHaveLength(3); expect(new Set(s.alchemist.bottles.map(b => b.source)).size).toBe(3);
    expect(validateAlchemistState(s)).toBe(true); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual bottle-specific jobs and900 cash without producing a free garden', () => {
    const s = taught(), b = s.alchemist.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, b.status, b.acquiredWeek]).toEqual([98580, 'PLAYER', s.week]);
    expect(s.alchemist.bottles[1]!.labourSteps).toBe(0); expect(s.alchemist.ritual.plots).toEqual([]);
    expect(validateAlchemistState(s)).toBe(true); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount or transfer one original bottle’s labour', () => {
    const s = taught(), b = s.alchemist.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const before = s.cash; buy(s); expect(before - s.cash).toBe(7200);
    s.cash = 7199; reject(s, { type: 'BUY_POTION', bottleId: s.alchemist.bottles[1]!.id });
  });
  it('cannot drink a paid bottle before actual full-area life extraction', () => {
    const s = taught(); buy(s); reject(s, dose(s));
    ritual(s, { type: 'PURCHASE_PLOT' }); reject(s, dose(s)); s.week += 1;
    ritual(s, { type: 'OPEN_RITUAL' }); reject(s, dose(s)); ritual(s, { type: 'SURVEY' }); reject(s, dose(s));
    expect(currentAlchemistPlot(s)!.plants.every(p => p.status === 'LIVING')).toBe(true);
    expect(s.alchemist.bottles[0]!.status).toBe('PLAYER');
  });
  it('requires exact separate potion consent after independently confirmed extraction', () => {
    const s = ready();
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), acceptBodyChange: true }, { ...dose(s), restoredGarden: true }]) {
      expect(validateAlchemistCommand(command)).toBe(false); reject(s, command);
    }
    expect(currentAlchemistPlot(s)!.plants.every(p => p.status === 'DEAD')).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 4], [30, 'SUCCESS', 85, 100, 0, 4], [90, 'FAILURE', 75, 85, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 60, 5]] as const)('uses exact four-tier result%s, keeps old history and leaves dead land', (roll, tier, mind, health, pollution, sequence) => {
    const s = ready(), b = s.alchemist.bottles[0]!, plot = structuredClone(currentAlchemistPlot(s)!);
    const old = structuredClone([s.savant, s.archaeologist, s.appraiser, s.artisan, s.astronomer]);
    const mastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, gender = s.character.gender;
    s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
    expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(b).toMatchObject({ status: 'CONSUMED', ritualId: plot.id, ritualWindowWeek: plot.windowWeek, consumedWeek: s.week });
    expect(s.alchemist.ritual).toMatchObject({ activePlotId: null, playerLocation: 'OUTSIDE' });
    expect(s.alchemist.ritual.plots[0]).toMatchObject({ status: 'CLOSED', plants: plot.plants, soil: plot.soil, pool: plot.pool, consumedBottleId: b.id });
    expect(projectAlchemist(s).ritual.plots[0]).toMatchObject({ livePlants: 0, deadPlants: 14, soil: { vitality: 0 }, pool: { waterLitres: 0 } });
    expect([s.savant, s.archaeologist, s.appraiser, s.artisan, s.astronomer]).toEqual(old);
    for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
    expect(s.character.gender).toBe(gender);
    if (sequence === 4) {
      expect(s.alchemist.astronomerActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(ALCHEMIST_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    } else expect(s.progression.acting).toBe(100);
    expect(validateAlchemistState(s)).toBe(true); reject(s, dose(s));
  });
  it('applies potion-only floor1, caps pollution and does not revive the sacrificed plants', () => {
    const s = ready(); s.health = 21; s.mind = 41; s.seer.pollution = 90; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence, s.seer.pollution]).toEqual([1, 1, 'ACTIVE', 5, 100]);
    expect(s.alchemist.ritual.plots[0]!.plants.every(p => p.status === 'DEAD')).toBe(true);
    expect(validateAlchemistState(s)).toBe(true);
  });
  it('can leave the drained plot at0 actions and stay Astronomer with potion intact', () => {
    const s = ready(), plot = structuredClone(currentAlchemistPlot(s)!); s.actionsRemaining = 0;
    applyAlchemistCommand(s, { type: 'LEAVE_RITUAL' }, context(s));
    expect(s.alchemist.bottles[0]!.status).toBe('PLAYER'); expect(s.progression.sequence).toBe(5);
    expect(s.alchemist.ritual.plots[0]).toMatchObject({ plants: plot.plants, soil: plot.soil, pool: plot.pool, consumedBottleId: null });
    expect(projectAlchemist(s).insideCase).toBe(false); reject(s, dose(s)); expect(validateAlchemistState(s)).toBe(true);
  });
  it('charges actual new live land after failure and preserves the first dead original after success', () => {
    const s = ready(); apply(s, dose(s), 90);
    const firstBottle = structuredClone(s.alchemist.bottles[0]), firstPlot = structuredClone(s.alchemist.ritual.plots[0]);
    buy(s, 1); reject(s, dose(s, 1)); const cash = s.cash, ap = s.actionsRemaining;
    ritual(s, { type: 'PURCHASE_PLOT' }); expect([s.cash, s.actionsRemaining]).toEqual([cash - 720, ap - 1]);
    const fresh = currentAlchemistPlot(s)!; expect(fresh.id).toBe('AL4-PLOT-2'); expect(fresh.plants.every(p => p.status === 'LIVING')).toBe(true);
    expect(fresh.plants.some(p => firstPlot!.plants.some(old => old.id === p.id))).toBe(false);
    expect(() => ritual(s, { type: 'OPEN_RITUAL' })).toThrow();
    s.week += 1; ritual(s, { type: 'OPEN_RITUAL' }); ritual(s, { type: 'SURVEY' }); ritual(s, { type: 'DRAIN_LIFE', confirmed: true }); apply(s, dose(s, 1));
    expect(s.alchemist.bottles[0]).toEqual(firstBottle); expect(s.alchemist.ritual.plots[0]).toEqual(firstPlot);
    expect(validateAlchemistState(s)).toBe(true);
  });
  it('retains three failures and waits a real week for a still-priced fourth original bottle', () => {
    const s = taught();
    for (let n = 0; n < 3; n++) {
      buy(s, n); prepareRitual(s); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100;
      if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' });
    }
    const originals = structuredClone(s.alchemist.bottles), land = structuredClone(s.alchemist.ritual), ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.alchemist.bottles.slice(0, 3)).toEqual(originals); expect(s.alchemist.bottles).toHaveLength(6);
    expect(s.alchemist.bottles[3]).toMatchObject({ id: 'alchemist-potion-4', status: 'SUPPLIER', stockedWeek: s.week, labourSteps: 0, acquiredWeek: null });
    expect(s.alchemist.ritual).toEqual(land);
    expect(projectAlchemist(s).actions.find(a => a.id === 'buy-alchemist-potion-4')!.cost).toContain('7200便士');
    expect(validateAlchemistState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('checks digestion, twelve full weeks, health, actual own bottle and current window before drawing', () => {
    const s = ready();
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100;
    const oldPromotion = s.astronomer.promotionWeek; s.astronomer.promotionWeek = s.week - 11; reject(s, dose(s)); s.astronomer.promotionWeek = oldPromotion;
    s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    reject(s, dose(s, 1)); const g = currentAlchemistPlot(s)!; g.plants[0]!.status = 'LIVING'; reject(s, dose(s)); g.plants[0]!.status = 'DEAD';
    s.week += 1; reject(s, dose(s));
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'BUY_POTION', bottleId: 'astronomer-potion-1' }, { type: 'LEARN_GUIDANCE', grantLife: true }, { type: 'CONSUME', bottleId: 'alchemist-potion-1' }])('rejects unknown or nonexact acquisition command%# without mutation', command => {
    expect(validateAlchemistCommand(command)).toBe(false); expect(isAlchemistAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects copied bottles, forged resurrection, mismatched history and malformed nested records', () => {
    const s = ready(); apply(s, dose(s));
    const mutations: ((state: SliceState) => void)[] = [
      t => { t.alchemist.astronomerActingAtPromotion = 99; }, t => { t.alchemist.bottles[0]!.source = 'copied old potion'; },
      t => { t.alchemist.bottles[0]!.ritualId = 'AL4-PLOT-999'; }, t => { t.alchemist.bottles[0]!.ritualWindowWeek! -= 1; },
      t => { t.alchemist.ritual.plots[0]!.consumedBottleId = 'astronomer-potion-1'; },
      t => { t.alchemist.ritual.plots[0]!.soil.vitality = 100; }, t => { t.alchemist.ritual.plots[0]!.plants[0]!.status = 'LIVING'; },
      t => { t.alchemist.bottles[1]!.id = t.alchemist.bottles[0]!.id; }, t => { t.alchemist.bottles[0]!.stockedWeek = t.week; },
      t => { delete t.progression.mastery[ALCHEMIST_ABILITY_IDS[0]]; },
      t => { (t.alchemist as unknown as Record<string, unknown>).ritual = null; },
      t => { (t.alchemist as unknown as Record<string, unknown>).life = null; },
    ];
    for (const change of mutations) {
      const t = structuredClone(s); change(t); expect(() => validateAlchemistState(t)).not.toThrow(); expect(validateAlchemistState(t)).toBe(false);
    }
  });
  it('validates after JSON object keys are reordered', () => {
    const s = ready(); apply(s, dose(s));
    const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, reorder(value)])) : v;
    expect(validateAlchemistState(reorder(s) as SliceState)).toBe(true);
  });
});
