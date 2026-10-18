import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { awardSeerMastery, type SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { applyMiracleWorkerCommand, createMiracleWorkerState, hasMiracleWorkerLock,
  isMiracleWorker, miracleWorkerCommandBlock, projectMiracleWorker,
  validateMiracleWorkerCommand, validateMiracleWorkerState,
  type MiracleWorkerCommand } from '../../src/domain/miracle-worker/index.js';
import { MIRACLE_WORKER_FORMULA, MIRACLE_WORKER_ABILITY_IDS } from '../../src/domain/miracle-worker/content.js';
import { canConsumeMiracleWorker, validateMiracleWorkerRitualState } from '../../src/domain/miracle-worker/ritual.js';
import { applyMiracleWorkerActivity, createMiracleWorkerLifeState, MIRACLE_WORKER_OWNER_IDS, validateMiracleWorkerLife,
  type MiracleWorkerCaseId } from '../../src/domain/miracle-worker/life.js';
import { validateSeerPractice } from '../../src/domain/seer/practice.js';
import { validateClownState } from '../../src/domain/clown/index.js';
import { validateMagicianPractice } from '../../src/domain/magician/practice.js';
import { validateFacelessPractice } from '../../src/domain/faceless/practice.js';
import { validateMarionettistPractice } from '../../src/domain/marionettist/practice.js';
import { validateBizarroLife } from '../../src/domain/bizarro-sorcerer/life.js';
import { validateAncientScholarState } from '../../src/domain/ancient-scholar/index.js';
import { validateAncientScholarLife } from '../../src/domain/ancient-scholar/life.js';

/** STATIC-DRAFT NOTE: not executed while authored. No boundaries.json import: that
 * file is approximately 87 MB. The 767-command original is genuinely still S3.
 * Directed checks below are unit fixtures, never evidence of natural promotion. */
const original = JSON.parse(readFileSync('tests/fixtures/miracle-worker-v01640/natural.json', 'utf8')) as {
  seed: string; commands: unknown[]; prefixCount: number; stage: string; final: SliceState;
};
const originalFinal = migrateSliceState(original.final);
const predecessor = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/ancient-scholar-v01400/natural.json', 'utf8')).final);
const oldRoots = ['clown', 'magician', 'faceless', 'marionettist', 'bizarroSorcerer', 'ancientScholar'] as const;
function context(s: SliceState, die = 1): SeerContext {
  return { roll: vi.fn(() => die), note: vi.fn(), check: vi.fn((ability, difficulty) =>
    resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: die })) };
}
function act(s: SliceState, command: MiracleWorkerCommand, die = 1) {
  const ctx = context(s, die);
  applyMiracleWorkerCommand(s, command, ctx, (source, amount) => {
    if (amount !== 5 && amount !== 8 && amount !== 25) throw new Error('Invalid mastery award');
    awardSeerMastery(s, source, amount, ctx);
  });
  s.revision++;
  return ctx;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyMiracleWorkerCommand(s, command as MiracleWorkerCommand, ctx, vi.fn())).toThrow();
  expect(s).toEqual(before);
  expect(ctx.check).not.toHaveBeenCalled();
  expect(ctx.roll).not.toHaveBeenCalled();
}
function sameOldRoots(s: SliceState, before: SliceState) {
  for (const key of oldRoots) expect(s[key], key).toEqual(before[key]);
  // Pollution and new reward-source entries may legitimately change; S9 originals may not.
  expect(s.seer.practice).toEqual(before.seer.practice);
}
/** Successful practice produces one packet for one already-known ability. The
 * shared random growth draw does not guarantee that the practiced ability wins. */
