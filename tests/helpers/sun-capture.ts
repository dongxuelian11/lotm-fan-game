import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';
import { assertEmptyDeathState, assertEmptyDeathPublic } from './empty-death-capture.js';

/** Independent read-only consumer of the actual NEW216 natural934. An explicit
 * root permits pre-publication validation of the exact same pinned bytes. No
 * automatic output fallback, producer import, compiled runtime or RNG seam. */
export const ROOT = process.env.SUN_CAPTURE_ROOT ?? 'tests/fixtures/sun-v02160';
export const SOURCE = 'tests/fixtures/pure-white-angel-v01940/natural.json';
export const SOURCE_SHA = '3f13d554046ecffe3512bda22fb4cd14747be2b06dd6dd47185c025d7d9855f1';
export const PREFIX = 853, NEW_COMMANDS = 81, FINAL_COMMAND = 934;
export const CAPTURE_SCHEMA = 213, CAPTURE_CONTENT = 'sun-v213';
export const PINS = {
  originalStateSha256: '98e3a20cedfe2fa9cec6be8645a6ea340592e497b6d4300b22d03f5476e4719a',
  prefixSha256: '6a8dc284dffb34025d9709eb91328425420b4bd1417f61c5cfa091b66c0e65ce',
  inputFreezeSha256: '2fc84570c5c10efaa1d7638f74bf11725ee0bf2e1897e8cdd2254dc84a554b01',
  runtimeFreezeSha256: 'd7f35f65cbf1da3d02842825314b8d30acb5ddbe94e121abb68a3c715b4bb883',
  checkpointEnvelopeSha256: '25ea55abcd54ad50f7fea3a60cbbb6e4673eb7c6cfa5e7f0c1527468ac962a87',
  initialStateSha256: '88ba3cd7f783f34b3e3033358d673dd0ffba4a66f8f58918330b601d193d6d46',
  finalStateSha256: '4d547a735ec49c0988ffdf398cb54fea623e7137d044dbf88ecccb497261b52d',
  initialPublicSha256: 'af1578ae96db35d810982fb4f459d82b5b444d081c98a64bef0c789a1c78b12e',
  finalPublicSha256: 'd15849e9072292b01454a0ad17deb4bca46c65e20596711b43d2a868231ae734',
  initialGlobalPublicSha256: '0562d2a66df155dfb71aa2eaa102705e29d68cc33e8cd7b5e8d1e81ee3e0c167',
  finalGlobalPublicSha256: 'ddb3a0156060c297dcf7d20d00b8aa99a54df965410e76845a34c974c1819a08',
  initialRandomSha256: 'c3f589e197767d84ce3a7fcc598ac45714530cdd2340b2d89468d48aca8c62f2',
  finalRandomSha256: 'ebaa879918517b0a2780e462bdeefe0543d3a90a4052beb587487e4feb62e875',
  initialPolicySha256: '8c5d29eb5fa42682516d0005011b0aeaa9f13e0c1fd1fb8bd52b2aba5a1ca736',
  stage: 'NATURAL_FINITE_SUN_REPORTED',
  reason: 'The finite actual incident was honestly reported; all failed attempts and costs remain',
  sqliteCommandCounts: [923, 934] as const,
  boundaryCommandCounts: [854, 856, 857, 858, 859, 860, 861, 862, 864, 865, 866, 868, 869, 871,
    878, 879, 881, 900, 904, 905, 909, 917, 919, 922, 923, 926, 927, 928, 929, 930, 931, 932, 933, 934] as const,
};
export interface FilePin { bytes: number; sha256: string }
export const FILE_PINS = {
  'archived-original194-natural.json.gz': { bytes: 695146, sha256: '8140b54354d98696bb32c2b80c5d6779ea57fcac6e0fb491ce79b17bdd14a3ee' },
  'migration-initial.json.gz': { bytes: 521247, sha256: '038a5204462222b70b1f4cb69c5a8f4e23f24a9b69533d50ba48a517ad049cf5' },
  'checkpoint.json.gz': { bytes: 363007, sha256: 'e8f55edfeb0977635e9da20e332056681be99d3d1879575865c5613c3d04fc61' },
  'natural.json.gz': { bytes: 337973, sha256: '5ae8bccd35335c6aba1f59832056ba8541e02dfd1204f052772b8cf3fe5cb2b8' },
  'input-freeze.json': { bytes: 640, sha256: 'e803684208f868e06a995b482065b6bee7a4729573a4227393f165146e90d0cf' },
  'runtime-freeze.json': { bytes: 621747, sha256: '8c1191978865642db2d726b4701b5f41cbde109ab9188d989e5607027907cf4a' },
  'producer.mjs': { bytes: 48203, sha256: '4023aaf768d13630e464d4b2d923de0dd5d727ac9723472b101f8589cb432303' },
  'boundaries.index.json': { bytes: 6189, sha256: '522ef8d7e0decffd534b914e87150ead7ebdcebc9ceff262babfbed9f4a787de' },
  'commands.ndjson.gz': { bytes: 29905, sha256: 'dc8f0e8ee11f49039d6e62c7ebc2a7db3730b6506d626e05692bf8ffc93e8b47' },
  'summary.json': { bytes: 21790, sha256: 'cf8476a6d1ba37521fe93012b689640c3345392076320020e8a232632383ed76' },
} satisfies Record<string, FilePin>;
export interface Policy { phase: string; week: number; doses: number; carriers: string[];
  epilogueAttempted: string[]; reported: boolean; loop: { key: string | null; repetitions: number } }
