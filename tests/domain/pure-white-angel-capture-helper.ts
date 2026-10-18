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
export const sameCaptureValue = (a: unknown, b: unknown) => {
  const actual = stableStringify(a), expected = stableStringify(b);
  const equal = actual === expected;
  // Keep exact canonical-byte equality; only the failure diagnostic is hashed.
  // Passing megabytes of serialized state to toBe would flood replay failure logs.
  const digest = (value: string) => createHash('sha256').update(value).digest('hex');
  expect(equal, equal ? undefined : `Capture byte mismatch: actual SHA-256 ${digest(actual)}; expected SHA-256 ${digest(expected)}`).toBe(true);
};
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

const GUIDANCE_BOUNDARY = 'actual500p-guidance-and-frozen-eight-root-source';
const GUIDANCE_OLD_RECOVERY = '全部原瓶失败后须付1行动与100便士申请下一批，至少跨一真实周才有新三瓶到货。';
const GUIDANCE_CURRENT_RECOVERY = '最初三瓶失败后，可以付1行动与120便士调查其中同一份原特性；至少跨一真实周，再在原采光廊入口向侧路的玛拉本人取得当次交接许可，以1行动封存回收。新普通药物与调配另付900便士或五项新劳动后90便士，当周检查仍另付150便士；不新增第四份原特性，不补写旧许可、不改原廊人物与物件，旧原瓶、失败和费用全部保留。';

// Command743 (revision743 ->744) now describes prospective same-original
// recovery. The immutable capture retains its original wording. Only the proven
// guidance record differs: its chronicle text at744/854 and lastResult at744.
// This comparison adapter does not migrate captures or normalize other text.
export function currentGuidanceCaptureExpected(state: SliceState): SliceState {
  expect(state.runId).toBe('bard-rebuild-natural');
  expect([744, 854]).toContain(state.revision);
  const record = state.chronicle[1160]!;
  expect(record).toMatchObject({ id: 'record-744-1160', week: 179, title: '听取纯白天使独立成品与专业准备指导' });
  expect(captureValueHash(record.text)).toBe('048216ebe2a0eb7d9b91266c2fcc24e595d51a1a512ce8019d8ea6f108f84070');
  expect(record.text.endsWith(GUIDANCE_OLD_RECOVERY)).toBe(true);
  if (state.revision === 744) sameCaptureValue(state.lastResult, record);
  else expect(state.lastResult?.id).toBe('record-854-1306');
  const text = record.text.slice(0, -GUIDANCE_OLD_RECOVERY.length) + GUIDANCE_CURRENT_RECOVERY;
  return {
    ...state,
    chronicle: state.chronicle.map((entry, index) => index === 1160 ? { ...entry, text } : entry),
    lastResult: state.revision === 744 ? { ...state.lastResult!, text } : state.lastResult,
  };
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
  if (name === GUIDANCE_BOUNDARY) {
    expect([save.count, save.before.revision, save.final.revision]).toEqual([743, 743, 744]);
    expect(save.intent).toEqual({ type: 'PURE_WHITE_ANGEL', command: { type: 'LEARN_GUIDANCE' } });
  }
  sameCaptureValue(applySliceIntent(save.before, save.intent), name === GUIDANCE_BOUNDARY ? currentGuidanceCaptureExpected(save.final) : save.final);
  return save;
}

// These tests replay long immutable histories. Budget per actual command rather
// than inheriting Vitest's short default or claiming a timeout is a domain fault.
// The actual853-command producer took about198 seconds including capture I/O.
// 400ms per command gives this replay a341.2-second budget without changing any
// global timeout or hiding a missing command behind a shortened replay.
export const FULL_CAPTURE_REPLAY_TIMEOUT = Math.max(300_000, captureCommands.length * 400);
export const CAPTURE_BOUNDARY_TIMEOUT = 60_000;
