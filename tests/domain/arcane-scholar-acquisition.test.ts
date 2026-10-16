import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyArcaneScholarAcquisition, applyArcaneScholarCommand, createArcaneScholarState, hasArcaneScholarLock, isArcaneScholarAcquisitionCommand, projectArcaneScholar, validateArcaneScholarCommand, validateArcaneScholarState, arcaneScholarAcquisitionBlock } from '../../src/domain/arcane-scholar/index.js';
import { ARCANE_SCHOLAR_CONSUMPTION_RISK, ARCANE_SCHOLAR_FORMULA_STATUS, ARCANE_SCHOLAR_PRICES, ARCANE_SCHOLAR_SOURCE_STATUS } from '../../src/domain/arcane-scholar/content.js';
import { ARCANE_SCHOLAR_ABILITY_IDS, ARCANE_SCHOLAR_PREPARATION_IDS, type ArcaneScholarAcquisitionCommand } from '../../src/domain/arcane-scholar/types.js';

/** Original living S4 end-state; extra time/resources below are explicit unit setup, never natural-play evidence. */
function alchemist(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/alchemist-v01200/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.arcaneScholar = createArcaneScholarState();
  s.week = Math.max(s.week, s.alchemist.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 30;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: ArcaneScholarAcquisitionCommand, roll = 1) { const c = context(s, roll); applyArcaneScholarAcquisition(s, command, c); return c; }
function taught(s = alchemist()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of ARCANE_SCHOLAR_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const b = s.arcaneScholar.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.arcaneScholar.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyArcaneScholarAcquisition(s, command as ArcaneScholarAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Arcane Scholar S3 original bottles and explicitly G professional preparation', () => {
  it('creates independent originals and hides the source before savant S4', () => {
    const s = createSliceRun('arcane-scholar-hidden', sliceDefaultCreationSelection, 'arcane-scholar-hidden');
    expect(validateArcaneScholarState(s)).toBe(true);
    expect(projectArcaneScholar(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], supplies: '', resources: null });
    expect(projectArcaneScholar(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createArcaneScholarState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'INSPECT_RECORDS', completedWeek: 1 });
    expect(s.arcaneScholar.bottles[0]!.labourSteps).toBe(0); expect(s.arcaneScholar.preparations).toEqual([]);
  });
  it('does not open this S3 channel for any other pathway or unsupported savant sequence', () => {
    const s = alchemist();
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'moon', 'darkness', 'white-tower', 'tyrant', 'sun', 'death', 'door', 'error', 'warrior', 'demoness', 'hermit', 'hanged-man', 'abyss', 'chained', 'wheel', 'black-emperor', 'justiciar', 'mother'] as const) {
      const other = structuredClone(s); other.progression.pathwayId = pathwayId;
      expect(projectArcaneScholar(other).discovered).toBe(false); expect(projectArcaneScholar(other).actions).toEqual([]); reject(other, { type: 'LEARN_GUIDANCE' });
    }
    // S1 now retains validated Arcane Scholar history; its old commands remain closed.
    for (const sequence of [9, 8, 7, 6, 5, 0]) { const other = structuredClone(s); other.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectArcaneScholar(other).discovered).toBe(false); }
  });
  it('keeps the actual new S1 original Arcane Scholar history while old acquisition remains closed', () => {
    const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/civilization-enlightener-v01890/snapshot-promoted.json', 'utf8')));
    expect(s.progression).toMatchObject({ pathwayId: 'paragon', sequence: 1 });
    expect(validateArcaneScholarState(s)).toBe(true);
    expect(projectArcaneScholar(s)).toMatchObject({ discovered: true, promoted: true, actions: [] });
    reject(s, { type: 'PREPARE_PROMOTION' });
    const unsupported = structuredClone(s); unsupported.progression.sequence = 0;
    expect(projectArcaneScholar(unsupported)).toMatchObject({ discovered: false, actions: [] });
    expect(validateArcaneScholarState(unsupported)).toBe(false);
  });
  it('charges500 and one action without inventing a canonical formula, rite or unverified canonical ability', () => {
    const s = alchemist(), old = structuredClone([s.savant, s.archaeologist, s.appraiser, s.artisan, s.astronomer, s.alchemist]);
    apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]);
    expect([s.savant, s.archaeologist, s.appraiser, s.artisan, s.astronomer, s.alchemist]).toEqual(old);
    expect(ARCANE_SCHOLAR_PRICES).toEqual({ guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 });
    expect(ARCANE_SCHOLAR_FORMULA_STATUS).toContain('完整配方与晋升仪式尚未核实');
    expect(ARCANE_SCHOLAR_FORMULA_STATUS).toContain('不重复炼金术士的抽取区域生命');
    expect(ARCANE_SCHOLAR_SOURCE_STATUS).toContain('跨段推定'); expect(ARCANE_SCHOLAR_SOURCE_STATUS).toContain('均为明确原创G'); expect(ARCANE_SCHOLAR_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectArcaneScholar(s)).toMatchObject({ formulaKnown: false, formula: [], preparations: ARCANE_SCHOLAR_PREPARATION_IDS.map(taskId => ({ taskId, completedWeek: null })) });
    reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateArcaneScholarState(s)).toBe(true);
  });
  it('five actual bottle-specific jobs yield only that original800 price, never free preparation', () => {
    const s = taught(), b = s.arcaneScholar.bottles[0]!, oldHistory = structuredClone(s.alchemist);
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, b.status, b.acquiredWeek]).toEqual([98700, 'PLAYER', s.week]);
    expect(s.arcaneScholar.bottles[1]!.labourSteps).toBe(0); expect(s.arcaneScholar.preparations).toEqual([]); expect(s.arcaneScholar.preparedWeek).toBeNull();
    expect(s.alchemist).toEqual(oldHistory); expect(validateArcaneScholarState(s)).toBe(true); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount or transfer one bottle’s labour', () => {
    const s = taught(), b = s.arcaneScholar.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6200);
    s.cash = 6199; reject(s, { type: 'BUY_POTION', bottleId: s.arcaneScholar.bottles[1]!.id });
  });
  it('requires three distinct real professional tasks and separate current-week paid preparation', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of ARCANE_SCHOLAR_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId });
      expect(s.actionsRemaining).toBe(ap - 1); expect(s.arcaneScholar.preparations[index]).toEqual({ taskId, completedWeek: s.week });
      reject(s, { type: 'PREPARE_TASK', taskId });
      if (index < 2) reject(s, { type: 'PREPARE_PROMOTION' });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.cash, s.actionsRemaining, s.arcaneScholar.preparedWeek]).toEqual([cash - 120, ap - 1, s.week]);
    expect(hasArcaneScholarLock(s)).toBe(true); expect(projectArcaneScholar(s).insideCase).toBe(true); expect(validateArcaneScholarState(s)).toBe(true);
  });
  it('preserves the last action as a real zero-action confirmation or non-refunding exit', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1;
    const week = s.week, cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 120]); reject(s, { type: 'PREPARE_PROMOTION' });
    applyArcaneScholarCommand(s, { type: 'LEAVE_PREPARATION' }, context(s));
    expect([s.actionsRemaining, s.cash, s.arcaneScholar.preparedWeek]).toEqual([0, cash - 120, null]);
    expect(s.arcaneScholar.bottles[0]!.status).toBe('PLAYER'); expect(hasArcaneScholarLock(s)).toBe(false); reject(s, dose(s));
    expect(validateArcaneScholarState(s)).toBe(true);
  });
  it('requires exact independent confirmation before any result draw', () => {
    const s = prepared();
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), acceptBodyChange: true }]) {
      expect(validateArcaneScholarCommand(command)).toBe(false); reject(s, command);
    }
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles exact tier%s while preserving original S4 history and original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), b = s.arcaneScholar.bottles[0]!, original = structuredClone([s.savant, s.archaeologist, s.appraiser, s.artisan, s.astronomer, s.alchemist]);
    const oldMastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, gender = s.character.gender, tasks = structuredClone(s.arcaneScholar.preparations);
    s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(b).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.arcaneScholar.preparedWeek).toBeNull();
    expect([s.savant, s.archaeologist, s.appraiser, s.artisan, s.astronomer, s.alchemist]).toEqual(original);
    expect(s.arcaneScholar.preparations).toEqual(tasks); expect(s.character.gender).toBe(gender);
    for (const [id, value] of Object.entries(oldMastery)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 3) {
      expect(s.arcaneScholar.alchemistActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(ARCANE_SCHOLAR_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
      expect(projectArcaneScholar(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateArcaneScholarState(s)).toBe(true); reject(s, dose(s));
  });
  it('floors only guided potion rejection to1 and never reopens a dead run', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    expect(validateArcaneScholarState(s)).toBe(true);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead));
  });
  it('keeps the failed bottle consumed, requires paid re-preparation, and permits recovery then retry', () => {
    const s = prepared(); apply(s, dose(s), 100);
    const first = structuredClone(s.arcaneScholar.bottles[0]), oldHistory = structuredClone(s.alchemist), tasks = structuredClone(s.arcaneScholar.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100;
    const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 120, ap - 1]); apply(s, dose(s, 1));
    expect(s.arcaneScholar.bottles[0]).toEqual(first); expect(s.alchemist).toEqual(oldHistory); expect(s.arcaneScholar.preparations).toEqual(tasks);
    expect(validateArcaneScholarState(s)).toBe(true);
  });
  it('retains all failed originals and waits a true week for a new priced batch', () => {
    const s = qualify(taught());
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const originals = structuredClone(s.arcaneScholar.bottles), oldHistory = structuredClone(s.alchemist), ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.arcaneScholar.bottles.slice(0, 3)).toEqual(originals); expect(s.arcaneScholar.bottles).toHaveLength(6);
    expect(s.arcaneScholar.bottles[3]).toMatchObject({ id: 'arcane-scholar-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(s.alchemist).toEqual(oldHistory);
    expect(projectArcaneScholar(s).actions.find(a => a.id === 'buy-arcane-scholar-potion-4')!.cost).toContain('6200便士');
    expect(validateArcaneScholarState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('checks prior digestion, twelve full weeks, vitality and stale preparation before drawing', () => {
    const s = prepared();
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100;
    const oldPromotion = s.alchemist.promotionWeek; s.alchemist.promotionWeek = s.week - 11; reject(s, dose(s)); s.alchemist.promotionWeek = oldPromotion;
    s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateArcaneScholarState(s)).toBe(false);
    apply(s, { type: 'LEAVE_PREPARATION' }); expect(s.arcaneScholar.preparedWeek).toBeNull();
  });
  it('measures twelve full weeks from actual alchemist promotion W83 rather than original savant W5', () => {
    const s = qualify(taught()); buy(s);
    expect(s.alchemist.promotionWeek).toBe(83); expect(s.progression.promotionWeek).toBe(5);
    s.week = 91;
    expect(arcaneScholarAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('8/12');
    expect(projectArcaneScholar(s).digestion).toContain('8/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = 94; reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = 95; apply(s, { type: 'PREPARE_PROMOTION' });
    expect(s.arcaneScholar.preparedWeek).toBe(95); expect(s.progression.promotionWeek).toBe(5);
  });
  it('lets an alive depleted character cancel at zero actions without healing, refund or a result draw', () => {
    const s = prepared(); s.actionsRemaining = 0; s.health = 1; s.mind = 1;
    const cash = s.cash, spirit = s.spirituality, bottles = structuredClone(s.arcaneScholar.bottles), old = structuredClone(s.alchemist);
    reject(s, dose(s));
    expect(projectArcaneScholar(s).actions.find(a => a.command.type === 'LEAVE_PREPARATION')).toMatchObject({ enabled: true, cost: expect.stringContaining('0行动') });
    const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect(c.check).not.toHaveBeenCalled(); expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, spirit, cash, 0]);
    expect(s.arcaneScholar.bottles).toEqual(bottles); expect(s.alchemist).toEqual(old); expect(hasArcaneScholarLock(s)).toBe(false);
    reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateArcaneScholarState(s)).toBe(true);
  });
  it.each([1, 100])('leaves the real preparation scene after consumption%s even with no remaining actions', roll => {
    const s = prepared(); s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(s.arcaneScholar.preparedWeek).toBeNull(); expect(hasArcaneScholarLock(s)).toBe(false);
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('沿原出口实际离开'));
    expect(projectArcaneScholar(s).insideCase).toBe(false); expect(validateArcaneScholarState(s)).toBe(true);
  });
  it('preserves original injuries, town property, seed, combat history and each earlier promotion across S3', () => {
    const s = prepared(), history = structuredClone(s.combatHistory), injuries = structuredClone(s.injuries), town = structuredClone(s.town);
    const originalPromotion = s.progression.promotionWeek, random = structuredClone(s.random);
    expect(s.alchemist.encounter.enemy).toMatchObject({ id: 'AL4-OSRIC', health: 0, mind: 100, status: 'DEAD', weaponLocation: 'YARD' });
    expect(s.alchemist.life.creations).toMatchObject([{ id: 'AL4-BOX-1', charge: 2, durability: 100, location: 'PLAYER', active: false }, { id: 'AL4-FRAME-1', charge: 0, durability: 95, location: 'PLAYER', active: false }]);
    expect(s.alchemist.ritual.plots).toHaveLength(2);
    for (const plot of s.alchemist.ritual.plots) { expect(plot.plants.every(p => p.status === 'DEAD')).toBe(true); expect(plot.soil).toMatchObject({ status: 'SAND', vitality: 0 }); expect(plot.pool).toMatchObject({ status: 'DRY', waterLitres: 0 }); }
    const original = structuredClone(s.alchemist);
    apply(s, dose(s));
    expect(s.combatHistory).toEqual(history); expect(s.injuries).toEqual(injuries); expect(s.town).toEqual(town);
    expect(s.progression.promotionWeek).toBe(originalPromotion); expect(s.random).toEqual(random);
    expect(s.alchemist).toEqual(original); expect(projectArcaneScholar(s).inheritedHistory.join(' ')).toContain('健康0/100、精神100/100');
    expect(projectArcaneScholar(s).inheritedHistory.join(' ')).toContain('已死亡，不会复活'); expect(projectArcaneScholar(s).inheritedHistory.join(' ')).toContain('储能0/3、耐久95/100');
    expect(projectArcaneScholar(s).inheritedHistory.join(' ')).toContain('原院地面');
  });
  it('rejects guidance without the actual S4 promotion and cannot borrow any old material batch', () => {
    const s = alchemist(); s.alchemist.promotionWeek = null;
    expect(projectArcaneScholar(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught();
    for (const bottleId of ['alchemist-potion-1', 'astronomer-potion-2', 'artisan-potion-2']) reject(t, { type: 'BUY_POTION', bottleId });
    expect(t.alchemist.bottles[2]!.status).toBe('SUPPLIER');
  });
  it('rejects missing action points before charging tasks, work, guidance or preparation', () => {
    const s = alchemist(); s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0;
    reject(t, { type: 'PREPARE_TASK', taskId: 'INSPECT_RECORDS' }); reject(t, { type: 'POTION_WORK', bottleId: t.arcaneScholar.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.actionsRemaining = 0; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it('requires the old gardens, real entrusted items, original creations and telescope contact to be closed', () => {
    const s = qualify(taught()); buy(s);
    s.alchemist.life.parcel.custodian = 'AL4-BOX-1'; reject(s, { type: 'PREPARE_PROMOTION' }); s.alchemist.life.parcel.custodian = 'AL4-HELENA';
    s.alchemist.life.entrustedMaterial.location = 'WORKBENCH'; reject(s, { type: 'PREPARE_PROMOTION' }); s.alchemist.life.entrustedMaterial.location = 'OWNER';
    s.alchemist.life.creations[0]!.active = true; reject(s, { type: 'PREPARE_PROMOTION' }); s.alchemist.life.creations[0]!.active = false;
    s.alchemist.life.creations[1]!.location = 'GUARD_MARK'; reject(s, { type: 'PREPARE_PROMOTION' }); s.alchemist.life.creations[1]!.location = 'PLAYER';
    s.alchemist.life.cases['maker-account'].status = 'PREPARED'; reject(s, { type: 'PREPARE_PROMOTION' }); s.alchemist.life.cases['maker-account'].status = 'RESOLVED';
    const first = Object.values(s.astronomer.cases)[0]!; first.contactOpen = true; reject(s, { type: 'PREPARE_PROMOTION' }); first.contactOpen = false;
    expect(arcaneScholarAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toBeNull();
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'BUY_POTION', bottleId: 'alchemist-potion-3' }, { type: 'PREPARE_TASK', taskId: 'MASS_RESONANCE' }, { type: 'LEARN_GUIDANCE', grantArmy: true }, { type: 'CONSUME', bottleId: 'arcane-scholar-potion-1', confirmed: false }])('rejects nonexact commands%# without mutation', command => {
    expect(validateArcaneScholarCommand(command)).toBe(false); expect(isArcaneScholarAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects malformed shape, copied bottle provenance, duplicate preparation and forged chronology', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.arcaneScholar.alchemistActingAtPromotion = 99; }, t => { t.arcaneScholar.bottles[0]!.source = 'old S4 bottle'; },
      t => { t.arcaneScholar.bottles[0]!.preparationWeek = t.arcaneScholar.bottles[0]!.preparationWeek! - 1; }, t => { t.arcaneScholar.bottles[1]!.id = t.arcaneScholar.bottles[0]!.id; },
      t => { t.arcaneScholar.preparations[1]!.taskId = t.arcaneScholar.preparations[0]!.taskId; },
      t => { t.arcaneScholar.preparations[0]!.completedWeek = t.week + 1; }, t => { t.arcaneScholar.preparedWeek = t.week; },
      t => { delete t.progression.mastery[ARCANE_SCHOLAR_ABILITY_IDS[0]]; },
      t => { (t.arcaneScholar as unknown as Record<string, unknown>).life = null; },
      t => { (t.arcaneScholar as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateArcaneScholarState(t)).not.toThrow(); expect(validateArcaneScholarState(t)).toBe(false); }
  });
  it('keeps validation independent of serialized object key order', () => {
    const s = prepared(); apply(s, dose(s));
    const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, reorder(x)])) : v;
    expect(validateArcaneScholarState(reorder(s) as SliceState)).toBe(true);
  });

  it('returns explicit preparation blockers without consuming the next original bottle', () => {
    const s = qualify(taught()); buy(s); s.cash = 119;
    expect(arcaneScholarAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('120'); reject(s, { type: 'PREPARE_PROMOTION' });
    expect(s.arcaneScholar.bottles[0]!.status).toBe('PLAYER');
  });
});