export interface Outcome { status: SliceState['status']; sequence: SliceProjection['progression']['sequence']; promoted: boolean; guidance: boolean }
export interface Row {
  commandCount: number; intent: SliceIntent; commandSha256: string; reason: string; publicLabel: string; publicCost: string;
  startedAt: string; elapsedMilliseconds: number; revision: number; week: number;
  beforeStateSha256: string; afterStateSha256: string; publicBeforeSha256: string; publicAfterSha256: string;
  globalPublicBeforeSha256: string; globalPublicAfterSha256: string; randomBefore: SliceState['random']; randomAfter: SliceState['random'];
  randomBeforeSha256: string; randomAfterSha256: string; policyBeforeSha256: string; policyAfterSha256: string;
  selectionOutcome: Outcome; receipts: { checks: unknown[]; finance: unknown[]; notes: unknown[] };
  capture: FilePin & { file: string };
}
export interface Boundary extends FilePin { file: string; kind: string; commandCount: number }
export interface Action {
  commandCount: number; beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState;
  randomBefore: SliceState['random']; randomAfter: SliceState['random']; publicBefore: CapturedPublic; public: CapturedPublic;
  globalPublicBefore: SliceProjection; globalPublic: SliceProjection; policyBefore: Policy; policyAfter: Policy;
  audit: Omit<Row, 'capture' | 'elapsedMilliseconds'> & { elapsedMilliseconds: null };
}
export interface Checkpoint {
  format: string; source: string; sourceSha256: string; prefixSha256: string; prefixHashEncoding: string; stateHashEncoding: string;
  inputFreezeSha256: string; runtimeFreezeSha256: string; policyDefinition: Record<string, unknown>; policy: Policy;
  migration: { originalStateSha256: string; migratedStateSha256: string; fromSchema: number; toSchema: number };
  commandCount: number; commands: SliceIntent[]; rows: Row[]; boundaries: Boundary[]; state: SliceState;
  initialStateSha256: string; finalStateSha256: string; initialPublicSha256: string; publicStateSha256: string;
  initialGlobalPublicSha256: string; globalPublicStateSha256: string; initialRandomSha256: string;
  pending: unknown | null; terminal: { stage: string; reason: string } | null;
}
export type OriginalState = Omit<SliceState, 'schemaVersion' | 'contentVersion'> & { schemaVersion: 191; contentVersion: 'pure-white-angel-v191' };
export interface History { commands: SliceIntent[]; final: OriginalState; seed: string; creation: unknown }
export interface Initial { originalStateSha256: string; migratedStateSha256: string; publicSha256: string;
  globalPublicSha256: string; final: SliceState; random: SliceState['random']; public: CapturedPublic; globalPublic: SliceProjection }