function expectMasteryPacket(before: SliceState, after: SliceState, amount: 0 | 8) {
  expect(Object.keys(after.progression.mastery).sort()).toEqual(Object.keys(before.progression.mastery).sort());
  const changed = Object.entries(after.progression.mastery)
    .filter(([id, value]) => value !== before.progression.mastery[id]);
  if (amount === 0) expect(changed).toEqual([]);
  else {
    expect(changed).toHaveLength(1);
    const [id, value] = changed[0]!;
    expect(Object.hasOwn(before.progression.mastery, id)).toBe(true);
    expect(value - before.progression.mastery[id]!).toBe(amount);
  }
}
/** Resource expansion is isolated unit setup, not a natural-play claim. */
function beforeMiracle(): SliceState {
  let s = structuredClone(predecessor);
  if (s.ancientScholar.ritual.location === 'OUTSIDE') s = applySliceIntent(s, {type:'ANCIENT_SCHOLAR',command:{type:'ENTER_RECEPTION'}});
  s.cash = 100000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 37;
  return s;
}
function taught(): SliceState { const s = beforeMiracle(); act(s, { type: 'LEARN_FORMULA' }); return s; }
function acquireAndBrew(s: SliceState, batchId: string) {
  for (let i = 0; i < 3; i++) act(s, { type: 'MATERIAL_WORK', batchId });
  act(s, { type: 'BUY_MATERIALS', batchId }); act(s, { type: 'BREW', batchId });
}
function realNextWeek(s: SliceState) {
  while (s.actionsRemaining > 0) act(s, { type: 'WORK' });
  act(s, { type: 'NEXT_WEEK' });
}
/** A new paid source is added after the untouched three natural failures. */
function fourthSource(): SliceState {
  const s = structuredClone(originalFinal);
  act(s, { type: 'REQUEST_NEW_LEAD' }); realNextWeek(s); act(s, { type: 'VERIFY_NEW_LEAD' });
  s.cash = 100000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 37;
  return s;
}
function restore(s: SliceState, sourceId: string, bottleId: string, repairDie = 1) {
  for (const step of ['ARCHIVE', 'ANCHOR'] as const) act(s, { type: 'INVESTIGATE_SOURCE', sourceId, step });
  act(s, { type: 'PREPARE_RETURN_KIT', sourceId }); act(s, { type: 'REGISTER_RETURN_PLAN', sourceId, bottleId });
  act(s, { type: 'TRAVEL_TO_GATE', sourceId }); act(s, { type: 'SURVEY_GATE' }); act(s, { type: 'CONTACT_SETTLEMENT' });
  act(s, { type: 'REPAIR_ANCHOR' }, repairDie);
  const q = s.miracleWorker.ritual.sources.find(x => x.id === sourceId)!;
  if (!q.repairDone) act(s, { type: 'REWORK_ANCHOR' });
  act(s, { type: 'OPEN_PASSAGE', confirmed: true });
  for (const destination of ['GATE_IN', 'COURTYARD', 'ARCHIVE'] as const) act(s, { type: 'MOVE', destination });
  act(s, { type: 'VERIFY_GENERATIONS' }); act(s, { type: 'INVITE_REPRESENTATIVES' });
  for (const destination of ['COURTYARD', 'GATE_IN', 'GATE_OUT'] as const) act(s, { type: 'MOVE', destination });
  for (let i = 0; i < 7; i++) act(s, { type: 'OBSERVE_EXCHANGE' });
  return q;
}
let windowCache: SliceState | undefined;
function fourthWindow(): SliceState {
  if (!windowCache) {
    const s = fourthSource(); acquireAndBrew(s, 'miracle-worker-batch-4');
    restore(s, 'MW2-LEAD-4', 'miracle-worker-batch-4:bottle'); windowCache = s;
  }
  return structuredClone(windowCache);
}
const dose = { type: 'CONSUME', bottleId: 'miracle-worker-batch-4:bottle', confirmed: true } as const;
let promotedCache: SliceState | undefined;
function directedS2(): SliceState {
  if (!promotedCache) {
    const s = fourthWindow(); act(s, dose, 1); act(s, { type: 'LEAVE_RITUAL' }); promotedCache = s;
  }
  return structuredClone(promotedCache);
}
function begin(s: SliceState, caseId: MiracleWorkerCaseId) {
  act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'START', caseId });
}
function report(s: SliceState, caseId: MiracleWorkerCaseId) {
  act(s, { type: 'STOP', caseId }); act(s, { type: 'REPORT', caseId });
}
function repairOwners(s: SliceState) {
  begin(s, 'small-repairs'); act(s, { type: 'BUY_REPAIR_KIT' }); act(s, { type: 'BUY_OWN_BOX' });
  for (const ownerId of MIRACLE_WORKER_OWNER_IDS) for (const type of ['TAKE_ITEM', 'INSPECT_ITEM', 'FIX_ITEM', 'RETURN_ITEM'] as const) act(s, { type, ownerId });
}
function repairsReported(s: SliceState) {
  repairOwners(s); act(s, { type: 'FINISH_ORDINARY' }); report(s, 'small-repairs');
}
function courtStarted(s: SliceState) {
  repairsReported(s); begin(s, 'limited-odds'); act(s, { type: 'FINISH_ORDINARY' }); report(s, 'limited-odds'); begin(s, 'familiar-court');
}

