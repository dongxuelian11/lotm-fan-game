import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { SEER_ABILITY_IDS } from '../../src/domain/seer/types.js';
import { CLOWN_ABILITY_IDS } from '../../src/domain/clown/types.js';
import { MAGICIAN_ABILITY_IDS } from '../../src/domain/magician/types.js';
import { FACELESS_ABILITY_IDS } from '../../src/domain/faceless/types.js';
import { MARIONETTIST_ABILITY_IDS } from '../../src/domain/marionettist/types.js';
import { BIZARRO_SORCERER_ABILITY_IDS, type BizarroSorcererAcquisitionCommand } from '../../src/domain/bizarro-sorcerer/types.js';
import { applyBizarroSorcererAcquisition, createBizarroSorcererState, projectBizarroSorcerer, validateBizarroSorcererCommand, validateBizarroSorcererState } from '../../src/domain/bizarro-sorcerer/index.js';
import { BIZARRO_SORCERER_FORMULA, BIZARRO_SORCERER_FORMULA_SOURCE } from '../../src/domain/bizarro-sorcerer/content.js';
import { handleBizarroRitualCommand, settleBizarroRitual, type BizarroRitualCommand } from '../../src/domain/bizarro-sorcerer/ritual.js';
import { resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

/** Explicit S5 unit fixture. Directed combat below is DIRECTED_RANDOM_NOT_NATURAL. */
function marionettist(): SliceState {
  const s = createSliceRun('bizarro-acquisition-fixture', sliceDefaultCreationSelection, 'bizarro-acquisition');
  s.activeEvent = null; s.eventQueue = []; s.week = 55; s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 100; s.world.city = 'BACKLUND'; s.arc.stage = 'ENDED';
  s.world.carrierAlive = false; s.world.carrierCanResist = false; s.town.clubLocation = 'SHOP';
  s.seer.discovered = true; s.marionettist.formulaKnown = true; s.marionettist.promotionWeek = 43;
  s.progression.pathwayId = 'diviner'; s.progression.sequence = 5; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...SEER_ABILITY_IDS, ...CLOWN_ABILITY_IDS, ...MAGICIAN_ABILITY_IDS, ...FACELESS_ABILITY_IDS, ...MARIONETTIST_ABILITY_IDS].map((id, i) => [id, i + 12]));
  s.character.coreStats.will = 28; s.bizarroSorcerer = createBizarroSorcererState();
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: BizarroSorcererAcquisitionCommand, roll = 1) { const c = context(s, roll); applyBizarroSorcererAcquisition(s, command, c); return c; }
function reject(s: SliceState, command: unknown) { const before = structuredClone(s), c = context(s); expect(() => applyBizarroSorcererAcquisition(s, command as BizarroSorcererAcquisitionCommand, c)).toThrow(); expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); }
function taught() { const s = marionettist(); apply(s, { type: 'LEARN_FORMULA' }); return s; }
function brew(s: SliceState, index = 0) { const batchId = s.bizarroSorcerer.batches[index]!.id; apply(s, { type: 'BUY_MATERIALS', batchId }); apply(s, { type: 'BREW', batchId }); return s.bizarroSorcerer.bottles.at(-1)!; }
function ritual(s: SliceState, command: BizarroRitualCommand) { const result = handleBizarroRitualCommand(s, command); expect(result.error).toBeUndefined(); }
/** Real shared rounds establish the actual body/death evidence, never a prewritten victory flag. */
function finale(s: SliceState, bottleId: string, index = 0) {
  const targetId = s.bizarroSorcerer.ritual.targets[index]!.id;
  if (s.week < s.bizarroSorcerer.ritual.earliestSurveyWeek) s.week = s.bizarroSorcerer.ritual.earliestSurveyWeek;
  ritual(s, { type: 'SURVEY_RITUAL', targetId }); ritual(s, { type: 'PREPARE_STAGE' }); s.week += 1;
  ritual(s, { type: 'GATHER_WITNESSES' });
  // Explicit original-oil fixture preparation, not a natural resource acquisition claim.
  s.magician.lantern.oilStock -= 1; s.magician.lantern.oilSpent += 1; s.magician.lantern.lastSupplyWeek = s.week; s.magician.lantern.prepared = true;
  ritual(s, { type: 'START_RITUAL', bottleId, confirmed: true });
  const original = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) { original.call(this, min, max); return min; });
  try {
    for (let round = 0; round < 32 && s.combat; round++) {
      const result = resolveSliceCombatRound(s, 'ATTACK'); s.combatHistory.push(structuredClone(result.round));
      settleBizarroRitual(s, result.outcome, context(s));
    }
  } finally { spy.mockRestore(); }
  expect(s.bizarroSorcerer.ritual.phase).toBe('FINALE'); expect(s.bizarroSorcerer.ritual.targets[index]!.status).toBe('DEAD');
}
afterEach(() => vi.restoreAllMocks());

