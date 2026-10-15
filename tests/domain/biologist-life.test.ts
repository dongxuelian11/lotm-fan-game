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
import { applyBiologistActivity, biologistActions, biologistCases, biologistInside } from '../../src/domain/biologist/life.js';
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
function begin(s: SliceState, caseId: BiologistCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method });
}
function sampleReport(s: SliceState, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  begin(s, 'sample-record', method); activity(s, { type: 'PERFORM', caseId: 'sample-record' });
  activity(s, { type: 'CLOSE', caseId: 'sample-record' }); activity(s, { type: 'REPORT', caseId: 'sample-record' });
}
function waiting(method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const s = promoted(); sampleReport(s, method); activity(s, { type: 'BUY_WATER' }); begin(s, 'paired-seedling', method);
  activity(s, { type: 'PERFORM', caseId: 'paired-seedling' }); activity(s, { type: 'CLOSE', caseId: 'paired-seedling' }); return s;
}
function verified() { const s = waiting(); s.week += 1; activity(s, { type: 'VERIFY', caseId: 'paired-seedling' }); activity(s, { type: 'REPORT', caseId: 'paired-seedling' }); return s; }

describe('Biologist original-water, actual next-week verification and safe return', () => {
  it.each(['ABILITY', 'ORDINARY'] as const)('uses one original water and explicit next-week verification with %s', method => {
    const s = promoted(); sampleReport(s, method);
    const cash = s.cash; activity(s, { type: 'BUY_WATER' }); expect(s.cash).toBe(cash - 30);
    expect(s.harvestpriest.plot).toMatchObject({ water: 2, waterUsed: 0, waterPacks: 1 }); rejectActivity(s, { type: 'BUY_WATER' });
    begin(s, 'paired-seedling', method); const sp = s.spirituality, ap = s.actionsRemaining;
    activity(s, { type: 'PERFORM', caseId: 'paired-seedling' });
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, sp - (method === 'ABILITY' ? 3 : 0)]);
    expect(s.harvestpriest.plot).toMatchObject({ water: 1, waterUsed: 1, waterPacks: 1 });
    expect(s.biologist.trial).toMatchObject({ status: 'WAITING', careWeek: s.week, verifiedWeek: null, waterUsed: 1, location: 'BENCH' });
    expect(s.biologist.cases['paired-seedling']).toMatchObject({ status: 'EXAMINED', contactOpen: true });
    rejectActivity(s, { type: 'VERIFY', caseId: 'paired-seedling' }); activity(s, { type: 'CLOSE', caseId: 'paired-seedling' });
    rejectActivity(s, { type: 'VERIFY', caseId: 'paired-seedling' }); rejectActivity(s, { type: 'REPORT', caseId: 'paired-seedling' });
    s.week += 1; expect(validateBiologistState(s)).toBe(true); expect(s.biologist.trial.verifiedWeek).toBeNull();
    rejectActivity(s, { type: 'REPORT', caseId: 'paired-seedling' }); rejectActivity(s, { type: 'OBSERVE', caseId: 'safe-return' });
    const before = s.actionsRemaining, water = structuredClone(s.harvestpriest.plot);
    activity(s, { type: 'VERIFY', caseId: 'paired-seedling' });
    expect(s.actionsRemaining).toBe(before - 1); expect(s.harvestpriest.plot).toEqual(water);
    expect(s.biologist.trial).toMatchObject({ verifiedWeek: s.week, status: 'VERIFIED' });
    rejectActivity(s, { type: 'VERIFY', caseId: 'paired-seedling' }); activity(s, { type: 'REPORT', caseId: 'paired-seedling' });
    expect(validateBiologistState(s)).toBe(true);
  });
  it('charges failed actual practice and allows zero-AP ending, without restoring used water', () => {
    const s = promoted(); sampleReport(s); activity(s, { type: 'BUY_WATER' }); begin(s, 'paired-seedling');
    s.actionsRemaining = 1; s.spirituality = 3;
    activity(s, { type: 'PERFORM', caseId: 'paired-seedling' }, 100);
    expect([s.actionsRemaining, s.spirituality, s.harvestpriest.plot.water, s.harvestpriest.plot.waterUsed]).toEqual([0, 0, 1, 1]);
    expect(s.biologist.trial).toMatchObject({ status: 'IDLE', careWeek: null, waterUsed: 1 }); expect(biologistInside(s)).toBe(true);
    const forgedWeek = structuredClone(s); forgedWeek.week += 1; expect(validateBiologistState(forgedWeek)).toBe(false);
    s.mind = 0; expect(biologistActions(s).find(x => x.command.type === 'CLOSE')?.enabled).toBe(true);
    activity(s, { type: 'WITHDRAW', caseId: 'paired-seedling' }); expect(biologistInside(s)).toBe(false); expect(validateBiologistState(s)).toBe(true);
    s.mind = 50; s.actionsRemaining = 10; rejectActivity(s, { type: 'PREPARE', caseId: 'paired-seedling', method: 'ORDINARY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'paired-seedling', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'paired-seedling' });
    activity(s, { type: 'CLOSE', caseId: 'paired-seedling' }); expect(s.harvestpriest.plot).toMatchObject({ water: 0, waterUsed: 2 }); expect(s.biologist.trial.waterUsed).toBe(2); expect(validateBiologistState(s)).toBe(true);
  });
  it('keeps a last-AP preparation stable and cancelable without water or spirituality spending', () => {
    const s = promoted(); sampleReport(s); activity(s, { type: 'OBSERVE', caseId: 'paired-seedling' }); s.actionsRemaining = 1;
    const water = structuredClone(s.harvestpriest.plot), sp = s.spirituality;
    activity(s, { type: 'PREPARE', caseId: 'paired-seedling', method: 'ABILITY' });
    expect(s.actionsRemaining).toBe(0); expect(biologistInside(s)).toBe(false); expect(validateBiologistState(s)).toBe(true);
    activity(s, { type: 'WITHDRAW', caseId: 'paired-seedling' });
    expect(s.harvestpriest.plot).toEqual(water); expect(s.spirituality).toBe(sp); expect(validateBiologistState(s)).toBe(true);
  });
  it('preserves successful facts on withdrawal and closes final return without reversing ownership', () => {
    const s = verified(); begin(s, 'safe-return'); s.actionsRemaining = 1;
    const sp = s.spirituality; activity(s, { type: 'PERFORM', caseId: 'safe-return' });
    expect(s.spirituality).toBe(sp); expect(s.biologist).toMatchObject({ practice: { warningsRecorded: true }, trial: { status: 'RETURNED', location: 'OWNER' } });
    activity(s, { type: 'WITHDRAW', caseId: 'safe-return' });
    expect(s.biologist.cases['safe-return']).toMatchObject({ status: 'EXAMINED', contactOpen: false });
    expect(s.biologist.trial.location).toBe('OWNER'); expect(validateBiologistState(s)).toBe(true);
    s.actionsRemaining = 10; activity(s, { type: 'REPORT', caseId: 'safe-return' }); activity(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(validateBiologistState(s)).toBe(true);
    rejectActivity(s, { type: 'PERFORM', caseId: 'safe-return' }); rejectActivity(s, { type: 'REFLECT' });
  });
  it('allows settled waiting seedlings to remain in the greenhouse during the courtyard dispute', () => {
    const s = waiting(), trial = structuredClone(s.biologist.trial), plot = structuredClone(s.harvestpriest.plot);
    activity(s, { type: 'ENCOUNTER_FIGHT' }); expect(hasBiologistDisputeOpponent(s)).toBe(true);
    expect(s.combat?.encounterId).toBe('BIOLOGIST_DISPUTE'); expect(validateBiologistState(s)).toBe(true);
    const ctx = context(s); settleBiologistEncounter(s, 'RETREATED', ctx.c, ctx.award);
    expect(s.biologist.trial).toEqual(trial); expect(s.harvestpriest.plot).toEqual(plot); expect(ctx.award).not.toHaveBeenCalled(); expect(validateBiologistState(s)).toBe(true);
  });
  it('projects actual waiting without claiming a report or edible harvest, and rejects fake chronology', () => {
    const s = waiting(); expect(biologistCases(s).find(x => x.id === 'paired-seedling')!.result).toContain('尚未复核');
    expect(projectBiologist(s).water).toMatchObject({ held: 1, used: 1 });
    for (const mutate of [
      (v: SliceState) => { v.biologist.trial.verifiedWeek = v.biologist.trial.careWeek; v.biologist.trial.status = 'VERIFIED'; },
      (v: SliceState) => { v.biologist.trial.location = 'OWNER'; },
      (v: SliceState) => { v.biologist.practice.warningsRecorded = true; },
      (v: SliceState) => { v.harvestpriest.plot.water += 1; },
    ]) { const forged = structuredClone(s); mutate(forged); expect(validateBiologistState(forged)).toBe(false); }
  });
});
