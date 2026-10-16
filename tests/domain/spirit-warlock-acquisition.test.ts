import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { SLEEPLESS_ABILITY_IDS } from '../../src/domain/sleepless/types.js';
import { MIDNIGHT_ABILITY_IDS } from '../../src/domain/midnight/types.js';
import { NIGHTMARE_ABILITY_IDS } from '../../src/domain/nightmare/types.js';
import { SOOTHER_ABILITY_IDS } from '../../src/domain/soother/types.js';
import { applySpiritWarlockCommand, createSpiritWarlockState, isSpiritWarlockAcquisitionCommand, projectSpiritWarlock, validateSpiritWarlockCommand, validateSpiritWarlockState } from '../../src/domain/spirit-warlock/index.js';
import { SPIRIT_WARLOCK_ABILITIES, SPIRIT_WARLOCK_FORMULA_STATUS, SPIRIT_WARLOCK_PRICES, SPIRIT_WARLOCK_SOURCE_STATUS } from '../../src/domain/spirit-warlock/content.js';
import { SPIRIT_WARLOCK_ABILITY_IDS, type SpiritWarlockAcquisitionCommand } from '../../src/domain/spirit-warlock/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function soother(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/soother-v0780/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.spiritWarlock = createSpiritWarlockState(); s.week = s.soother.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: SpiritWarlockAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applySpiritWarlockCommand(s, command, c); return c;
}
function taught(s = soother()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const b = s.spiritWarlock.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.spiritWarlock.bottles[0]!.id, confirmed: true }); return s;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applySpiritWarlockCommand(s, command as SpiritWarlockAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('SpiritWarlock S5 finished originals and bounded G promotion', () => {
  it('hides the future channel and creates independent original bottles and practice state', () => {
    const s = createSliceRun('spirit-warlock-hidden', sliceDefaultCreationSelection, 'spirit-warlock-hidden');
    expect(validateSpiritWarlockState(s)).toBe(true);
    expect(projectSpiritWarlock(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: null });
    expect(projectSpiritWarlock(s).story).toBeUndefined();
    const other = createSpiritWarlockState(); other.practice.note = 'RECIPIENT'; other.companion.status = 'SEALED'; other.bottles[0]!.labourSteps = 5;
    expect(s.spiritWarlock.practice.note).toBe('TABLE'); expect(s.spiritWarlock.companion.status).toBe('UNMET'); expect(s.spiritWarlock.bottles[0]!.labourSteps).toBe(0);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('opens the existing soother channel and takes 460 plus one action without revealing a formula or ritual', () => {
    const s = soother(), old = structuredClone([s.sleepless, s.midnight, s.nightmare, s.soother]);
    expect(validateSpiritWarlockState(s)).toBe(true);
    expect(projectSpiritWarlock(s)).toMatchObject({ discovered: true, promoted: false, acting: 0, practice: null });
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([29540, 99]); expect(c.check).not.toHaveBeenCalled();
    expect([s.sleepless, s.midnight, s.nightmare, s.soother]).toEqual(old);
    expect(SPIRIT_WARLOCK_PRICES).toEqual({ guidance: 460, potion: 4800, labourCredit: 4200 });
    expect(SPIRIT_WARLOCK_FORMULA_STATUS).toContain('完整配方与晋升仪式尚未核实');
    expect(projectSpiritWarlock(s)).toMatchObject({ formulaKnown: false, formula: [] });
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real labour actions and 600 payment per bottle, with no transferable or partial credit', () => {
    const s = taught(), b = s.spiritWarlock.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([28940, 94, 'PLAYER']);
    const second = s.spiritWarlock.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4800); expect(validateSpiritWarlockState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 4799; reject(s, { type: 'BUY_POTION', bottleId: s.spiritWarlock.bottles[2]!.id });
  });
  it('allows early preparation but requires soother digestion100 and twelve complete weeks before drinking', () => {
    const s = soother(); s.week = s.soother.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateSpiritWarlockState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week += 11; s.progression.acting = 100;
    expect(projectSpiritWarlock(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(s.progression.sequence).toBe(5);
  });
  it('consumes exactly the selected original and applies all four fixed guided result tiers', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.spiritWarlock.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.spiritWarlock.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 6) expect(s.progression.acting).toBe(100);
      expect(validateSpiritWarlockState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('requires health above20 and mind above40 without rolling or consuming a bottle at the boundary', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.spiritWarlock.bottles[0]!.id, confirmed: true });
      expect(s.spiritWarlock.bottles[0]!.status).toBe('PLAYER');
      expect(projectSpiritWarlock(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
  });
  it('preserves every old ID and past spirit cases, adds three zero masteries without a free spirit or refill', () => {
    const s = prepared(), old = structuredClone([s.sleepless, s.midnight, s.nightmare, s.soother]), stats = { ...s.character.coreStats };
    act(s, { type: 'CONSUME', bottleId: s.spiritWarlock.bottles[0]!.id, confirmed: true });
    expect([s.sleepless, s.midnight, s.nightmare, s.soother]).toEqual(old);
    expect(s.spiritWarlock.sootherActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...SLEEPLESS_ABILITY_IDS, ...MIDNIGHT_ABILITY_IDS, ...NIGHTMARE_ABILITY_IDS, ...SOOTHER_ABILITY_IDS, ...SPIRIT_WARLOCK_ABILITY_IDS]);
    expect(SPIRIT_WARLOCK_ABILITY_IDS).toEqual(['darkness.s5.spirit-shelter', 'darkness.s5.spirit-assistance', 'darkness.s5.spirit-coordination']);
    for (const id of SPIRIT_WARLOCK_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.spiritWarlock.companion).toEqual({ status: 'UNMET', invitedWeek: null, acquiredWeek: null, releases: 0, deployments: 0, recalls: 0, source: 'SW5-LEAF-1' });
    expect(s.spiritWarlock.practice).toEqual({ note: 'TABLE', dreamOpen: false, deliveries: 0, returns: 0, coordinationChecks: 0 });
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    expect(SPIRIT_WARLOCK_ABILITIES).toHaveLength(3); expect(SPIRIT_WARLOCK_ABILITIES[0]!.description).toContain('晋升不附赠任何灵');
    expect(SPIRIT_WARLOCK_SOURCE_STATUS).toContain('牙齿'); expect(SPIRIT_WARLOCK_SOURCE_STATUS).toContain('体内冥界'); expect(SPIRIT_WARLOCK_SOURCE_STATUS).toContain('序列4');
    expect(projectSpiritWarlock(s).digestion).toContain('灵巫扮演0/100');
  });
  it('retains failed originals and waits a real week for the next batch without free delivery to the player', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.spiritWarlock.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.spiritWarlock.bottles.slice(0, 3)).toEqual(originals); expect(s.spiritWarlock.bottles).toHaveLength(6);
    expect(s.spiritWarlock.bottles[3]).toMatchObject({ id: 'spirit-warlock-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectSpiritWarlock(s).actions.find(a => a.id === 'buy-spirit-warlock-potion-4')!.cost).toContain('4800便士');
    expect(validateSpiritWarlockState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('rejects invented commands and extra fields while keeping exact life commands outside acquisition', () => {
    const malformed = [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'spirit-warlock-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'soother-potion-1' }, { type: 'SIGNAL', caseId: 'original-message' }, { type: 'REFLECT', extra: true }, { type: 'PREPARE', caseId: 'listening-leaves', method: 'ASTROLOGY' }];
    for (const command of malformed) {
      expect(validateSpiritWarlockCommand(command)).toBe(false); expect(isSpiritWarlockAcquisitionCommand(command)).toBe(false); reject(prepared(), command);
    }
    for (const command of [{ type: 'CLOSE', caseId: 'original-message' }, { type: 'PREPARE', caseId: 'quiet-coordination', method: 'ABILITY' }]) {
      expect(validateSpiritWarlockCommand(command)).toBe(true); expect(isSpiritWarlockAcquisitionCommand(command)).toBe(false); reject(promoted(), command);
    }
  });
  it('rejects forged sources, chronology, promotion snapshots, mastery and malformed nested saves without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.spiritWarlock.bottles[0]!.source = 'invented'; },
      t => { t.spiritWarlock.bottles[0]!.consumedWeek = t.spiritWarlock.promotionWeek! - 1; },
      t => { t.spiritWarlock.sootherActingAtPromotion = 99; },
      t => { delete t.progression.mastery[SLEEPLESS_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['darkness.s5.free-flight'] = 0; },
      t => { t.spiritWarlock.bottles[1]!.labourSteps = 6; },
      t => { (t.spiritWarlock as unknown as Record<string, unknown>).practice = null; },
      t => { (t.spiritWarlock as unknown as Record<string, unknown>).companion = null; },
      t => { (t.spiritWarlock.companion as unknown as Record<string, unknown>).extraSpirit = 'invented'; },
      t => { t.spiritWarlock.companion.status = 'SEALED'; },
      t => { t.spiritWarlock.practice.note = 'RECIPIENT'; },
      t => { (t.spiritWarlock.cases as unknown as Record<string, unknown>)['listening-leaves'] = null; },
      t => { (t.spiritWarlock as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validateSpiritWarlockState(t)).not.toThrow(); expect(validateSpiritWarlockState(t)).toBe(false);
    }
  });
  it('projects bounded S5 capabilities without exposing mutable companion or practice state', () => {
    const s = promoted(), p = projectSpiritWarlock(s);
    expect(p.practice).toBeNull(); expect(p.companion).toBeNull();
    expect(p.abilities.map(x => x.id)).toEqual([...SPIRIT_WARLOCK_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false, cases: [] });
    expect(p.actions.every(a => !a.enabled)).toBe(true);
    p.abilities[0]!.mastery = 99; expect(s.progression.mastery[SPIRIT_WARLOCK_ABILITY_IDS[0]]).toBe(0);
    const before = structuredClone(s); projectSpiritWarlock(s); expect(s).toEqual(before);
  });
  it('accepts only exact finite-original life commands and never routes them through acquisition', () => {
    for (const type of ['INVITE_SPIRIT', 'RELEASE_SPIRIT', 'RECALL_SPIRIT', 'RETRIEVE_NOTE'] as const) {
      expect(validateSpiritWarlockCommand({ type })).toBe(true);
      expect(isSpiritWarlockAcquisitionCommand({ type })).toBe(false);
      expect(validateSpiritWarlockCommand({ type, source: 'SW5-LEAF-2' })).toBe(false);
      reject(promoted(), { type });
    }
    expect(validateSpiritWarlockCommand({ type: 'INVITE_SPIRIT', caseId: 'listening-leaves' })).toBe(false);
    expect(validateSpiritWarlockCommand({ type: 'RETRIEVE_NOTE', count: 2 })).toBe(false);
  });
});