export interface Natural { commands: SliceIntent[]; final: SliceState; seed: string; creation: unknown;
  provenance: Record<string, unknown>; prefixCount: number; policy: Record<string, unknown>; boundaries: Boundary[];
  stage: string; reason: string; pendingIntent: null }

export function stable(value: unknown): string {
  function canonical(node: unknown): unknown {
    if (node === null || typeof node === 'string' || typeof node === 'boolean') return node;
    if (typeof node === 'number') { assert(Number.isFinite(node)); return Object.is(node, -0) ? 0 : node; }
    if (Array.isArray(node)) return node.map(canonical);
    assert(node && typeof node === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(node)));
    const object = node as Record<string, unknown>;
    return Object.fromEntries(Object.keys(object).sort().map(key => [key, canonical(object[key])]));
  }
  return JSON.stringify(canonical(value));
}
export const sha = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
export const hash = (value: unknown): string => sha(stable(value));
export const compactHash = (value: unknown): string => sha(JSON.stringify(value));
export const same = (actual: unknown, expected: unknown, message?: string): void => assert.equal(hash(actual), hash(expected), message);
const exactKeys = (value: object, expected: readonly string[]): void => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
function relativeFile(file: string): string {
  assert(file && !file.includes('\\') && !file.includes('\0') && !file.startsWith('/') && !/^[A-Za-z]:/.test(file));
  assert(file.split('/').every(part => part && part !== '.' && part !== '..')); return file;
}
export function bytes(path: string): Buffer {
  assert.equal(realpathSync(path), resolve(path), 'Evidence must not be symlinked');
  const before = lstatSync(path, { bigint: true }); assert(before.isFile() && !before.isSymbolicLink());
  const value = readFileSync(path), after = lstatSync(path, { bigint: true });
  for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino'] as const) assert.equal(after[key], before[key]);
  assert.equal(BigInt(value.length), before.size); return value;
}
export const filePin = (path: string): FilePin => { const value = bytes(path); return { bytes: value.length, sha256: sha(value) }; };
export const decoded = (file: string): Buffer => {
  const value = bytes(join(ROOT, relativeFile(file))); return file.endsWith('.gz') ? gunzipSync(value) : value;
};
export const json = <T>(file: string): T => JSON.parse(decoded(file).toString('utf8')) as T;
export function readCheckpoint(): Checkpoint {
  assert.deepEqual(filePin(join(ROOT, 'checkpoint.json.gz')), FILE_PINS['checkpoint.json.gz']);
  const wrapper = json<{ sha256: string; payload: Checkpoint }>('checkpoint.json.gz');
  assert.equal(wrapper.sha256, PINS.checkpointEnvelopeSha256); assert.equal(hash(wrapper.payload), wrapper.sha256);
  return wrapper.payload;
}
/** Hash one compressed member at a time; never inflate/cache all81 actions. */
export function authenticateInputs(): void {
  for (const [file, pin] of Object.entries(FILE_PINS)) assert.deepEqual(filePin(join(ROOT, file)), pin, file);
  const archive = decoded('archived-original194-natural.json.gz'), original = bytes(SOURCE);
  assert.equal(original.length, 8199835); assert.equal(sha(original), SOURCE_SHA); assert(archive.equals(original));
  const checkpoint = readCheckpoint();
  const names = readdirSync(ROOT).filter(name => /^action-\d+\.json\.gz$/.test(name)).sort();
  assert.deepEqual(names, Array.from({ length: NEW_COMMANDS }, (_, index) => `action-${PREFIX + index + 1}.json.gz`));
  for (const row of checkpoint.rows) {
    assert.equal(row.capture.file, `action-${row.commandCount}.json.gz`);
    assert.deepEqual(filePin(join(ROOT, relativeFile(row.capture.file))), { bytes: row.capture.bytes, sha256: row.capture.sha256 });
  }
  const freeze = json<{ sha256: string; files: Array<FilePin & { file: string }> }>('runtime-freeze.json');
  assert.equal(freeze.sha256, PINS.runtimeFreezeSha256); assert.equal(compactHash(freeze.files), freeze.sha256);
  assert.equal(freeze.files.length, 4586); assert.equal(new Set(freeze.files.map(row => row.file)).size, freeze.files.length);
  assert.deepEqual(freeze.files.find(row => row.file === '$natural-producer'), { file: '$natural-producer', ...FILE_PINS['producer.mjs'] });
  const inputs = json<{ sha256: string; files: Array<FilePin & { file: string }> }>('input-freeze.json');
  assert.equal(inputs.sha256, PINS.inputFreezeSha256); assert.equal(compactHash(inputs.files), inputs.sha256);
  assert.deepEqual(inputs.files, [{ file: SOURCE, sha256: SOURCE_SHA, bytes: 8199835 }]);
}

