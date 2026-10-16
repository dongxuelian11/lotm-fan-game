import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  applyWitchKingAcquisition, applyWitchKingCommand, createWitchKingState,
  projectWitchKing, validateWitchKingCommand, validateWitchKingState, isWitchKingAcquisitionCommand,
} from '../../src/domain/witch-king/index.js';
import {
  WITCH_KING_FORMULA_STATUS, WITCH_KING_PRICES, WITCH_KING_RITUAL_SOURCE, WITCH_KING_SOURCE_STATUS,
} from '../../src/domain/witch-king/content.js';
import { WITCH_KING_ABILITY_IDS, type WitchKingAcquisitionCommand } from '../../src/domain/witch-king/types.js';
import {
  applyWitchKingRitualCommand, currentWitchKingVisit, type WitchKingRitualCommand,
} from '../../src/domain/witch-king/ritual.js';

/** Historic S5 original history is unchanged; resource/time edits are unit setup, not a natural-play claim. */
function scholar(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/crimson-scholar-v0990/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.witchKing = createWitchKingState();
  s.week = Math.max(s.week, s.crimsonScholar.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: WitchKingAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyWitchKingAcquisition(s, command, c); return c;
}
function ritual(s: SliceState, command: WitchKingRitualCommand) { applyWitchKingRitualCommand(s, command, context(s)); }
function taught(s = scholar()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.witchKing.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.witchKing.bottles[index]!.id, confirmed: true }) as const;
function prepareRitual(s: SliceState) {
  ritual(s, { type: 'BOOK_RITUAL' }); s.week += 1;
  ritual(s, { type: 'BEGIN_RITUAL' }); ritual(s, { type: 'CHECK_PREPARATION', confirmed: true }); return s;
}
function ready() { const s = taught(); buy(s); return prepareRitual(s); }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyWitchKingAcquisition(s, command as WitchKingAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}
const oldMoon = (s: SliceState) => [s.apothecary, s.tamer, s.vampire, s.potionProfessor, s.crimsonScholar];

