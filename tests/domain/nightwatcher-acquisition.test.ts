import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  applyNightwatcherAcquisition, applyNightwatcherCommand, createNightwatcherState,
  projectNightwatcher, validateNightwatcherCommand, validateNightwatcherState, isNightwatcherAcquisitionCommand,
} from '../../src/domain/nightwatcher/index.js';
import {
  NIGHTWATCHER_FORMULA_STATUS, NIGHTWATCHER_PRICES, NIGHTWATCHER_RITUAL_SOURCE, NIGHTWATCHER_SOURCE_STATUS,
} from '../../src/domain/nightwatcher/content.js';
import { NIGHTWATCHER_ABILITY_IDS, type NightwatcherAcquisitionCommand } from '../../src/domain/nightwatcher/types.js';
import {
  applyNightwatcherRitualCommand, currentNightwatcherVisit, type NightwatcherRitualCommand,
} from '../../src/domain/nightwatcher/ritual.js';

/** Historic S5 original history is unchanged; resource/time edits are unit setup, not a natural-play claim. */
function warlock(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/spirit-warlock-v01000/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.nightwatcher = createNightwatcherState();
  s.week = Math.max(s.week, s.spiritWarlock.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: NightwatcherAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyNightwatcherAcquisition(s, command, c); return c;
}
function ritual(s: SliceState, command: NightwatcherRitualCommand) { applyNightwatcherRitualCommand(s, command, context(s)); }
function taught(s = warlock()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.nightwatcher.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.nightwatcher.bottles[index]!.id, confirmed: true }) as const;
function prepareRitual(s: SliceState) {
  ritual(s, { type: 'BOOK_RITUAL' }); s.week += 1;
  ritual(s, { type: 'BEGIN_RITUAL' }); ritual(s, { type: 'CHECK_PREPARATION', confirmed: true }); return s;
}
function ready() { const s = taught(); buy(s); return prepareRitual(s); }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyNightwatcherAcquisition(s, command as NightwatcherAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}
const oldDarkness = (s: SliceState) => [s.sleepless, s.midnight, s.nightmare, s.soother, s.spiritWarlock];