const PUBLIC_FIELDS = ['runId', 'revision', 'status', 'week', 'date', 'actionsRemaining', 'weeklyBudget', 'cash', 'weeklyWage', 'wagePaid',
  'health', 'mind', 'spirituality', 'maxHealth', 'maxMind', 'maxSpirituality', 'pollution', 'injuries', 'injuryRisk',
  'debtTotal', 'debts', 'canAct', 'actionBlockedReason', 'activeEvent', 'combat'] as const;
export function capturePublic(projection: SliceProjection) {
  const ordinary = Object.fromEntries(PUBLIC_FIELDS.map(key => [key, structuredClone(projection[key])])) as Pick<SliceProjection, typeof PUBLIC_FIELDS[number]>;
  return { ...ordinary, progression: { sequence: projection.progression.sequence, acting: projection.progression.acting,
    mastery: structuredClone(projection.progression.mastery) }, sun: structuredClone(projection.sun) };
}
export type CapturedPublic = ReturnType<typeof capturePublic>;
export function assertPublicOnly(value: unknown, state: SliceState): void {
  const forbidden = /^(?:random|rng|rngState|seed|cursor|randomSeed|randomCursor|randomCursorBefore|randomCursorAfter|cursorBefore|cursorAfter|randomBefore|randomAfter|randomReceipts|preparedRoll|futureRoll|futureRolls|nextRoll|unrolledResult|privateSource|sourceState|sourceDigest|historyDigest|originalWorldDigest|combatHistoryDigest|originalsDigest|originalPracticeDigest|acquisitionDigest|compoundDigest|beforeDigest|afterDigest|actorId|predecessorActorId|incumbentActorId|custodianActorId)$/;
  function visit(node: unknown, path: string): void {
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      const next = `${path}.${key}`, inactive = key === 'actorId' && child === null &&
        ['.divineHand.life.site.guard.actorId', '.glory.life.site.guard.actorId'].some(suffix => next.endsWith(suffix));
      assert(!(forbidden.test(key) && !inactive), `Private field ${next}`);
      assert(!(key === 'source' && child !== null && typeof child === 'object'), `Private source ${next}`);
      visit(child, next);
    }
  }
  visit(value, '$'); const text = JSON.stringify(value);
  for (const secret of [state.random.seed, state.sun.source?.actorId, state.sun.source?.historyDigest])
    if (secret) assert(!text.includes(secret), 'An actual private value leaked');
}
export const assertGlobalPublic = (value: SliceProjection, state: SliceState): void => assertPublicOnly(value, state);
export const outcome = (view: CapturedPublic): Outcome => ({ status: view.status, sequence: view.progression.sequence,
  promoted: view.sun.promoted, guidance: view.sun.guidanceKnown });
export function assertPublicAction(view: CapturedPublic, row: Pick<Row, 'intent' | 'publicLabel' | 'publicCost'>): void {
  assert.equal(row.intent.type, 'SUN'); assert(row.intent.type === 'SUN');
  const command = row.intent.command, actions = view.sun.actions.filter(action => hash(action.command) === hash(command));
  assert.equal(actions.length, 1); assert.equal(actions[0]!.enabled, true); assert.equal(actions[0]!.preferredAction, true);
  assert.equal(actions[0]!.label, row.publicLabel); assert.equal(actions[0]!.cost, row.publicCost);
}
export function actualReceipts(after: SliceState, before: SliceState): Row['receipts'] {
  const latest = after.sun.journal.at(-1);
  if (latest?.revision === after.revision) return { checks: latest.randomReceipts, finance: latest.financeReceipts, notes: latest.notes };
  assert(!before.sun.guidanceKnown && after.sun.guidanceKnown);
  return { checks: [], finance: [], notes: after.chronicle.slice(before.chronicle.length) };
}