describe('Miracle Worker S2 acquisition, irreversible return and paid independent leads', () => {
  it('preserves the 767-command natural run as three genuine failures at live S3', () => {
    expect(original.commands).toHaveLength(767); expect(original.prefixCount).toBe(549);
    expect(original.seed).toBe('seer-rebuild-first');
    expect(original.stage).toBe('THREE_REAL_RESTORATIONS_AND_POTION_FAILURES');
    expect(originalFinal).toMatchObject({ status: 'ACTIVE', week: 15800, progression: { sequence: 3, acting: 100 } });
    expect(originalFinal.miracleWorker.bottles.map(b => b.outcome)).toEqual(['FAILURE', 'FAILURE', 'FAILURE']);
    expect(originalFinal.miracleWorker.ritual.sources.every(q => q.restorationId !== null && q.window === 'CONSUMED')).toBe(true);
    expect(originalFinal.miracleWorker.promotionWeek).toBeNull(); expect(isMiracleWorker(originalFinal)).toBe(false);
    expect(validateMiracleWorkerState(originalFinal)).toBe(true);
    expect(originalFinal.miracleWorker.ritual.sources).toEqual(original.final.miracleWorker.ritual.sources);
    sameOldRoots(originalFinal, original.final);
  });
  it('starts with independent default originals, no bottle, no free wish and no historical scene', () => {
    const s = createSliceRun('miracle-default', sliceDefaultCreationSelection, 'miracle-default');
    expect(validateMiracleWorkerState(s)).toBe(true);
    expect(projectMiracleWorker(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], abilities: [] });
    expect(s.miracleWorker.batches).toHaveLength(3); expect(s.miracleWorker.bottles).toEqual([]);
    expect(s.miracleWorker.life).toEqual(createMiracleWorkerLifeState());
    expect(s.miracleWorker.revival).toEqual({ allowance: 4, used: 0, pendingDeathId: null, records: [] });
    const separate = createMiracleWorkerState(); separate.batches[0]!.materials[0]!.quantity = 0;
    separate.ritual.sources[0]!.residents[0]!.consent = 'REFUSED';
    expect(s.miracleWorker.batches[0]!.materials[0]!.quantity).toBe(1);
    expect(s.miracleWorker.ritual.sources[0]!.residents[0]!.consent).toBe('NOT_ASKED');
    reject(s, { type: 'LEARN_FORMULA' });
  });
  it('requires actual S3 promotion, current reception, resources and an unblocked body', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'hunter'; }, s => { s.progression.sequence = 4; },
      s => { s.ancientScholar.promotionWeek = null; }, s => { s.ancientScholar.ritual.location = 'VAULT'; },
      s => { s.health = 0; }, s => { s.status = 'DEAD'; }, s => { s.actionsRemaining = 0; }, s => { s.cash = 179; },
      s => { s.ancientScholar.life.practice.ownerAt = 'OWN_HISTORY'; },
    ];
    for (const change of changes) { const s = beforeMiracle(); change(s); reject(s, { type: 'LEARN_FORMULA' }); }
  });
  it('charges exact formula guidance and retains original sourced quantities and the alternative-main-material boundary', () => {
    const s = beforeMiracle(), before = structuredClone(s); act(s, { type: 'LEARN_FORMULA' });
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash - 180, before.actionsRemaining - 1]);
    expect(MIRACLE_WORKER_FORMULA.map(({ id, quantity, unit }) => [id, quantity, unit])).toEqual([
      ['dark-wolf-heart', 1, '颗'], ['dark-wolf-blood', 300, 'mL'], ['worm-of-time', 1, '条'], ['worm-of-stars', 1, '条'],
    ]);
    expect(MIRACLE_WORKER_FORMULA[0].note).toContain('不能同时收两份');
    expect(projectMiracleWorker(s).formula).toEqual(MIRACLE_WORKER_FORMULA);
    for (const b of s.miracleWorker.batches) for (const m of b.materials) {
      expect(m.holder).toBe('SUPPLIER'); expect(m.source).toContain('MW2-SUPPLIER'); expect(m.source).toContain('有偿');
    }
    sameOldRoots(s, before); reject(s, { type: 'LEARN_FORMULA' }); expect(validateMiracleWorkerState(s)).toBe(true);
  });
  it('discounts only the three-job original batch, then consumes each sourced input exactly once', () => {
    const s = taught(), b = s.miracleWorker.batches[0]!, before = structuredClone(s);
    acquireAndBrew(s, b.id);
    expect([before.cash - s.cash, before.actionsRemaining - s.actionsRemaining]).toEqual([240, 4]);
    expect(b.labourSteps).toBe(3); expect(b.materials.every(m => m.holder === 'CONSUMED' && m.quantity === 0)).toBe(true);
    expect(s.miracleWorker.bottles[0]).toMatchObject({ id: `${b.id}:bottle`, batchId: b.id, inputIds: b.materials.map(m => m.id), status: 'PREPARED', outcome: null, restorationId: null });
    expect(s.miracleWorker.batches[1]!.labourSteps).toBe(0); sameOldRoots(s, before);
    for (const type of ['MATERIAL_WORK', 'BUY_MATERIALS', 'BREW'] as const) reject(s, { type, batchId: b.id });
    reject(s, { type: 'CONSUME', bottleId: `${b.id}:bottle`, confirmed: true }); expect(validateMiracleWorkerState(s)).toBe(true);
  });
  it('does not partially discount a two-job batch or accept old-stage materials', () => {
    const s = taught(), batchId = 'miracle-worker-batch-1';
    act(s, { type: 'MATERIAL_WORK', batchId }); act(s, { type: 'MATERIAL_WORK', batchId });
    const cash = s.cash; act(s, { type: 'BUY_MATERIALS', batchId }); expect(cash - s.cash).toBe(1500);
    reject(s, { type: 'BUY_MATERIALS', batchId: 'ancient-scholar-batch-1' });
    s.cash = 59; reject(s, { type: 'BREW', batchId }); expect(s.miracleWorker.bottles).toEqual([]);
  });
  it('pays for one pending lead, waits an actual seven-day week, then pays to verify an independent fourth site', () => {
    const s = structuredClone(originalFinal), before = structuredClone(s), week = s.week, date = structuredClone(s.date);
    act(s, { type: 'REQUEST_NEW_LEAD' });
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash - 48, before.actionsRemaining - 1]);
    expect(s.miracleWorker.ritual.leads).toEqual([{ id: 'MW2-LEAD-REQUEST-4', sourceId: 'MW2-LEAD-4', requestedWeek: week, confirmedWeek: null, paidPennies: 48 }]);
    expect(s.miracleWorker.ritual.sources).toHaveLength(3); expect(s.miracleWorker.batches).toHaveLength(3);
    reject(s, { type: 'REQUEST_NEW_LEAD' }); reject(s, { type: 'VERIFY_NEW_LEAD' });
    realNextWeek(s); expect(s.week).toBe(week + 1); expect(s.date).toEqual(addGameDays(date, 7));
    const cash = s.cash, ap = s.actionsRemaining; act(s, { type: 'VERIFY_NEW_LEAD' });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 48, ap - 1]);
    expect(s.miracleWorker.ritual.leads[0]).toMatchObject({ confirmedWeek: week + 1, paidPennies: 96 });
    expect(s.miracleWorker.ritual.sources[3]).toMatchObject({ id: 'MW2-LEAD-4', restorationId: null, window: 'NONE', investigations: [], gateOpen: false });
    expect(s.miracleWorker.batches[3]).toMatchObject({ id: 'miracle-worker-batch-4', labourSteps: 0, acquiredWeek: null, brewedWeek: null });
    expect(s.miracleWorker.ritual.sources.slice(0, 3)).toEqual(before.miracleWorker.ritual.sources);
    expect(s.miracleWorker.bottles).toEqual(before.miracleWorker.bottles);
    const bodies = s.miracleWorker.ritual.sources.flatMap(q => q.residents.map(p => p.bodyId));
    expect(new Set(bodies).size).toBe(32); sameOldRoots(s, before);
    reject(s, { type: 'VERIFY_NEW_LEAD' }); reject(s, { type: 'REQUEST_NEW_LEAD' }); expect(validateMiracleWorkerState(s)).toBe(true);
  });
  it('does not unlock paid leads before all existing communities return and bottles fail', () => {
    const s = taught(); act(s, { type: 'REVIEW_RETURN' }); reject(s, { type: 'REQUEST_NEW_LEAD' });
    const poor = structuredClone(originalFinal); poor.cash = 47; reject(poor, { type: 'REQUEST_NEW_LEAD' });
    for (const source of originalFinal.miracleWorker.ritual.sources) {
      const t = structuredClone(originalFinal); reject(t, { type: 'INVESTIGATE_SOURCE', sourceId: source.id, step: 'ARCHIVE' });
      reject(t, { type: 'TRAVEL_TO_GATE', sourceId: source.id });
    }
  });
  it('requires actual original-body return and seven custody exchanges before the one-shot bottle window', () => {
    const s = fourthWindow(), q = s.miracleWorker.ritual.sources[3]!;
    expect(q).toMatchObject({ exchangeStep: 7, gateOpen: true, window: 'OPEN', restorationId: `${s.runId}:MW2-LEAD-4:RETURN` });
    expect(q.deadline! - q.restoredAt!).toBe(600); expect(q.verifiedIds).toHaveLength(12);
    expect(q.residents[3]!.consent).toBe('REFUSED'); expect(q.residents.every(p => p.alive)).toBe(true);
    expect(q.originals.find(o => o.id.endsWith(':census'))!.holder).toBe(q.residents[0]!.id);
    expect(q.originals.find(o => o.id.endsWith(':cloth'))!.holder).toBe('AS3-ELIN');
    expect(canConsumeMiracleWorker(s, dose.bottleId)).toBe(true);
    expect(canConsumeMiracleWorker(s, 'miracle-worker-batch-1:bottle')).toBe(false);
    expect(validateMiracleWorkerState(s)).toBe(true); reject(s, { type: 'OBSERVE_EXCHANGE' });
    reject(s, { type: 'WORK' }); reject(s, { type: 'NEXT_WEEK' });
  });
  it('preserves a failed repair and pays finite original backup pins rather than rerolling it', () => {
    const s = fourthSource(); acquireAndBrew(s, 'miracle-worker-batch-4');
    const q = restore(s, 'MW2-LEAD-4', dose.bottleId, 100);
    expect(q.repairOutcome).toBe('GREAT_FAILURE'); expect(q.spentPins).toBe(4); expect(q.repairDone).toBe(true);
    expect(q.history.filter(h => h.step === 'REPAIR_ANCHOR')).toHaveLength(1);
    expect(q.history.filter(h => h.step === 'REWORK_ANCHOR')).toHaveLength(1);
    reject(s, { type: 'REPAIR_ANCHOR' }); reject(s, { type: 'REWORK_ANCHOR' }); expect(validateMiracleWorkerState(s)).toBe(true);
  });
  it.each([1, 100])('settles directed potion die %s without restoring old communities or refilling resources', die => {
    const s = fourthWindow(), before = structuredClone(s), q = s.miracleWorker.ritual.sources[3]!;
    const ctx = act(s, dose, die); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect(s.spirituality).toBe(before.spirituality); expect(s.actionsRemaining).toBe(before.actionsRemaining);
    expect(s.miracleWorker.ritual.sources.slice(0, 3)).toEqual(before.miracleWorker.ritual.sources.slice(0, 3));
    expect(s.miracleWorker.bottles.slice(0, 3)).toEqual(before.miracleWorker.bottles.slice(0, 3));
    expect(q.residents).toEqual(before.miracleWorker.ritual.sources[3]!.residents);
    expect(q.originals).toEqual(before.miracleWorker.ritual.sources[3]!.originals); expect(q.window).toBe('CONSUMED');
    expect(s.miracleWorker.bottles[3]).toMatchObject({ status: 'CONSUMED', outcome: die === 1 ? 'GREAT_SUCCESS' : 'GREAT_FAILURE', restorationId: q.restorationId });
    expect([s.health, s.mind, s.progression.sequence, s.progression.acting]).toEqual(die === 1 ? [100, 92, 2, 0] : [75, 55, 3, 100]);
    if (die === 1) { expect(s.miracleWorker.ancientActingAtPromotion).toBe(100); for (const id of MIRACLE_WORKER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0); }
    sameOldRoots(s, before); expect(s.random).toEqual(before.random); reject(s, dose); expect(validateMiracleWorkerState(s)).toBe(true);
  });
  it('expires or declines the window without resetting the returned people, objects or permanent gate', () => {
    for (const type of ['WAIT_WINDOW', 'LEAVE_RITUAL'] as const) {
      const s = fourthWindow(), before = structuredClone(s.miracleWorker.ritual.sources[3]!); act(s, { type });
      const q = s.miracleWorker.ritual.sources[3]!;
      expect(q.window).toBe(type === 'WAIT_WINDOW' ? 'EXPIRED' : 'DECLINED');
      expect(q.restorationId).toBe(before.restorationId); expect(q.residents).toEqual(before.residents); expect(q.originals).toEqual(before.originals); expect(q.gateOpen).toBe(true);
      expect(s.miracleWorker.bottles[3]!.status).toBe('PREPARED'); reject(s, dose); expect(validateMiracleWorkerState(s)).toBe(true);
    }
  });
  it.each([
    null, {}, { type: 'SELF_WISH', wish: 'infinite resources' }, { type: 'SUMMON_SCENE', sourceId: 'UNKNOWN' },
    { type: 'CONSUME', bottleId: 'miracle-worker-batch-4:bottle', confirmed: false },
    { type: 'OPEN_PASSAGE', confirmed: false }, { type: 'VERIFY_NEW_LEAD', force: true },
    { type: 'BUY_MATERIALS', batchId: 'miracle-worker-batch-0' }, { type: 'BUY_MATERIALS', batchId: 'miracle-worker-batch-1000000' },
    { type: 'CHOOSE_PROBABILITY', direction: 'GUARANTEED' }, { type: 'ROLL_PROBABILITY', roll: 1 },
    { type: 'RESET_HISTORY' }, { type: 'REFILL_REVIVALS' },
  ])('rejects unknown or client-forged command shape %#', command => {
    expect(validateMiracleWorkerCommand(command)).toBe(false); reject(beforeMiracle(), command);
  });
});

