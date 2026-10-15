import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { SAVANT_ABILITY_IDS } from '../../src/domain/savant/types.js';
import { ARCHAEOLOGIST_ABILITY_IDS } from '../../src/domain/archaeologist/types.js';
import { APPRAISER_ABILITY_IDS } from '../../src/domain/appraiser/types.js';
import { ARTISAN_ABILITY_IDS } from '../../src/domain/artisan/types.js';
import { applyAstronomerCommand, createAstronomerState, isAstronomerAcquisitionCommand, projectAstronomer, validateAstronomerCommand, validateAstronomerState } from '../../src/domain/astronomer/index.js';
import { ASTRONOMER_ABILITIES, ASTRONOMER_FORMULA_STATUS, ASTRONOMER_PRICES, ASTRONOMER_SOURCE_STATUS } from '../../src/domain/astronomer/content.js';
import { ASTRONOMER_ABILITY_IDS, type AstronomerAcquisitionCommand } from '../../src/domain/astronomer/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function artisan(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/artisan-v0760/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.astronomer = createAstronomerState(); s.week = s.artisan.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: AstronomerAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyAstronomerCommand(s, command, c); return c;
}
function taught(s = artisan()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const b = s.astronomer.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.astronomer.bottles[0]!.id, confirmed: true }); return s;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyAstronomerCommand(s, command as AstronomerAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Astronomer S5 finished originals and bounded G promotion', () => {
  it('hides the future channel and creates independent original bottles and practice state', () => {
    const s = createSliceRun('astronomer-hidden', sliceDefaultCreationSelection, 'astronomer-hidden');
    expect(validateAstronomerState(s)).toBe(true);
    expect(projectAstronomer(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: null });
    expect(projectAstronomer(s).story).toBeUndefined();
    const other = createAstronomerState(); other.practice.instrumentOffset = 0; other.bottles[0]!.labourSteps = 5;
    expect(s.astronomer.practice.instrumentOffset).toBe(2); expect(s.astronomer.bottles[0]!.labourSteps).toBe(0);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('opens the existing artisan channel and takes 440 plus one action without revealing a formula or ritual', () => {
    const s = artisan(), old = structuredClone([s.savant, s.archaeologist, s.appraiser, s.artisan]);
    expect(validateAstronomerState(s)).toBe(true);
    expect(projectAstronomer(s)).toMatchObject({ discovered: true, promoted: false, acting: 0, practice: null });
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([29560, 99]); expect(c.check).not.toHaveBeenCalled();
    expect([s.savant, s.archaeologist, s.appraiser, s.artisan]).toEqual(old);
    expect(ASTRONOMER_PRICES).toEqual({ guidance: 440, potion: 4700, labourCredit: 4100 });
    expect(ASTRONOMER_FORMULA_STATUS).toContain('完整配方与晋升仪式尚未核实');
    expect(projectAstronomer(s)).toMatchObject({ formulaKnown: false, formula: [] });
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real labour actions and 600 payment per bottle, with no transferable or partial credit', () => {
    const s = taught(), b = s.astronomer.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([28960, 94, 'PLAYER']);
    const second = s.astronomer.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4700); expect(validateAstronomerState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 4699; reject(s, { type: 'BUY_POTION', bottleId: s.astronomer.bottles[2]!.id });
  });
  it('allows early preparation but requires artisan digestion100 and twelve complete weeks before drinking', () => {
    const s = artisan(); s.week = s.artisan.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateAstronomerState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week += 11; s.progression.acting = 100;
    expect(projectAstronomer(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(s.progression.sequence).toBe(5);
  });
  it('consumes exactly the selected original and applies all four fixed guided result tiers', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.astronomer.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.astronomer.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 6) expect(s.progression.acting).toBe(100);
      expect(validateAstronomerState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('requires health above20 and mind above40 without rolling or consuming a bottle at the boundary', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.astronomer.bottles[0]!.id, confirmed: true });
      expect(s.astronomer.bottles[0]!.status).toBe('PLAYER');
      expect(projectAstronomer(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
  });
  it('preserves every old ID and the client lamp, adds one zero mastery and four +1 stats without refilling spirit', () => {
    const s = prepared(), old = structuredClone([s.savant, s.archaeologist, s.appraiser, s.artisan]), stats = { ...s.character.coreStats };
    expect(s.artisan.workshop.lamp).toMatchObject({ id: 'ART6-LAMP-1', location: 'CLIENT', charges: 2 });
    act(s, { type: 'CONSUME', bottleId: s.astronomer.bottles[0]!.id, confirmed: true });
    expect([s.savant, s.archaeologist, s.appraiser, s.artisan]).toEqual(old);
    expect(s.astronomer.artisanActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...SAVANT_ABILITY_IDS, ...ARCHAEOLOGIST_ABILITY_IDS, ...APPRAISER_ABILITY_IDS, ...ARTISAN_ABILITY_IDS, ...ASTRONOMER_ABILITY_IDS]);
    expect(ASTRONOMER_ABILITY_IDS).toEqual(['paragon.s5.precision-focus']);
    expect(s.progression.mastery['paragon.s5.precision-focus']).toBe(0);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    expect(ASTRONOMER_ABILITIES[0]!.description).toContain('原创G');
    expect(ASTRONOMER_SOURCE_STATUS).toContain('第二部第4章'); expect(ASTRONOMER_SOURCE_STATUS).toContain('序列4');
    expect(projectAstronomer(s).digestion).toContain('天文学家扮演0/100');
  });
  it('retains failed originals and waits a real week for the next batch without free delivery to the player', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.astronomer.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.astronomer.bottles.slice(0, 3)).toEqual(originals); expect(s.astronomer.bottles).toHaveLength(6);
    expect(s.astronomer.bottles[3]).toMatchObject({ id: 'astronomer-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectAstronomer(s).actions.find(a => a.id === 'buy-astronomer-potion-4')!.cost).toContain('4700便士');
    expect(validateAstronomerState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('rejects invented commands and extra fields while keeping exact life commands outside acquisition', () => {
    const malformed = [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'astronomer-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'artisan-potion-1' }, { type: 'SIGNAL', caseId: 'instrument-drift' }, { type: 'REFLECT', extra: true }, { type: 'PREPARE', caseId: 'catalogue-check', method: 'ASTROLOGY' }];
    for (const command of malformed) {
      expect(validateAstronomerCommand(command)).toBe(false); expect(isAstronomerAcquisitionCommand(command)).toBe(false); reject(prepared(), command);
    }
    for (const command of [{ type: 'CLOSE', caseId: 'instrument-drift' }, { type: 'PREPARE', caseId: 'night-measurement', method: 'ABILITY' }]) {
      expect(validateAstronomerCommand(command)).toBe(true); expect(isAstronomerAcquisitionCommand(command)).toBe(false); reject(promoted(), command);
    }
  });
  it('rejects forged sources, chronology, promotion snapshots, mastery and malformed nested saves without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.astronomer.bottles[0]!.source = 'invented'; },
      t => { t.astronomer.bottles[0]!.consumedWeek = t.astronomer.promotionWeek! - 1; },
      t => { t.astronomer.artisanActingAtPromotion = 99; },
      t => { delete t.progression.mastery[SAVANT_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['paragon.s5.star-laser'] = 0; },
      t => { t.astronomer.bottles[1]!.labourSteps = 6; },
      t => { (t.astronomer as unknown as Record<string, unknown>).practice = null; },
      t => { (t.astronomer.cases as unknown as Record<string, unknown>)['catalogue-check'] = null; },
      t => { (t.astronomer as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validateAstronomerState(t)).not.toThrow(); expect(validateAstronomerState(t)).toBe(false);
    }
  });
  it('exposes only the exact current practice snapshot after promotion and does not leak mutable domain state', () => {
    const s = promoted(), p = projectAstronomer(s);
    expect(p.practice).toEqual({ instrumentOffset: 2, calibratedWeek: null, observedWeek: null, measurements: 0 });
    expect(p.abilities.map(x => x.id)).toEqual(['paragon.s5.precision-focus']);
    expect(p.practice).not.toBe(s.astronomer.practice);
    p.practice!.instrumentOffset = 0; expect(s.astronomer.practice.instrumentOffset).toBe(2);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false });
    expect(p.actions.every(a => !a.enabled)).toBe(true);
  });
});
