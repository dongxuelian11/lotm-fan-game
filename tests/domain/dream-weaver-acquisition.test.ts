import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyDreamWeaverAcquisition, applyDreamWeaverCommand, createDreamWeaverState, hasDreamWeaverLock, isDreamWeaverAcquisitionCommand, projectDreamWeaver, validateDreamWeaverCommand, validateDreamWeaverState, dreamWeaverAcquisitionBlock } from '../../src/domain/dream-weaver/index.js';
import { DREAM_WEAVER_CONSUMPTION_RISK, DREAM_WEAVER_FORMULA_STATUS, DREAM_WEAVER_PRICES, DREAM_WEAVER_SOURCE_STATUS } from '../../src/domain/dream-weaver/content.js';
import { DREAM_WEAVER_ABILITY_IDS, DREAM_WEAVER_PREPARATION_IDS, type DreamWeaverAcquisitionCommand, type DreamWeaverCommand } from '../../src/domain/dream-weaver/types.js';

/** Original living S4 end-state; extra time/resources below are explicit unit setup, never natural-play evidence. */
function manipulator(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/manipulator-v01190/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.dreamWeaver = createDreamWeaverState();
  s.week = Math.max(s.week, s.manipulator.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 30;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: DreamWeaverAcquisitionCommand, roll = 1) { const c = context(s, roll); applyDreamWeaverAcquisition(s, command, c); return c; }
function taught(s = manipulator()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of DREAM_WEAVER_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const b = s.dreamWeaver.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.dreamWeaver.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyDreamWeaverAcquisition(s, command as DreamWeaverAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Dream Weaver S3 original bottles and explicitly G professional preparation', () => {
  it('creates independent originals and hides the source before audience S4', () => {
    const s = createSliceRun('dream-weaver-hidden', sliceDefaultCreationSelection, 'dream-weaver-hidden');
    expect(validateDreamWeaverState(s)).toBe(true);
    expect(projectDreamWeaver(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], supplies: '', resources: null });
    expect(projectDreamWeaver(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createDreamWeaverState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'INSPECT_ROUTE', completedWeek: 1 });
    expect(s.dreamWeaver.bottles[0]!.labourSteps).toBe(0); expect(s.dreamWeaver.preparations).toEqual([]);
  });
  it('does not open this S3 channel for any other pathway or unsupported audience sequence', () => {
    const s = manipulator();
    for (const pathwayId of ['diviner', 'hunter', 'paragon', 'moon', 'darkness', 'white-tower', 'tyrant', 'sun', 'death', 'door', 'error', 'warrior', 'demoness', 'hermit', 'hanged-man', 'abyss', 'chained', 'wheel', 'black-emperor', 'justiciar', 'mother'] as const) {
      const other = structuredClone(s); other.progression.pathwayId = pathwayId;
      expect(projectDreamWeaver(other).discovered).toBe(false); expect(projectDreamWeaver(other).actions).toEqual([]); reject(other, { type: 'LEARN_GUIDANCE' });
    }
    for (const sequence of [9, 8, 7, 6, 5, 0]) {
      const other = structuredClone(s); other.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>;
      expect(projectDreamWeaver(other).discovered).toBe(false); expect(projectDreamWeaver(other).actions).toEqual([]); reject(other, { type: 'LEARN_GUIDANCE' });
    }
  });
  it('accepts exact inherited S1 Writer history while keeping old acquisition, life and encounter actions closed', () => {
    const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/writer-v01880/snapshot-promoted.json', 'utf8')));
    const original = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/discerner-v01660/natural.json', 'final'));
    expect(s.progression).toMatchObject({ pathwayId: 'audience', sequence: 1 });
    expect(s.dreamWeaver).toEqual(original.dreamWeaver); expect(validateDreamWeaverState(s)).toBe(true);
    expect(projectDreamWeaver(s)).toMatchObject({ discovered: true, promoted: true, acting: 100, actions: [] });
    for (const id of DREAM_WEAVER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(original.progression.mastery[id]);
    const commands: { command: DreamWeaverCommand; reason: string }[] = [
      { command: { type: 'BUY_POTION', bottleId: s.dreamWeaver.bottles[1]!.id }, reason: '已经真实晋升织梦人3' },
      { command: { type: 'PREPARE', caseId: 'two-desks', method: 'ORDINARY' }, reason: '本人须仍活着并已成为织梦人。' },
      { command: { type: 'ENCOUNTER_FIGHT' }, reason: '须本人仍活着且有精神，并已成为织梦人3。' },
    ];
    for (const { command, reason } of commands) {
      const before = structuredClone(s), c = context(s);
      expect(validateDreamWeaverCommand(command)).toBe(true);
      expect(() => applyDreamWeaverCommand(s, command, c)).toThrow(reason); expect(s).toEqual(before);
      expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled(); expect(c.note).not.toHaveBeenCalled();
    }
    const unsupported = structuredClone(s); unsupported.progression.sequence = 0;
    expect(projectDreamWeaver(unsupported)).toMatchObject({ discovered: false, promoted: false, actions: [] });
    expect(validateDreamWeaverState(unsupported)).toBe(false); reject(unsupported, { type: 'LEARN_GUIDANCE' });
  });
  it('charges500 and one action without inventing a canonical formula, rite or independent soul', () => {
    const s = manipulator(), old = structuredClone([s.audience, s.mindreader, s.psychologist, s.hypnotist, s.dreamwalker, s.manipulator]);
    apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]);
    expect([s.audience, s.mindreader, s.psychologist, s.hypnotist, s.dreamwalker, s.manipulator]).toEqual(old);
    expect(DREAM_WEAVER_PRICES).toEqual({ guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 });
    expect(DREAM_WEAVER_FORMULA_STATUS).toContain('完整配方与晋升仪式尚未核实');
    expect(DREAM_WEAVER_FORMULA_STATUS).toContain('不重复操纵师的万人共鸣');
    expect(DREAM_WEAVER_SOURCE_STATUS).toContain('不能生成真钱'); expect(DREAM_WEAVER_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectDreamWeaver(s)).toMatchObject({ formulaKnown: false, formula: [], preparations: DREAM_WEAVER_PREPARATION_IDS.map(taskId => ({ taskId, completedWeek: null })) });
    reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateDreamWeaverState(s)).toBe(true);
  });
  it('five actual bottle-specific jobs yield only that original800 price, never free preparation', () => {
    const s = taught(), b = s.dreamWeaver.bottles[0]!, oldHistory = structuredClone(s.manipulator);
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, b.status, b.acquiredWeek]).toEqual([98700, 'PLAYER', s.week]);
    expect(s.dreamWeaver.bottles[1]!.labourSteps).toBe(0); expect(s.dreamWeaver.preparations).toEqual([]); expect(s.dreamWeaver.preparedWeek).toBeNull();
    expect(s.manipulator).toEqual(oldHistory); expect(validateDreamWeaverState(s)).toBe(true); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount or transfer one bottle’s labour', () => {
    const s = taught(), b = s.dreamWeaver.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6200);
    s.cash = 6199; reject(s, { type: 'BUY_POTION', bottleId: s.dreamWeaver.bottles[1]!.id });
  });
  it('requires three distinct real professional tasks and separate current-week paid preparation', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of DREAM_WEAVER_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId });
      expect(s.actionsRemaining).toBe(ap - 1); expect(s.dreamWeaver.preparations[index]).toEqual({ taskId, completedWeek: s.week });
      reject(s, { type: 'PREPARE_TASK', taskId });
      if (index < 2) reject(s, { type: 'PREPARE_PROMOTION' });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.cash, s.actionsRemaining, s.dreamWeaver.preparedWeek]).toEqual([cash - 120, ap - 1, s.week]);
    expect(hasDreamWeaverLock(s)).toBe(true); expect(projectDreamWeaver(s).insideCase).toBe(true); expect(validateDreamWeaverState(s)).toBe(true);
  });
  it('preserves the last action as a real zero-action confirmation or non-refunding exit', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1;
    const week = s.week, cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 120]); reject(s, { type: 'PREPARE_PROMOTION' });
    applyDreamWeaverCommand(s, { type: 'LEAVE_PREPARATION' }, context(s));
    expect([s.actionsRemaining, s.cash, s.dreamWeaver.preparedWeek]).toEqual([0, cash - 120, null]);
    expect(s.dreamWeaver.bottles[0]!.status).toBe('PLAYER'); expect(hasDreamWeaverLock(s)).toBe(false); reject(s, dose(s));
    expect(validateDreamWeaverState(s)).toBe(true);
  });
  it('requires exact independent confirmation before any result draw', () => {
    const s = prepared();
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), acceptBodyChange: true }]) {
      expect(validateDreamWeaverCommand(command)).toBe(false); reject(s, command);
    }
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles exact tier%s while preserving original S4 history and original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), b = s.dreamWeaver.bottles[0]!, original = structuredClone([s.audience, s.mindreader, s.psychologist, s.hypnotist, s.dreamwalker, s.manipulator]);
    const oldMastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, gender = s.character.gender, tasks = structuredClone(s.dreamWeaver.preparations);
    s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(b).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.dreamWeaver.preparedWeek).toBeNull();
    expect([s.audience, s.mindreader, s.psychologist, s.hypnotist, s.dreamwalker, s.manipulator]).toEqual(original);
    expect(s.dreamWeaver.preparations).toEqual(tasks); expect(s.character.gender).toBe(gender);
    for (const [id, value] of Object.entries(oldMastery)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 3) {
      expect(s.dreamWeaver.manipulatorActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(DREAM_WEAVER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
      expect(projectDreamWeaver(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateDreamWeaverState(s)).toBe(true); reject(s, dose(s));
  });
  it('floors only guided potion rejection to1 and never reopens a dead run', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    expect(validateDreamWeaverState(s)).toBe(true);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead));
  });
  it('keeps the failed bottle consumed, requires paid re-preparation, and permits recovery then retry', () => {
    const s = prepared(); apply(s, dose(s), 100);
    const first = structuredClone(s.dreamWeaver.bottles[0]), oldHistory = structuredClone(s.manipulator), tasks = structuredClone(s.dreamWeaver.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100;
    const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 120, ap - 1]); apply(s, dose(s, 1));
    expect(s.dreamWeaver.bottles[0]).toEqual(first); expect(s.manipulator).toEqual(oldHistory); expect(s.dreamWeaver.preparations).toEqual(tasks);
    expect(validateDreamWeaverState(s)).toBe(true);
  });
  it('retains all failed originals and waits a true week for a new priced batch', () => {
    const s = qualify(taught());
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const originals = structuredClone(s.dreamWeaver.bottles), oldHistory = structuredClone(s.manipulator), ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.dreamWeaver.bottles.slice(0, 3)).toEqual(originals); expect(s.dreamWeaver.bottles).toHaveLength(6);
    expect(s.dreamWeaver.bottles[3]).toMatchObject({ id: 'dream-weaver-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(s.manipulator).toEqual(oldHistory);
    expect(projectDreamWeaver(s).actions.find(a => a.id === 'buy-dream-weaver-potion-4')!.cost).toContain('6200便士');
    expect(validateDreamWeaverState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('checks prior digestion, twelve full weeks, vitality and stale preparation before drawing', () => {
    const s = prepared();
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100;
    const oldPromotion = s.manipulator.promotionWeek; s.manipulator.promotionWeek = s.week - 11; reject(s, dose(s)); s.manipulator.promotionWeek = oldPromotion;
    s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateDreamWeaverState(s)).toBe(false);
    apply(s, { type: 'LEAVE_PREPARATION' }); expect(s.dreamWeaver.preparedWeek).toBeNull();
  });
  it('measures twelve full weeks from actual manipulator promotion W74 rather than original audience W5', () => {
    const s = qualify(taught()); buy(s);
    expect(s.manipulator.promotionWeek).toBe(74); expect(s.progression.promotionWeek).toBe(5);
    s.week = 82;
    expect(dreamWeaverAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('8/12');
    expect(projectDreamWeaver(s).digestion).toContain('8/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = 85; reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = 86; apply(s, { type: 'PREPARE_PROMOTION' });
    expect(s.dreamWeaver.preparedWeek).toBe(86); expect(s.progression.promotionWeek).toBe(5);
  });
  it('lets an alive depleted character cancel at zero actions without healing, refund or a result draw', () => {
    const s = prepared(); s.actionsRemaining = 0; s.health = 1; s.mind = 1;
    const cash = s.cash, spirit = s.spirituality, bottles = structuredClone(s.dreamWeaver.bottles), old = structuredClone(s.manipulator);
    reject(s, dose(s));
    expect(projectDreamWeaver(s).actions.find(a => a.command.type === 'LEAVE_PREPARATION')).toMatchObject({ enabled: true, cost: expect.stringContaining('0行动') });
    const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect(c.check).not.toHaveBeenCalled(); expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, spirit, cash, 0]);
    expect(s.dreamWeaver.bottles).toEqual(bottles); expect(s.manipulator).toEqual(old); expect(hasDreamWeaverLock(s)).toBe(false);
    reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateDreamWeaverState(s)).toBe(true);
  });
  it.each([1, 100])('leaves the real preparation scene after consumption%s even with no remaining actions', roll => {
    const s = prepared(); s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(s.dreamWeaver.preparedWeek).toBeNull(); expect(hasDreamWeaverLock(s)).toBe(false);
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('沿原出口实际离开'));
    expect(projectDreamWeaver(s).insideCase).toBe(false); expect(validateDreamWeaverState(s)).toBe(true);
  });
  it('preserves original injuries, town property, seed, combat history and each earlier promotion across S3', () => {
    const s = prepared(), history = structuredClone(s.combatHistory), injuries = structuredClone(s.injuries), town = structuredClone(s.town);
    const originalPromotion = s.progression.promotionWeek, random = structuredClone(s.random);
    expect(s.manipulator.encounter.enemy).toMatchObject({ id: 'MP4-RULAN', health: 100, mind: 0, status: 'SURRENDERED', weaponLocation: 'YARD' });
    expect(s.manipulator.encounter.mentalPlague).toBe(0); expect(injuries).toHaveLength(2);
    apply(s, dose(s));
    expect(s.combatHistory).toEqual(history); expect(s.injuries).toEqual(injuries); expect(s.town).toEqual(town);
    expect(s.progression.promotionWeek).toBe(originalPromotion); expect(s.random).toEqual(random);
    expect(projectDreamWeaver(s).inheritedHistory.join(' ')).toContain('健康100/100、精神0/100、精神瘟疫0');
    expect(projectDreamWeaver(s).inheritedHistory.join(' ')).toContain('原院地面');
  });
  it('rejects guidance without the actual S4 promotion and cannot borrow any old material batch', () => {
    const s = manipulator(); s.manipulator.promotionWeek = null;
    expect(projectDreamWeaver(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught();
    for (const bottleId of ['manipulator-potion-1', 'manipulator-batch-2', 'dreamwalker-potion-2']) reject(t, { type: 'BUY_POTION', bottleId });
    expect(t.manipulator.batches[1]!.status).toBe('SUPPLIER');
  });
  it('rejects missing action points before charging tasks, work, guidance or preparation', () => {
    const s = manipulator(); s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0;
    reject(t, { type: 'PREPARE_TASK', taskId: 'INSPECT_ROUTE' }); reject(t, { type: 'POTION_WORK', bottleId: t.dreamWeaver.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.actionsRemaining = 0; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it('requires the old persona, real paper, dream contact and gatherings to be closed', () => {
    const s = qualify(taught()); buy(s);
    s.manipulator.life.practice.paper.holder = 'OWNER'; reject(s, { type: 'PREPARE_PROMOTION' }); s.manipulator.life.practice.paper.holder = 'DESK';
    s.manipulator.life.cases['divided-attention'].status = 'PREPARED'; reject(s, { type: 'PREPARE_PROMOTION' }); s.manipulator.life.cases['divided-attention'].status = 'RESOLVED';
    s.dreamwalker.cases['dream-evidence'].contactOpen = true; reject(s, { type: 'PREPARE_PROMOTION' });
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'BUY_POTION', bottleId: 'manipulator-potion-3' }, { type: 'PREPARE_TASK', taskId: 'MASS_RESONANCE' }, { type: 'LEARN_GUIDANCE', grantArmy: true }, { type: 'CONSUME', bottleId: 'dream-weaver-potion-1', confirmed: false }])('rejects nonexact commands%# without mutation', command => {
    expect(validateDreamWeaverCommand(command)).toBe(false); expect(isDreamWeaverAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects malformed shape, copied bottle provenance, duplicate preparation and forged chronology', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.dreamWeaver.manipulatorActingAtPromotion = 99; }, t => { t.dreamWeaver.bottles[0]!.source = 'old S4 bottle'; },
      t => { t.dreamWeaver.bottles[0]!.preparationWeek = t.dreamWeaver.bottles[0]!.preparationWeek! - 1; }, t => { t.dreamWeaver.bottles[1]!.id = t.dreamWeaver.bottles[0]!.id; },
      t => { t.dreamWeaver.preparations[1]!.taskId = t.dreamWeaver.preparations[0]!.taskId; },
      t => { t.dreamWeaver.preparations[0]!.completedWeek = t.week + 1; }, t => { t.dreamWeaver.preparedWeek = t.week; },
      t => { delete t.progression.mastery[DREAM_WEAVER_ABILITY_IDS[0]]; },
      t => { (t.dreamWeaver as unknown as Record<string, unknown>).life = null; },
      t => { (t.dreamWeaver as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateDreamWeaverState(t)).not.toThrow(); expect(validateDreamWeaverState(t)).toBe(false); }
  });
  it('keeps validation independent of serialized object key order', () => {
    const s = prepared(); apply(s, dose(s));
    const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, reorder(x)])) : v;
    expect(validateDreamWeaverState(reorder(s) as SliceState)).toBe(true);
  });

  it('returns explicit preparation blockers without consuming the next original bottle', () => {
    const s = qualify(taught()); buy(s); s.cash = 119;
    expect(dreamWeaverAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('120'); reject(s, { type: 'PREPARE_PROMOTION' });
    expect(s.dreamWeaver.bottles[0]!.status).toBe('PLAYER');
  });
});