describe('Nightwatcher S4 original potion acquisition and present professional ritual', () => {
  it('creates three independent originals and hides the source before Spirit Warlock', () => {
    const s = createSliceRun('nightwatcher-hidden', sliceDefaultCreationSelection, 'nightwatcher-hidden');
    expect(validateNightwatcherState(s)).toBe(true);
    expect(projectNightwatcher(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], supplies: '' });
    expect(projectNightwatcher(s).story).toBeUndefined();
    const other = createNightwatcherState(); other.bottles[0]!.labourSteps = 5;
    expect(s.nightwatcher.bottles[0]!.labourSteps).toBe(0); expect(s.nightwatcher.ritual.visits).toEqual([]);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges520 and one action without inventing full formula or skipping the S4 ritual', () => {
    const s = warlock(), old = structuredClone(oldDarkness(s));
    apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99480, 99]); expect(oldDarkness(s)).toEqual(old);
    expect(NIGHTWATCHER_PRICES).toEqual({ guidance: 520, potion: 7200, labourCredit: 6300 });
    expect(NIGHTWATCHER_FORMULA_STATUS).toContain('完整配方'); expect(NIGHTWATCHER_FORMULA_STATUS).toContain('保持未知');
    expect(NIGHTWATCHER_RITUAL_SOURCE).toContain('完整原著仪式仍未核实'); expect(NIGHTWATCHER_RITUAL_SOURCE).toContain('奥黛莉娅');
    expect(NIGHTWATCHER_SOURCE_STATUS).toContain('SW5-LEAF-1'); expect(NIGHTWATCHER_SOURCE_STATUS).toContain('恐惧主教3仍未开放');
    expect(projectNightwatcher(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(s.nightwatcher.bottles).toHaveLength(3); expect(new Set(s.nightwatcher.bottles.map(b => b.source)).size).toBe(3);
    expect(validateNightwatcherState(s)).toBe(true); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual bottle-specific jobs and900 cash without gifting a ritual kit', () => {
    const s = taught(), b = s.nightwatcher.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, b.status, b.acquiredWeek]).toEqual([98580, 'PLAYER', s.week]);
    expect(s.nightwatcher.bottles[1]!.labourSteps).toBe(0); expect(s.nightwatcher.ritual.visits).toEqual([]);
    expect(validateNightwatcherState(s)).toBe(true); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount, backdate or transfer labour between originals', () => {
    const s = taught(), b = s.nightwatcher.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const before = s.cash; buy(s); expect(before - s.cash).toBe(7200);
    reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 7199; reject(s, { type: 'BUY_POTION', bottleId: s.nightwatcher.bottles[1]!.id });
  });
  it('requires new present preparation while preserving original S5 spirit and practice history', () => {
    const s = taught(), old = structuredClone(s.spiritWarlock); buy(s); reject(s, dose(s));
    expect(old.companion).toMatchObject({ source: 'SW5-LEAF-1', status: 'SEALED', acquiredWeek: 45, deployments: 6, recalls: 6 });
    ritual(s, { type: 'BOOK_RITUAL' }); reject(s, dose(s)); s.week += 1;
    ritual(s, { type: 'BEGIN_RITUAL' }); reject(s, dose(s));
    expect(s.nightwatcher.bottles[0]!.status).toBe('PLAYER'); expect(s.spiritWarlock).toEqual(old);
    ritual(s, { type: 'CHECK_PREPARATION', confirmed: true });
    expect(projectNightwatcher(s).actions.find(a => a.id === `consume-${dose(s).bottleId}`)?.enabled).toBe(true);
  });
  it('requires separate exact potion consent after confirmed preparation', () => {
    const s = ready();
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), acceptBodyChange: true }, { ...dose(s), skipRitual: true }]) {
      expect(validateNightwatcherCommand(command)).toBe(false); reject(s, command);
    }
    expect(s.nightwatcher.bottles[0]!.status).toBe('PLAYER');
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 4], [30, 'SUCCESS', 85, 100, 0, 4], [90, 'FAILURE', 75, 85, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 60, 5]] as const)('uses exact four-tier result%s, original kit and old body/spirit/history', (roll, tier, mind, health, pollution, sequence) => {
    const s = ready(), b = s.nightwatcher.bottles[0]!, visit = structuredClone(currentNightwatcherVisit(s)!);
    const old = structuredClone(oldDarkness(s)), mastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, gender = s.character.gender;
    s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
    expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(b).toMatchObject({ status: 'CONSUMED', ritualId: visit.id, ritualWindowWeek: visit.windowWeek, consumedWeek: s.week });
    expect(s.nightwatcher.ritual).toMatchObject({ activeVisitId: null, playerLocation: 'OUTSIDE' });
    expect(s.nightwatcher.ritual.visits[0]).toMatchObject({ consumedBottleId: b.id, windowWeek: s.week, closedWeek: s.week, kit: { id: visit.kit.id, source: visit.kit.source, status: 'CONSUMED', sealsIntact: false, consumedWeek: s.week, location: 'TABLE' } });
    expect(s.nightwatcher.ritual.expert).toMatchObject({ id: 'NW4-ODELIA', alive: true, willing: true, location: 'NW4-HALL' });
    expect(oldDarkness(s)).toEqual(old); for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
    expect(s.character.gender).toBe(gender);
    if (sequence === 4) {
      expect(s.nightwatcher.spiritWarlockActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(NIGHTWATCHER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      expect(Object.keys(s.progression.mastery).filter(id => id.includes('spirit-assistance'))).toEqual(['darkness.s5.spirit-assistance']);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    } else expect(s.progression.acting).toBe(100);
    expect(validateNightwatcherState(s)).toBe(true); reject(s, dose(s));
  });
  it('applies the potion-only floor1 and pollution cap without healing or restoring SP', () => {
    const s = ready(); s.health = 21; s.mind = 41; s.seer.pollution = 90; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence, s.seer.pollution, s.spirituality]).toEqual([1, 1, 'ACTIVE', 5, 100, 31]);
    expect(validateNightwatcherState(s)).toBe(true);
  });
  it('can safely end at0 actions and remain S5 with its bottle intact', () => {
    const s = ready(), visit = structuredClone(currentNightwatcherVisit(s)!); s.actionsRemaining = 0;
    applyNightwatcherCommand(s, { type: 'END_RITUAL' }, context(s));
    expect(s.nightwatcher.bottles[0]!.status).toBe('PLAYER'); expect(s.progression.sequence).toBe(5);
    expect(s.nightwatcher.ritual.visits[0]).toMatchObject({ id: visit.id, consumedBottleId: null });
    expect(projectNightwatcher(s).insideCase).toBe(false); reject(s, dose(s)); expect(validateNightwatcherState(s)).toBe(true);
  });
  it('requires another paid next-week booking after failure without modifying the first visit', () => {
    const s = ready(); apply(s, dose(s), 90);
    const firstBottle = structuredClone(s.nightwatcher.bottles[0]), firstVisit = structuredClone(s.nightwatcher.ritual.visits[0]);
    buy(s, 1); reject(s, dose(s, 1)); const cash = s.cash, ap = s.actionsRemaining;
    ritual(s, { type: 'BOOK_RITUAL' }); expect([s.cash, s.actionsRemaining]).toEqual([cash - 240, ap - 1]);
    expect(currentNightwatcherVisit(s)!.id).not.toBe(firstVisit!.id);
    expect(() => ritual(s, { type: 'BEGIN_RITUAL' })).toThrow();
    s.week += 1; ritual(s, { type: 'BEGIN_RITUAL' }); ritual(s, { type: 'CHECK_PREPARATION', confirmed: true }); apply(s, dose(s, 1));
    expect(s.nightwatcher.bottles[0]).toEqual(firstBottle); expect(s.nightwatcher.ritual.visits[0]).toEqual(firstVisit);
    expect(validateNightwatcherState(s)).toBe(true);
  });
  it('retains three failures and waits a real week for a still-priced fourth original bottle', () => {
    const s = taught();
    for (let n = 0; n < 3; n++) {
      buy(s, n); prepareRitual(s); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100;
      if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' });
    }
    const originals = structuredClone(s.nightwatcher.bottles), history = structuredClone(s.nightwatcher.ritual), ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.nightwatcher.bottles.slice(0, 3)).toEqual(originals); expect(s.nightwatcher.bottles).toHaveLength(6);
    expect(s.nightwatcher.bottles[3]).toMatchObject({ id: 'nightwatcher-potion-4', status: 'SUPPLIER', stockedWeek: s.week, labourSteps: 0, acquiredWeek: null });
    expect(s.nightwatcher.ritual).toEqual(history);
    expect(projectNightwatcher(s).actions.find(a => a.id === 'buy-nightwatcher-potion-4')!.cost).toContain('7200便士');
    expect(validateNightwatcherState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
    const freshCash = s.cash; buy(s, 3); expect(freshCash - s.cash).toBe(7200); reject(s, dose(s, 3));
  });
  it('checks digestion, twelve full weeks, health, own bottle and current window before drawing', () => {
    const s = ready();
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100;
    const oldPromotion = s.spiritWarlock.promotionWeek; s.spiritWarlock.promotionWeek = s.week - 11; reject(s, dose(s)); s.spiritWarlock.promotionWeek = oldPromotion;
    s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    reject(s, dose(s, 1)); s.week += 1; reject(s, dose(s));
  });
  it('rechecks the original expert and kit at actual consumption without rewriting their current facts', () => {
    const s = ready(), visit = currentNightwatcherVisit(s)!;
    s.nightwatcher.ritual.expert.alive = false; reject(s, dose(s)); s.nightwatcher.ritual.expert.alive = true;
    s.nightwatcher.ritual.expert.willing = false; reject(s, dose(s)); s.nightwatcher.ritual.expert.willing = true;
    s.nightwatcher.ritual.expert.location = 'AWAY'; reject(s, dose(s)); s.nightwatcher.ritual.expert.location = 'NW4-HALL';
    visit.kit.location = 'MISSING'; reject(s, dose(s)); visit.kit.location = 'TABLE';
    visit.kit.sealsIntact = false; reject(s, dose(s)); visit.kit.sealsIntact = true;
    const source = visit.kit.source; visit.kit.source = 'copied kit'; reject(s, dose(s)); visit.kit.source = source;
    expect(validateNightwatcherState(s)).toBe(true);
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'BUY_POTION', bottleId: 'spirit-warlock-potion-1' }, { type: 'LEARN_GUIDANCE', freeRitual: true }, { type: 'CONSUME', bottleId: 'nightwatcher-potion-1' }])('rejects unknown or nonexact acquisition command%# without mutation', command => {
    expect(validateNightwatcherCommand(command)).toBe(false); expect(isNightwatcherAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects copied bottles, duplicate mastery, mismatched ritual history and malformed state', () => {
    const s = ready(); apply(s, dose(s));
    const mutations: ((state: SliceState) => void)[] = [
      t => { t.nightwatcher.spiritWarlockActingAtPromotion = 99; }, t => { t.nightwatcher.bottles[0]!.source = 'copied S5 potion'; },
      t => { t.nightwatcher.bottles[0]!.ritualId = 'NW4-RITUAL-999'; }, t => { t.nightwatcher.bottles[0]!.ritualWindowWeek! -= 1; },
      t => { t.nightwatcher.ritual.visits[0]!.consumedBottleId = 'spirit-warlock-potion-1'; },
      t => { t.nightwatcher.bottles[1]!.id = t.nightwatcher.bottles[0]!.id; }, t => { t.nightwatcher.bottles[0]!.stockedWeek = t.week; },
      t => { delete t.progression.mastery[NIGHTWATCHER_ABILITY_IDS[0]]; }, t => { t.progression.mastery['darkness.s4.spirit-assistance'] = 0; },
      t => { (t.nightwatcher as unknown as Record<string, unknown>).ritual = null; },
      t => { (t.nightwatcher as unknown as Record<string, unknown>).life = null; },
    ];
    for (const change of mutations) {
      const t = structuredClone(s); change(t); expect(() => validateNightwatcherState(t)).not.toThrow(); expect(validateNightwatcherState(t)).toBe(false);
    }
  });
  it('validates after JSON object keys are reordered', () => {
    const s = ready(); apply(s, dose(s));
    const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, reorder(value)])) : v;
    expect(validateNightwatcherState(reorder(s) as SliceState)).toBe(true);
  });
  it('does not grant a new spirit, innate fear, travel or a S3 mastery on S4 promotion', () => {
    const s = ready(), original = structuredClone(s.spiritWarlock.companion), oldPaper = structuredClone(s.spiritWarlock.practice);
    apply(s, dose(s));
    expect(s.spiritWarlock.companion).toEqual(original); expect(s.spiritWarlock.practice).toEqual(oldPaper);
    expect(NIGHTWATCHER_ABILITY_IDS).toEqual(['darkness.s4.limited-misfortune', 'darkness.s4.area-dream']);
    expect(Object.keys(s.progression.mastery).filter(id => id.startsWith('darkness.s4.'))).toEqual([...NIGHTWATCHER_ABILITY_IDS]);
    expect(NIGHTWATCHER_FORMULA_STATUS).toContain('跨途径晋升'); expect(NIGHTWATCHER_SOURCE_STATUS).toContain('可以失败');
    expect(NIGHTWATCHER_SOURCE_STATUS).toContain('秘偶'); expect(NIGHTWATCHER_SOURCE_STATUS).toContain('灵界旅行不属于本阶天赋');
    expect(validateNightwatcherState(s)).toBe(true);
  });
  it('cannot prepare a potion while the original spirit or old paper remains outside', () => {
    const s = taught(); s.spiritWarlock.companion.status = 'DEPLOYED'; s.spiritWarlock.companion.deployments += 1;
    reject(s, { type: 'BUY_POTION', bottleId: s.nightwatcher.bottles[0]!.id });
    s.spiritWarlock.companion.status = 'SEALED'; s.spiritWarlock.companion.recalls += 1;
    s.spiritWarlock.practice.note = 'RECIPIENT'; reject(s, { type: 'BUY_POTION', bottleId: s.nightwatcher.bottles[0]!.id });
    s.spiritWarlock.practice.note = 'TABLE'; s.spiritWarlock.practice.dreamOpen = true;
    reject(s, { type: 'BUY_POTION', bottleId: s.nightwatcher.bottles[0]!.id });
  });

});
