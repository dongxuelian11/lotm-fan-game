import { expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateDivineHandSource } from '../../src/domain/divine-hand/index.js';
import { DIVINE_HAND_SOURCE_KEYS, DIVINE_HAND_ABILITY_IDS } from '../../src/domain/divine-hand/types.js';
import { divineHandExpectedOriginals, divineHandLifeMasteryGains } from '../../src/domain/divine-hand/life.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { currentDivineHandReplayExpectation } from '../helpers/divine-hand-current-replay.js';

export const DIVINE_HAND_ROOT = 'tests/fixtures/divine-hand-v01980';
export const DIVINE_HAND_SOURCE = 'tests/fixtures/glory-v01760/natural.json';
export const DIVINE_HAND_PREFIX_COUNT = 158;
export const CAPTURE_BOUNDARY_TIMEOUT = 120_000;
export const captureValueHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
export const insertionOrderHash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Compare large states by digest rather than constructing enormous nested diffs.
export const sameCaptureValue = (a: unknown, b: unknown): void => expect(captureValueHash(a)).toBe(captureValueHash(b));
export const naturalEntry = <T>(key: string): T => readObjectEntry<T>(`${DIVINE_HAND_ROOT}/natural.json`, key);
export const sourceEntry = <T>(key: string): T => readObjectEntry<T>(DIVINE_HAND_SOURCE, key);
export const summaryEntry = <T>(key: string): T => readObjectEntry<T>(`${DIVINE_HAND_ROOT}/summary.json`, key);