export type HistoricalSunState = Omit<SliceState, 'schemaVersion' | 'contentVersion' | 'death'> & {
  schemaVersion: 213; contentVersion: 'sun-v213';
};
export type HistoricalSunPublic = Omit<SliceProjection, 'death'>;
/** Only the independently verified empty Death root may be removed. All old
 * fields and every unrecognized future root remain in the historical hash. */
export function historicalSunState(state: SliceState): HistoricalSunState {
  assert.deepEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION], [214, 'death-v214'],
    'Review and explicitly pin each post214 migration addition before accepting a new schema');
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  assertEmptyDeathState(state);
  const { death: _emptyDeath, ...originalFields } = state;
  return { ...originalFields, schemaVersion: CAPTURE_SCHEMA, contentVersion: CAPTURE_CONTENT };
}
export function historicalSunPublic(projection: SliceProjection, state: SliceState): HistoricalSunPublic {
  historicalSunState(state); assertEmptyDeathPublic(projection, state);
  const { death: _emptyDeath, ...originalFields } = projection;
  return originalFields;
}
export function migrateCapturedSunState(raw: SliceState): SliceState {
  assert.deepEqual([raw.schemaVersion, raw.contentVersion], [CAPTURE_SCHEMA, CAPTURE_CONTENT]);
  assert.equal(Object.hasOwn(raw, 'death'), false);
  const before = hash(raw), current = migrateSliceState(raw); assertValidSliceState(current);
  exactKeys(current, [...Object.keys(raw), 'death']); same(historicalSunState(current), raw, 'Current ingress changed a complete captured state');
  assert.equal(hash(raw), before, 'Migration mutated the original capture'); return current;
}
/** Reviewed public corrections: the genuine Sun0 maximum30→150 from923-after,
 * and ordinary-action gating/reason from actual guidance854-after, including
 * the twelve explicitly named recovery leaves derived from that shared gate.
 * The latter reflects the existing non-SUN dispatcher rejection. Bind both
 * boundaries to the captured command, guidance/source and promotion history;
 * never strip these or any other keys before comparing the complete projection.
 * Raw hashes, complete private states and RNG always retain their old values. */
