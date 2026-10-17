import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { PERFECTER_FROZEN_SOURCE_KEYS } from '../../src/domain/perfecter/source.js';
import { PERFECTER_ABILITY_IDS } from '../../src/domain/perfecter/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { readObjectEntry } from './read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';

// Explicit controlled branch, never a natural capture. These files are read only;
// no altered fixture, seed, cursor, production option or outcome is written.
export const PERFECTER_CONSUME_BOUNDARY = 'tests/fixtures/perfecter-v02110/boundary-919-consume.json';
export const PERFECTER_CONSUME_BOUNDARY_SHA256 = 'f1795525729ca1104d52aee06b274456d5fc628bedcf3c871cc9524b34f289d8';
export const PERFECTER_CONSUME_BEFORE_SHA256 = 'a427bdc9247c30e76a792734db90d0b9ec9b9186245ff866eb611dedf18b5172';
const ORIGINAL = 'tests/fixtures/civilization-enlightener-v01890/natural.json';
export const CONTROLLED_CONSUME = {
  type: 'PERFECTER', command: { type: 'CONSUME', compoundId: 'perfecter-compound-1', confirmed: true },
} as const satisfies SliceIntent;
export const controlledHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');

// The immutable producer sorts ALL object keys lexically, including numeric
// keys. Runtime canonical hashing remains separate from this capture format.
function captureStable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(captureStable).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${captureStable(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value)!;
}
const captureValueHash = (value: unknown): string => createHash('sha256').update(captureStable(value)).digest('hex');

/** Preserve every captured208 field. Only the two version labels are normalized;
 * newly introduced known roots must exactly equal their whole fresh CURRENT
 * defaults. Missing, unknown or nonempty additions never disappear from proof. */
function captureHash(current: SliceState, historical: SliceState): string {
  expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  const defaults = createSliceRun(historical.runId,
    readObjectEntry<Parameters<typeof createSliceRun>[1]>(ORIGINAL, 'creation'), historical.random.seed);
  const old = historical as unknown as Record<string, unknown>, now = current as unknown as Record<string, unknown>;
  const fresh = defaults as unknown as Record<string, unknown>;
  const added = Object.keys(fresh).filter(key => !Object.hasOwn(old, key));
  expect(Object.keys(now).sort()).toEqual([...Object.keys(old), ...added].sort());
  for (const key of added) expect(now[key], `New root ${key} must remain the complete fresh current default`).toEqual(fresh[key]);
  return captureValueHash({ ...Object.fromEntries(Object.keys(old).map(key => [key, now[key]])),
    schemaVersion: historical.schemaVersion, contentVersion: historical.contentVersion });
}
function migrateExactly(historical: SliceState): SliceState {
  const beforeHash = captureValueHash(historical), current = migrateSliceState(historical);
  expect(captureValueHash(historical), 'Migration cannot mutate historical input').toBe(beforeHash);
  expect(captureHash(current, historical)).toBe(beforeHash);
  return current;
}
export function assertUnmodifiedPerfecterCapture(): void {
  expect(createHash('sha256').update(readFileSync(PERFECTER_CONSUME_BOUNDARY)).digest('hex')).toBe(PERFECTER_CONSUME_BOUNDARY_SHA256);
  expect(createHash('sha256').update(readFileSync(ORIGINAL)).digest('hex')).toBe('5d7a97347f8a555c91c7b1a57dc4acdebd78f3ac36414e1674d2bb5d34cc835f');
}
export function authenticPerfecterBeforeConsume(): SliceState {
  assertUnmodifiedPerfecterCapture();
  expect(readObjectEntry<number>(PERFECTER_CONSUME_BOUNDARY, 'commandCount')).toBe(919);
  expect(readObjectEntry<SliceIntent>(PERFECTER_CONSUME_BOUNDARY, 'lastIntent')).toEqual(CONTROLLED_CONSUME);
  const historical = readObjectEntry<SliceState>(PERFECTER_CONSUME_BOUNDARY, 'beforeLast');
  expect([historical.schemaVersion, historical.contentVersion]).toEqual([208, 'perfecter-v208']);
  expect(captureValueHash(historical)).toBe(PERFECTER_CONSUME_BEFORE_SHA256);
  const before = migrateExactly(historical);
  expect(before).toMatchObject({ revision: 919, status: 'ACTIVE', week: 220,
    health: 100, mind: 92, spirituality: 108, cash: 440, actionsRemaining: 1, injuries: [], injuryRisk: 0,
    random: { seed: 'savant-rebuild-first', cursor: 346 }, progression: { sequence: 1, acting: 100 } });
  expect(before.perfecter.journal.flatMap(event => event.randomReceipts)).toEqual([]);
  expect(before.perfecter.promotionStability.preparations).toHaveLength(1);
  expect(before.perfecter.promotionStability.preparations[0]).toMatchObject({ status: 'READY', compoundId: 'perfecter-compound-1', spentEventId: null });
  const original = readObjectEntry<SliceState>(ORIGINAL, 'final');
  for (const key of PERFECTER_FROZEN_SOURCE_KEYS) expect(before[key]).toEqual(original[key]);
  expect(before.perfecter.source!.budget.injuries).toEqual(original.injuries);
  expect(before.perfecter.source!.originalDevices).toEqual(original.alchemist.life.creations);
  expect(before.progression.mastery).toEqual(original.progression.mastery);
  assertValidSliceState(before);
  return before;
}

