import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { AUDIENCE_ABILITY_IDS } from '../../src/domain/audience/types.js';
import { MINDREADER_ABILITY_IDS } from '../../src/domain/mindreader/types.js';
import { PSYCHOLOGIST_ABILITY_IDS } from '../../src/domain/psychologist/types.js';
import { HYPNOTIST_ABILITY_IDS } from '../../src/domain/hypnotist/types.js';
import { applyDreamwalkerCommand, createDreamwalkerState, projectDreamwalker, validateDreamwalkerCommand, validateDreamwalkerState } from '../../src/domain/dreamwalker/index.js';
import { DREAMWALKER_ABILITY_IDS, type DreamwalkerAcquisitionCommand } from '../../src/domain/dreamwalker/types.js';
import { DREAMWALKER_FEATHER_ID, DREAMWALKER_FORMULA_STATUS, DREAMWALKER_SOURCE_STATUS } from '../../src/domain/dreamwalker/content.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

/** Prior S6 is an explicit domain fixture; this does not claim a natural full-path playthrough. */
function hypnotist(): SliceState {
  const s = createSliceRun('dreamwalker-acquisition-fixture', sliceDefaultCreationSelection, 'dreamwalker-fixture');
  s.activeEvent = null; s.eventQueue = []; s.week = 43; s.cash = 50000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.world.city = 'BACKLUND';
  s.audience.discovered = true; s.audience.formulaKnown = true; s.mindreader.formulaKnown = true;
  s.psychologist.guidanceKnown = true; s.psychologist.promotionWeek = 19;
  s.hypnotist.guidanceKnown = true; s.hypnotist.promotionWeek = 31;
  s.progression.pathwayId = 'audience'; s.progression.sequence = 6; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...AUDIENCE_ABILITY_IDS, ...MINDREADER_ABILITY_IDS, ...PSYCHOLOGIST_ABILITY_IDS, ...HYPNOTIST_ABILITY_IDS].map((id, index) => [id, index + 12]));
  s.character.coreStats.will = 25; s.dreamwalker = createDreamwalkerState(); return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: DreamwalkerAcquisitionCommand, roll = 1) { const c = context(s, roll); applyDreamwalkerCommand(s, command, c); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyDreamwalkerCommand(s, command as DreamwalkerAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}
function taught() { const s = hypnotist(); apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.dreamwalker.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
function visit(s: SliceState) { apply(s, { type: 'REQUEST_RITUAL' }); s.week += 1; apply(s, { type: 'BEGIN_RITUAL' }); }

describe('Dreamwalker finite originals and mandatory real bird-spirit visit', () => {
  it('prepares only actual originals, charges 460 guidance and 600 after five per-bottle labours', () => {
    const s = hypnotist(), original = structuredClone(s.hypnotist), other = createDreamwalkerState();
    expect(validateDreamwalkerState(s)).toBe(true);
    other.bottles[0]!.labourSteps = 5; other.ritual.visits.push({ id: 1, requestedWeek: 43, startedWeek: 44, endedWeek: null, contractConfirmed: true, participantPresent: true, emotionPrepared: true, featherReturned: false, consumedBottleId: null, awakened: false });
    expect(s.dreamwalker.bottles[0]!.labourSteps).toBe(0); expect(s.dreamwalker.ritual.visits).toEqual([]);
    apply(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([49540, 99]);
    expect(projectDreamwalker(s)).toMatchObject({ formulaKnown: false, formula: [], practice: null });
    expect(DREAMWALKER_FORMULA_STATUS).toContain('尚未核实'); expect(DREAMWALKER_SOURCE_STATUS).toContain('第五部第69章');
    const bottle = s.dreamwalker.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    reject(s, { type: 'POTION_WORK', bottleId: bottle.id }); buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([48940, 94, 'PLAYER']);
    expect(s.dreamwalker.bottles[1]!.labourSteps).toBe(0); expect(s.hypnotist).toEqual(original);
    expect(validateDreamwalkerState(s)).toBe(true);
  });
  it('requires a previous-week appointment, actual autonomous participant, original feather and strong emotion', () => {
    const s = taught(), b = buy(s), dose = { type: 'CONSUME', bottleId: b.id, confirmed: true } as const;
    reject(s, dose); apply(s, { type: 'REQUEST_RITUAL' }); reject(s, { type: 'BEGIN_RITUAL' });
    s.week += 1; const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'BEGIN_RITUAL' });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 120, ap - 1]);
    expect(s.dreamwalker.ritual).toMatchObject({ requestedWeek: null, contractAcceptedWeek: s.week, featherHolder: 'PLAYER', activeVisitId: 1 });
    const v = s.dreamwalker.ritual.visits[0]!;
    for (const field of ['participantPresent', 'contractConfirmed', 'emotionPrepared'] as const) { v[field] = false; reject(s, dose); v[field] = true; }
    s.dreamwalker.ritual.featherHolder = 'LINGWEI'; reject(s, dose); s.dreamwalker.ritual.featherHolder = 'PLAYER';
    expect(projectDreamwalker(s).ritual.feather).toContain(DREAMWALKER_FEATHER_ID); expect(validateDreamwalkerState(s)).toBe(true);
  });
  it('keeps preparation separate from acting, twelve full weeks and strict survivable pre-dose thresholds', () => {
    const s = taught(), b = buy(s); s.hypnotist.promotionWeek = 33; visit(s);
    const dose = { type: 'CONSUME', bottleId: b.id, confirmed: true } as const;
    reject(s, dose); s.hypnotist.promotionWeek = 32; s.progression.acting = 99; reject(s, dose); s.progression.acting = 100;
    s.health = 20; reject(s, dose); s.health = 21; s.mind = 40; reject(s, dose); s.mind = 41;
    apply(s, dose, 100); expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 6]);
    s.actionsRemaining = 0; apply(s, { type: 'END_RITUAL' });
    expect(s.dreamwalker.ritual.featherHolder).toBe('LINGWEI'); expect(s.dreamwalker.ritual.visits[0]!.awakened).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [90, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const)('records recoverable tier %s, actual waking, unchanged old mastery and no S refill', (roll, tier, mind, health, pollution, sequence) => {
    const s = taught(), b = buy(s), inherited = { ...s.progression.mastery }, old = structuredClone(s.hypnotist), stats = { ...s.character.coreStats };
    visit(s); const c = apply(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
    expect(c.check).toHaveBeenCalledWith('will', 26); expect(b.outcome).toBe(tier);
    expect([s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality]).toEqual([mind, health, pollution, sequence, 31]);
    expect(s.hypnotist).toEqual(old); for (const [id, value] of Object.entries(inherited)) expect(s.progression.mastery[id]).toBe(value);
    expect(s.dreamwalker.ritual.visits[0]).toMatchObject({ consumedBottleId: b.id, awakened: true, featherReturned: false });
    if (sequence === 5) {
      expect(DREAMWALKER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0, 0]); expect(s.dreamwalker.hypnotistActingAtPromotion).toBe(100);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    } else expect(s.progression.acting).toBe(100);
    expect(validateDreamwalkerState(s)).toBe(true); s.actionsRemaining = 0; apply(s, { type: 'END_RITUAL' });
    expect(validateDreamwalkerState(s)).toBe(true); expect(s.dreamwalker.ritual).toMatchObject({ activeVisitId: null, featherHolder: 'LINGWEI' });
  });
  it('returns the same feather on cancellation without spending a bottle or refunding the room', () => {
    const s = taught(), b = buy(s); visit(s); const cash = s.cash, accepted = s.dreamwalker.ritual.contractAcceptedWeek;
    s.actionsRemaining = 0; s.health = 0; s.mind = 0; apply(s, { type: 'END_RITUAL' });
    expect([s.cash, b.status, b.outcome]).toEqual([cash, 'PLAYER', null]);
    expect(s.dreamwalker.ritual.visits[0]).toMatchObject({ featherReturned: true, participantPresent: false, consumedBottleId: null, awakened: false });
    s.actionsRemaining = 10; s.health = 100; s.mind = 100; visit(s);
    expect(s.dreamwalker.ritual.contractAcceptedWeek).toBe(accepted); expect(s.dreamwalker.ritual.visits).toHaveLength(2);
    expect(validateDreamwalkerState(s)).toBe(true);
  });
  it('uses one bottle per visit and replenishes only after three real failures and a later week', () => {
    const s = taught(); for (let i = 0; i < 3; i++) buy(s, i);
    for (let i = 0; i < 3; i++) {
      visit(s); apply(s, { type: 'CONSUME', bottleId: s.dreamwalker.bottles[i]!.id, confirmed: true }, 100);
      if (i < 2) reject(s, { type: 'CONSUME', bottleId: s.dreamwalker.bottles[i + 1]!.id, confirmed: true });
      reject(s, { type: 'REQUEST_RITUAL' }); apply(s, { type: 'END_RITUAL' }); s.health = 100; s.mind = 100;
      if (i < 2) reject(s, { type: 'REQUEST_SUPPLY' });
    }
    const previous = structuredClone(s.dreamwalker.bottles); apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.dreamwalker.bottles).toHaveLength(6); expect(s.dreamwalker.bottles.slice(0, 3)).toEqual(previous);
    expect(s.dreamwalker.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null)).toBe(true);
    expect(s.dreamwalker.ritual.visits).toHaveLength(3); expect(validateDreamwalkerState(s)).toBe(true);
  });
  it('rejects fabricated ritual and bottle histories plus formula, duplicated feather and unconfirmed commands', () => {
    const s = taught(), b = buy(s); visit(s); apply(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    const missingWake = structuredClone(s); missingWake.dreamwalker.ritual.visits[0]!.awakened = false; expect(validateDreamwalkerState(missingWake)).toBe(false);
    const instant = structuredClone(s); instant.dreamwalker.ritual.visits[0]!.requestedWeek = instant.week; expect(validateDreamwalkerState(instant)).toBe(false);
    const absent = structuredClone(s); absent.dreamwalker.ritual.visits = []; expect(validateDreamwalkerState(absent)).toBe(false);
    expect(validateDreamwalkerCommand({ type: 'BEGIN_RITUAL', extraFeather: true })).toBe(false);
    expect(validateDreamwalkerCommand({ type: 'CONSUME', bottleId: b.id, confirmed: false })).toBe(false);
    expect(validateDreamwalkerCommand({ type: 'BREW' })).toBe(false);
  });
});
