import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyCultivatorCommand } from '../../src/domain/cultivator/index.js';
import { CULTIVATOR_ABILITY_IDS } from '../../src/domain/cultivator/types.js';
import { applyPhysicianCommand } from '../../src/domain/physician/index.js';
import { PHYSICIAN_ABILITY_IDS } from '../../src/domain/physician/types.js';
import { applyHarvestpriestCommand } from '../../src/domain/harvestpriest/index.js';
import { HARVESTPRIEST_ABILITY_IDS } from '../../src/domain/harvestpriest/types.js';
import { applyBiologistCommand, createBiologistState, projectBiologist, validateBiologistCommand, validateBiologistState } from '../../src/domain/biologist/index.js';
import { applyBiologistActivity } from '../../src/domain/biologist/life.js';
import { hasBiologistDisputeOpponent, settleBiologistEncounter } from '../../src/domain/biologist/encounter.js';
import { BIOLOGIST_FORMULA_STATUS, BIOLOGIST_SOURCE_STATUS } from '../../src/domain/biologist/content.js';
import { BIOLOGIST_ABILITY_IDS, BIOLOGIST_CASE_IDS, type BiologistAcquisitionCommand, type BiologistActivityCommand, type BiologistCaseId } from '../../src/domain/biologist/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('biologist-stage', sliceDefaultCreationSelection, 'biologist-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.biologist = createBiologistState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => { if (s.seer.completedSources.includes(source)) return; s.seer.completedSources.push(source); s.progression.mastery[BIOLOGIST_ABILITY_IDS[0]]! += amount; });
  return { c, award };
}
/** Prior acting is a completed-history fixture; every original bottle is acquired through its real command. */
function harvestpriest(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyCultivatorCommand(s, { type: 'DISCOVER' }, c); applyCultivatorCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyCultivatorCommand(s, { type: 'BUY_POTION', bottleId: s.cultivator.bottles[0]!.id }, c); applyCultivatorCommand(s, { type: 'CONSUME', bottleId: s.cultivator.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyPhysicianCommand(s, { type: 'LEARN_GUIDANCE' }, c); applyPhysicianCommand(s, { type: 'BUY_POTION', bottleId: s.physician.bottles[0]!.id }, c); applyPhysicianCommand(s, { type: 'CONSUME', bottleId: s.physician.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyHarvestpriestCommand(s, { type: 'LEARN_GUIDANCE' }, c); applyHarvestpriestCommand(s, { type: 'BUY_POTION', bottleId: s.harvestpriest.bottles[0]!.id }, c); applyHarvestpriestCommand(s, { type: 'CONSUME', bottleId: s.harvestpriest.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...CULTIVATOR_ABILITY_IDS, ...PHYSICIAN_ABILITY_IDS, ...HARVESTPRIEST_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25; s.character.coreStats.knowledge = 25;
  return s;
}
function acquisition(s: SliceState, command: BiologistAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyBiologistCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: BiologistActivityCommand, roll = 1) { const ctx = context(s, roll); applyBiologistActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = harvestpriest()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.biologist.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.biologist.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyBiologistCommand(s, command as BiologistAcquisitionCommand, ctx.c)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); }
function rejectActivity(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyBiologistActivity(s, command as BiologistActivityCommand, ctx.c, ctx.award)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled(); }
describe('Biologist independent S6 originals, guidance and promotion', () => {
  it('hides the undiscovered channel and creates no formula or supply', () => {
    const s = ordinary(), other = createBiologistState();
    expect(validateBiologistState(s)).toBe(true);
    expect(projectBiologist(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: { sampleRecorded: false, warningsRecorded: false } });
    expect(projectBiologist(s).story).toBeUndefined(); other.bottles[0]!.labourSteps = 5; expect(s.biologist.bottles[0]!.labourSteps).toBe(0);
    expect(BIOLOGIST_FORMULA_STATUS).toContain('尚未核实'); expect(BIOLOGIST_SOURCE_STATUS).toContain('长期研究'); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 360p and one AP for guidance, without inventing resources or a complete recipe', () => {
    const s = harvestpriest(), cash = s.cash, ap = s.actionsRemaining, oldHarvestpriest = structuredClone(s.harvestpriest);
    acquisition(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([cash - 360, ap - 1]); expect(s.harvestpriest).toEqual(oldHarvestpriest);
    expect(projectBiologist(s)).toMatchObject({ guidanceKnown: true, formulaKnown: false, formula: [] }); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' }); expect(validateBiologistState(s)).toBe(true);
  });
  it('charges five bottle-specific labours then 320p without transfer, refund or partial credit', () => {
    const s = taught(), [first, second] = s.biologist.bottles, cash = s.cash, ap = s.actionsRemaining;
    for (let n = 0; n < 5; n += 1) acquisition(s, { type: 'POTION_WORK', bottleId: first!.id });
    expect(s.cash).toBe(cash); expect(s.actionsRemaining).toBe(ap - 5); rejectAcquisition(s, { type: 'POTION_WORK', bottleId: first!.id });
    buy(s); expect(s.cash).toBe(cash - 320); expect(second!.labourSteps).toBe(0); rejectAcquisition(s, { type: 'BUY_POTION', bottleId: first!.id }); expect(validateBiologistState(s)).toBe(true);
  });
  it('requires actual original, separate confirmation, consumed100 and twelve complete Harvestpriest weeks', () => {
    const s = taught(); rejectAcquisition(s, { type: 'CONSUME', bottleId: s.biologist.bottles[0]!.id, confirmed: true }); buy(s);
    rejectAcquisition(s, { type: 'CONSUME', bottleId: s.biologist.bottles[0]!.id, confirmed: false });
    s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: s.biologist.bottles[0]!.id, confirmed: true }); s.progression.acting = 100;
    s.week -= 1; rejectAcquisition(s, { type: 'CONSUME', bottleId: s.biologist.bottles[0]!.id, confirmed: true }); s.week += 1;
    acquisition(s, { type: 'CONSUME', bottleId: s.biologist.bottles[0]!.id, confirmed: true }); expect(validateBiologistState(s)).toBe(true);
  });
  it.each([{ roll: 1, mind: 95 }, { roll: 30, mind: 90 }])('promotes at roll $roll preserving all original mastery without gifting resources', ({ roll, mind }) => {
    const s = prepared(), old = structuredClone(s.progression.mastery), stats = { ...s.character.coreStats }, spirituality = s.spirituality;
    acquisition(s, { type: 'CONSUME', bottleId: s.biologist.bottles[0]!.id, confirmed: true }, roll);
    expect(s.progression).toMatchObject({ pathwayId: 'mother', sequence: 6, acting: 0, mastery: { ...old, 'mother.s6.specimen-study': 0, 'mother.s6.controlled-trial': 0 } });
    expect(s.biologist).toMatchObject({ promotionWeek: 31, harvestpriestActingAtPromotion: 100 }); expect([s.mind, s.spirituality]).toEqual([mind, spirituality]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    rejectAcquisition(s, { type: 'BUY_POTION', bottleId: s.biologist.bottles[1]!.id }); expect(validateBiologistState(s)).toBe(true);
  });
  it.each([{ roll: 80, mind: 80, health: 90, pollution: 25 }, { roll: 100, mind: 60, health: 80, pollution: 50 }])('keeps failed roll $roll recoverable while spending exactly the selected original', ({ roll, mind, health, pollution }) => {
    const s = prepared(), old = structuredClone(s.progression); acquisition(s, { type: 'CONSUME', bottleId: s.biologist.bottles[0]!.id, confirmed: true }, roll);
    expect(s.progression).toEqual(old); expect([s.mind, s.health, s.seer.pollution, s.status]).toEqual([mind, health, pollution, 'ACTIVE']); expect(s.biologist.bottles[0]!.status).toBe('CONSUMED'); expect(validateBiologistState(s)).toBe(true);
  });
  it('requires all originals to fail, one request AP and the next real week before a paid new batch', () => {
    const s = taught(); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    for (let i = 0; i < 3; i += 1) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 80); }
    const ap = s.actionsRemaining; acquisition(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
    s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' }); expect(s.biologist.bottles).toHaveLength(6); expect(s.biologist.bottles[3]!).toMatchObject({ id: 'biologist-potion-4', status: 'SUPPLIER', labourSteps: 0 }); expect(validateBiologistState(s)).toBe(true);
    const forged = structuredClone(s); forged.biologist.bottles[3]!.source = forged.biologist.bottles[0]!.source; expect(validateBiologistState(forged)).toBe(false);
  });
});

describe('Biologist strict command and original-source boundaries', () => {
  it('accepts only paired-seedling VERIFY and rejects malformed commands before spending', () => {
    const s = promoted();
    expect(validateBiologistCommand({ type: 'VERIFY', caseId: 'paired-seedling' })).toBe(true);
    for (const c of [{ type: 'VERIFY', caseId: 'sample-record' }, { type: 'PREPARE', caseId: 'paired-seedling', method: 'ABILITY', free: true }, { type: 'BUY_WATER', quantity: 20 }, { type: 'COMPOSE' }]) {
      expect(validateBiologistCommand(c)).toBe(false); rejectActivity(s, c);
    }
    rejectAcquisition(s, { type: 'CONSUME', bottleId: 'harvestpriest-potion-1', confirmed: true });
  });
  it('rejects forged trial, practice, rewards and original provenance', () => {
    const s = promoted();
    const mutations: ((v: SliceState) => void)[] = [
      v => { v.biologist.trial.status = 'VERIFIED'; },
      v => { v.biologist.trial.waterUsed = 1; },
      v => { v.biologist.practice.sampleRecorded = true; },
      v => { v.progression.acting = 25; },
      v => { v.biologist.bottles[0]!.source = 'conjured bottle'; },
      v => { (v.biologist as unknown as Record<string, unknown>).practice = []; },
      v => { (v.biologist as unknown as Record<string, unknown>).trial = null; },
    ];
    for (const mutate of mutations) { const forged = structuredClone(s); mutate(forged); expect(validateBiologistState(forged)).toBe(false); }
  });
});