describe('Miracle Worker finite S2 practices and predecessor history validation', () => {
  it('keeps every predecessor practice valid after S2 resets only current digestion to zero', () => {
    const s = directedS2(); expect(s.progression.acting).toBe(0); expect(s.miracleWorker.ancientActingAtPromotion).toBe(100);
    for (const validate of [validateSeerPractice, validateClownState, validateMagicianPractice, validateFacelessPractice,
      validateMarionettistPractice, validateBizarroLife, validateAncientScholarLife, validateAncientScholarState]) expect(validate(s), validate.name).toBe(true);
    sameOldRoots(s, originalFinal); expect(validateMiracleWorkerState(s)).toBe(true);
    const copy = structuredClone(s); copy.miracleWorker.ancientActingAtPromotion = 0;
    expect(validateAncientScholarLife(copy)).toBe(false); expect(validateMiracleWorkerState(copy)).toBe(false);
  });
  it('requires real return to reception before starting S2 life', () => {
    const s = fourthWindow(); act(s, dose); expect(hasMiracleWorkerLock(s)).toBe(true);
    reject(s, { type: 'OBSERVE', caseId: 'small-repairs' }); act(s, { type: 'LEAVE_RITUAL' });
    expect(hasMiracleWorkerLock(s)).toBe(false); expect(miracleWorkerCommandBlock(s, { type: 'OBSERVE', caseId: 'small-repairs' })).toBeNull();
  });
  it('counts wishes only after three distinct owners actually inspect and take back their originals', () => {
    const s = directedS2(); begin(s, 'small-repairs'); act(s, { type: 'BUY_REPAIR_KIT' }); act(s, { type: 'BUY_OWN_BOX' });
    reject(s, { type: 'SELF_WISH' });
    for (const ownerId of MIRACLE_WORKER_OWNER_IDS) {
      act(s, { type: 'TAKE_ITEM', ownerId }); reject(s, { type: 'STOP', caseId: 'small-repairs' });
      act(s, { type: 'INSPECT_ITEM', ownerId }); act(s, { type: 'FIX_ITEM', ownerId });
      expect(s.miracleWorker.life.items.find(i => i.ownerId === ownerId)!.confirmedSecond).toBeNull();
      reject(s, { type: 'SELF_WISH' }); act(s, { type: 'RETURN_ITEM', ownerId }); reject(s, { type: 'TAKE_ITEM', ownerId });
    }
    const l = s.miracleWorker.life;
    expect(l.items.every(i => i.holder === 'OWNER' && i.handovers === 2 && i.similarWishBlockedUntil === i.confirmedSecond! + 7200)).toBe(true);
    expect(l.kit.packets.filter(p => p.usedFor !== null)).toHaveLength(3);
    expect(l.spent).toEqual({ cash: 84, spirituality: 0, mind: 0 }); expect(validateMiracleWorkerLife(s)).toBe(true);
  });
  it('returns an unrepaired original without manufacturing a confirmed wish or consuming material', () => {
    const s = directedS2(); begin(s, 'small-repairs'); act(s, { type: 'TAKE_ITEM', ownerId: 'mara' }); act(s, { type: 'RETURN_ITEM', ownerId: 'mara' });
    expect(s.miracleWorker.life.items[0]).toMatchObject({ holder: 'OWNER', handovers: 2, step: 0, confirmedSecond: null, similarWishBlockedUntil: null });
    expect(s.miracleWorker.life.kit.packets.every(p => p.usedFor === null)).toBe(true);
    act(s, { type: 'STOP', caseId: 'small-repairs' }); expect(validateMiracleWorkerLife(s)).toBe(true);
    act(s, { type: 'START', caseId: 'small-repairs' }); expect(s.miracleWorker.life.items[0]!.handovers).toBe(2);
  });
  it.each([1, 100])('keeps the finite self-wish cost and the exact original box on directed die %s', die => {
    const s = directedS2(); repairOwners(s); const before = structuredClone(s), l = s.miracleWorker.life;
    act(s, { type: 'SELF_WISH' }, die); reject(s, { type: 'SELF_WISH' });
    expect([s.spirituality, s.mind]).toEqual([before.spirituality - 6, before.mind - 2]);
    expect(l.ownBox.id).toBe('MW2-OWN-BOX-1'); expect(l.items).toEqual(before.miracleWorker.life.items);
    if (die === 100) act(s, { type: 'FINISH_ORDINARY' });
    expect(l.ownBox.repair).toBe(die === 1 ? 'WISH' : 'ORDINARY');
    expect(l.kit.packets.filter(p => p.usedFor !== null)).toHaveLength(die === 1 ? 3 : 4);
    report(s, 'small-repairs'); expectMasteryPacket(before, s, die === 1 ? 8 : 0);
    expect(l.cases['small-repairs'].result).toBe(die === 1 ? 'ABILITY' : 'ORDINARY');
    expect(s.progression.acting).toBe(25); expect(validateMiracleWorkerState(s)).toBe(true);
    reject(s, { type: 'REPORT', caseId: 'small-repairs' }); expectMasteryPacket(before, s, die === 1 ? 8 : 0);
  });
  it('uses the same random known-ability packet without a callback and keeps success distinct from the selected mastery', () => {
    const s = directedS2(); repairOwners(s); act(s, { type: 'SELF_WISH' }); act(s, { type: 'STOP', caseId: 'small-repairs' });
    const before = structuredClone(s), ctx = context(s);
    // A directed final ticket selects an inherited known ability, not the first S2 entry.
    ctx.roll = vi.fn((_min, max) => max);
    applyMiracleWorkerActivity(s, { type: 'REPORT', caseId: 'small-repairs' }, ctx); s.revision++;
    expect(ctx.roll).toHaveBeenCalledTimes(1); expectMasteryPacket(before, s, 8);
    expect(s.progression.mastery['diviner.s2.wish']).toBe(before.progression.mastery['diviner.s2.wish']);
    expect(s.miracleWorker.life.cases['small-repairs']).toMatchObject({ status: 'RESOLVED', result: 'ABILITY' });
    expect(s.seer.completedSources.filter(id => id === 'diviner.s2.wish')).toHaveLength(1);
    reject(s, { type: 'REPORT', caseId: 'small-repairs' }); expectMasteryPacket(before, s, 8);
    expect(validateMiracleWorkerState(s)).toBe(true);
  });
  it.each([['UP', 60, 4, 1], ['DOWN', 40, 4, 1], ['NONE', 50, 0, 0]] as const)('locks %s odds before one die and cannot refund or reroll it', (direction, chance, spirit, mind) => {
    const s = directedS2(); repairsReported(s); begin(s, 'limited-odds'); const before = structuredClone(s);
    reject(s, { type: 'ROLL_PROBABILITY' }); act(s, { type: 'CHOOSE_PROBABILITY', direction });
    expect(s.miracleWorker.life.probability).toMatchObject({ direction, chance, roll: null });
    expect([s.spirituality, s.mind]).toEqual([before.spirituality - spirit, before.mind - mind]);
    reject(s, { type: 'CHOOSE_PROBABILITY', direction: 'UP' }); reject(s, { type: 'FINISH_ORDINARY' });
    const ctx = act(s, { type: 'ROLL_PROBABILITY' }, 100); expect(ctx.roll).toHaveBeenCalledExactlyOnceWith(1, 100);
    expect(s.miracleWorker.life.probability.roll).toBe(100); reject(s, { type: 'ROLL_PROBABILITY' });
    act(s, { type: 'FINISH_ORDINARY' }); report(s, 'limited-odds');
    expect(s.progression.mastery['diviner.s2.probability']).toBe(0); expect(s.miracleWorker.life.probability.roll).toBe(100);
    expect(validateMiracleWorkerState(s)).toBe(true);
  });
  it('cannot spend unavailable spirituality or use zero remaining mind for wishes', () => {
    const s = directedS2(); repairOwners(s); s.spirituality = 5; reject(s, { type: 'SELF_WISH' });
    s.spirituality = 6; s.mind = 2; reject(s, { type: 'SELF_WISH' }); s.mind = 3;
    act(s, { type: 'SELF_WISH' }); expect([s.spirituality, s.mind]).toEqual([0, 1]); expect(validateMiracleWorkerLife(s)).toBe(true);
  });
  it('summons exactly one personally observed 30-second scene, then expires its payload but retains provenance', () => {
    const s = directedS2(); courtStarted(s); const before = structuredClone(s); act(s, { type: 'SUMMON_SCENE' });
    const scene = s.miracleWorker.life.scene, record = structuredClone(scene.imageRecord);
    expect(scene.source).toMatchObject({ bodyId: `${s.runId}:body`, place: 'MW2-CURRENT-COURTYARD', source: 'PERSONALLY_OBSERVED_CURRENT_ORIGINAL' });
    expect(scene.image).toMatchObject({ sourceId: scene.source!.id, remainingSeconds: 30 });
    expect([s.spirituality, s.mind]).toEqual([before.spirituality - 6, before.mind - 2]);
    reject(s, { type: 'SUMMON_SCENE' }); reject(s, { type: 'STOP', caseId: 'familiar-court' }); reject(s, { type: 'WORK' });
    act(s, { type: 'LOOK_SCENE' }); expect(scene.image!.remainingSeconds).toBe(20);
    act(s, { type: 'WAIT_SCENE' }); expect(scene).toMatchObject({ image: null, imageRecord: record, elapsedSeconds: 30, ended: 'EXPIRED', viewed: true });
    reject(s, { type: 'LOOK_SCENE' }); reject(s, { type: 'SUMMON_SCENE' });
    report(s, 'familiar-court'); act(s, { type: 'REFLECT' });
    expectMasteryPacket(before, s, 8); expect(s.progression.acting).toBe(100);
    expect(s.miracleWorker.life.cases['familiar-court'].result).toBe('ABILITY');
    expect(s.miracleWorker.life.kit).toEqual(before.miracleWorker.life.kit); expect(s.miracleWorker.life.ownBox).toEqual(before.miracleWorker.life.ownBox);
    sameOldRoots(s, before); expect(validateMiracleWorkerState(s)).toBe(true);
  });
  it('allows early scene termination without refund, permanent property or automatic mastery', () => {
    const s = directedS2(); courtStarted(s); act(s, { type: 'SUMMON_SCENE' }); const spirit = s.spirituality;
    act(s, { type: 'END_SCENE' });
    expect(s.miracleWorker.life.scene).toMatchObject({ image: null, elapsedSeconds: 1, ended: 'EARLY', viewed: false });
    expect(s.spirituality).toBe(spirit); act(s, { type: 'FINISH_ORDINARY' }); report(s, 'familiar-court');
    expect(s.progression.mastery['diviner.s2.scene-projection']).toBe(0); expect(validateMiracleWorkerLife(s)).toBe(true);
  });
  it('does not generate a scene on failure and preserves the spent resources through ordinary completion', () => {
    const s = directedS2(); courtStarted(s); act(s, { type: 'SUMMON_SCENE' }, 100); const spirit = s.spirituality;
    expect(s.miracleWorker.life.scene).toMatchObject({ image: null, imageRecord: null, elapsedSeconds: 0 });
    reject(s, { type: 'SUMMON_SCENE' }); act(s, { type: 'FINISH_ORDINARY' }); report(s, 'familiar-court'); act(s, { type: 'REFLECT' });
    expect(s.spirituality).toBe(spirit); expect(s.progression.acting).toBe(100); expect(s.progression.mastery['diviner.s2.scene-projection']).toBe(0);
    reject(s, { type: 'REFLECT' }); expect(validateMiracleWorkerState(s)).toBe(true);
  });
  it('projects detached life state, preventing UI edits from creating resources or wish records', () => {
    const s = directedS2(), before = structuredClone(s), p = projectMiracleWorker(s);
    p.life.practice!.kit.packets[0]!.usedFor = 'FORGED'; p.life.practice!.items[0]!.confirmedSecond = 1;
    expect(s).toEqual(before);
  });
});

