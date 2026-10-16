import { expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

export const PURE_WHITE_ROOT = 'tests/fixtures/pure-white-angel-v01940';
export const PURE_WHITE_SOURCE = 'tests/fixtures/light-seeker-v01720/natural.json';
export const PURE_WHITE_SOURCE_SHA = '0a06e9fa84a0b384aea3bf7bb79a7e72b2620ec113ad517bee2af14df35ae556';
export const PURE_WHITE_PREFIX_SHA = '5df5681e46346992f05a11a41a279ea659e98e77bf288a4bf891dcaa28be95b4';
export const PURE_WHITE_RAW_SOURCE_STATE_SHA = '07cac5fb2cbe060c179152c3f634bbc70a4534a2d2b752399bf31ae08df450ff';
export const PURE_WHITE_PREFIX_COUNT = 729;
export const sameCaptureValue = (a: unknown, b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));
export const captureValueHash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
export const naturalEntry = <T>(key: string): T => readObjectEntry<T>(`${PURE_WHITE_ROOT}/natural.json`, key);
export const sourceEntry = <T>(key: string): T => readObjectEntry<T>(PURE_WHITE_SOURCE, key);

// These are tiny indexes. Large natural and boundary documents use readObjectEntry.
export const boundaryIndex: Record<string, string> = JSON.parse(readFileSync(`${PURE_WHITE_ROOT}/boundaries.index.json`, 'utf8'));
export const snapshotIndex = naturalEntry<Record<string, string>>('snapshots');
export const captureCommands = naturalEntry<SliceIntent[]>('commands');
export const uniqueBoundaryFiles = [...new Set(Object.values(boundaryIndex))];

export function capturePath(filename: string): string {
  if (filename !== basename(filename) || !filename.endsWith('.json')) throw new Error(`Nonlocal capture reference: ${filename}`);
  return `${PURE_WHITE_ROOT}/${filename}`;
}
export async function captureFileHash(path: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
export function currentCapture(value: unknown): SliceState {
  const state = migrateSliceState(value);
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  return state;
}
// A bounded cache holds only named checkpoints, never all boundary state trees.
const checkpoints = new Map<string, SliceState>();
export function capturedState(key: 'initial' | 'prefixFinal' | 'beforeLast' | 'final'): SliceState {
  if (!checkpoints.has(key)) checkpoints.set(key, currentCapture(naturalEntry<unknown>(key)));
  return checkpoints.get(key)!;
}
export function capturedSnapshot(name: string): SliceState {
  const filename = snapshotIndex[name];
  if (!filename) throw new Error(`Missing actual Pure White Angel snapshot: ${name}`);
  // Snapshot files contain one state, unlike the multi-state natural/boundary files.
  return currentCapture(JSON.parse(readFileSync(capturePath(filename), 'utf8')));
}
export function boundaryFile(filename: string) {
  const path = capturePath(filename);
  return {
    count: readObjectEntry<number>(path, 'commandCount'),
    before: currentCapture(readObjectEntry<unknown>(path, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(path, 'lastIntent'),
    final: currentCapture(readObjectEntry<unknown>(path, 'final')),
  };
}
export function namedBoundary(name: string) {
  const filename = boundaryIndex[name];
  if (!filename) throw new Error(`Missing actual Pure White Angel boundary: ${name}`);
  return boundaryFile(filename);
}
export function assertPublicCaptureControl(state: SliceState, intent: SliceIntent): void {
  expect(validateSlicePayload(intent), JSON.stringify(intent)).toBe(true);
  const view = projectSliceState(state);
  if (intent.type === 'PURE_WHITE_ANGEL') {
    const action = view.pureWhiteAngel.actions.find(row => stableStringify(row.command) === stableStringify(intent.command));
    expect(action, `Missing public control: ${JSON.stringify(intent)}`).toBeDefined();
    expect(action!.enabled, action!.reason ?? JSON.stringify(intent)).toBe(true);
  } else if (intent.type === 'ACTION') {
    expect(view.canAct, view.actionBlockedReason ?? JSON.stringify(intent)).toBe(true);
    if (intent.action === 'INVESTIGATE') {
      expect(intent.targetId).toBe('CARE-ACCESS-01');
      expect(view.investigateTargets.some(target => target.id === intent.targetId)).toBe(true);
      expect(view.recovery.actions.discover.enabled, view.recovery.actions.discover.reason ?? '').toBe(true);
    } else {
      expect(['REST', 'WORK']).toContain(intent.action);
      const action = view.recovery.actions[intent.action === 'REST' ? 'rest' : 'work'];
      expect(action.enabled, action.reason ?? '').toBe(true);
    }
  } else if (intent.type === 'EVENT_CHOICE') {
    expect(state.activeEvent?.instanceId).toBe(intent.eventInstanceId);
    expect(view.activeEvent?.choices.find(choice => choice.id === intent.choiceId)?.enabled).toBe(true);
  } else if (intent.type === 'COMBAT_ROUND') {
    expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull();
    expect(intent.stance).toBe('CONTROL');
    expect(view.combat?.stances.some(stance => stance.id === intent.stance)).toBe(true);
  } else throw new Error(`Unexpected continuation command: ${JSON.stringify(intent)}`);
}
export function replayCaptureBoundary(name: string) {
  const save = namedBoundary(name);
  if (save.count > PURE_WHITE_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
  sameCaptureValue(applySliceIntent(save.before, save.intent), save.final);
  return save;
}

// These tests replay long immutable histories. Budget per actual command rather
// than inheriting Vitest's short default or claiming a timeout is a domain fault.
// The actual853-command producer took about198 seconds including capture I/O.
// 400ms per command gives this replay a341.2-second budget without changing any
// global timeout or hiding a missing command behind a shortened replay.
export const FULL_CAPTURE_REPLAY_TIMEOUT = Math.max(300_000, captureCommands.length * 400);
export const CAPTURE_BOUNDARY_TIMEOUT = 60_000;
