import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { addGameDays, addGameYears, gameDaysBetween } from '../../src/domain/game-calendar.js';
import { applyAncientScholarCommand, createAncientScholarState, projectAncientScholar, validateAncientScholarCommand, validateAncientScholarState } from '../../src/domain/ancient-scholar/index.js';
import { blockAncientScholarRitual, canConsumeAncientScholar, hasAncientScholarEraClosure, hasAncientScholarLock, projectAncientScholarRitual, validateAncientScholarRitualState } from '../../src/domain/ancient-scholar/ritual.js';
import { ANCIENT_SCHOLAR_ABILITY_IDS, ANCIENT_SCHOLAR_PREPARATION_IDS, ANCIENT_SCHOLAR_RECORD_IDS, type AncientScholarCommand } from '../../src/domain/ancient-scholar/types.js';

/** Explicit isolated unit fixture from the real S4 final. Large budget and healed/restored
 * body below are test setup only. The parent runs the unmodified natural public route. */
function ready(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/bizarro-sorcerer-v01170/natural.json', 'utf8')).final);
  s.ancientScholar = createAncientScholarState(); s.cash = 10000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 120; s.injuryRisk = 0;
  for (const i of s.injuries) if (i.treatedRevision === null) i.treatedRevision = s.revision;
  s.faceless.appearance.templateId = 'SELF'; s.faceless.appearance.sourceCaseId = null;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext { return { note: vi.fn(), roll: vi.fn(min => min), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) }; }
function act(s: SliceState, command: AncientScholarCommand, roll = 1) { const ctx = context(s, roll); applyAncientScholarCommand(s, command, ctx); expect(validateAncientScholarState(s)).toBe(true); return ctx; }
function reject(s: SliceState, command: unknown) { const before = structuredClone(s); expect(() => applyAncientScholarCommand(s, command as AncientScholarCommand, context(s))).toThrow(); expect(s).toEqual(before); }
function taught(s = ready()) { act(s, { type: 'LEARN_FORMULA' }); if (s.world.bellHolder === 'PLAYER') act(s, { type: 'HAND_OVER_BELL' }); act(s, { type: 'REVIEW_SECLUSION' }); return s; }
function materials(s = taught()) {
  for (const recordId of ANCIENT_SCHOLAR_RECORD_IDS) { act(s, { type: 'OBTAIN_RECORD', recordId }); act(s, { type: 'VERIFY_RECORD', recordId }); }
  for (const batch of s.ancientScholar.batches) { act(s, { type: 'BUY_MATERIALS', batchId: batch.id }); act(s, { type: 'BREW', batchId: batch.id }); }
  return s;
}
function prepare(s = materials()) { for (const taskId of ANCIENT_SCHOLAR_PREPARATION_IDS) act(s, { type: 'PREPARE_FACILITY', taskId }); act(s, { type: 'PAY_FACILITY' }); return s; }
function enter(s = prepare()) { act(s, { type: 'ENTER_SECLUSION', confirmed: true }); return s; }
function eligible(s = enter()) { act(s, { type: 'ADVANCE_FIRST_150' }); act(s, { type: 'ADVANCE_SECOND_150' }); act(s, { type: 'VERIFY_CONTINUITY' }); return s; }
function bottle(s: SliceState, i = 0) { return s.ancientScholar.bottles[i]!.id; }
function newWeek(s: SliceState) { while (s.actionsRemaining > 0) act(s, { type: 'WORK' }); act(s, { type: 'NEXT_WEEK' }); }