describe('Miracle Worker actual same-seed continuation and S2 inherited practice regression', () => {
  // Bounded 5.9 MB artifact; never load the 122 MB continuation boundaries bundle.
  const continuation = JSON.parse(readFileSync('tests/fixtures/miracle-worker-v01640/continuation.json', 'utf8')) as {
    seed: string; commands: SliceIntent[]; prefixCount: number;
    promoted: SliceState; practiced: SliceState; combatStart: SliceState;
    beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState;
  };
  const actual = Object.fromEntries((['promoted', 'practiced', 'combatStart', 'beforeLast', 'final'] as const)
    .map(key => [key, migrateSliceState(continuation[key])])) as Record<'promoted' | 'practiced' | 'combatStart' | 'beforeLast' | 'final', SliceState>;

  it('keeps all 767 original public choices and three failed returned communities before the fifth original bottle succeeds', () => {
    expect(continuation.commands).toHaveLength(1038); expect(continuation.prefixCount).toBe(767);
    expect(continuation.seed).toBe(original.seed); expect(continuation.commands.slice(0, 767)).toEqual(original.commands);
    expect(actual.promoted.progression).toMatchObject({ sequence: 2, acting: 0 });
    expect(actual.promoted.miracleWorker.bottles.map(b => b.outcome)).toEqual(['FAILURE', 'FAILURE', 'FAILURE', 'FAILURE', 'SUCCESS']);
    for (const s of [actual.promoted, actual.practiced, actual.combatStart, actual.final]) {
      expect(s.miracleWorker.bottles.slice(0, 3)).toEqual(originalFinal.miracleWorker.bottles);
      expect(s.miracleWorker.ritual.sources.slice(0, 3)).toEqual(originalFinal.miracleWorker.ritual.sources);
      expect(s.miracleWorker.ritual.sources.every(q => q.restorationId !== null)).toBe(true);
      sameOldRoots(s, originalFinal);
    }
  });
  it('validates completed S9 and faceless practices at actual promotion, practiced, battle-start and live terminal S2', () => {
    for (const [name, s] of Object.entries(actual)) {
      expect(validateSeerPractice(s), `${name}: S9 originals`).toBe(true);
      expect(validateFacelessPractice(s), `${name}: S6 original appearance and outfit history`).toBe(true);
      for (const validate of [validateClownState, validateMagicianPractice, validateMarionettistPractice,
        validateBizarroLife, validateAncientScholarLife, validateAncientScholarState, validateMiracleWorkerState]) expect(validate(s), `${name}: ${validate.name}`).toBe(true);
      expect(s.miracleWorker.ancientActingAtPromotion).toBe(100); assertValidSliceState(s);
    }
  });
  it('retains natural probability and scene failures, ordinary recovery and unused revival allowance', () => {
    const s = actual.practiced;
    expect(s.progression.acting).toBe(100);
    expect(s.miracleWorker.life.cases['small-repairs']).toMatchObject({ status: 'RESOLVED', outcome: 'SUCCESS', result: 'ABILITY' });
    expect(s.miracleWorker.life.cases['limited-odds']).toMatchObject({ status: 'RESOLVED', outcome: 'FAILURE', result: 'ORDINARY' });
    expect(s.miracleWorker.life.cases['familiar-court']).toMatchObject({ status: 'RESOLVED', outcome: 'GREAT_FAILURE', result: 'ORDINARY' });
    expect(s.miracleWorker.life.scene.imageRecord).toBeNull(); expect(s.miracleWorker.life.scene.image).toBeNull();
    expectMasteryPacket(actual.promoted, s, 8);
    expect(actual.final).toMatchObject({ status: 'ACTIVE', health: 100, progression: { sequence: 2, acting: 100 } });
    expect(actual.final.miracleWorker.encounter).toMatchObject({ status: 'RESOLVED', location: 'MW2-NORTH-DRAIN-STAIR', enemyHealth: 60, enemyStatus: 'SURRENDERED' });
    expect(actual.final.miracleWorker.revival).toEqual({ allowance: 4, used: 0, pendingDeathId: null, records: [] });
  });
  it('replays only the new 271 public commands from the preserved original final and matches the complete saved continuation', () => {
    let state = structuredClone(originalFinal);
    for (const intent of continuation.commands.slice(original.commands.length)) state = applySliceIntent(state, intent);
    expect(state).toEqual(actual.final); assertValidSliceState(state);
    expect(applySliceIntent(actual.beforeLast, continuation.lastIntent)).toEqual(actual.final);
  }, 30000);
});