describe('Bizarro Sorcerer original seven-material acquisition and real finale', () => {
  it('keeps three independent seven-material batches and unmeasured canon main amounts', () => {
    const s = marionettist(); expect(validateBizarroSorcererState(s)).toBe(true);
    expect(BIZARRO_SORCERER_FORMULA.map(m => m.quantity)).toEqual([null, null, 200, 30, 10, 1, 1]);
    expect(BIZARRO_SORCERER_FORMULA_SOURCE).toContain('第四部第113章');
    expect(s.bizarroSorcerer.batches.map(b => b.materials.length)).toEqual([7, 7, 7]);
    expect(new Set(s.bizarroSorcerer.batches.flatMap(b => b.materials.map(m => m.id))).size).toBe(21);
    createBizarroSorcererState().batches[0]!.materials[0]!.quantity = 0;
    expect(s.bizarroSorcerer.batches[0]!.materials[0]!.quantity).toBe(1);
    apply(s, { type: 'LEARN_FORMULA' }); expect(s.cash).toBe(99500);
    expect(projectBizarroSorcerer(s).formula.map(m => m.quantity)).toEqual([null, null, 200, 30, 10, 1, 1]);
    expect(projectBizarroSorcerer(s).formula[0]!.note).toContain('G每批供货1份');
  });
  it('uses five real batch labour actions, then pays auxiliaries320 and brew120', () => {
    const s = taught(), batchId = s.bizarroSorcerer.batches[0]!.id, start = s.cash, ap = s.actionsRemaining;
    for (let i = 0; i < 5; i++) apply(s, { type: 'MATERIAL_WORK', batchId });
    expect(s.cash).toBe(start); expect(s.actionsRemaining).toBe(ap - 5); expect(s.bizarroSorcerer.batches[1]!.labourSteps).toBe(0);
    reject(s, { type: 'MATERIAL_WORK', batchId }); apply(s, { type: 'BUY_MATERIALS', batchId }); expect(s.cash).toBe(start - 320);
    apply(s, { type: 'BREW', batchId }); expect(s.cash).toBe(start - 440);
    expect(s.bizarroSorcerer.batches[0]!.materials.every(m => m.quantity === 0 && m.holder === 'CONSUMED')).toBe(true);
    expect(s.bizarroSorcerer.bottles[0]).toMatchObject({ status: 'PREPARED', outcome: null, consumedWeek: null, ritualAttemptId: null });
    reject(s, { type: 'BREW', batchId }); expect(validateBizarroSorcererState(s)).toBe(true);
  });
  it('does not discount incomplete labour or copy costs across batches', () => {
    const s = taught(), batchId = s.bizarroSorcerer.batches[0]!.id;
    for (let i = 0; i < 4; i++) apply(s, { type: 'MATERIAL_WORK', batchId });
    const cash = s.cash; apply(s, { type: 'BUY_MATERIALS', batchId }); expect(s.cash).toBe(cash - 5320);
    reject(s, { type: 'MATERIAL_WORK', batchId }); expect(s.bizarroSorcerer.batches[1]!.labourSteps).toBe(0);
  });
  it('rejects mixed original inputs, wrong amounts and non-exact commands without mutation', () => {
    const s = taught(), batchId = s.bizarroSorcerer.batches[0]!.id; apply(s, { type: 'BUY_MATERIALS', batchId });
    s.bizarroSorcerer.batches[0]!.materials[2]!.quantity = 201; reject(s, { type: 'BREW', batchId }); expect(validateBizarroSorcererState(s)).toBe(false);
    expect(validateBizarroSorcererCommand({ type: 'CONSUME_FINALE', bottleId: `${batchId}:bottle`, confirmed: false })).toBe(false);
    expect(validateBizarroSorcererCommand({ type: 'LEARN_FORMULA', hiddenVictory: true })).toBe(false);
    expect(validateBizarroSorcererCommand({ type: 'CONSUME', bottleId: `${batchId}:bottle`, confirmed: true })).toBe(false);
  });
  it('cannot drink an idle bottle or a counterfeit finale, and preserves old prepared contact', () => {
    const s = taught(), b = brew(s), dose = { type: 'CONSUME_FINALE', bottleId: b.id, confirmed: true } as const;
    reject(s, dose); s.bizarroSorcerer.ritual.phase = 'FINALE'; reject(s, dose); expect(validateBizarroSorcererState(s)).toBe(false);
    s.bizarroSorcerer.ritual.phase = 'UNSEEN'; s.marionettist.cases['living-lines'].status = 'PREPARED'; reject(s, { type: 'BUY_MATERIALS', batchId: s.bizarroSorcerer.batches[1]!.id });
  });
  it('requires prior digestion, twelve weeks, actual current original bottle and viable body at finale', () => {
    const s = taught(), b = brew(s), other = brew(s, 1); finale(s, b.id);
    const dose = { type: 'CONSUME_FINALE', bottleId: b.id, confirmed: true } as const;
    reject(s, { ...dose, bottleId: other.id }); s.progression.acting = 99; reject(s, dose); s.progression.acting = 100;
    s.marionettist.promotionWeek = s.week - 11; reject(s, dose); s.marionettist.promotionWeek = 43;
    s.health = 20; reject(s, dose); s.health = 100; s.mind = 40; reject(s, dose); s.mind = 100;
    expect(validateBizarroSorcererState(s)).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0], [30, 'SUCCESS', 85, 100, 0], [90, 'FAILURE', 75, 85, 30], [100, 'GREAT_FAILURE', 55, 75, 60]] as const)('applies exact four-tier risk %s and retains every original death and old mastery', (roll, tier, mind, health, pollution) => {
    const s = taught(), b = brew(s); finale(s, b.id);
    const old = structuredClone(s.marionettist), body = structuredClone(s.bizarroSorcerer.ritual.targets[0]), mastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, sp = s.spirituality;
    s.actionsRemaining = 0; const c = apply(s, { type: 'CONSUME_FINALE', bottleId: b.id, confirmed: true }, roll);
    expect(c.check).toHaveBeenCalledWith('will', 28); expect(b.outcome).toBe(tier);
    expect([s.mind, s.health, s.seer.pollution, s.spirituality, s.actionsRemaining]).toEqual([mind, health, pollution, sp, 0]);
    expect(s.marionettist).toEqual(old); expect(s.bizarroSorcerer.ritual.targets[0]).toEqual(body); expect(s.bizarroSorcerer.ritual.phase).toBe('CLOSED');
    for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
    if (roll <= 30) { expect(s.progression.sequence).toBe(4); expect(BIZARRO_SORCERER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]); expect(s.bizarroSorcerer.marionettistActingAtPromotion).toBe(100); for (const id of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[id]).toBe(stats[id] + 1); }
    else expect(s.progression.sequence).toBe(5);
    expect(validateBizarroSorcererState(s)).toBe(true); reject(s, { type: 'CONSUME_FINALE', bottleId: b.id, confirmed: true });
  });
  it('uses explicit G potion-only aftercare floor1 at the approved boundary', () => {
    const s = taught(), b = brew(s); finale(s, b.id); s.health = 21; s.mind = 41;
    apply(s, { type: 'CONSUME_FINALE', bottleId: b.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 5]);
    expect(s.bizarroSorcerer.ritual.targets[0]!.status).toBe('DEAD');
  });
  it('allows zero-action abandonment without consuming a bottle or reopening the original death', () => {
    const s = taught(), b = brew(s); finale(s, b.id); s.actionsRemaining = 0;
    ritual(s, { type: 'CLOSE_RITUAL' }); expect(b.status).toBe('PREPARED'); expect(s.progression.sequence).toBe(5);
    reject(s, { type: 'CONSUME_FINALE', bottleId: b.id, confirmed: true }); expect(s.bizarroSorcerer.ritual.targets[0]!.status).toBe('DEAD');
  });
  it('requires another real target after failure and a real-week delivery after three failures', () => {
    const s = taught();
    for (let i = 0; i < 3; i++) {
      const b = brew(s, i); finale(s, b.id, i); apply(s, { type: 'CONSUME_FINALE', bottleId: b.id, confirmed: true }, 100);
      s.health = 100; s.mind = 100; s.spirituality = 100;
      if (i < 2) reject(s, { type: 'REQUEST_SUPPLY' });
    }
    const dead = structuredClone(s.bizarroSorcerer.ritual.targets);
    apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.bizarroSorcerer.batches).toHaveLength(6); expect(s.bizarroSorcerer.bottles).toHaveLength(3);
    expect(s.bizarroSorcerer.batches.slice(3).every(b => !b.acquired && !b.brewed && b.labourSteps === 0)).toBe(true);
    expect(s.bizarroSorcerer.ritual.targets).toEqual(dead); expect(validateBizarroSorcererState(s)).toBe(true);
  });
  it('rejects a consumed bottle detached from its original murder and corrupted nested state safely', () => {
    const s = taught(), b = brew(s); finale(s, b.id); apply(s, { type: 'CONSUME_FINALE', bottleId: b.id, confirmed: true });
    const detached = structuredClone(s); detached.bizarroSorcerer.bottles[0]!.ritualAttemptId = 'imaginary-death'; expect(validateBizarroSorcererState(detached)).toBe(false);
    const missing = structuredClone(s); (missing.bizarroSorcerer as unknown as Record<string, unknown>).ritual = null; expect(validateBizarroSorcererState(missing)).toBe(false);
    const substituted = structuredClone(s); substituted.bizarroSorcerer.bottles[0]!.inputIds[0] = 'copied-main-eye'; expect(validateBizarroSorcererState(substituted)).toBe(false);
    const unseen = structuredClone(s); unseen.bizarroSorcerer.ritual.attempts[0]!.deathWitnessIds.pop(); expect(validateBizarroSorcererState(unseen)).toBe(false);
  });
});