// Retain only small metadata. Large natural captures are read one top-level
// entry at a time; historical schema literals are asserted before migration.
export const boundaryIndex: Record<string, string> = JSON.parse(readFileSync(`${DIVINE_HAND_ROOT}/boundaries.index.json`, 'utf8'));
export const boundarySteps: Record<string, number> = JSON.parse(readFileSync(`${DIVINE_HAND_ROOT}/boundaries.steps.json`, 'utf8'));
export const snapshotIndex = naturalEntry<Record<string, string>>('snapshots');
export const captureCommands = naturalEntry<SliceIntent[]>('commands');
export const uniqueBoundaryFiles = [...new Set(Object.values(boundaryIndex))];
export function capturePath(filename: string): string {
  if (filename !== basename(filename) || !filename.endsWith('.json')) throw new Error(`Nonlocal capture reference: ${filename}`);
  return `${DIVINE_HAND_ROOT}/${filename}`;
}
export async function captureFileHash(path: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
export async function* captureJsonLines<T>(name: 'commands.jsonl' | 'public.jsonl'): AsyncGenerator<T> {
  const input = createReadStream(`${DIVINE_HAND_ROOT}/${name}`, { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  try { for await (const line of lines) if (line.trim()) yield JSON.parse(line) as T; }
  finally { lines.close(); input.destroy(); }
}
export function currentCapture(value: unknown): SliceState {
  const state = migrateSliceState(value);
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  return state;
}
export function capturedState(key: 'initial' | 'prefixFinal' | 'beforeLast' | 'final'): SliceState {
  return currentCapture(naturalEntry<unknown>(key));
}
export function capturedSnapshot(name: string): SliceState {
  const filename = snapshotIndex[name];
  if (!filename) throw new Error(`Missing actual Divine Hand snapshot: ${name}`);
  return currentCapture(JSON.parse(readFileSync(capturePath(filename), 'utf8')));
}
export function boundaryFile(filename: string) {
  const path = capturePath(filename);
  return { count: readObjectEntry<number>(path, 'commandCount'),
    before: currentCapture(readObjectEntry<unknown>(path, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: currentCapture(readObjectEntry<unknown>(path, 'final')) };
}
export function namedBoundary(name: string) {
  const filename = boundaryIndex[name];
  if (!filename) throw new Error(`Missing actual Divine Hand boundary: ${name}`);
  return boundaryFile(filename);
}
export function assertPublicCaptureControl(state: SliceState, intent: SliceIntent): void {
  expect(validateSlicePayload(intent), JSON.stringify(intent)).toBe(true);
  const view = projectSliceState(state);
  if (intent.type === 'DIVINE_HAND') {
    const offered = view.divineHand.actions.find(row => stableStringify(row.command) === stableStringify(intent.command));
    expect(offered, `Missing current public control: ${JSON.stringify(intent)}`).toBeDefined();
    expect(offered!.enabled, offered!.reason ?? JSON.stringify(intent)).toBe(true);
  } else if (intent.type === 'ACTION') {
    expect(['WORK', 'REST']).toContain(intent.action); expect(view.canAct, view.actionBlockedReason ?? JSON.stringify(intent)).toBe(true);
  } else if (intent.type === 'EVENT_CHOICE') {
    expect(state.activeEvent?.instanceId).toBe(intent.eventInstanceId);
    const choice = view.activeEvent?.choices.find(row => row.id === intent.choiceId);
    expect(choice, `Missing public event choice: ${JSON.stringify(intent)}`).toBeDefined(); expect(choice!.enabled).toBe(true);
  } else if (intent.type === 'COMBAT_ROUND') {
    expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull(); expect(intent.stance).toBe('CONTROL');
    expect(view.combat?.stances.some(stance => stance.id === intent.stance)).toBe(true);
  } else throw new Error(`Unexpected continuation command: ${JSON.stringify(intent)}`);
}
export function replayCaptureBoundary(name: string) {
  const save = namedBoundary(name);
  if (save.count > DIVINE_HAND_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
  // A restored historical boundary retains its original guidance. Only the
  // command that actually writes guidance uses the exact current expectation.
  const expected = save.intent.type === 'DIVINE_HAND' && save.intent.command.type === 'LEARN_GUIDANCE'
    ? currentDivineHandReplayExpectation(save.final) : save.final;
  sameCaptureValue(applySliceIntent(save.before, save.intent), expected);
  return save;
}
export const captureBody = (s: SliceState) => ({ status: s.status, revision: s.revision, week: s.week, date: s.date,
  H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, pollution: s.seer.pollution,
  injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, mastery: s.progression.mastery,
  sequence: s.progression.sequence, acting: s.progression.acting });

/** Frozen eight-root history is immutable. Only the original repair-room
 * registry follows the captured life and combat resource journal. */
export function assertOriginalContinuity(state: SliceState, original: SliceState): void {
  for (const key of DIVINE_HAND_SOURCE_KEYS) {
    const current = structuredClone(state[key]);
    if (key === 'glory') (current as SliceState['glory']).life.site = structuredClone(original.glory.life.site);
    sameCaptureValue(current, original[key]);
  }
  if (state.divineHand.guidanceKnown) {
    sameCaptureValue(state.divineHand.sourceHistory, Object.fromEntries(DIVINE_HAND_SOURCE_KEYS.map(key => [key, original[key]])));
    expect(validateDivineHandSource(state)).toBe(true);
    sameCaptureValue({ site: state.glory.life.site }, divineHandExpectedOriginals(state));
  } else sameCaptureValue(state.glory.life.site, original.glory.life.site);
  const site = state.glory.life.site, old = original.glory.life.site;
  for (const key of ['load', 'plates', 'bridge', 'armorSource'] as const) sameCaptureValue(site[key], old[key]);
  for (const key of ['celia', 'evan'] as const) {
    sameCaptureValue({ ...site[key], location: old[key].location, energy: old[key].energy, travelMetres: old[key].travelMetres }, old[key]);
  }
  sameCaptureValue(state.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  const mastery = { ...original.progression.mastery };
  if (state.progression.sequence === 1) {
    for (const id of DIVINE_HAND_ABILITY_IDS) mastery[id] = 0;
    for (const [id, gain] of Object.entries(divineHandLifeMasteryGains(state))) mastery[id] = Math.min(500, mastery[id]! + gain);
  }
  for (const round of state.combatHistory.slice(original.combatHistory.length)) {
    expect(round.divineHandOutcome).toBeDefined();
    for (const action of [...round.divineHandOutcome!.playerActions, ...round.divineHandOutcome!.enemyActions]) {
      for (const id of action.masteryApplied) { expect(Object.hasOwn(mastery, id)).toBe(true); mastery[id] = Math.min(500, mastery[id]! + 8); }
    }
  }
  sameCaptureValue(state.progression.mastery, mastery);
  expect(state.runId).toBe(original.runId); expect(state.random.seed).toBe(original.random.seed);
  const { coreStats, ...identity } = state.character, { coreStats: originalStats, ...originalIdentity } = original.character;
  sameCaptureValue(identity, originalIdentity);
  for (const id of Object.keys(originalStats) as (keyof typeof originalStats)[]) expect(coreStats[id]).toBe(Math.min(500, originalStats[id] + (state.progression.sequence === 1 ? 1 : 0)));
  expect(state.progression.promotionWeek).toBe(original.progression.promotionWeek);
}