export function expectedCurrentGlobal(action: Action, side: 'before' | 'after'): SliceProjection {
  const raw = side === 'before' ? action.globalPublicBefore : action.globalPublic;
  const state = side === 'before' ? action.beforeLast : action.final;
  const guided = action.commandCount > 854 || action.commandCount === 854 && side === 'after';
  const promoted = action.commandCount > 923 || action.commandCount === 923 && side === 'after';
  assert(Number.isSafeInteger(action.commandCount) && action.commandCount > PREFIX && action.commandCount <= FINAL_COMMAND);
  assert.equal(action.audit.commandCount, action.commandCount); same(action.lastIntent, action.audit.intent);
  assert.equal(compactHash(action.lastIntent), action.audit.commandSha256);
  assert.equal(state.revision, action.commandCount + (side === 'after' ? 1 : 0));
  assert.equal(raw.revision, state.revision); assert.equal(raw.runId, state.runId);
  assert.equal(state.progression.pathwayId, 'sun'); assert.equal(state.progression.sequence, promoted ? 0 : 1);
  assert.equal(raw.sun.guidanceKnown, guided); assert.equal(state.sun.guidanceKnown, guided);
  assert.equal(state.sun.source !== null, guided);
  assert.equal(raw.sun.promoted, promoted); assert.equal(state.sun.promotionWeek, promoted ? 214 : null);
  assert.equal(raw.maxSpirituality, promoted ? 30 : 120); assert.equal(raw.actionBlockedReason, null);
  if (action.commandCount === 854) same(action.lastIntent, { type: 'SUN', command: { type: 'LEARN_GUIDANCE' } });
  const expected = structuredClone(raw);
  if (guided) {
    assert(state.sun.source); assert.equal(state.sun.source.revision, 854);
    assert.equal(state.sun.source.runId, state.runId); assert.equal(state.sun.source.actorId, `${state.runId}:original-player`);
    assert.equal(state.status, 'ACTIVE'); assert.equal(raw.status, 'ACTIVE');
    assert.equal(state.activeEvent, null); assert.equal(raw.activeEvent, null);
    assert.notEqual(raw.recovery.nextAction.kind, 'CURRENT_EVENT');
    const reason = '请在当前街区与筹备处继续行动。';
    expected.canAct = false;
    expected.actionBlockedReason = reason;
    // Preserve the frozen recovery object in full. Only these derived gating
    // leaves change; event-choice pay/credit, targets, stages and guidance do not.
    expected.recovery.locked = true;
    expected.recovery.blockedReason = reason;
    expected.recovery.actions.rest.enabled = false;
    expected.recovery.actions.rest.reason = reason;
    expected.recovery.actions.discover.enabled = false;
    expected.recovery.actions.discover.reason = reason;
    expected.recovery.actions.work.enabled = false;
    expected.recovery.actions.work.reason = reason;
    expected.recovery.actions.aid.enabled = false;
    expected.recovery.actions.aid.reason = reason;
    expected.recovery.nextAction.enabled = false;
    expected.recovery.nextAction.reason = reason;
  }
  if (promoted) expected.maxSpirituality = 150;
  return expected;
}
export function assertCurrentGlobal(actual: SliceProjection, action: Action, side: 'before' | 'after'): void {
  const state = side === 'before' ? action.beforeLast : action.final;
  const expected = expectedCurrentGlobal(action, side);
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CAPTURE_SCHEMA, CAPTURE_CONTENT]);
  assertEmptyDeathPublic(actual, state);
  const { death: _emptyDeath, ...historicalPublic } = actual;
  same(historicalPublic, expected,
    `Complete global public ${action.commandCount} ${side}`);
  same(capturePublic(actual), capturePublic(expected));
}
export function readAction(row: Row): Action {
  assert.equal(row.capture.file, `action-${row.commandCount}.json.gz`);
  assert.deepEqual(filePin(join(ROOT, relativeFile(row.capture.file))), { bytes: row.capture.bytes, sha256: row.capture.sha256 });
  const action = json<Action>(row.capture.file);
  exactKeys(action, ['commandCount', 'beforeLast', 'lastIntent', 'final', 'randomBefore', 'randomAfter', 'publicBefore', 'public',
    'globalPublicBefore', 'globalPublic', 'policyBefore', 'policyAfter', 'audit']);
  const { capture: _capture, ...audit } = row;
  same(action.audit, { ...audit, elapsedMilliseconds: null }); assert.equal(action.commandCount, row.commandCount); same(action.lastIntent, row.intent);
  for (const [value, expected] of [[action.beforeLast, row.beforeStateSha256], [action.final, row.afterStateSha256],
    [action.publicBefore, row.publicBeforeSha256], [action.public, row.publicAfterSha256],
    [action.globalPublicBefore, row.globalPublicBeforeSha256], [action.globalPublic, row.globalPublicAfterSha256],
    [action.policyBefore, row.policyBeforeSha256], [action.policyAfter, row.policyAfterSha256]] as const) assert.equal(hash(value), expected);
  same(action.randomBefore, row.randomBefore); same(action.randomAfter, row.randomAfter);
  same(action.beforeLast.random, row.randomBefore); same(action.final.random, row.randomAfter);
  same(capturePublic(action.globalPublicBefore), action.publicBefore); same(capturePublic(action.globalPublic), action.public);
  same(actualReceipts(action.final, action.beforeLast), row.receipts); same(outcome(action.public), row.selectionOutcome);
  assertPublicAction(action.publicBefore, row);
  assertGlobalPublic(action.globalPublicBefore, action.beforeLast); assertGlobalPublic(action.globalPublic, action.final);
  return action;
}
export function readActionAt(count: number): Action {
  assert(Number.isSafeInteger(count) && count > PREFIX && count <= FINAL_COMMAND);
  return readAction(readCheckpoint().rows[count - PREFIX - 1]!);
}
export interface LoadedCapture { original: OriginalState; initial: SliceState; checkpoint: Checkpoint; rows: Row[] }
export function loadCapture(): LoadedCapture {
  authenticateInputs();
  const original = json<History>('archived-original194-natural.json.gz');
  assert.equal(original.commands.length, PREFIX); assert.equal(compactHash(original.commands), PINS.prefixSha256);
  assert.equal(hash(original.final), PINS.originalStateSha256);
  assert.deepEqual([original.final.schemaVersion, original.final.contentVersion], [191, 'pure-white-angel-v191']);
  const captured = json<Initial>('migration-initial.json.gz');
  assert.equal(captured.originalStateSha256, PINS.originalStateSha256); assert.equal(captured.migratedStateSha256, PINS.initialStateSha256);
  assert.equal(hash(captured.final), PINS.initialStateSha256); assert.equal(hash(captured.public), PINS.initialPublicSha256);
  assert.equal(hash(captured.globalPublic), PINS.initialGlobalPublicSha256); same(capturePublic(captured.globalPublic), captured.public);
  const initial = migrateSliceState(original.final); assertValidSliceState(initial);
  same(initial, migrateCapturedSunState(captured.final)); assert.equal(hash(original.final), PINS.originalStateSha256);
  // Exact191->213 additions are reviewed by name, never a generic root filter.
  exactKeys(captured.final, [...Object.keys(original.final), 'abomination', 'apocalypseDemoness', 'darkAngel', 'darkness',
    'divineHand', 'fool', 'handOfOrder', 'knowledgeEmperor', 'mercurySnake', 'moon', 'natureWalker', 'paleEmperor',
    'perfecter', 'princeOfAbolition', 'redPriest', 'starKey', 'sun', 'timeWorm', 'tyrant', 'uncleanMonarch', 'visionary', 'whiteTower']);
  for (const [key, value] of Object.entries(original.final)) if (!['schemaVersion', 'contentVersion'].includes(key))
    same(captured.final[key as keyof SliceState], value, `Original853 field ${key}`);
  same(historicalSunPublic(projectSliceState(initial), initial), captured.globalPublic); same(initial.random, original.final.random);
  const cp = readCheckpoint();
  assert.equal(cp.format, 'NEW216_RESTORED194_LIVING853_DURABLE_PUBLIC_ACTION_BOUNDARY_V1');
  assert.equal(cp.source, SOURCE); assert.equal(cp.sourceSha256, SOURCE_SHA);
  assert.equal(cp.prefixHashEncoding, 'JSON_STRINGIFY_UTF8_ORIGINAL_OBJECT_KEY_ORDER');
  assert.equal(cp.stateHashEncoding, 'STABLE_STRINGIFY_CANONICAL_JSON_UTF8');
  for (const key of ['prefixSha256', 'inputFreezeSha256', 'runtimeFreezeSha256', 'initialStateSha256', 'finalStateSha256',
    'initialPublicSha256', 'initialGlobalPublicSha256', 'initialRandomSha256'] as const) assert.equal(cp[key], PINS[key]);
  assert.equal(cp.publicStateSha256, PINS.finalPublicSha256); assert.equal(cp.globalPublicStateSha256, PINS.finalGlobalPublicSha256);
  assert.equal(hash(cp.state), PINS.finalStateSha256); assert.equal(hash(cp.state.random), PINS.finalRandomSha256);
  assert.equal(cp.commandCount, FINAL_COMMAND); assert.equal(cp.commands.length, NEW_COMMANDS); assert.equal(cp.rows.length, NEW_COMMANDS);
  assert.equal(cp.pending, null); assert.deepEqual(cp.terminal, { stage: PINS.stage, reason: PINS.reason });
  assert.deepEqual(cp.migration, { originalStateSha256: PINS.originalStateSha256, migratedStateSha256: PINS.initialStateSha256, fromSchema: 191, toSchema: 213 });
  let privateHash = PINS.initialStateSha256, publicHash = PINS.initialPublicSha256, globalHash = PINS.initialGlobalPublicSha256,
    randomHash = PINS.initialRandomSha256, policyHash = PINS.initialPolicySha256;
  for (const [index, row] of cp.rows.entries()) {
    assert.equal(row.commandCount, PREFIX + index + 1); assert.equal(row.revision, row.commandCount + 1); same(row.intent, cp.commands[index]);
    assert.equal(row.intent.type, 'SUN'); assert.equal(row.commandSha256, compactHash(row.intent));
    assert.equal(row.beforeStateSha256, privateHash); assert.equal(row.publicBeforeSha256, publicHash);
    assert.equal(row.globalPublicBeforeSha256, globalHash); assert.equal(row.randomBeforeSha256, randomHash); assert.equal(row.policyBeforeSha256, policyHash);
    assert.equal(hash(row.randomBefore), row.randomBeforeSha256); assert.equal(hash(row.randomAfter), row.randomAfterSha256);
    assert.equal(row.randomBefore.seed, original.seed); assert.equal(row.randomAfter.seed, original.seed);
    assert(row.randomAfter.cursor >= row.randomBefore.cursor);
    privateHash = row.afterStateSha256; publicHash = row.publicAfterSha256; globalHash = row.globalPublicAfterSha256;
    randomHash = row.randomAfterSha256; policyHash = row.policyAfterSha256;
  }
  assert.equal(privateHash, PINS.finalStateSha256); assert.equal(publicHash, PINS.finalPublicSha256); assert.equal(globalHash, PINS.finalGlobalPublicSha256);
  assert.equal(randomHash, PINS.finalRandomSha256); assert.equal(policyHash, hash(cp.policy));
  same(json<Boundary[]>('boundaries.index.json'), cp.boundaries); assert.deepEqual(cp.boundaries.map(row => row.commandCount), PINS.boundaryCommandCounts);
  assert.equal(new Set(cp.boundaries.map(row => row.kind)).size, 34);
  for (const { kind: _kind, commandCount, ...pin } of cp.boundaries) same(pin, cp.rows[commandCount - PREFIX - 1]!.capture);
  assert.equal(decoded('commands.ndjson.gz').toString('utf8'), cp.rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  const natural = json<Natural>('natural.json.gz'); same(natural.final, cp.state); same(natural.creation, original.creation);
  assert.equal(natural.seed, original.seed); assert.equal(natural.prefixCount, PREFIX);
  same(natural.commands, [...original.commands, ...cp.commands]); same(natural.boundaries, cp.boundaries); same(natural.policy, cp.policyDefinition);
  assert.equal(natural.pendingIntent, null); assert.equal(natural.stage, PINS.stage); assert.equal(natural.reason, PINS.reason);
  for (const key of ['historicalPrefixReplayedByThisProducer', 'alternateSourceUsed', 'seedChanged', 'randomOverridden', 'futureDrawInspected']) assert.equal(natural.provenance[key], false);
  for (const key of ['newNatural216', 'rebuiltFromRestoredVolume194', 'originalPrefixRetainedExactly', 'completeOriginalSourceRetainedExactly', 'selectedFromEnabledPublicActionsOnly']) assert.equal(natural.provenance[key], true);
  const summary = json<Record<string, unknown> & { public: CapturedPublic }>('summary.json');
  assert.deepEqual(summary, { stage: PINS.stage, reason: PINS.reason, commands: FINAL_COMMAND, originalCommands: PREFIX, newCommands: NEW_COMMANDS,
    rebuild: 'NEW216', newNatural216: true, controlledStop: false, week: 215, paused: false, diagnostic: false,
    strictFinalValidation: true, sqliteReopenValidation: 'NOT_RUN_BY_PRODUCER', checkpoint: 'checkpoint.json.gz', public: summary.public });
  assert.equal(hash(summary.public), PINS.finalPublicSha256);
  return { original: original.final, initial, checkpoint: cp, rows: cp.rows };
}
