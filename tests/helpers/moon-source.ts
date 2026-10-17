import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { compareGameDates } from '../../src/domain/game-calendar.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { BeautyGoddessCommand } from '../../src/domain/beauty-goddess/types.js';
import { BEAUTY_GODDESS_CASE_IDS } from '../../src/domain/beauty-goddess/life.js';
import { resolveBeautyGoddessOriginalCharacteristics } from '../../src/domain/beauty-goddess/index.js';
import { MOON_VACANCY_DATE } from '../../src/domain/moon/content.js';
import { moonSourceBlock } from '../../src/domain/moon/source.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';
import { readObjectEntry } from './read-object-entry.js';

export const MOON_RECOVERY_SOURCE = 'tests/fixtures/beauty-goddess-v01900/script-blocker-first.json';
export const MOON_RECOVERY_SOURCE_SHA256 = '195064d584c3fa6bb7c87584970ab5e2a43d5493613cb66afa3252902fc453eb';
export const moonStateHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
export function assertUnmodifiedMoonRecoverySource(): void {
  expect(createHash('sha256').update(readFileSync(MOON_RECOVERY_SOURCE)).digest('hex')).toBe(MOON_RECOVERY_SOURCE_SHA256);
}

/** EXPLICIT CONTROLLED TEST BRANCH, never a natural success capture.
 * Only the next new d100 at cursor318 is substituted. The real draw still runs
 * first and advances its cursor; all frozen draws0..317 remain untouched.
 * Keep this seam installed for strict replay of states produced under it. */
export function installControlledMoonS1Promotion() {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  const substituted: { cursorBefore: number; cursorAfter: number; actual: number; controlled: number }[] = [];
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum: number, maximum: number,
  ) {
    const cursorBefore = this.cursor, actual = original.call(this, minimum, maximum);
    if (this.seed === 'apothecary-rebuild-first' && cursorBefore === 318 && minimum === 1 && maximum === 100) {
      substituted.push({ cursorBefore, cursorAfter: this.cursor, actual, controlled: 1 });
      return 1;
    }
    return actual;
  });
  return { substituted, restore: () => spy.mockRestore() };
}

/** Derive a complete controlled S1 through public commands from exact670.
 * The caller must install the explicitly controlled new-draw seam above.
 * No initial resources, stats, dates, seed, cursor, receipts or original bottles
 * are edited. Ordinary paid life reaches the dated vacancy; three actual
 * ordinary cases and reflection earn acting100. This is test evidence only. */
