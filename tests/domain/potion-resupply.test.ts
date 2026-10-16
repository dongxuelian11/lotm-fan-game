import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySeerCommand, createSeerState, projectSeer, validateSeerState, type SeerContext } from '../../src/domain/seer/index.js';
import { SEER_FORMULA, SEER_PRICES } from '../../src/domain/seer/content.js';
import { applyClownCommand, createClownState, projectClown, validateClownState } from '../../src/domain/clown/index.js';
import { CLOWN_FORMULA, CLOWN_PRICES } from '../../src/domain/clown/content.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

type Path = 'seer' | 'clown';
type Command =
  | { type: 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY' }
  | { type: 'MATERIAL_WORK' | 'BUY_MATERIALS' | 'BREW'; batchId: string }
  | { type: 'CONSUME'; bottleId: string; confirmed: true };

function context(s: SliceState, roll = 80): SeerContext {
  return {
    roll: min => min,
    note() {},
    check: (ability, difficulty) => resolveNormalCheck({
      ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll,
    }),
  };
}

function state(path: Path): SliceState {
  const s = createSliceRun(`resupply-${path}`, sliceDefaultCreationSelection, 'resupply-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 30_000;
  s.actionsRemaining = 100;
  s.weeklyBudget = 100;
  s.character.coreStats.will = 15;
  applySeerCommand(s, { type: 'DISCOVER' }, context(s));
  applySeerCommand(s, { type: 'LEARN_FORMULA' }, context(s));
  if (path === 'clown') {
    applySeerCommand(s, { type: 'BUY_MATERIALS', batchId: 'seer-batch-1' }, context(s));
    applySeerCommand(s, { type: 'BREW', batchId: 'seer-batch-1' }, context(s));
    applySeerCommand(s, { type: 'CONSUME', bottleId: 'seer-batch-1:bottle', confirmed: true }, context(s, 1));
    s.week = 11;
    s.progression.acting = 100;
    applyClownCommand(s, { type: 'LEARN_FORMULA' }, context(s));
  }
  s.health = 100;
  s.mind = 100;
  return s;
}

function apply(s: SliceState, path: Path, command: Command, roll = 80) {
  if (path === 'seer') applySeerCommand(s, command, context(s, roll));
  else applyClownCommand(s, command, context(s, roll));
}
function project(s: SliceState, path: Path) { return path === 'seer' ? projectSeer(s) : projectClown(s); }
function valid(s: SliceState) { return validateSeerState(s) && validateClownState(s); }
function reject(s: SliceState, path: Path, command: Command) {
  const before = JSON.stringify(s);
  expect(() => apply(s, path, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
function brew(s: SliceState, path: Path, index: number) {
  const batchId = s[path].batches[index]!.id;
  apply(s, path, { type: 'BUY_MATERIALS', batchId });
  apply(s, path, { type: 'BREW', batchId });
  return `${batchId}:bottle`;
}
function failRound(s: SliceState, path: Path) {
  // These tests isolate acquisition rules; ordinary recovery is covered by the slice suite.
  s.health = 100;
  s.mind = 100;
  for (const index of [s[path].batches.length - 3, s[path].batches.length - 2, s[path].batches.length - 1]) {
    apply(s, path, { type: 'CONSUME', bottleId: brew(s, path, index), confirmed: true });
  }
  expect(s[path].bottles.every(bottle => bottle.status === 'CONSUMED' && bottle.outcome === 'FAILURE')).toBe(true);
  expect(valid(s)).toBe(true);
}
function delivered(path: Path) {
  const s = state(path);
  failRound(s, path);
  apply(s, path, { type: 'REQUEST_SUPPLY' });
  s.week += 1;
  apply(s, path, { type: 'RECEIVE_SUPPLY' });
  return s;
}

for (const path of ['seer', 'clown'] as const) describe(`${path}: failure-gated, next-week potion supply`, () => {
  const formula = path === 'seer' ? SEER_FORMULA : CLOWN_FORMULA;
  const prices = path === 'seer' ? SEER_PRICES : CLOWN_PRICES;
  const steps = path === 'seer' ? 2 : 3;

  it('retains the exact original three batch IDs, ingredient quantities and sources', () => {
    const original = path === 'seer' ? createSeerState() : createClownState();
    expect(original.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
    expect(original.batches.map(batch => batch.id)).toEqual([1, 2, 3].map(number => `${path}-batch-${number}`));
    for (const [index, batch] of original.batches.entries()) {
      expect(batch.materials.map(({ name, quantity, unit }) => ({ name, quantity, unit }))).toEqual(formula.map(({ name, quantity, unit }) => ({ name, quantity, unit })));
      expect(batch.materials.every(material => material.holder === 'SUPPLIER')).toBe(true);
      expect(batch.materials.map(material => material.source)).toEqual(formula.map(material => path === 'seer'
        ? `占卜俱乐部备料第${index + 1}批${material.id === 'lava-octopus-blood' ? '，血液避光保存' : ''}`
        : `占卜俱乐部小丑备料第${index + 1}批`));
    }
  });

  it('never grants another round merely because weeks pass', () => {
    const s = state(path), before = structuredClone(s[path]);
    s.week += 20;
    expect(s[path]).toEqual(before);
    expect(project(s, path).actions.some(action => action.command.type === 'REQUEST_SUPPLY' || action.command.type === 'RECEIVE_SUPPLY')).toBe(false);
    reject(s, path, { type: 'REQUEST_SUPPLY' });
    reject(s, path, { type: 'RECEIVE_SUPPLY' });
    expect(valid(s)).toBe(true);
  });

  it('requires all three actual bottles to be consumed failures, including the last prepared bottle', () => {
    const s = state(path);
    for (let index = 0; index < 3; index += 1) {
      reject(s, path, { type: 'REQUEST_SUPPLY' });
      const bottleId = brew(s, path, index);
      reject(s, path, { type: 'REQUEST_SUPPLY' });
      apply(s, path, { type: 'CONSUME', bottleId, confirmed: true });
    }
    const offer = project(s, path).actions.find(action => action.command.type === 'REQUEST_SUPPLY');
    expect(offer?.enabled).toBe(true);
    expect(offer?.cost).toContain('1行动');
    expect(offer?.cost).toContain('下一个真实周');
    expect(s[path].batches).toHaveLength(3);
    expect(valid(s)).toBe(true);
  });

  it('charges one preparation action without granting stock, money, recovery or abilities', () => {
    const s = state(path);
    failRound(s, path);
    s.cash = 0;
    const before = structuredClone(s);
    apply(s, path, { type: 'REQUEST_SUPPLY' });
    expect(s.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(s[path].resupply).toEqual({ requestedWeek: s.week, deliveries: 0 });
    expect(s[path].batches).toEqual(before[path].batches);
    expect(s[path].bottles).toEqual(before[path].bottles);
    expect([s.cash, s.health, s.mind, s.spirituality, s.seer.pollution]).toEqual([before.cash, before.health, before.mind, before.spirituality, before.seer.pollution]);
    expect(s.character).toEqual(before.character);
    expect(s.progression).toEqual(before.progression);
    reject(s, path, { type: 'REQUEST_SUPPLY' });
    reject(s, path, { type: 'RECEIVE_SUPPLY' });
    const receive = project(s, path).actions.find(action => action.command.type === 'RECEIVE_SUPPLY');
    expect(receive?.enabled).toBe(false);
    expect(receive?.reason).toContain(`第${s.week + 1}周`);
    expect(receive?.cost).toContain('0行动');
    expect(valid(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
  });

  it('needs an available action for requesting but allows receipt at zero AP after the next real week', () => {
    const s = state(path);
    failRound(s, path);
    s.actionsRemaining = 0;
    reject(s, path, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 1;
    apply(s, path, { type: 'REQUEST_SUPPLY' });
    const old = structuredClone(s[path]);
    s.week += 1;
    expect(s[path].batches).toHaveLength(3);
    expect(project(s, path).actions.find(action => action.command.type === 'RECEIVE_SUPPLY')?.enabled).toBe(true);
    apply(s, path, { type: 'RECEIVE_SUPPLY' });
    expect(s.actionsRemaining).toBe(0);
    expect(s[path].resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(s[path].batches.slice(0, 3)).toEqual(old.batches);
    expect(s[path].bottles).toEqual(old.bottles);
    expect(s[path].batches.slice(3).map(batch => batch.id)).toEqual([4, 5, 6].map(number => `${path}-batch-${number}`));
    for (const batch of s[path].batches.slice(3)) {
      expect(batch).toMatchObject({ acquired: false, brewed: false, labourSteps: 0 });
      expect(batch.materials.map(item => item.quantity)).toEqual(formula.map(item => item.quantity));
      expect(batch.materials.every(material => material.holder === 'SUPPLIER')).toBe(true);
    }
    expect(new Set(s[path].batches.flatMap(batch => batch.materials.map(material => material.id))).size).toBe(42);
    reject(s, path, { type: 'RECEIVE_SUPPLY' });
    reject(s, path, { type: 'REQUEST_SUPPLY' });
    expect(valid(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
  });

  it('retains the original cash prices and makes the fourth batch consume its own seven inputs', () => {
    const s = delivered(path), cash = s.cash, ap = s.actionsRemaining;
    const old = structuredClone(s[path].batches.slice(0, 3));
    const bottleId = brew(s, path, 3), bottle = s[path].bottles.at(-1)!;
    expect(s.cash).toBe(cash - prices.mainMaterials - prices.auxiliaryMaterials - prices.brewing);
    expect(s.actionsRemaining).toBe(ap - 1);
    expect(bottle.id).toBe(`${path}-batch-4:bottle`);
    expect(bottle.inputIds).toEqual(formula.map(material => `${path}-batch-4:${material.id}`));
    expect(bottle.status).toBe('PREPARED');
    expect(s[path].batches[3]!.materials.every(material => material.quantity === 0 && material.holder === 'CONSUMED')).toBe(true);
    expect(s[path].batches.slice(0, 3)).toEqual(old);
    expect(project(s, path).bottles.find(candidate => candidate.id === bottleId)?.title).toContain('第4批');
    expect(project(s, path).actions.find(action => action.id === `consume-${bottleId}`)?.label).toContain('第4批');
    reject(s, path, { type: 'REQUEST_SUPPLY' });
    expect(valid(s)).toBe(true);
  });

  it(`requires all ${steps} real labour actions again for the new batch's main-material credit`, () => {
    const s = delivered(path), batchId = `${path}-batch-4`, ap = s.actionsRemaining, cash = s.cash;
    for (let index = 0; index < steps; index += 1) {
      apply(s, path, { type: 'MATERIAL_WORK', batchId });
      expect(s[path].batches[3]!.labourSteps).toBe(index + 1);
      expect(s[path].batches[3]!.materials.every(material => material.holder === 'SUPPLIER')).toBe(true);
      expect(project(s, path).actions.find(action => action.id === `buy-${batchId}`)?.cost).toContain(`${index + 1 === steps ? prices.auxiliaryMaterials : prices.mainMaterials + prices.auxiliaryMaterials}便士`);
    }
    reject(s, path, { type: 'MATERIAL_WORK', batchId });
    apply(s, path, { type: 'BUY_MATERIALS', batchId });
    apply(s, path, { type: 'BREW', batchId });
    expect(s.cash).toBe(cash - prices.auxiliaryMaterials - prices.brewing);
    expect(s.actionsRemaining).toBe(ap - steps - 1);
    expect(s[path].batches[4]!.labourSteps).toBe(0);
    expect(valid(s)).toBe(true);
  });

  it('can reach a third round after six failures without reusing IDs or skipping the second wait', () => {
    const s = delivered(path);
    failRound(s, path);
    const old = structuredClone(s[path]), week = s.week;
    apply(s, path, { type: 'REQUEST_SUPPLY' });
    reject(s, path, { type: 'RECEIVE_SUPPLY' });
    s.week += 1;
    apply(s, path, { type: 'RECEIVE_SUPPLY' });
    expect(s[path].resupply).toEqual({ requestedWeek: null, deliveries: 2 });
    expect(s.week).toBe(week + 1);
    expect(s[path].batches).toHaveLength(9);
    expect(s[path].batches.slice(0, 6)).toEqual(old.batches);
    expect(s[path].bottles).toEqual(old.bottles);
    expect(s[path].batches.slice(6).map(batch => batch.id)).toEqual([7, 8, 9].map(number => `${path}-batch-${number}`));
    expect(new Set(s[path].batches.flatMap(batch => batch.materials.map(material => material.id))).size).toBe(63);
    expect(valid(s)).toBe(true);
  });

  it('promotes normally from the fourth bottle, retains failed bottles, and closes the supply route', () => {
    const s = delivered(path), oldBottles = structuredClone(s[path].bottles);
    const stats = { ...s.character.coreStats }, ap = s.actionsRemaining;
    apply(s, path, { type: 'CONSUME', bottleId: brew(s, path, 3), confirmed: true }, 1);
    expect(s.progression.pathwayId).toBe('diviner');
    expect(s.progression.sequence).toBe(path === 'seer' ? 9 : 8);
    expect(s[path].bottles.slice(0, 3)).toEqual(oldBottles);
    expect(s[path].bottles[3]!.outcome).toBe('GREAT_SUCCESS');
    expect(s.actionsRemaining).toBe(ap - 1);
    expect(s.character.coreStats).toEqual(path === 'seer'
      ? { ...stats, perception: stats.perception + 3, will: stats.will + 2, knowledge: stats.knowledge + 3 }
      : { ...stats, physique: stats.physique + 6, perception: stats.perception + 4, will: stats.will + 2, knowledge: stats.knowledge + 1 });
    reject(s, path, { type: 'REQUEST_SUPPLY' });
    reject(s, path, { type: 'RECEIVE_SUPPLY' });
    expect(project(s, path).actions.some(action => action.command.type === 'REQUEST_SUPPLY' || action.command.type === 'RECEIVE_SUPPLY')).toBe(false);
    expect(valid(s)).toBe(true);
  });

  it('rejects mismatched delivery totals, replaced IDs, resurrected ingredients and missing failure evidence', () => {
    const baseline = delivered(path);
    for (const mutate of [
      (s: SliceState) => { s[path].resupply.deliveries = 0; },
      (s: SliceState) => { s[path].resupply.deliveries = 2; },
      (s: SliceState) => { s[path].resupply.deliveries = 0.5; },
      (s: SliceState) => { s[path].batches[3]!.id = `${path}-batch-1`; },
      (s: SliceState) => { s[path].batches[3]!.id = `${path}-batch-7`; },
      (s: SliceState) => { s[path].batches[0]!.materials[0]!.quantity = formula[0]!.quantity; },
      (s: SliceState) => { s[path].bottles[0]!.status = 'PREPARED'; s[path].bottles[0]!.outcome = null; },
      (s: SliceState) => { s[path].bottles.pop(); },
      (s: SliceState) => { s[path].resupply.requestedWeek = s.week; },
      (s: SliceState) => { s.week -= 1; },
    ]) {
      const invalid = structuredClone(baseline);
      mutate(invalid);
      expect(path === 'seer' ? validateSeerState(invalid) : validateClownState(invalid)).toBe(false);
    }
  });

  it('rejects backdated new bottles and request weeks instead of treating them as elapsed real weeks', () => {
    const s = delivered(path);
    brew(s, path, 3);
    s[path].bottles[3]!.brewedWeek -= 1;
    expect(path === 'seer' ? validateSeerState(s) : validateClownState(s)).toBe(false);
    const pending = state(path);
    failRound(pending, path);
    apply(pending, path, { type: 'REQUEST_SUPPLY' });
    pending[path].resupply.requestedWeek! -= 1;
    expect(path === 'seer' ? validateSeerState(pending) : validateClownState(pending)).toBe(false);
  });

  it('rejects malformed supply metadata without throwing during save validation', () => {
    const s = state(path);
    for (const malformed of [undefined, null, {}, { requestedWeek: null, deliveries: -1 }, { requestedWeek: 'next week', deliveries: 0 }, { requestedWeek: null, deliveries: 0, extra: true }]) {
      const invalid = structuredClone(s);
      (invalid[path] as unknown as Record<string, unknown>).resupply = malformed;
      expect(() => path === 'seer' ? validateSeerState(invalid) : validateClownState(invalid)).not.toThrow();
      expect(path === 'seer' ? validateSeerState(invalid) : validateClownState(invalid)).toBe(false);
    }
  });
});