describe('Miracle Worker corrupt-save rejection', () => {
  it('rejects inconsistent sourcing, duplicate bottles, future chronology, paid-lead forgery and original-body replacement', () => {
    const valid = fourthWindow(); expect(validateMiracleWorkerState(valid)).toBe(true);
    const changes: ((s: SliceState) => void)[] = [
      s => { s.miracleWorker.batches[3]!.materials[0]!.source = 'free replacement'; },
      s => { s.miracleWorker.batches[3]!.materials[1]!.quantity = 300; },
      s => { s.miracleWorker.bottles.push(structuredClone(s.miracleWorker.bottles[0]!)); },
      s => { s.miracleWorker.bottles[3]!.inputIds[0] = 'ancient-scholar-batch-1:ingredient'; },
      s => { s.miracleWorker.batches[3]!.acquiredWeek = s.week + 1; },
      s => { s.miracleWorker.ritual.leads[0]!.confirmedWeek = s.miracleWorker.ritual.leads[0]!.requestedWeek; },
      s => { s.miracleWorker.ritual.leads[0]!.paidPennies = 48; },
      s => { s.miracleWorker.ritual.sources[0]!.residents[0]!.bodyId = 'replacement-body'; },
      s => { s.miracleWorker.ritual.sources[0]!.originals[0]!.holder = 'PLAYER'; },
      s => { s.miracleWorker.ritual.sources[3]!.deadline! += 1; },
      s => { s.miracleWorker.ritual.sources[3]!.exchangeStep = 6; },
      s => { s.miracleWorker.revival.used = 1; },
      s => { Object.assign(s.miracleWorker.revival, { freeRefills: 4 }); },
    ];
    for (const change of changes) { const copy = structuredClone(valid); change(copy); expect(validateMiracleWorkerState(copy), change.toString()).toBe(false); }
    expect(validateMiracleWorkerState(valid)).toBe(true);
  });
  it('rejects forged wish custody, duplicate material use, source identity, unlimited probability and fabricated paid costs', () => {
    const valid = directedS2(); courtStarted(valid); act(valid, { type: 'SUMMON_SCENE' });
    expect(validateMiracleWorkerLife(valid)).toBe(true);
    const changes: ((s: SliceState) => void)[] = [
      s => { s.miracleWorker.life.items[0]!.holder = 'PLAYER'; },
      s => { s.miracleWorker.life.items[0]!.similarWishBlockedUntil! += 1; },
      s => { s.miracleWorker.life.kit.packets[1]!.usedFor = s.miracleWorker.life.kit.packets[0]!.usedFor; },
      s => { s.miracleWorker.life.kit.pricePaid = 0; },
      s => { s.miracleWorker.life.spent.spirituality = 0; },
      s => { s.miracleWorker.life.probability.chance = 100; },
      s => { s.miracleWorker.life.scene.source!.bodyId = 'some-other-body'; },
      s => { s.miracleWorker.life.scene.image!.remainingSeconds = 31; },
      s => { s.miracleWorker.life.scene.imageRecord!.sourceId = 'unobserved-site'; },
      s => { s.seer.completedSources.push('miracle-worker-case:small-repairs'); },
      s => { s.progression.acting = 100; },
    ];
    for (const change of changes) { const copy = structuredClone(valid); change(copy); expect(validateMiracleWorkerLife(copy), change.toString()).toBe(false); }
  });
  it('rejects revived bodies and existing restoration IDs manufactured in an untouched default state', () => {
    const s = beforeMiracle(); s.miracleWorker.ritual.sources[0]!.restorationId = `${s.runId}:MW2-WHITE-ELM:RETURN`;
    expect(validateMiracleWorkerRitualState(s)).toBe(false);
    const t = beforeMiracle(); t.status = 'REVIVAL_PENDING'; expect(validateMiracleWorkerState(t)).toBe(false);
  });
});
