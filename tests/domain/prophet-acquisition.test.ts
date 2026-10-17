import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  applyProphetAcquisition, applyProphetCommand, createProphetState,
  projectProphet, validateProphetCommand, validateProphetState, isProphetAcquisitionCommand,
} from '../../src/domain/prophet/index.js';
import {
  PROPHET_FORMULA_STATUS, PROPHET_PRICES, PROPHET_RITUAL_SOURCE, PROPHET_SOURCE_STATUS,
} from '../../src/domain/prophet/content.js';
import { PROPHET_ABILITY_IDS, type ProphetAcquisitionCommand } from '../../src/domain/prophet/types.js';
import {
  applyProphetRitualCommand, currentProphetVisit, type ProphetRitualCommand,
} from '../../src/domain/prophet/ritual.js';

/** Historic S5 original history is unchanged; resource/time edits are unit setup, not a natural-play claim. */
function magister(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/mysticism-magister-v01010/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.prophet = createProphetState();
  s.week = Math.max(s.week, s.mysticismMagister.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: ProphetAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyProphetAcquisition(s, command, c); return c;
}
function ritual(s: SliceState, command: ProphetRitualCommand) { applyProphetRitualCommand(s, command, context(s)); }
function taught(s = magister()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.prophet.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.prophet.bottles[index]!.id, confirmed: true }) as const;
function prepareRitual(s: SliceState) {
  ritual(s, { type: 'BOOK_RITUAL' }); s.week += 1;
  ritual(s, { type: 'BEGIN_RITUAL' }); ritual(s, { type: 'CHECK_PREPARATION', confirmed: true }); return s;
}
function ready() { const s = taught(); buy(s); return prepareRitual(s); }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyProphetAcquisition(s, command as ProphetAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}
const oldReaderPath = (s: SliceState) => [s.reader, s.reasoner, s.detective, s.polymath, s.mysticismMagister];

