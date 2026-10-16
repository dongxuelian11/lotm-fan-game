import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { READER_ABILITY_IDS } from '../../src/domain/reader/types.js';
import { REASONER_ABILITY_IDS } from '../../src/domain/reasoner/types.js';
import { DETECTIVE_ABILITY_IDS } from '../../src/domain/detective/types.js';
import { POLYMATH_ABILITY_IDS } from '../../src/domain/polymath/types.js';
import { applyMysticismMagisterCommand, createMysticismMagisterState, isMysticismMagisterAcquisitionCommand, projectMysticismMagister, validateMysticismMagisterCommand, validateMysticismMagisterState } from '../../src/domain/mysticism-magister/index.js';
import { MYSTICISM_MAGISTER_ABILITIES, MYSTICISM_MAGISTER_FORMULA_STATUS, MYSTICISM_MAGISTER_PRICES, MYSTICISM_MAGISTER_SOURCE_STATUS } from '../../src/domain/mysticism-magister/content.js';
import { MYSTICISM_MAGISTER_ABILITY_IDS, type MysticismMagisterAcquisitionCommand } from '../../src/domain/mysticism-magister/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function polymath(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/polymath-v0790/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.mysticismMagister = createMysticismMagisterState(); s.week = s.polymath.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: MysticismMagisterAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyMysticismMagisterCommand(s, command, c); return c;
}
function taught(s = polymath()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const b = s.mysticismMagister.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.mysticismMagister.bottles[0]!.id, confirmed: true }); return s;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyMysticismMagisterCommand(s, command as MysticismMagisterAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('MysticismMagister S5 finished originals and bounded G promotion', () => {
  it('hides the future channel and creates independent original bottles and practice state', () => {
    const s = createSliceRun('mysticism-magister-hidden', sliceDefaultCreationSelection, 'mysticism-magister-hidden');
    expect(validateMysticismMagisterState(s)).toBe(true);
    expect(projectMysticismMagister(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: null });
    expect(projectMysticismMagister(s).story).toBeUndefined();
    const other = createMysticismMagisterState(); other.practice.token = 'PLAYER'; other.crafts.push({ id: 'MM5-FLASH-1', sourceKitId: 'MM5-KIT-1', createdWeek: 1, usedWeek: null, status: 'PLAYER', power: 0.65 }); other.bottles[0]!.labourSteps = 5;
    expect(s.mysticismMagister.practice.token).toBe('OWNER'); expect(s.mysticismMagister.crafts).toEqual([]); expect(s.mysticismMagister.bottles[0]!.labourSteps).toBe(0);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('opens the existing polymath channel and takes 460 plus one action without revealing a formula or ritual', () => {
    const s = polymath(), old = structuredClone([s.reader, s.reasoner, s.detective, s.polymath]);
    expect(validateMysticismMagisterState(s)).toBe(true);
    expect(projectMysticismMagister(s)).toMatchObject({ discovered: true, promoted: false, acting: 0, practice: null });
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([29540, 99]); expect(c.check).not.toHaveBeenCalled();
    expect([s.reader, s.reasoner, s.detective, s.polymath]).toEqual(old);
    expect(MYSTICISM_MAGISTER_PRICES).toEqual({ guidance: 460, potion: 4800, labourCredit: 4200 });
    expect(MYSTICISM_MAGISTER_FORMULA_STATUS).toContain('完整配方与晋升仪式尚未核实');
    expect(projectMysticismMagister(s)).toMatchObject({ formulaKnown: false, formula: [] });
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real labour actions and 600 payment per bottle, with no transferable or partial credit', () => {
    const s = taught(), b = s.mysticismMagister.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([28940, 94, 'PLAYER']);
    const second = s.mysticismMagister.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4800); expect(validateMysticismMagisterState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 4799; reject(s, { type: 'BUY_POTION', bottleId: s.mysticismMagister.bottles[2]!.id });
  });
  it('allows early preparation but requires polymath digestion100 and twelve complete weeks before drinking', () => {
    const s = polymath(); s.week = s.polymath.promotionWeek! + 8; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateMysticismMagisterState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = s.polymath.promotionWeek! + 11; s.progression.acting = 100;
    expect(projectMysticismMagister(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(s.progression.sequence).toBe(5);
  });
  it('consumes exactly the selected original and applies all four fixed guided result tiers', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.mysticismMagister.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.mysticismMagister.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 6) expect(s.progression.acting).toBe(100);
      expect(validateMysticismMagisterState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('requires health above20 and mind above40 without rolling or consuming a bottle at the boundary', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.mysticismMagister.bottles[0]!.id, confirmed: true });
      expect(s.mysticismMagister.bottles[0]!.status).toBe('PLAYER');
      expect(projectMysticismMagister(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
  });
  it('preserves every old ID and actual samples, adds two zero masteries and four +1 stats without refilling spirit', () => {
    const s = prepared(), old = structuredClone([s.reader, s.reasoner, s.detective, s.polymath]), stats = { ...s.character.coreStats };
    for (const sample of Object.values(s.polymath.samples)) expect(sample.learnedWeek).not.toBeNull();
    act(s, { type: 'CONSUME', bottleId: s.mysticismMagister.bottles[0]!.id, confirmed: true });
    expect([s.reader, s.reasoner, s.detective, s.polymath]).toEqual(old);
    expect(s.mysticismMagister.polymathActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...READER_ABILITY_IDS, ...REASONER_ABILITY_IDS, ...DETECTIVE_ABILITY_IDS, ...POLYMATH_ABILITY_IDS, ...MYSTICISM_MAGISTER_ABILITY_IDS]);
    expect(MYSTICISM_MAGISTER_ABILITY_IDS).toEqual(['reader.s5.secret-ritual', 'reader.s5.material-imitation']);
    for (const id of MYSTICISM_MAGISTER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.mysticismMagister.practice).toEqual({ token: 'OWNER', dreamOpen: false, dreamResult: 'NONE', dreamAttempts: 0, kitsUsed: 0, teachingChecks: 0 });
    expect(s.mysticismMagister.crafts).toEqual([]); expect(s.mysticismMagister.craftAttemptWeek).toBeNull();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    expect(MYSTICISM_MAGISTER_ABILITIES).toHaveLength(2); expect(MYSTICISM_MAGISTER_ABILITIES[0]!.description).toContain('不是梦魇');
    expect(MYSTICISM_MAGISTER_SOURCE_STATUS).toContain('第三部52章'); expect(MYSTICISM_MAGISTER_SOURCE_STATUS).toContain('序列4');
    expect(projectMysticismMagister(s).digestion).toContain('秘术导师扮演0/100');
  });
  it('retains failed originals and waits a real week for the next batch without free delivery to the player', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.mysticismMagister.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.mysticismMagister.bottles.slice(0, 3)).toEqual(originals); expect(s.mysticismMagister.bottles).toHaveLength(6);
    expect(s.mysticismMagister.bottles[3]).toMatchObject({ id: 'mysticism-magister-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectMysticismMagister(s).actions.find(a => a.id === 'buy-mysticism-magister-potion-4')!.cost).toContain('4800便士');
    expect(validateMysticismMagisterState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('rejects invented commands and extra fields while keeping exact life commands outside acquisition', () => {
    const malformed = [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'mysticism-magister-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'polymath-potion-1' }, { type: 'SIGNAL', caseId: 'modest-craft' }, { type: 'REFLECT', extra: true }, { type: 'PREPARE', caseId: 'linked-dream', method: 'ASTROLOGY' }];
    for (const command of malformed) {
      expect(validateMysticismMagisterCommand(command)).toBe(false); expect(isMysticismMagisterAcquisitionCommand(command)).toBe(false); reject(prepared(), command);
    }
    for (const command of [{ type: 'CLOSE', caseId: 'modest-craft' }, { type: 'PREPARE', caseId: 'careful-teaching', method: 'ABILITY' }]) {
      expect(validateMysticismMagisterCommand(command)).toBe(true); expect(isMysticismMagisterAcquisitionCommand(command)).toBe(false); reject(promoted(), command);
    }
  });
  it('rejects forged sources, chronology, promotion snapshots, mastery and malformed nested saves without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.mysticismMagister.bottles[0]!.source = 'invented'; },
      t => { t.mysticismMagister.bottles[0]!.consumedWeek = t.mysticismMagister.promotionWeek! - 1; },
      t => { t.mysticismMagister.polymathActingAtPromotion = 99; },
      t => { delete t.progression.mastery[READER_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['reader.s5.free-holy-light'] = 0; },
      t => { t.mysticismMagister.bottles[1]!.labourSteps = 6; },
      t => { (t.mysticismMagister as unknown as Record<string, unknown>).practice = null; },
      t => { (t.mysticismMagister as unknown as Record<string, unknown>).crafts = null; },
      t => { (t.mysticismMagister.practice as unknown as Record<string, unknown>).teleport = true; },
      t => { t.mysticismMagister.craftAttemptWeek = t.week + 1; },
      t => { t.mysticismMagister.practice.dreamOpen = true; },
      t => { t.mysticismMagister.crafts.push({ id: 'MM5-FLASH-1', sourceKitId: 'MM5-KIT-1', createdWeek: t.week, usedWeek: null, status: 'PLAYER', power: 0.65 }); },
      t => { (t.mysticismMagister.cases as unknown as Record<string, unknown>)['linked-dream'] = null; },
      t => { (t.mysticismMagister as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validateMysticismMagisterState(t)).not.toThrow(); expect(validateMysticismMagisterState(t)).toBe(false);
    }
  });
  it('leaves life projections to the life helper and does not leak mutable domain state', () => {
    const s = promoted(), p = projectMysticismMagister(s);
    expect(p.practice).toBeNull(); expect(p.crafts).toEqual([]);
    expect(p.abilities.map(x => x.id)).toEqual([...MYSTICISM_MAGISTER_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false, cases: [] });
    expect(p.actions.every(a => !a.enabled)).toBe(true);
    p.abilities[0]!.mastery = 99; expect(s.progression.mastery[MYSTICISM_MAGISTER_ABILITY_IDS[0]]).toBe(0);
    const before = structuredClone(s); projectMysticismMagister(s); expect(s).toEqual(before);
  });
  it('accepts only exact original-token commands and never handles life commands as acquisition', () => {
    for (const type of ['RETURN_TOKEN', 'VERIFY_DREAM', 'MAKE_TOKEN'] as const) {
      expect(validateMysticismMagisterCommand({ type })).toBe(true);
      expect(isMysticismMagisterAcquisitionCommand({ type })).toBe(false);
      expect(validateMysticismMagisterCommand({ type, caseId: 'linked-dream' })).toBe(false);
      reject(promoted(), { type });
    }
    expect(validateMysticismMagisterCommand({ type: 'TEST_TOKEN', itemId: 'MM5-FLASH-1' })).toBe(true);
    expect(isMysticismMagisterAcquisitionCommand({ type: 'TEST_TOKEN', itemId: 'MM5-FLASH-1' })).toBe(false);
    reject(promoted(), { type: 'TEST_TOKEN', itemId: 'MM5-FLASH-1' });
    for (const itemId of ['MM5-KIT-1', 'MM5-FLASH-0', 'MM5-FLASH-01', 'SW5-LEAF-1', 'MM5-FLASH-1 extra']) expect(validateMysticismMagisterCommand({ type: 'TEST_TOKEN', itemId })).toBe(false);
    expect(validateMysticismMagisterCommand({ type: 'TEST_TOKEN' })).toBe(false);
    expect(validateMysticismMagisterCommand({ type: 'TEST_TOKEN', itemId: 'MM5-FLASH-1', count: 2 })).toBe(false);
  });
  it('does not manufacture a missing FLASH sample during promotion', () => {
    const s = prepared();
    s.polymath.samples.FLASH = { observedWeek: s.polymath.promotionWeek, understoodWeek: null, learnedWeek: null, analysisAttemptWeek: null };
    s.polymath.cases['flash-study']!.method = 'ORDINARY'; s.polymath.cases['flash-study']!.outcome = 'FLASH_COMPARED';
    const samples = structuredClone(s.polymath.samples);
    act(s, { type: 'CONSUME', bottleId: s.mysticismMagister.bottles[0]!.id, confirmed: true });
    expect(s.polymath.samples).toEqual(samples);
    expect(s.mysticismMagister.crafts).toEqual([]);
    expect(s.mysticismMagister.practice.kitsUsed).toBe(0);
  });
});