describe('ancient scholar original body and real continuous 300 years', () => {
  it('begins with independent original batches, no invented main weights or completed history', () => {
    const s = ready(); expect(validateAncientScholarState(s)).toBe(true); expect(s.ancientScholar.batches).toHaveLength(3);
    expect(s.ancientScholar.batches[0]!.materials.map(m => m.quantity)).toEqual([1, 1, 100, 30, null, 1]);
    expect(s.ancientScholar.ritual.records.every(r => r.verifiedDate === null)).toBe(true);
    expect(hasAncientScholarEraClosure(s)).toBe(false); expect(hasAncientScholarLock(s)).toBe(false);
    expect(validateAncientScholarCommand({ type: 'ENTER_SECLUSION' })).toBe(false);
    expect(validateAncientScholarCommand({ type: 'ENTER_SECLUSION', confirmed: true, elapsedYears: 300 })).toBe(false);
  });
  it('requires actual old bell handover and retains the original historical verdict', () => {
    const s = ready(), arc = structuredClone(s.arc), ending = structuredClone(s.ending), carrierAlive = s.world.carrierAlive;
    act(s, { type: 'LEARN_FORMULA' }); expect(blockAncientScholarRitual(s, { type: 'REVIEW_SECLUSION' })).toContain('铜铃');
    const cash = s.cash, ap = s.actionsRemaining; act(s, { type: 'HAND_OVER_BELL' });
    expect(s.cash).toBe(cash - 60); expect(s.actionsRemaining).toBe(ap - 1); expect(s.world.bellHolder).toBe('ORGANIZATION'); expect(s.world.bell).toBe('CONTAINED');
    expect(s.arc).toEqual(arc); expect(s.ending).toEqual(ending); expect(s.world.carrierAlive).toBe(carrierAlive);
    expect(s.ancientScholar.ritual.bellHandover?.bellId).toBe(`${s.runId}:ARC-BELL-1`); reject(s, { type: 'HAND_OVER_BELL' });
  });
  it('cannot acquire drug history merely by choosing an ancient archive name', () => {
    const s = taught(), batchId = s.ancientScholar.batches[0]!.id;
    reject(s, { type: 'BUY_MATERIALS', batchId }); reject(s, { type: 'VERIFY_RECORD', recordId: 'AS3-RECORD-145' });
    act(s, { type: 'OBTAIN_RECORD', recordId: 'AS3-RECORD-145' }); reject(s, { type: 'BUY_MATERIALS', batchId });
    expect(s.ancientScholar.ritual.records[0]!.historicalYear).toBe(s.date.year - 145);
    act(s, { type: 'VERIFY_RECORD', recordId: 'AS3-RECORD-145' }); expect(s.ancientScholar.ritual.records[0]!.copyId).toBe('AS3-RECORD-145:VERIFIED-COPY');
  });
  it('does three distinct preparation jobs, pays once, then asks a separate entry confirmation', () => {
    const s = materials(), initialDate = structuredClone(s.date), cash = s.cash;
    for (const taskId of ANCIENT_SCHOLAR_PREPARATION_IDS) act(s, { type: 'PREPARE_FACILITY', taskId });
    for (let n = 0; n < 3; n += 1) act(s, { type: 'FACILITY_WORK' });
    act(s, { type: 'PAY_FACILITY' }); expect(s.cash).toBe(cash - 120); expect(s.date).toEqual(initialDate); expect(s.ancientScholar.ritual.location).toBe('OUTSIDE');
    reject(s, { type: 'PAY_FACILITY' }); reject(s, { type: 'PREPARE_FACILITY', taskId: 'CHECK_LOCAL_CLOCK' }); reject(s, { type: 'ENTER_SECLUSION', confirmed: false });
    act(s, { type: 'ENTER_SECLUSION', confirmed: true }); expect(hasAncientScholarLock(s)).toBe(true); expect(hasAncientScholarEraClosure(s)).toBe(false);
  });
  it('does not use the facility as a cure for existing injury or ordinary death', () => {
    const s = prepare(); s.injuryRisk = 1; reject(s, { type: 'ENTER_SECLUSION', confirmed: true }); s.injuryRisk = 0;
    s.health = 79; reject(s, { type: 'ENTER_SECLUSION', confirmed: true }); s.health = 0; s.status = 'DEAD'; reject(s, { type: 'ENTER_SECLUSION', confirmed: true });
  });
  it('preserves body and original objects through two actual 150-year increments without communication', () => {
    const s = enter(), start = structuredClone(s.date), oldMouse = structuredClone(s.bizarroSorcerer.life.mouse), oldDorn = structuredClone(s.marionettist.puppet), reserve = s.spirituality, health = s.health;
    reject(s, { type: 'WORK' }); reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'EXIT_EARLY', confirmed: true });
    act(s, { type: 'ADVANCE_FIRST_150' }); expect(s.date).toEqual(addGameYears(start, 150)); expect(hasAncientScholarEraClosure(s)).toBe(true); expect(s.health).toBe(health); expect(s.spirituality).toBe(reserve);
    expect(projectAncientScholarRitual(s).people).toEqual([]); reject(s, { type: 'ADVANCE_FIRST_150' }); reject(s, { type: 'CONSUME', bottleId: bottle(s), confirmed: true });
    act(s, { type: 'ADVANCE_SECOND_150' }); expect(s.date).toEqual(addGameYears(start, 300)); expect(s.ancientScholar.ritual.visits[0]!.elapsedDays).toBe(gameDaysBetween(start, s.date));
    reject(s, { type: 'CONSUME', bottleId: bottle(s), confirmed: true }); act(s, { type: 'VERIFY_CONTINUITY' }); expect(canConsumeAncientScholar(s, bottle(s))).toBe(true);
    expect(s.bizarroSorcerer.life.mouse).toEqual(oldMouse); expect(s.marionettist.puppet).toEqual(oldDorn); expect(s.ancientScholar.ritual.visits[0]!.retainedObjectIds).toEqual(['BR4-CARRIER-1', 'BR4-TAG-1']);
  });
  it('keeps 150 elapsed years after early exit and requires a new full 300-year stay', () => {
    const s = enter(), start = structuredClone(s.date); act(s, { type: 'ADVANCE_FIRST_150' }); act(s, { type: 'EXIT_EARLY', confirmed: true });
    expect(s.date).toEqual(addGameYears(start, 150)); expect(s.ancientScholar.ritual.completed300VisitId).toBeNull(); expect(s.ancientScholar.ritual.visits[0]!.result).toBe('EARLY_EXIT');
    expect(s.ancientScholar.ritual.people.some(p => p.id === 'AS3-MARA' && p.kind === 'DEATH')).toBe(true); reject(s, { type: 'CONSUME', bottleId: bottle(s), confirmed: true });
    act(s, { type: 'REVIEW_SECLUSION' }); reject(s, { type: 'REASSESS_HISTORY' }); prepare(s); act(s, { type: 'ENTER_SECLUSION', confirmed: true });
    expect(s.ancientScholar.ritual.visits[1]!.mode).toBe('THREE_CENTURIES'); expect(s.ancientScholar.ritual.visits[1]!.targetDate).toEqual(addGameYears(start, 450));
  });
  it('consumes the protected original bottle for actual S3 and leaves all old mastery intact', () => {
    const s = eligible(), old = structuredClone(s.progression.mastery), oldSpirit = s.spirituality;
    act(s, { type: 'CONSUME', bottleId: bottle(s), confirmed: true }); expect(s.progression.sequence).toBe(3); expect(s.progression.acting).toBe(0); expect(s.spirituality).toBe(oldSpirit);
    for (const [id, mastery] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(mastery);
    expect(ANCIENT_SCHOLAR_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0, 0]); expect(s.ancientScholar.bizarroActingAtPromotion).toBe(100);
    expect(s.ancientScholar.ritual.location).toBe('VAULT'); reject(s, { type: 'CONSUME', bottleId: bottle(s, 1), confirmed: true });
    act(s, { type: 'EXIT_SECLUSION' }); expect(projectAncientScholar(s).ritual.people.join(' ')).toContain('84岁故去'); expect(s.ancientScholar.ritual.successorId).toBe('AS3-ELIN');
  });
  it('preserves severe failure and uses finite original recovery packs without refilling spirituality', () => {
    const s = eligible(), before = { h: s.health, m: s.mind, sp: s.spirituality };
    act(s, { type: 'CONSUME', bottleId: bottle(s), confirmed: true }, 100); expect(s.progression.sequence).toBe(4); expect(s.progression.acting).toBe(100);
    expect(s.health).toBe(before.h - 25); expect(s.mind).toBe(before.m - 45); expect(s.ancientScholar.bottles[0]!.outcome).toBe('GREAT_FAILURE');
    const date = structuredClone(s.date); act(s, { type: 'ISOLATION_REST' }); expect(s.date).toEqual(addGameDays(date, 1)); expect(s.spirituality).toBe(before.sp);
    act(s, { type: 'ISOLATION_REST' }); act(s, { type: 'ISOLATION_REST' }); reject(s, { type: 'ISOLATION_REST' });
    act(s, { type: 'CONSUME', bottleId: bottle(s, 1), confirmed: true }); expect(s.ancientScholar.bottles[0]!.outcome).toBe('GREAT_FAILURE'); expect(s.progression.sequence).toBe(3);
  });
  it('rechecks completed 300-year history outside, then requires fresh 14 days rather than another 300 years', () => {
    const s = eligible(); act(s, { type: 'CONSUME', bottleId: bottle(s), confirmed: true }, 100); act(s, { type: 'EXIT_SECLUSION' });
    reject(s, { type: 'CONSUME', bottleId: bottle(s, 1), confirmed: true });
    while (s.health < 80 || s.mind < 60) { if (!s.actionsRemaining) newWeek(s); act(s, { type: 'REST' }); }
    newWeek(s); act(s, { type: 'REVIEW_SECLUSION' }); act(s, { type: 'REASSESS_HISTORY' }); prepare(s); const entered = structuredClone(s.date); act(s, { type: 'ENTER_SECLUSION', confirmed: true });
    expect(s.ancientScholar.ritual.visits[1]!.mode).toBe('G_REASSESSMENT'); reject(s, { type: 'ADVANCE_FIRST_150' }); act(s, { type: 'ADVANCE_REASSESSMENT' }); expect(s.date).toEqual(addGameDays(entered, 14));
    act(s, { type: 'VERIFY_CONTINUITY' }); act(s, { type: 'CONSUME', bottleId: bottle(s, 1), confirmed: true }); expect(s.progression.sequence).toBe(3);
  });
  it('rejects replacing body, local clock, protected original bottle or three-hundred-year evidence', () => {
    const s = eligible(); for (const change of [
      (x: SliceState) => { x.ancientScholar.ritual.visits[0]!.bodyId = 'another-person'; },
      (x: SliceState) => { x.ancientScholar.ritual.visits[0]!.milestones[1]!.elapsedDays -= 1; },
      (x: SliceState) => { x.ancientScholar.ritual.visits[0]!.registeredBottleIds.push('invented-bottle'); },
      (x: SliceState) => { x.ancientScholar.ritual.completed300VisitId = 'invented-300'; },
    ]) { const forged = structuredClone(s); change(forged); expect(validateAncientScholarRitualState(forged)).toBe(false); }
  });
});