describe('Witch King S4 original potion acquisition and present professional ritual', () => {
  it('creates three independent originals and hides the source before Crimson Scholar', () => {
    const s = createSliceRun('witch-king-hidden', sliceDefaultCreationSelection, 'witch-king-hidden');
    expect(validateWitchKingState(s)).toBe(true);
    expect(projectWitchKing(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], supplies: '' });
    expect(projectWitchKing(s).story).toBeUndefined();
    const other = createWitchKingState(); other.bottles[0]!.labourSteps = 5;
    expect(s.witchKing.bottles[0]!.labourSteps).toBe(0); expect(s.witchKing.ritual.visits).toEqual([]);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges520 and one action without inventing full formula or skipping the S4 ritual', () => {
    const s = scholar(), old = structuredClone(oldMoon(s));
    apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99480, 99]); expect(oldMoon(s)).toEqual(old);
    expect(WITCH_KING_PRICES).toEqual({ guidance: 520, potion: 7200, labourCredit: 6300 });
    expect(WITCH_KING_FORMULA_STATUS).toContain('完整配方'); expect(WITCH_KING_FORMULA_STATUS).toContain('保持未知');
    expect(WITCH_KING_RITUAL_SOURCE).toContain('不能省略仪式'); expect(WITCH_KING_RITUAL_SOURCE).toContain('格蕾丝');
    expect(WITCH_KING_SOURCE_STATUS).toContain('moon.s7.abyss-shackles'); expect(WITCH_KING_SOURCE_STATUS).toContain('召唤大师3仍未开放');
    expect(projectWitchKing(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(s.witchKing.bottles).toHaveLength(3); expect(new Set(s.witchKing.bottles.map(b => b.source)).size).toBe(3);
    expect(validateWitchKingState(s)).toBe(true); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual bottle-specific jobs and900 cash without gifting a ritual kit', () => {
    const s = taught(), b = s.witchKing.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, b.status, b.acquiredWeek]).toEqual([98580, 'PLAYER', s.week]);
    expect(s.witchKing.bottles[1]!.labourSteps).toBe(0); expect(s.witchKing.ritual.visits).toEqual([]);
    expect(validateWitchKingState(s)).toBe(true); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount, backdate or transfer labour between originals', () => {
    const s = taught(), b = s.witchKing.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const before = s.cash; buy(s); expect(before - s.cash).toBe(7200);
    reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 7199; reject(s, { type: 'BUY_POTION', bottleId: s.witchKing.bottles[1]!.id });
  });
  it('requires a new present preparation even though historical S5 moon ritual remains complete', () => {
    const s = taught(), oldRitual = structuredClone(s.crimsonScholar.ritual); buy(s); reject(s, dose(s));
    expect(oldRitual.visits.some(v => v.consumedBottleId !== null)).toBe(true);
    ritual(s, { type: 'BOOK_RITUAL' }); reject(s, dose(s)); s.week += 1;
    ritual(s, { type: 'BEGIN_RITUAL' }); reject(s, dose(s));
    expect(s.witchKing.bottles[0]!.status).toBe('PLAYER'); expect(s.crimsonScholar.ritual).toEqual(oldRitual);
    ritual(s, { type: 'CHECK_PREPARATION', confirmed: true });
    expect(projectWitchKing(s).actions.find(a => a.id === `consume-${dose(s).bottleId}`)?.enabled).toBe(true);
  });
  it('requires separate exact potion consent after confirmed preparation', () => {
    const s = ready();
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), acceptBodyChange: true }, { ...dose(s), skipRitual: true }]) {
      expect(validateWitchKingCommand(command)).toBe(false); reject(s, command);
    }
    expect(s.witchKing.bottles[0]!.status).toBe('PLAYER');
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 4], [30, 'SUCCESS', 85, 100, 0, 4], [90, 'FAILURE', 75, 85, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 60, 5]] as const)('uses exact four-tier result%s, original kit and old body/blood/history', (roll, tier, mind, health, pollution, sequence) => {
    const s = ready(), b = s.witchKing.bottles[0]!, visit = structuredClone(currentWitchKingVisit(s)!);
    const old = structuredClone(oldMoon(s)), mastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, gender = s.character.gender;
    s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
    expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(b).toMatchObject({ status: 'CONSUMED', ritualId: visit.id, ritualWindowWeek: visit.windowWeek, consumedWeek: s.week });
    expect(s.witchKing.ritual).toMatchObject({ activeVisitId: null, playerLocation: 'OUTSIDE' });
    expect(s.witchKing.ritual.visits[0]).toMatchObject({ consumedBottleId: b.id, windowWeek: s.week, closedWeek: s.week, kit: { id: visit.kit.id, source: visit.kit.source, status: 'CONSUMED', sealsIntact: false, consumedWeek: s.week, location: 'TABLE' } });
    expect(s.witchKing.ritual.expert).toMatchObject({ id: 'WK4-GRACE', alive: true, willing: true, location: 'WK4-HALL' });
    expect(oldMoon(s)).toEqual(old); for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
    expect(s.character.gender).toBe(gender);
    if (sequence === 4) {
      expect(s.witchKing.crimsonScholarActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(WITCH_KING_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      expect(Object.keys(s.progression.mastery).filter(id => id.includes('abyss-shackles'))).toEqual(['moon.s7.abyss-shackles']);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    } else expect(s.progression.acting).toBe(100);
    expect(validateWitchKingState(s)).toBe(true); reject(s, dose(s));
  });
  it('applies the potion-only floor1 and pollution cap without healing or restoring SP', () => {
    const s = ready(); s.health = 21; s.mind = 41; s.seer.pollution = 90; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence, s.seer.pollution, s.spirituality]).toEqual([1, 1, 'ACTIVE', 5, 100, 31]);
    expect(validateWitchKingState(s)).toBe(true);
  });
  it('can safely end at0 actions and remain S5 with its bottle intact', () => {
    const s = ready(), visit = structuredClone(currentWitchKingVisit(s)!); s.actionsRemaining = 0;
    applyWitchKingCommand(s, { type: 'END_RITUAL' }, context(s));
    expect(s.witchKing.bottles[0]!.status).toBe('PLAYER'); expect(s.progression.sequence).toBe(5);
    expect(s.witchKing.ritual.visits[0]).toMatchObject({ id: visit.id, consumedBottleId: null });
    expect(projectWitchKing(s).insideCase).toBe(false); reject(s, dose(s)); expect(validateWitchKingState(s)).toBe(true);
  });
  it('requires another paid next-week booking after failure without modifying the first visit', () => {
    const s = ready(); apply(s, dose(s), 90);
    const firstBottle = structuredClone(s.witchKing.bottles[0]), firstVisit = structuredClone(s.witchKing.ritual.visits[0]);
    buy(s, 1); reject(s, dose(s, 1)); const cash = s.cash, ap = s.actionsRemaining;
    ritual(s, { type: 'BOOK_RITUAL' }); expect([s.cash, s.actionsRemaining]).toEqual([cash - 240, ap - 1]);
    expect(currentWitchKingVisit(s)!.id).not.toBe(firstVisit!.id);
    expect(() => ritual(s, { type: 'BEGIN_RITUAL' })).toThrow();
    s.week += 1; ritual(s, { type: 'BEGIN_RITUAL' }); ritual(s, { type: 'CHECK_PREPARATION', confirmed: true }); apply(s, dose(s, 1));
    expect(s.witchKing.bottles[0]).toEqual(firstBottle); expect(s.witchKing.ritual.visits[0]).toEqual(firstVisit);
    expect(validateWitchKingState(s)).toBe(true);
  });
  it('retains three failures and waits a real week for a still-priced fourth original bottle', () => {
    const s = taught();
    for (let n = 0; n < 3; n++) {
      buy(s, n); prepareRitual(s); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100;
      if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' });
    }
    const originals = structuredClone(s.witchKing.bottles), history = structuredClone(s.witchKing.ritual), ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.witchKing.bottles.slice(0, 3)).toEqual(originals); expect(s.witchKing.bottles).toHaveLength(6);
    expect(s.witchKing.bottles[3]).toMatchObject({ id: 'witch-king-potion-4', status: 'SUPPLIER', stockedWeek: s.week, labourSteps: 0, acquiredWeek: null });
    expect(s.witchKing.ritual).toEqual(history);
    expect(projectWitchKing(s).actions.find(a => a.id === 'buy-witch-king-potion-4')!.cost).toContain('7200便士');
    expect(validateWitchKingState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
    const freshCash = s.cash; buy(s, 3); expect(freshCash - s.cash).toBe(7200); reject(s, dose(s, 3));
  });
  it('checks digestion, twelve full weeks, health, own bottle and current window before drawing', () => {
    const s = ready();
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100;
    const oldPromotion = s.crimsonScholar.promotionWeek; s.crimsonScholar.promotionWeek = s.week - 11; reject(s, dose(s)); s.crimsonScholar.promotionWeek = oldPromotion;
    s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    reject(s, dose(s, 1)); s.week += 1; reject(s, dose(s));
  });
  it('rechecks the original expert and kit at actual consumption without rewriting their current facts', () => {
    const s = ready(), visit = currentWitchKingVisit(s)!;
    s.witchKing.ritual.expert.alive = false; reject(s, dose(s)); s.witchKing.ritual.expert.alive = true;
    s.witchKing.ritual.expert.willing = false; reject(s, dose(s)); s.witchKing.ritual.expert.willing = true;
    s.witchKing.ritual.expert.location = 'AWAY'; reject(s, dose(s)); s.witchKing.ritual.expert.location = 'WK4-HALL';
    visit.kit.location = 'MISSING'; reject(s, dose(s)); visit.kit.location = 'TABLE';
    visit.kit.sealsIntact = false; reject(s, dose(s)); visit.kit.sealsIntact = true;
    const source = visit.kit.source; visit.kit.source = 'copied kit'; reject(s, dose(s)); visit.kit.source = source;
    expect(validateWitchKingState(s)).toBe(true);
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'BUY_POTION', bottleId: 'crimson-scholar-potion-1' }, { type: 'LEARN_GUIDANCE', freeRitual: true }, { type: 'CONSUME', bottleId: 'witch-king-potion-1' }])('rejects unknown or nonexact acquisition command%# without mutation', command => {
    expect(validateWitchKingCommand(command)).toBe(false); expect(isWitchKingAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects copied bottles, duplicate mastery, mismatched ritual history and malformed state', () => {
    const s = ready(); apply(s, dose(s));
    const mutations: ((state: SliceState) => void)[] = [
      t => { t.witchKing.crimsonScholarActingAtPromotion = 99; }, t => { t.witchKing.bottles[0]!.source = 'copied S5 potion'; },
      t => { t.witchKing.bottles[0]!.ritualId = 'WK4-VISIT-999'; }, t => { t.witchKing.bottles[0]!.ritualWindowWeek! -= 1; },
      t => { t.witchKing.ritual.visits[0]!.consumedBottleId = 'crimson-scholar-potion-1'; },
      t => { t.witchKing.bottles[1]!.id = t.witchKing.bottles[0]!.id; }, t => { t.witchKing.bottles[0]!.stockedWeek = t.week; },
      t => { delete t.progression.mastery[WITCH_KING_ABILITY_IDS[0]]; }, t => { t.progression.mastery['moon.s4.abyss-shackles'] = 0; },
      t => { (t.witchKing as unknown as Record<string, unknown>).ritual = null; },
      t => { (t.witchKing as unknown as Record<string, unknown>).life = null; },
    ];
    for (const change of mutations) {
      const t = structuredClone(s); change(t); expect(() => validateWitchKingState(t)).not.toThrow(); expect(validateWitchKingState(t)).toBe(false);
    }
  });
  it('validates after JSON object keys are reordered', () => {
    const s = ready(); apply(s, dose(s));
    const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, reorder(value)])) : v;
    expect(validateWitchKingState(reorder(s) as SliceState)).toBe(true);
  });
});