export function controlledMoonSource(originalNumber: 1 | 2 | 3 = 1): SliceState {
  assertUnmodifiedMoonRecoverySource();
  const raw = readObjectEntry<SliceState>(MOON_RECOVERY_SOURCE, 'final'), rawHash = moonStateHash(raw);
  expect(readObjectEntry<SliceIntent[]>(MOON_RECOVERY_SOURCE, 'commands')).toHaveLength(670);
  expect(raw).toMatchObject({ revision: 671, week: 160, cash: 14, actionsRemaining: 1,
    random: { seed: 'apothecary-rebuild-first', cursor: 318 }, progression: { sequence: 2, acting: 100 } });
  let state = migrateSliceState(raw);
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  const oldBottles = structuredClone(state.beautyGoddess.bottles);
  const oldJournal = structuredClone(state.beautyGoddess.acquisitionJournal);
  const originalPartner = structuredClone(state.summoningMaster.life.partner);
  const sourceBottleId = `beauty-goddess-potion-${originalNumber}`, recoveredBottleId = 'beauty-goddess-potion-4';
  let steps = 0;
  const step = (intent: SliceIntent): void => {
    if (++steps > 250) throw Error('Controlled Moon source exceeded its bounded public route');
    try { state = applySliceIntent(state, intent); }
    catch (error) { throw new Error(`Controlled Moon source blocked at ${JSON.stringify(intent)}: ${String(error)}`); }
    expect(state.status).toBe('ACTIVE');
  };
  const settleBill = (): void => {
    while (state.activeEvent) {
      expect(state.activeEvent.id, 'Only the actual ordinary living bill may interrupt this route').toBe('LIFE-BILL-01');
      step({ type: 'EVENT_CHOICE', eventInstanceId: state.activeEvent.instanceId, choiceId: 'PAY_PART' });
    }
  };
  const ordinary = (): void => {
    settleBill();
    step({ type: 'ACTION', action: state.wagePaidWeek !== state.week ? 'WORK' : 'REST' });
    settleBill();
  };
  const afford = (cash: number, actions = 1): void => {
    while (state.cash < cash || state.actionsRemaining < actions) ordinary();
  };
  const beauty = (command: BeautyGoddessCommand): void => { step({ type: 'BEAUTY_GODDESS', command }); settleBill(); };

  afford(400);
  beauty({ type: 'REQUEST_RECOVERY_V1', bottleId: sourceBottleId });
  const requestedWeek = state.beautyGoddess.resupply.recovery!.requestedWeek;
  while (state.week <= requestedWeek) ordinary();
  beauty({ type: 'RECOVER_CHARACTERISTIC_V1', bottleId: sourceBottleId });
  for (let n = 0; n < 5; n++) { afford(0); beauty({ type: 'POTION_WORK', bottleId: recoveredBottleId }); }
  afford(300);
  beauty({ type: 'BUY_POTION', bottleId: recoveredBottleId });
  beauty({ type: 'PREPARE_PROMOTION' });
  beauty({ type: 'CONSUME', bottleId: recoveredBottleId, confirmed: true });
  expect(state.progression.sequence).toBe(1);
  expect(state.character.coreStats.will).toBe(raw.character.coreStats.will + 1);
  expect(state.beautyGoddess.acquisitionJournal.at(-1)).toMatchObject({
    command: { type: 'CONSUME', bottleId: recoveredBottleId, confirmed: true },
    cursorBefore: 318, cursorAfter: 319, check: { chance: 44, roll: 1, tier: 'GREAT_SUCCESS' },
  });

  // Complete only ordinary, visible work/rest weeks; there is no date jump,
  // duplicated weekly wage, source replenishment or hidden successful scene.
  while (compareGameDates(state.date, MOON_VACANCY_DATE) <= 0 || state.cash < 500 || state.actionsRemaining < 3) ordinary();
  for (const caseId of BEAUTY_GODDESS_CASE_IDS) {
    expect(state.actionsRemaining).toBe(3);
    beauty({ type: 'OBSERVE', caseId });
    beauty({ type: 'INVITE', caseId, method: 'ORDINARY' });
    beauty({ type: 'VISIT_HOME' });
    beauty({ type: 'CONSENT', permission: 'CARETAKER' });
    beauty({ type: 'CONSENT', permission: 'GUEST' });
    beauty({ type: 'DECLINE_CONSENT', permission: 'SELF_POWER' });
    beauty({ type: 'BORROW_WEIGHT' });
    if (caseId === 'withdrawn-moonlight') {
      beauty({ type: 'LOWER_SHUTTER' });
      beauty({ type: 'REVOKE_CONSENT', permission: 'GUEST' });
      beauty({ type: 'RAISE_SHUTTER' });
    }
    beauty({ type: 'ORDINARY_PLACE' });
    beauty({ type: 'RETURN_WEIGHT' });
    beauty({ type: 'RETURN_HOME' });
    beauty({ type: 'REPORT', caseId });
  }
  beauty({ type: 'REFLECT' });
  expect(state.progression.acting).toBe(100);
  expect(state.beautyGoddess.life.reflected).toBe(true);
  expect(state.beautyGoddess.bottles.slice(0, 3)).toEqual(oldBottles);
  expect(state.beautyGoddess.acquisitionJournal.slice(0, oldJournal.length)).toEqual(oldJournal);
  expect(state.beautyGoddess.bottles[3]!.recovery).toMatchObject({
    originalBottleId: sourceBottleId, sourceBottleId, characteristicId: `${sourceBottleId}:characteristic`,
  });
  expect(resolveBeautyGoddessOriginalCharacteristics(state)).toMatchObject({
    embodiedOriginalBottleId: sourceBottleId, embodiedBottleId: recoveredBottleId,
  });
  expect(state.summoningMaster.life.partner).toEqual(originalPartner);
  expect(state.random).toEqual({ seed: raw.random.seed, cursor: 319 });
  expect(moonSourceBlock(state)).toBeNull();
  assertValidSliceState(state);
  expect(moonStateHash(raw)).toBe(rawHash); assertUnmodifiedMoonRecoverySource();
  return state;
}
