import { expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateUncleanMonarchSource } from '../../src/domain/unclean-monarch/index.js';
import { UNCLEAN_MONARCH_SOURCE_KEYS, UNCLEAN_MONARCH_ABILITY_IDS } from '../../src/domain/unclean-monarch/types.js';
import { UNCLEAN_MONARCH_CASE_IDS, getUncleanMonarchCurrentSite, uncleanMonarchLifeMasteryGains } from '../../src/domain/unclean-monarch/life.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { UNCLEAN_MONARCH_CAPTURE_EVIDENCE, type UncleanMonarchObservedCapture } from './unclean-monarch-capture-evidence.js';

export const UNCLEAN_MONARCH_ROOT = 'tests/fixtures/unclean-monarch-v02020';
export const UNCLEAN_MONARCH_SOURCE = 'tests/fixtures/blood-duke-v01800/natural.json';
export const UNCLEAN_MONARCH_SOURCE_BOUNDARY = 'tests/fixtures/blood-duke-v01800/boundary-real-combat-preparation.json';
export const UNCLEAN_MONARCH_PRIOR = 'tests/fixtures/blatherer-v01560/natural.json';
export const UNCLEAN_MONARCH_PREFIX_COUNT = 718;
export const UNCLEAN_MONARCH_INHERITED_COUNT = 583;
export const UNCLEAN_MONARCH_SEED = 'criminal-natural-v054';
export const captureValueHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
export const insertionOrderHash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const sameCaptureValue = (actual: unknown, expected: unknown): void => expect(captureValueHash(actual)).toBe(captureValueHash(expected));
export function observedCapture(): UncleanMonarchObservedCapture {
  if (!UNCLEAN_MONARCH_CAPTURE_EVIDENCE.observed) throw new Error('PENDING: no observed stage202 natural capture has been frozen.');
  return UNCLEAN_MONARCH_CAPTURE_EVIDENCE.observed;
}
export const naturalEntry = <T>(key: string): T => readObjectEntry<T>(`${UNCLEAN_MONARCH_ROOT}/natural.json`, key);
export const sourceEntry = <T>(key: string): T => readObjectEntry<T>(UNCLEAN_MONARCH_SOURCE, key);
export const summaryEntry = <T>(key: string): T => readObjectEntry<T>(`${UNCLEAN_MONARCH_ROOT}/summary.json`, key);
// Lazy metadata avoids reading nonexistent future captures during collection.
// Large historical documents are always streamed one top-level entry at a time.
export function captureMetadata() {
  observedCapture();
  return {
    boundaries: JSON.parse(readFileSync(`${UNCLEAN_MONARCH_ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>,
    steps: JSON.parse(readFileSync(`${UNCLEAN_MONARCH_ROOT}/boundaries.steps.json`, 'utf8')) as Record<string, number>,
    snapshots: naturalEntry<Record<string, string>>('snapshots'), commands: naturalEntry<SliceIntent[]>('commands'),
  };
}
export function capturePath(filename: string): string {
  if (filename !== basename(filename) || !filename.endsWith('.json')) throw new Error(`Nonlocal capture reference: ${filename}`);
  return `${UNCLEAN_MONARCH_ROOT}/${filename}`;
}
export async function captureFileHash(path: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
export async function* captureJsonLines<T>(name: 'commands.jsonl' | 'public.jsonl'): AsyncGenerator<T> {
  const input = createReadStream(`${UNCLEAN_MONARCH_ROOT}/${name}`, { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  try { for await (const line of lines) { expect(line.length).toBeGreaterThan(0); yield JSON.parse(line) as T; } }
  finally { lines.close(); input.destroy(); }
}
export function currentCapture(value: unknown): SliceState {
  const state = migrateSliceState(value);
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  return state;
}
export function originalLivingPrefix(): SliceState { return currentCapture(readObjectEntry<unknown>(UNCLEAN_MONARCH_SOURCE_BOUNDARY, 'beforeLast')); }
export function capturedState(key: 'initial' | 'prefixFinal' | 'beforeLast' | 'final'): SliceState {
  observedCapture(); return currentCapture(naturalEntry<unknown>(key));
}
export function capturedSnapshot(name: string): SliceState {
  const filename = captureMetadata().snapshots[name];
  if (!filename) throw new Error(`No actual Unclean Monarch snapshot: ${name}`);
  return currentCapture(JSON.parse(readFileSync(capturePath(filename), 'utf8')));
}
export function namedBoundary(name: string) {
  const filename = captureMetadata().boundaries[name];
  if (!filename) throw new Error(`No actual Unclean Monarch boundary: ${name}`);
  const path = capturePath(filename);
  return { path, count: readObjectEntry<number>(path, 'commandCount'), before: currentCapture(readObjectEntry<unknown>(path, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: currentCapture(readObjectEntry<unknown>(path, 'final')) };
}
export function assertPublicCaptureControl(state: SliceState, intent: SliceIntent): void {
  expect(validateSlicePayload(intent), JSON.stringify(intent)).toBe(true);
  const view = projectSliceState(state);
  if (intent.type === 'UNCLEAN_MONARCH') {
    const offered = view.uncleanMonarch.actions.find(row => stableStringify(row.command) === stableStringify(intent.command));
    expect(offered, `Missing actual public control: ${JSON.stringify(intent)}`).toBeDefined();
    expect(offered!.enabled, offered!.reason ?? JSON.stringify(intent)).toBe(true);
  } else if (intent.type === 'ACTION') {
    expect(['WORK', 'REST']).toContain(intent.action); expect(view.canAct, view.actionBlockedReason ?? '').toBe(true);
    expect(view.uncleanMonarch.insideCase).toBe(false); expect(state.combat).toBeNull(); expect(state.uncleanMonarch.preparedWeek).toBeNull();
  } else if (intent.type === 'EVENT_CHOICE') {
    expect(state.activeEvent?.instanceId).toBe(intent.eventInstanceId);
    expect(view.activeEvent?.choices.find(row => row.id === intent.choiceId)?.enabled).toBe(true);
  } else if (intent.type === 'COMBAT_ROUND') {
    expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull(); expect(intent.stance).toBe('CONTROL');
    expect(view.combat?.stances.some(stance => stance.id === intent.stance)).toBe(true);
    expect(state.combat?.encounterId).toBe('UNCLEAN_MONARCH_DISPUTE');
  } else throw new Error(`Unexpected continuation command: ${JSON.stringify(intent)}`);
}
export function replayCaptureBoundary(name: string) {
  const save = namedBoundary(name);
  if (save.count > UNCLEAN_MONARCH_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
  sameCaptureValue(applySliceIntent(save.before, save.intent), save.final); return save;
}
export const captureBody = (s: SliceState) => ({ status: s.status, revision: s.revision, week: s.week, date: s.date,
  H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, pollution: s.seer.pollution,
  injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, mastery: s.progression.mastery,
  sequence: s.progression.sequence, acting: s.progression.acting,
  finance: { weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier,
    nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit,
    pulse: s.pulse, billAmount: s.billAmount } });
export const sourceOriginals = (s: SliceState) => ({ site: s.blatherer.life, operation: s.bloodDuke.life.operation, strain: s.demon.strain });
export const currentOriginals = (s: SliceState) => ({
  site: s.uncleanMonarch.promotionWeek === null ? s.blatherer.life : getUncleanMonarchCurrentSite(s),
  operation: s.uncleanMonarch.promotionWeek === null ? s.bloodDuke.life.operation : s.uncleanMonarch.life.operation,
  strain: s.uncleanMonarch.encounter.strain ?? s.demon.strain,
});
export function actualLifeAbilityUse(s: SliceState) {
  const life = s.uncleanMonarch.life;
  return Object.fromEntries(UNCLEAN_MONARCH_ABILITY_IDS.map((id, index) => {
    const ids = UNCLEAN_MONARCH_CASE_IDS.filter(caseId => index === 1 ? caseId === 'observed-tension' : caseId !== 'observed-tension');
    const attempts = ids.flatMap(caseId => life.cases[caseId].attempts);
    return [id, { attempts: attempts.filter(a => a.castTier !== null).length,
      checkSuccesses: attempts.filter(a => a.castTier === 'SUCCESS' || a.castTier === 'GREAT_SUCCESS').length,
      actualApplications: attempts.filter(a => a.appliedAbilityIds.includes(id)).length,
      reportedApplications: ids.filter(caseId => life.cases[caseId].status === 'RESOLVED').flatMap(caseId => life.cases[caseId].attempts).filter(a => a.appliedAbilityIds.includes(id)).length }];
  }));
}
export function actualCombatAbilityUse(s: SliceState, original: SliceState) {
  const actions = s.combatHistory.slice(original.combatHistory.length).flatMap(round => {
    expect(round.uncleanMonarchOutcome).toBeDefined(); return round.uncleanMonarchOutcome!.playerActions;
  });
  return Object.fromEntries(UNCLEAN_MONARCH_ABILITY_IDS.map(id => {
    const selected = actions.filter(a => a.id === id);
    return [id, { selectedSlots: selected.length, paidAttempts: selected.filter(a => a.attempted).length,
      castingSuccesses: selected.filter(a => a.succeeded).length, preparedWindows: selected.filter(a => a.chargeGranted).length,
      actualApplications: selected.filter(a => a.applied && a.appliedAmount > 0).length,
      masteryApplications: selected.filter(a => a.masteryApplied.includes(id)).length,
      spiritualitySpent: selected.reduce((n, a) => n + a.paidCost, 0), mindSpent: selected.reduce((n, a) => n + a.mindCost, 0) }];
  }));
}
/** Historical roots are evidence, never mutable current bodies or refill stores. */
export function assertOriginalContinuity(state: SliceState, original: SliceState): void {
  for (const key of UNCLEAN_MONARCH_SOURCE_KEYS) sameCaptureValue(state[key], original[key]);
  if (state.uncleanMonarch.guidanceKnown) {
    sameCaptureValue(state.uncleanMonarch.sourceHistory, Object.fromEntries(UNCLEAN_MONARCH_SOURCE_KEYS.map(key => [key, original[key]])));
    sameCaptureValue(state.uncleanMonarch.sourceScene!.originals, sourceOriginals(original));
    expect(validateUncleanMonarchSource(state)).toBe(true);
  }
  const old = original.blatherer.life, now = currentOriginals(state), site = now.site, life = state.uncleanMonarch.life;
  expect(site.siteId).toBe(old.siteId); expect(Object.hasOwn(site, 'playerEnergy')).toBe(false);
  expect(Object.hasOwn(site.volunteer, 'energy')).toBe(false);
  for (const key of ['id', 'owner', 'quantity'] as const) sameCaptureValue(site.card[key], old.card[key]);
  for (const key of ['id', 'name', 'age', 'alive', 'willing'] as const) sameCaptureValue(site.volunteer[key], old.volunteer[key]);
  sameCaptureValue(site.guide, old.guide); sameCaptureValue(site.bell, old.bell); sameCaptureValue(site.note, old.note);
  expect(site.playerTravelMetres).toBeGreaterThanOrEqual(old.playerTravelMetres); expect(site.clockSeconds).toBeGreaterThanOrEqual(old.clockSeconds);
  expect(site.card.travelMetres).toBeGreaterThanOrEqual(old.card.travelMetres);
  expect(now.operation.door).toBe('OPEN'); expect(now.operation.bellRehearsals).toBeGreaterThanOrEqual(original.bloodDuke.life.operation.bellRehearsals);
  expect(now.strain).toBeGreaterThanOrEqual(0); expect(now.strain).toBeLessThanOrEqual(original.demon.strain);
  expect(life.volunteerEffortSpent).toBe(UNCLEAN_MONARCH_CASE_IDS.flatMap(id => life.cases[id].attempts).reduce((n, a) => n + a.volunteerEffortSpent, 0));
  expect(life.volunteerEffortSpent).toBeLessThanOrEqual(12);
  sameCaptureValue(state.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  const mastery = { ...original.progression.mastery };
  if (state.progression.sequence === 1) {
    for (const id of UNCLEAN_MONARCH_ABILITY_IDS) mastery[id] = 0;
    for (const [id, gain] of Object.entries(uncleanMonarchLifeMasteryGains(state))) mastery[id] = Math.min(500, mastery[id]! + gain);
  }
  for (const round of state.combatHistory.slice(original.combatHistory.length)) {
    expect(round.uncleanMonarchOutcome).toBeDefined();
    for (const action of [...round.uncleanMonarchOutcome!.playerActions, ...round.uncleanMonarchOutcome!.enemyActions]) {
      for (const id of action.masteryApplied) { expect(Object.hasOwn(mastery, id)).toBe(true); mastery[id] = Math.min(500, mastery[id]! + 8); }
    }
  }
  sameCaptureValue(state.progression.mastery, mastery);
  const { coreStats, ...identity } = state.character, { coreStats: oldStats, ...oldIdentity } = original.character;
  sameCaptureValue(identity, oldIdentity);
  for (const key of Object.keys(oldStats) as (keyof typeof oldStats)[]) expect(coreStats[key]).toBe(Math.min(500, oldStats[key] + (state.progression.sequence === 1 ? 1 : 0)));
  expect(state.runId).toBe(original.runId); expect(state.random.seed).toBe(UNCLEAN_MONARCH_SEED);
  expect(state.progression.promotionWeek).toBe(original.progression.promotionWeek);
}