/** Sole injection: one specific first-new d100 draw returns the declared 1.
 * The real method ALWAYS executes first, including its validation and cursor
 * increment. Historical draws 0..345 and later draws pass through unchanged.
 * Replay uses the same seam; it is deliberately NOT production-valid evidence. */
export function installControlledPerfecterPromotion() {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  const substituted: { cursorBefore: number; cursorAfter: number; actual: number; controlled: number }[] = [];
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum: number, maximum: number,
  ) {
    const cursorBefore = this.cursor, actual = original.call(this, minimum, maximum);
    if (this.seed === 'savant-rebuild-first' && cursorBefore === 346 && minimum === 1 && maximum === 100) {
      substituted.push({ cursorBefore, cursorAfter: this.cursor, actual, controlled: 1 });
      return 1;
    }
    return actual;
  });
  return { substituted, restore: () => spy.mockRestore(), original };
}

export function assertControlledPerfecterPromotion(before: SliceState, after: SliceState): void {
  const event = after.perfecter.journal.at(-1)!;
  expect(after).toMatchObject({ revision: 920, status: 'ACTIVE', week: 220, health: 100, mind: 92,
    spirituality: 78, cash: 440, actionsRemaining: 0, seer: { pollution: 0 }, injuries: [], injuryRisk: 0,
    progression: { pathwayId: 'paragon', sequence: 0, acting: 0 },
    random: { seed: 'savant-rebuild-first', cursor: 347 }, perfecter: { promotionWeek: 220, epilogue: null } });
  expect(event.command).toEqual(CONTROLLED_CONSUME.command);
  expect(event.before).toEqual(before.perfecter.frame);
  expect(event.after).toEqual(after.perfecter.frame);
  expect(event.randomReceipts).toEqual([{ kind: 'CHECK', id: `${event.id}:check:1`, cursorBefore: 346, cursorAfter: 347,
    check: { ability: 'will', baseAbility: 25, modifiers: [{ source: '本瓶本次实际稳定准备', value: 40 }],
      effectiveAbility: 65, difficulty: 55, chance: 70, roll: 1, tier: 'GREAT_SUCCESS' } }]);
  expect(after.perfecter.promotionStability.preparations).toEqual([
    { ...before.perfecter.promotionStability.preparations[0], status: 'SPENT', spentEventId: event.id },
  ]);
  const materials = after.perfecter.materials!, previous = before.perfecter.materials!;
  expect(materials.characteristics).toHaveLength(3);
  expect(materials.characteristics.map(item => item.id)).toEqual(previous.characteristics.map(item => item.id));
  for (const item of [...materials.characteristics, materials.uniqueness])
    expect(item).toMatchObject({ holder: 'FUSED', compoundId: 'perfecter-compound-1', location: null });
  expect(materials.uniqueness.id).toBe(previous.uniqueness.id);
  expect(materials.uniqueness.incumbentActorId).toBe(materials.origin.actorId);
  expect(materials.compounds).toHaveLength(1);
  expect(materials.compounds[0]).toEqual({ ...previous.compounds[0], status: 'SUCCESS', consumedWeek: 220, settlementEventId: event.id });
  expect(materials.batches).toEqual(previous.batches.map(batch => batch.id === 'perfecter-carrier-1'
    ? { ...batch, status: 'SPENT', spentWeek: 220 } : batch));
  expect(materials.settlements).toEqual([{ eventId: event.id, week: 220, compoundId: 'perfecter-compound-1',
    success: true, alive: true, location: 'backlund:ritual-workshop' }]);
  expect(materials.receipts).toEqual(previous.receipts);
  expect(materials.refills).toEqual(previous.refills);
  expect(Object.keys(before.progression.mastery)).toHaveLength(21);
  expect(Object.keys(after.progression.mastery)).toHaveLength(23);
  for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(after.progression.mastery[id]).toBe(mastery);
  expect(Object.values(before.progression.mastery).filter(value => value === 0)).toHaveLength(8);
  for (const id of PERFECTER_ABILITY_IDS) expect(after.progression.mastery[id]).toBe(0);
  expect(after.perfecter.source).toEqual(before.perfecter.source);
  expect(after.perfecter.journal.slice(0, -1)).toEqual(before.perfecter.journal);
  for (const key of PERFECTER_FROZEN_SOURCE_KEYS) expect(after[key]).toEqual(before[key]);
  expect(after.alchemist.life.creations.map(device => [device.charge, device.durability])).toEqual([[0, 100], [0, 95]]);
  const historical = readObjectEntry<SliceState>(PERFECTER_CONSUME_BOUNDARY, 'beforeLast');
  expect(captureValueHash(historical)).toBe(PERFECTER_CONSUME_BEFORE_SHA256);
  expect(captureHash(before, historical)).toBe(PERFECTER_CONSUME_BEFORE_SHA256);
}
