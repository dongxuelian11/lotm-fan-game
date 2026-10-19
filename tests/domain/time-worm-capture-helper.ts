import { expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateTimeWormSource } from '../../src/domain/time-worm/index.js';
import { TIME_WORM_SOURCE_KEYS, TIME_WORM_ABILITY_IDS } from '../../src/domain/time-worm/types.js';
import { timeWormExpectedOriginals, timeWormLifeMasteryGains } from '../../src/domain/time-worm/life.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { currentTimeWormReplayExpectation } from '../helpers/time-worm-current-replay.js';

export const TIME_WORM_ROOT = 'tests/fixtures/time-worm-v01970';
export const TIME_WORM_SOURCE = 'tests/fixtures/fate-trojan-v01750/natural.json';
export const TIME_WORM_PEACEFUL_SOURCE = 'tests/fixtures/deceit-mentor-v01510/peaceful.json';
export const TIME_WORM_DEATH_SOURCE = 'tests/fixtures/deceit-mentor-v01510/natural.json';
export const TIME_WORM_PREFIX_COUNT = 551;
export const CAPTURE_BOUNDARY_TIMEOUT = 120_000;
export const captureValueHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
export const insertionOrderHash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Compare large states by digest rather than constructing enormous nested diffs.
export const sameCaptureValue = (a: unknown, b: unknown): void => expect(captureValueHash(a)).toBe(captureValueHash(b));
export const naturalEntry = <T>(key: string): T => readObjectEntry<T>(`${TIME_WORM_ROOT}/natural.json`, key);
export const sourceEntry = <T>(key: string): T => readObjectEntry<T>(TIME_WORM_SOURCE, key);
export const peacefulEntry = <T>(key: string): T => readObjectEntry<T>(TIME_WORM_PEACEFUL_SOURCE, key);
export const summaryEntry = <T>(key: string): T => readObjectEntry<T>(`${TIME_WORM_ROOT}/summary.json`, key);

// Retain only small metadata. Large natural captures are read one top-level
// entry at a time; historical schema literals are asserted before migration.
export const boundaryIndex: Record<string, string> = JSON.parse(readFileSync(`${TIME_WORM_ROOT}/boundaries.index.json`, 'utf8'));
export const boundarySteps: Record<string, number> = JSON.parse(readFileSync(`${TIME_WORM_ROOT}/boundaries.steps.json`, 'utf8'));
export const snapshotIndex = naturalEntry<Record<string, string>>('snapshots');
export const captureCommands = naturalEntry<SliceIntent[]>('commands');
export const uniqueBoundaryFiles = [...new Set(Object.values(boundaryIndex))];
export function capturePath(filename: string): string {
  if (filename !== basename(filename) || !filename.endsWith('.json')) throw new Error(`Nonlocal capture reference: ${filename}`);
  return `${TIME_WORM_ROOT}/${filename}`;
}
export async function captureFileHash(path: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
export async function* captureJsonLines<T>(name: 'commands.jsonl' | 'public.jsonl'): AsyncGenerator<T> {
  const input = createReadStream(`${TIME_WORM_ROOT}/${name}`, { encoding: 'utf8' });
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
  if (!filename) throw new Error(`Missing actual Time Worm snapshot: ${name}`);
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
  if (!filename) throw new Error(`Missing actual Time Worm boundary: ${name}`);
  return boundaryFile(filename);
}
export function assertPublicCaptureControl(state: SliceState, intent: SliceIntent): void {
  expect(validateSlicePayload(intent), JSON.stringify(intent)).toBe(true);
  const view = projectSliceState(state);
  if (intent.type === 'TIME_WORM') {
    const offered = view.timeWorm.actions.find(row => stableStringify(row.command) === stableStringify(intent.command));
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
  if (save.count > TIME_WORM_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
  // A single restored boundary retains its old guide unless this command
  // actually writes guidance; only a fresh whole-history replay rewrites it.
  const expected = save.intent.type === 'TIME_WORM' && save.intent.command.type === 'LEARN_GUIDANCE'
    ? currentTimeWormReplayExpectation(save.final) : save.final;
  sameCaptureValue(applySliceIntent(save.before, save.intent), expected);
  return save;
}
export const captureBody = (s: SliceState) => ({ status: s.status, revision: s.revision, week: s.week, date: s.date,
  H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, pollution: s.seer.pollution,
  injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, mastery: s.progression.mastery,
  sequence: s.progression.sequence, acting: s.progression.acting });

/** Frozen old histories remain exact. Only the original registry's current
 * clock, body positions, travel and energy follow the new actual journal. */
export function assertOriginalContinuity(state: SliceState, original: SliceState): void {
  for (const key of TIME_WORM_SOURCE_KEYS) {
    const current = structuredClone(state[key]);
    if (key === 'fateTrojan') (current as SliceState['fateTrojan']).life.site = structuredClone(original.fateTrojan.life.site);
    sameCaptureValue(current, original[key]);
  }
  if (state.timeWorm.guidanceKnown) {
    sameCaptureValue(state.timeWorm.sourceHistory, Object.fromEntries(TIME_WORM_SOURCE_KEYS.map(key => [key, original[key]])));
    expect(validateTimeWormSource(state)).toBe(true);
    sameCaptureValue({ site: state.fateTrojan.life.site }, timeWormExpectedOriginals(state));
  } else sameCaptureValue(state.fateTrojan.life.site, original.fateTrojan.life.site);
  const site = state.fateTrojan.life.site, old = original.fateTrojan.life.site;
  for (const key of ['cabinet', 'parcel', 'link', 'fate', 'seals'] as const) sameCaptureValue(site[key], old[key]);
  for (const key of ['lina', 'victor'] as const) {
    sameCaptureValue({ ...site[key], location: old[key].location, energy: old[key].energy, travelMetres: old[key].travelMetres }, old[key]);
  }
  sameCaptureValue(state.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  const mastery = { ...original.progression.mastery };
  if (state.progression.sequence === 1) {
    for (const id of TIME_WORM_ABILITY_IDS) mastery[id] = 0;
    for (const [id, gain] of Object.entries(timeWormLifeMasteryGains(state))) mastery[id] = Math.min(500, mastery[id]! + gain);
  }
  for (const round of state.combatHistory.slice(original.combatHistory.length)) {
    expect(round.timeWormOutcome).toBeDefined();
    for (const action of [...round.timeWormOutcome!.playerActions, ...round.timeWormOutcome!.enemyActions]) {
      for (const id of action.masteryApplied) { expect(Object.hasOwn(mastery, id)).toBe(true); mastery[id] = Math.min(500, mastery[id]! + 8); }
    }
  }
  sameCaptureValue(state.progression.mastery, mastery);
  expect(state.random.seed).toBe(original.random.seed);
  const { coreStats, ...identity } = state.character, { coreStats: originalStats, ...originalIdentity } = original.character;
  sameCaptureValue(identity, originalIdentity);
  for (const id of Object.keys(originalStats) as (keyof typeof originalStats)[]) expect(coreStats[id]).toBe(Math.min(500, originalStats[id] + (state.progression.sequence === 1 ? 1 : 0)));
  expect(state.progression.promotionWeek).toBe(original.progression.promotionWeek);
}