describe('Prophet S4 original potion acquisition and present professional ritual', () => {
  it('creates three independent originals and hides the source before Mysticism Magister', () => {
    const s = createSliceRun('prophet-hidden', sliceDefaultCreationSelection, 'prophet-hidden');
    expect(validateProphetState(s)).toBe(true);
    expect(projectProphet(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], supplies: '' });
    expect(projectProphet(s).story).toBeUndefined();
    const other = createProphetState(); other.bottles[0]!.labourSteps = 5;
    expect(s.prophet.bottles[0]!.labourSteps).toBe(0); expect(s.prophet.ritual.visits).toEqual([]);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges520 and one action without inventing full formula or skipping the S4 ritual', () => {
    const s = magister(), old = structuredClone(oldReaderPath(s));
    apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99480, 99]); expect(oldReaderPath(s)).toEqual(old);
    expect(PROPHET_PRICES).toEqual({ guidance: 520, potion: 7200, labourCredit: 6300 });
    expect(PROPHET_FORMULA_STATUS).toContain('完整配方'); expect(PROPHET_FORMULA_STATUS).toContain('保持未知');
    expect(PROPHET_RITUAL_SOURCE).toContain('完整原著仪式仍未核实'); expect(PROPHET_RITUAL_SOURCE).toContain('玛莎');
    expect(PROPHET_SOURCE_STATUS).toContain('实际样本'); expect(PROPHET_SOURCE_STATUS).toContain('未来更高阶段待核');
    expect(projectProphet(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(s.prophet.bottles).toHaveLength(3); expect(new Set(s.prophet.bottles.map(b => b.source)).size).toBe(3);
    expect(validateProphetState(s)).toBe(true); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual bottle-specific jobs and900 cash without gifting a ritual kit', () => {
    const s = taught(), b = s.prophet.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, b.status, b.acquiredWeek]).toEqual([98580, 'PLAYER', s.week]);
    expect(s.prophet.bottles[1]!.labourSteps).toBe(0); expect(s.prophet.ritual.visits).toEqual([]);
    expect(validateProphetState(s)).toBe(true); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount, backdate or transfer labour between originals', () => {
    const s = taught(), b = s.prophet.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const before = s.cash; buy(s); expect(before - s.cash).toBe(7200);
    reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 7199; reject(s, { type: 'BUY_POTION', bottleId: s.prophet.bottles[1]!.id });
  });
  it('requires new present preparation while preserving original S5 samples, crafts and practice history', () => {
    const s = taught(), old = structuredClone(s.mysticismMagister); buy(s); reject(s, dose(s));
    expect(old.practice).toMatchObject({ token: 'OWNER', dreamOpen: false, kitsUsed: 3 });
    expect(old.crafts).toEqual([
      { id: 'MM5-FLASH-1', sourceKitId: 'MM5-KIT-1', createdWeek: 58, usedWeek: 58, status: 'CONSUMED', power: 0.65 },
      { id: 'MM5-FLASH-3', sourceKitId: 'MM5-KIT-3', createdWeek: 63, usedWeek: null, status: 'PLAYER', power: 0.65 },
    ]);
    ritual(s, { type: 'BOOK_RITUAL' }); reject(s, dose(s)); s.week += 1;
    ritual(s, { type: 'BEGIN_RITUAL' }); reject(s, dose(s));
    expect(s.prophet.bottles[0]!.status).toBe('PLAYER'); expect(s.mysticismMagister).toEqual(old);
    ritual(s, { type: 'CHECK_PREPARATION', confirmed: true });
    expect(projectProphet(s).actions.find(a => a.id === `consume-${dose(s).bottleId}`)?.enabled).toBe(true);
  });
  it('requires separate exact potion consent after confirmed preparation', () => {
    const s = ready();
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), acceptBodyChange: true }, { ...dose(s), skipRitual: true }]) {
      expect(validateProphetCommand(command)).toBe(false); reject(s, command);
    }
    expect(s.prophet.bottles[0]!.status).toBe('PLAYER');
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 4], [30, 'SUCCESS', 85, 100, 0, 4], [90, 'FAILURE', 75, 85, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 60, 5]] as const)('uses exact four-tier result%s, original kit and old body/samples/history', (roll, tier, mind, health, pollution, sequence) => {
    const s = ready(), b = s.prophet.bottles[0]!, visit = structuredClone(currentProphetVisit(s)!);
    const old = structuredClone(oldReaderPath(s)), mastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, gender = s.character.gender;
    s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
    expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(b).toMatchObject({ status: 'CONSUMED', ritualId: visit.id, ritualWindowWeek: visit.windowWeek, consumedWeek: s.week });
    expect(s.prophet.ritual).toMatchObject({ activeVisitId: null, playerLocation: 'OUTSIDE' });
    expect(s.prophet.ritual.visits[0]).toMatchObject({ consumedBottleId: b.id, windowWeek: s.week, closedWeek: s.week, kit: { id: visit.kit.id, source: visit.kit.source, status: 'CONSUMED', sealsIntact: false, consumedWeek: s.week, location: 'TABLE' } });
    expect(s.prophet.ritual.expert).toMatchObject({ id: 'PF4-MARTHA', alive: true, willing: true, location: 'PF4-HALL' });
    expect(oldReaderPath(s)).toEqual(old); for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
    expect(s.character.gender).toBe(gender);
    if (sequence === 4) {
      expect(s.prophet.mysticismMagisterActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(PROPHET_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      expect(Object.keys(s.progression.mastery).filter(id => id.includes('material-imitation'))).toEqual(['reader.s5.material-imitation']);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    } else expect(s.progression.acting).toBe(100);
    expect(validateProphetState(s)).toBe(true); reject(s, dose(s));
  });
  it('applies the potion-only floor1 and pollution cap without healing or restoring SP', () => {
    const s = ready(); s.health = 21; s.mind = 41; s.seer.pollution = 90; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence, s.seer.pollution, s.spirituality]).toEqual([1, 1, 'ACTIVE', 5, 100, 31]);
    expect(validateProphetState(s)).toBe(true);
  });
  it('can safely end at0 actions and remain S5 with its bottle intact', () => {
    const s = ready(), visit = structuredClone(currentProphetVisit(s)!); s.actionsRemaining = 0;
    applyProphetCommand(s, { type: 'END_RITUAL' }, context(s));
    expect(s.prophet.bottles[0]!.status).toBe('PLAYER'); expect(s.progression.sequence).toBe(5);
    expect(s.prophet.ritual.visits[0]).toMatchObject({ id: visit.id, consumedBottleId: null });
    expect(projectProphet(s).insideCase).toBe(false); reject(s, dose(s)); expect(validateProphetState(s)).toBe(true);
  });
  it('requires another paid next-week booking after failure without modifying the first visit', () => {
    const s = ready(); apply(s, dose(s), 90);
    const firstBottle = structuredClone(s.prophet.bottles[0]), firstVisit = structuredClone(s.prophet.ritual.visits[0]);
    buy(s, 1); reject(s, dose(s, 1)); const cash = s.cash, ap = s.actionsRemaining;
    ritual(s, { type: 'BOOK_RITUAL' }); expect([s.cash, s.actionsRemaining]).toEqual([cash - 240, ap - 1]);
    expect(currentProphetVisit(s)!.id).not.toBe(firstVisit!.id);
    expect(() => ritual(s, { type: 'BEGIN_RITUAL' })).toThrow();
    s.week += 1; ritual(s, { type: 'BEGIN_RITUAL' }); ritual(s, { type: 'CHECK_PREPARATION', confirmed: true }); apply(s, dose(s, 1));
    expect(s.prophet.bottles[0]).toEqual(firstBottle); expect(s.prophet.ritual.visits[0]).toEqual(firstVisit);
    expect(validateProphetState(s)).toBe(true);
  });
  it('retains three failures and waits a real week for a still-priced fourth original bottle', () => {
    const s = taught();
    for (let n = 0; n < 3; n++) {
      buy(s, n); prepareRitual(s); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100;
      if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' });
    }
    const originals = structuredClone(s.prophet.bottles), history = structuredClone(s.prophet.ritual), ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.prophet.bottles.slice(0, 3)).toEqual(originals); expect(s.prophet.bottles).toHaveLength(6);
    expect(s.prophet.bottles[3]).toMatchObject({ id: 'prophet-potion-4', status: 'SUPPLIER', stockedWeek: s.week, labourSteps: 0, acquiredWeek: null });
    expect(s.prophet.ritual).toEqual(history);
    expect(projectProphet(s).actions.find(a => a.id === 'buy-prophet-potion-4')!.cost).toContain('7200便士');
    expect(validateProphetState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
    const freshCash = s.cash; buy(s, 3); expect(freshCash - s.cash).toBe(7200); reject(s, dose(s, 3));
  });
  it('checks digestion, twelve full weeks, health, own bottle and current window before drawing', () => {
    const s = ready();
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100;
    const oldPromotion = s.mysticismMagister.promotionWeek; s.mysticismMagister.promotionWeek = s.week - 11; reject(s, dose(s)); s.mysticismMagister.promotionWeek = oldPromotion;
    s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    reject(s, dose(s, 1)); s.week += 1; reject(s, dose(s));
  });
  it('rechecks the original expert and kit at actual consumption without rewriting their current facts', () => {
    const s = ready(), visit = currentProphetVisit(s)!;
    s.prophet.ritual.expert.alive = false; reject(s, dose(s)); s.prophet.ritual.expert.alive = true;
    s.prophet.ritual.expert.willing = false; reject(s, dose(s)); s.prophet.ritual.expert.willing = true;
    s.prophet.ritual.expert.location = 'AWAY'; reject(s, dose(s)); s.prophet.ritual.expert.location = 'PF4-HALL';
    visit.kit.location = 'MISSING'; reject(s, dose(s)); visit.kit.location = 'TABLE';
    visit.kit.sealsIntact = false; reject(s, dose(s)); visit.kit.sealsIntact = true;
    const source = visit.kit.source; visit.kit.source = 'copied kit'; reject(s, dose(s)); visit.kit.source = source;
    expect(validateProphetState(s)).toBe(true);
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'BUY_POTION', bottleId: 'mysticism-magister-potion-1' }, { type: 'LEARN_GUIDANCE', freeRitual: true }, { type: 'CONSUME', bottleId: 'prophet-potion-1' }])('rejects unknown or nonexact acquisition command%# without mutation', command => {
    expect(validateProphetCommand(command)).toBe(false); expect(isProphetAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects copied bottles, duplicate mastery, mismatched ritual history and malformed state', () => {
    const s = ready(); apply(s, dose(s));
    const mutations: ((state: SliceState) => void)[] = [
      t => { t.prophet.mysticismMagisterActingAtPromotion = 99; }, t => { t.prophet.bottles[0]!.source = 'copied S5 potion'; },
      t => { t.prophet.bottles[0]!.ritualId = 'PF4-RITUAL-999'; }, t => { t.prophet.bottles[0]!.ritualWindowWeek! -= 1; },
      t => { t.prophet.ritual.visits[0]!.consumedBottleId = 'mysticism-magister-potion-1'; },
      t => { t.prophet.bottles[1]!.id = t.prophet.bottles[0]!.id; }, t => { t.prophet.bottles[0]!.stockedWeek = t.week; },
      t => { delete t.progression.mastery[PROPHET_ABILITY_IDS[0]]; }, t => { t.progression.mastery['reader.s4.material-imitation'] = 0; },
      t => { (t.prophet as unknown as Record<string, unknown>).ritual = null; },
      t => { (t.prophet as unknown as Record<string, unknown>).life = null; },
    ];
    for (const change of mutations) {
      const t = structuredClone(s); change(t); expect(() => validateProphetState(t)).not.toThrow(); expect(validateProphetState(t)).toBe(false);
    }
  });
  it('validates after JSON object keys are reordered', () => {
    const s = ready(); apply(s, dose(s));
    const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, reorder(value)])) : v;
    expect(validateProphetState(reorder(s) as SliceState)).toBe(true);
  });
  it('adds only two new original IDs without free crafts, copied samples or omniscient higher stages', () => {
    const s = ready(), samples = structuredClone(s.polymath.samples), practice = structuredClone(s.mysticismMagister.practice), crafts = structuredClone(s.mysticismMagister.crafts);
    apply(s, dose(s));
    expect(s.polymath.samples).toEqual(samples); expect(s.mysticismMagister.practice).toEqual(practice); expect(s.mysticismMagister.crafts).toEqual(crafts);
    expect(PROPHET_ABILITY_IDS).toEqual(['reader.s4.fragmentary-foresight', 'reader.s4.symbolic-interpretation']);
    expect(Object.keys(s.progression.mastery).filter(id => id.startsWith('reader.s4.'))).toEqual([...PROPHET_ABILITY_IDS]);
    expect(PROPHET_FORMULA_STATUS).toContain('不是预言家配方材料'); expect(PROPHET_SOURCE_STATUS).toContain('不保证避开灾难');
    expect(PROPHET_SOURCE_STATUS).toContain('未来更高阶段待核'); expect(PROPHET_SOURCE_STATUS).toContain('真实会面和调查');
    expect(validateProphetState(s)).toBe(true);
  });
  it('cannot prepare a potion while original old contact, token or dream is still open', () => {
    const s = taught(), command = { type: 'BUY_POTION', bottleId: s.prophet.bottles[0]!.id } as const;
    s.mysticismMagister.cases['linked-dream']!.contactOpen = true; reject(s, command);
    s.mysticismMagister.cases['linked-dream']!.contactOpen = false;
    s.mysticismMagister.practice.token = 'PLAYER'; reject(s, command);
    s.mysticismMagister.practice.token = 'OWNER'; s.mysticismMagister.practice.dreamOpen = true; reject(s, command);
    s.mysticismMagister.practice.dreamOpen = false;
    s.polymath.cases['flash-study']!.contactOpen = true; reject(s, command);
    s.polymath.cases['flash-study']!.contactOpen = false;
    s.polymath.cases['flash-study']!.status = 'PREPARED'; reject(s, command);
  });
});
