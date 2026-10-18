import { assertEmptyDemonessState, assertEmptyDemonessPublic } from './empty-demoness-capture.js';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';
import { assertEmptyErrorAscentState, assertEmptyErrorAscentPublic } from './empty-error-ascent-capture.js';
import { assertEmptyTwilightGiantState, assertEmptyTwilightGiantPublic } from './empty-twilight-giant-capture.js';

/** Independent immutable NEW218 reader. Never imports/executes the producer,
 * gameplay replay, migration, SQLite or controlled scenario builders.
 * Historical runtime freeze is an audit artifact, never compared with current code. */
export const ROOT = process.env.DOOR_CAPTURE_ROOT ?? 'tests/fixtures/door-v02180';
export const SOURCE = 'tests/fixtures/star-key-v01960/natural.json';
export const SOURCE_SHA = 'd9f23dd736ccf0a9fe4eb48e7ffbd79f86a87c6f6ad58dcd913d234c3251cc6d';
export const PREFIX = 823, SOURCE_REVISION = 1131;
export const NEW_COMMANDS = 105, FINAL_COMMAND = PREFIX + NEW_COMMANDS;
export const CAPTURE_SCHEMA = 215, CAPTURE_CONTENT = 'door-v215';
export const MANIFEST = 'test-inputs/door-v02180-capture-files.json';
export const MANIFEST_SHA = '20cbef150abd01ad544a9fb911f178087872e0d4a2fd08a47fdeddb9834c8402';
export const FORMAT = 'NEW218_RESTORED196_LIVING823_DURABLE_PUBLIC_ACTION_BOUNDARY_V1';
export const PREFIX_ENCODING = 'JSON_STRINGIFY_UTF8_ORIGINAL_OBJECT_KEY_ORDER';
export const STATE_ENCODING = 'STABLE_STRINGIFY_CANONICAL_JSON_UTF8';
export const PINS = {
  "prefixSha256": "ac621af822eec1b364d0b98a9215beaa048942915b43e6718c56725d1e445385",
  "inputFreezeSha256": "24679ef09ed7d3cf2d21ee092dec8aa068d1bfda1f55f763db946ae0aa47d3ae",
  "runtimeFreezeSha256": "fc2308010ba258a1f8364d43cf23868baafd4bac14ed1af873934577236d4385",
  "initialStateSha256": "af86bdaa96740f6394e5f83091aea0a155db6c636a3b6afb2cead79aacb0b038",
  "finalStateSha256": "3bf28a14b38ff28099a1f87fafe1e26844f0a1e1104878f2ab5607a027be6bb9",
  "initialPublicSha256": "e8f6ef065665cad73812d44d79564975b36b44cd95eb9d1f7b68b28dd6143829",
  "initialGlobalPublicSha256": "15bf3536bcc78be94780d7d8abac83d5c40f6bd9242516dea0124884b5685061",
  "initialRandomSha256": "3bcf585998aec4212f5366265e1858736f7d4e096aaaefccd1b4eaba5357507a",
  "predecessorSha256": "e246dd57af3f2b2018e728169777a792a8b775339989b142c140bc34f2adfdd0",
  "createdAt": "2026-10-18T13:33:06.310Z",
  "originalStateSha256": "56ecbdddfdbfa82116aa8ea466d4195be0b98e4ccbcc49bea07f3f2cabfd1a5b",
  "checkpointEnvelopeSha256": "ebc19c9151aeb66ad11f7309925d2325b85f8b8b262e2c640cf234e78d226b98",
  "finalPublicSha256": "4f7542e6c04a74139d8d3f8d44421f85de17017e534e522a1e3f619081be5015",
  "finalGlobalPublicSha256": "7d9215ab489a904b92697ecbc13ec82e8793ea5f7691161eac252cbefd1b7e70",
  "finalRandomSha256": "9b22ff45bb5e3ee9dd5e3ef9ed0f2727c3810a3e13e307fd111b0616702f291a",
  "initialPolicySha256": "fa5b35e9bb5e99607e467520fc801c7ede0ac4eaa52a5df3396f0f30a0052736",
  "finalPolicySha256": "bd0ffd00be6cccd692921ef4bc76b025cbd41f580502a2856e54e536343288be",
  "stage": "NATURAL_FINITE_DOOR_REPORTED",
  "reason": "The finite actual incident was honestly reported; all failed attempts and costs remain",
  "sqliteCommandCounts": [
    824,
    916,
    928
  ],
  "boundaryCommandCounts": [
    824,
    825,
    826,
    827,
    828,
    829,
    830,
    831,
    835,
    836,
    841,
    842,
    843,
    844,
    845,
    847,
    848,
    850,
    851,
    855,
    856,
    861,
    863,
    864,
    865,
    866,
    868,
    869,
    870,
    871,
    875,
    876,
    881,
    882,
    883,
    884,
    885,
    886,
    889,
    890,
    891,
    894,
    895,
    896,
    903,
    904,
    906,
    907,
    908,
    911,
    912,
    913,
    915,
    916,
    918,
    919,
    920,
    921,
    922,
    923,
    924,
    925,
    926
  ]
} as const;
/** The historical archive omits prior directed actions. Never count + 1. */
export const revisionAt = (count: number, side: 'before' | 'after'): number =>
  SOURCE_REVISION + count - PREFIX - (side === 'before' ? 1 : 0);
export const POLICY_DEFINITION = {
  "id": "NEW218_SAME_THREE_ORIGINALS_OWNED_PUBLIC_V1",
  "startWeek": 218,
  "defaultObservationActions": 32,
  "selectedBoundaryLimit": 64,
  "selectedBoundaryTerminalReserve": 1,
  "carrierLimit": 3,
  "serviceLimit": 3,
  "selection": "EXACT_ENABLED_RUNTIME_PREFERRED_DOOR_CONTROL",
  "ordinary": "ACTUAL_WORK_REST_CLINIC_NEXT_WEEK_AND_PHYSICAL_EXITS",
  "epilogue": "TWO_FINITE_TECHNIQUE_ATTEMPTS_ACTUAL_APPLICATION_OR_ORDINARY_EXIT_HONEST_REPORT",
  "failure": "RETAIN_ACTUAL_COSTS_INJURIES_POLLUTION_REMAINS_AND_TERMINAL_DEATH",
  "observationLimit": "RESUMABLE_CONTROLLED_STOP_NEVER_PRODUCT_FAILURE",
  "noReroll": true
} as const;

export interface FilePin { bytes: number; sha256: string }
export interface CaptureManifest { format: string; files: Array<FilePin & { file: string }> }
export interface Policy {
  phase: string; week: number; doses: number; carriers: string[]; consumedCompounds: string[];
  epilogueAttempted: string[]; reported: boolean;
  loop: { key: string | null; repetitions: number; recent: string[]; cycleRepeats: number };
}
export interface Outcome {
  status: SliceState['status']; sequence: SliceProjection['progression']['sequence']; promoted: boolean; guidance: boolean;
}
export interface Row {
  commandCount: number; intent: SliceIntent; commandSha256: string; reason: string; publicLabel: string; publicCost: string;
  startedAt: string; elapsedMilliseconds: number; revision: number; week: number;
  beforeStateSha256: string; afterStateSha256: string; publicBeforeSha256: string; publicAfterSha256: string;
  globalPublicBeforeSha256: string; globalPublicAfterSha256: string;
  randomBefore: SliceState['random']; randomAfter: SliceState['random']; randomBeforeSha256: string; randomAfterSha256: string;
  policyBeforeSha256: string; policyAfterSha256: string; selectionOutcome: Outcome;
  receipts: { checks: unknown[]; finance: unknown[]; notes: unknown[] }; capture: FilePin & { file: string };
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
  inputFreezeSha256: string; runtimeFreezeSha256: string; policyDefinition: typeof POLICY_DEFINITION; policy: Policy;
  migration: { originalStateSha256: string; migratedStateSha256: string; fromSchema: number; toSchema: number };
  createdAt: string; predecessorSha256: string; commandCount: number; commands: SliceIntent[]; rows: Row[]; boundaries: Boundary[];
  state: SliceState; initialStateSha256: string; finalStateSha256: string; initialPublicSha256: string; publicStateSha256: string;
  initialGlobalPublicSha256: string; globalPublicStateSha256: string; initialRandomSha256: string;
  pending: unknown | null; terminal: { stage: string; reason: string } | null;
}
export type OriginalState = Omit<SliceState, 'schemaVersion' | 'contentVersion'> & {
  schemaVersion: 193; contentVersion: 'star-key-v193';
};
export interface History { commands: SliceIntent[]; final: OriginalState; seed: string; creation: unknown }
export interface Initial {
  originalStateSha256: string; migratedStateSha256: string; publicSha256: string; globalPublicSha256: string;
  final: SliceState; random: SliceState['random']; public: CapturedPublic; globalPublic: SliceProjection;
}
export interface Natural {
  provenance: Record<string, unknown>; commands: SliceIntent[]; final: SliceState; seed: string; creation: unknown;
  prefixCount: number; policy: typeof POLICY_DEFINITION; boundaries: Boundary[]; stage: string; reason: string; pendingIntent: null;
}
export interface LoadedCapture {
  original: OriginalState; initial: SliceState; initialPublic: SliceProjection; checkpoint: Checkpoint; rows: Row[];
}

export function stable(value: unknown): string {
  function canonical(node: unknown): unknown {
    if (node === null || typeof node === 'string' || typeof node === 'boolean') return node;
    if (typeof node === 'number') { assert(Number.isFinite(node)); return Object.is(node, -0) ? 0 : node; }
    if (Array.isArray(node)) return node.map(canonical);
    assert(node && typeof node === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(node)), 'Expected JSON value');
    const object = node as Record<string, unknown>;
    return Object.fromEntries(Object.keys(object).sort().map(key => [key, canonical(object[key])]));
  }
  return JSON.stringify(canonical(value));
}
export const sha = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
export const hash = (value: unknown): string => sha(stable(value));
export const compactHash = (value: unknown): string => sha(JSON.stringify(value));
export const same = (actual: unknown, expected: unknown, message?: string): void => assert.equal(hash(actual), hash(expected), message);
export function exactKeys(value: object, expected: readonly string[]): void {
  assert(value && typeof value === 'object' && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
}
function relativeFile(file: string): string {
  assert(file && !file.includes('\\') && !file.includes('\0') && !file.startsWith('/') && !/^[A-Za-z]:/.test(file));
  assert(file.split('/').every(part => part && part !== '.' && part !== '..')); return file;
}
export function bytes(path: string): Buffer {
  assert.equal(realpathSync(path), resolve(path), 'Evidence must not be symlinked');
  const before = lstatSync(path, { bigint: true }); assert(before.isFile() && !before.isSymbolicLink());
  const value = readFileSync(path), after = lstatSync(path, { bigint: true });
  for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino'] as const) assert.equal(after[key], before[key], 'Evidence changed while reading');
  assert.equal(BigInt(value.length), before.size); return value;
}
export const filePin = (path: string): FilePin => { const value = bytes(path); return { bytes: value.length, sha256: sha(value) }; };
export function readManifest(): CaptureManifest {
  const raw = bytes(MANIFEST); assert.equal(sha(raw), MANIFEST_SHA, 'Reviewed complete fixture manifest changed');
  const manifest = JSON.parse(raw.toString('utf8')) as CaptureManifest;
  exactKeys(manifest, ['format', 'files']); assert.equal(manifest.format, 'DOOR218_CAPTURE_FILES_V1');
  assert.equal(manifest.files.length, 117);
  const names = manifest.files.map(row => {
    exactKeys(row, ['file', 'bytes', 'sha256']); relativeFile(row.file); assert(!row.file.includes('/'));
    assert(Number.isSafeInteger(row.bytes) && row.bytes > 0 && /^[a-f0-9]{64}$/.test(row.sha256));
    assert(!row.file.endsWith('.next') && !row.file.endsWith('.derived-next')); return row.file;
  });
  assert.equal(new Set(names).size, names.length); assert.deepEqual(names, [...names].sort());
  assert.equal(manifest.files.reduce((total, row) => total + row.bytes, 0), 132903940);
  return manifest;
}
export const FILE_PINS: Readonly<Record<string, FilePin>> = Object.freeze(Object.fromEntries(readManifest().files
  .map(({ file, ...pin }) => [file, Object.freeze(pin)])));
export function decoded(file: string): Buffer {
  relativeFile(file); assert(Object.hasOwn(FILE_PINS, file), 'Unpinned capture member');
  const raw = bytes(join(ROOT, file)); assert.deepEqual({ bytes: raw.length, sha256: sha(raw) }, FILE_PINS[file], file);
  return file.endsWith('.gz') ? gunzipSync(raw) : raw;
}
export const json = <T>(file: string): T => JSON.parse(decoded(file).toString('utf8')) as T;
export function readCheckpoint(): Checkpoint {
  const wrapper = json<{ sha256: string; payload: Checkpoint }>('checkpoint.json.gz'); exactKeys(wrapper, ['sha256', 'payload']);
  assert.equal(wrapper.sha256, PINS.checkpointEnvelopeSha256); assert.equal(hash(wrapper.payload), wrapper.sha256);
  return wrapper.payload;
}
/** One compressed member at a time; never inflate/cache all full actions. */
export function authenticateInputs(): void {
  const manifest = readManifest();
  assert.deepEqual(readdirSync(ROOT).sort(), manifest.files.map(row => row.file), 'Missing or unindexed capture member');
  for (const { file, ...pin } of manifest.files) assert.deepEqual(filePin(join(ROOT, file)), pin, file);
  const original = bytes(SOURCE); assert.equal(original.length, 9160811); assert.equal(sha(original), SOURCE_SHA);
  assert(decoded('archived-original196-natural.json.gz').equals(original), 'Complete original196 bytes must remain exact');
  const freeze = json<{ sha256: string; nodeVersion: string; files: Array<FilePin & { file: string }> }>('runtime-freeze.json');
  exactKeys(freeze, ['sha256', 'nodeVersion', 'files']); assert.equal(freeze.sha256, PINS.runtimeFreezeSha256);
  assert.equal(compactHash(freeze.files), freeze.sha256); assert.equal(freeze.nodeVersion, 'v24.19.0'); assert.equal(freeze.files.length, 4675);
  assert.equal(new Set(freeze.files.map(row => row.file)).size, freeze.files.length);
  for (const [captured, name] of [['producer.mjs', '$natural-producer'], ['producer-tests.mjs', 'scripts/play/door-stage.test.mjs']])
    assert.deepEqual(freeze.files.find(row => row.file === name), { file: name, ...FILE_PINS[captured!] });
  for (const row of freeze.files) {
    exactKeys(row, ['file', 'bytes', 'sha256']); if (row.file !== '$natural-producer') relativeFile(row.file);
    assert(Number.isSafeInteger(row.bytes) && row.bytes >= 0 && /^[a-f0-9]{64}$/.test(row.sha256));
  }
  const inputFiles = [{ file: SOURCE, sha256: SOURCE_SHA, bytes: original.length }];
  assert.equal(compactHash(inputFiles), PINS.inputFreezeSha256);
  same(json('input-freeze.json'), { format: 'NEW218_RESTORED196_HISTORICAL_INPUTS_V1', sha256: PINS.inputFreezeSha256,
    files: inputFiles, originalStateSha256: PINS.originalStateSha256, stateHashEncoding: STATE_ENCODING, sourceRoot: 'final',
    prefixSha256: PINS.prefixSha256, prefixHashEncoding: PREFIX_ENCODING, archivedCommandCount: PREFIX });
  const cp = readCheckpoint(), recovery = json<{ sha256: string; payload: unknown }>('recovery-manifest.json');
  exactKeys(recovery, ['sha256', 'payload']); assert.equal(recovery.sha256, hash(recovery.payload));
  same(recovery.payload, { format: `${FORMAT}_RECOVERY`, commandCount: FINAL_COMMAND, checkpointSha256: PINS.checkpointEnvelopeSha256,
    inputFreezeSha256: PINS.inputFreezeSha256, runtimeFreezeSha256: PINS.runtimeFreezeSha256,
    runtimeRequirement: 'SEPARATE_EXACT_FROZEN_CHECKOUT_AND_NODE_VERSION', files: manifest.files.filter(row => row.file !== 'recovery-manifest.json') });
  assert.equal(cp.pending, null);
}

const PUBLIC_FIELDS = ['runId', 'revision', 'status', 'week', 'date', 'actionsRemaining', 'weeklyBudget', 'cash', 'weeklyWage', 'wagePaid',
  'health', 'mind', 'spirituality', 'maxHealth', 'maxMind', 'maxSpirituality', 'pollution', 'injuries', 'injuryRisk',
  'debtTotal', 'debts', 'canAct', 'actionBlockedReason', 'activeEvent', 'combat'] as const;
export function capturePublic(projection: SliceProjection) {
  const ordinary = Object.fromEntries(PUBLIC_FIELDS.map(key => [key, structuredClone(projection[key])])) as Pick<SliceProjection, typeof PUBLIC_FIELDS[number]>;
  return { ...ordinary, progression: { sequence: projection.progression.sequence, acting: projection.progression.acting,
    mastery: structuredClone(projection.progression.mastery) }, door: structuredClone(projection.door) };
}
export type CapturedPublic = ReturnType<typeof capturePublic>;
export function assertPublicOnly(value: unknown, state: Pick<SliceState, 'random' | 'door'>): void {
  const forbidden = /^(?:random|rng|rngState|seed|cursor|randomSeed|randomCursor|randomCursorBefore|randomCursorAfter|cursorBefore|cursorAfter|randomBefore|randomAfter|randomReceipts|preparedRoll|preparationRoll|futureRoll|futureRolls|nextRoll|unrolledResult|privateSource|sourceState|sourceDigest|historyDigest|originalWorldDigest|combatHistoryDigest|originalsDigest|originalPracticeDigest|acquisitionDigest|compoundDigest|beforeDigest|afterDigest|actorId|predecessorActorId|incumbentActorId|custodianActorId|sourceHistory|sourceScene|privateProbe|privateMastery|unexpectedField)$/;
  function visit(node: unknown, path: string): void {
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      const next = `${path}.${key}`, inactive = key === 'actorId' && child === null &&
        ['.divineHand.life.site.guard.actorId', '.glory.life.site.guard.actorId'].some(suffix => next.endsWith(suffix));
      assert(!(forbidden.test(key) && !inactive), `Private field ${next}`);
      assert(!(key === 'source' && child !== null && typeof child === 'object'), `Private source ${next}`); visit(child, next);
    }
  }
  visit(value, '$'); const text = JSON.stringify(value);
  for (const secret of [state.random.seed, state.door.source?.actorId, state.door.source?.historyDigest])
    if (secret) assert(!text.includes(secret), 'An actual private value leaked');
}
export const assertGlobalPublic = (value: SliceProjection, state: SliceState): void => assertPublicOnly(value, state);
export const outcome = (view: CapturedPublic): Outcome => ({ status: view.status, sequence: view.progression.sequence,
  promoted: view.door.promoted, guidance: view.door.guidanceKnown });
export function assertPublicAction(view: CapturedPublic, row: Pick<Row, 'intent' | 'publicLabel' | 'publicCost'>): void {
  assert.equal(view.status, 'ACTIVE'); assert.equal(view.activeEvent, null); assert.equal(view.combat, null);
  assert(row.intent.type === 'DOOR');
  const preferred = view.door.actions.filter(action => action.preferredAction); assert.equal(preferred.length, 1);
  const action = preferred[0]!; assert.equal(action.enabled, true); same(action.command, row.intent.command);
  assert.equal(action.label, row.publicLabel); assert.equal(action.cost, row.publicCost);
}
export function actualReceipts(after: SliceState, before: SliceState): Row['receipts'] {
  const latest = after.door.journal.at(-1);
  if (latest?.revision === after.revision) return { checks: latest.randomReceipts, finance: latest.financeReceipts, notes: latest.notes };
  assert(!before.door.guidanceKnown && after.door.guidanceKnown);
  return { checks: [], finance: [], notes: after.chronicle.slice(before.chronicle.length) };
}
export type HistoricalDoorState = Omit<SliceState, 'schemaVersion' | 'contentVersion' | 'errorAscent' | 'twilightGiant' | 'demoness'> & {
  schemaVersion: 215; contentVersion: 'door-v215';
};
export type HistoricalDoorPublic = Omit<SliceProjection, 'errorAscent' | 'twilightGiant' | 'demoness'>;
/** Only the independently pinned schema216 Error, schema217 Twilight Giant and schema218 Demoness defaults may be omitted.
 * Every historical field and unknown addition stays covered by the raw215 pins. */
export function historicalDoorState(state: SliceState): HistoricalDoorState {
  assert.deepEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION], [218, 'demoness-v218'],
    'A future schema requires a separate exact-empty-root migration adapter');
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  assertEmptyErrorAscentState(state); assertEmptyTwilightGiantState(state); assertEmptyDemonessState(state);
  const { errorAscent: _emptyErrorAscent, twilightGiant: _emptyTwilightGiant, demoness: _emptyDemoness, ...originalFields } = state;
  return { ...originalFields, schemaVersion: CAPTURE_SCHEMA, contentVersion: CAPTURE_CONTENT };
}
export function historicalDoorPublic(projection: SliceProjection, state: SliceState): HistoricalDoorPublic {
  historicalDoorState(state); assertEmptyErrorAscentPublic(projection, state); assertEmptyTwilightGiantPublic(projection, state); assertEmptyDemonessPublic(projection, state);
  const { errorAscent: _emptyErrorAscent, twilightGiant: _emptyTwilightGiant, demoness: _emptyDemoness, ...originalFields } = projection;
  return originalFields;
}
export function assertCapturedGlobal(actual: SliceProjection, action: Action, side: 'before' | 'after'): void {
  const state = side === 'before' ? action.beforeLast : action.final;
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CAPTURE_SCHEMA, CAPTURE_CONTENT]);
  assert.equal(state.revision, revisionAt(action.commandCount, side));
  assert.equal(Object.hasOwn(state, 'errorAscent'), false); assert.equal(Object.hasOwn(state, 'twilightGiant'), false); assert.equal(Object.hasOwn(state, 'demoness'), false); assert.equal(Object.hasOwn(actual, 'errorAscent'), false); assert.equal(Object.hasOwn(actual, 'twilightGiant'), false); assert.equal(Object.hasOwn(actual, 'demoness'), false);
  const expected = side === 'before' ? action.globalPublicBefore : action.globalPublic;
  exactKeys(actual, Object.keys(expected));
  same(actual, expected, `Complete captured global public ${action.commandCount} ${side}`);
  assert.equal(hash(actual), side === 'before' ? action.audit.globalPublicBeforeSha256 : action.audit.globalPublicAfterSha256);
  same(capturePublic(actual), side === 'before' ? action.publicBefore : action.public); assertGlobalPublic(actual, state);
}
export function assertCurrentGlobal(actual: SliceProjection, action: Action, side: 'before' | 'after'): void {
  const state = side === 'before' ? action.beforeLast : action.final;
  assertEmptyErrorAscentPublic(actual, state); assertEmptyTwilightGiantPublic(actual, state); assertEmptyDemonessPublic(actual, state);
  const { errorAscent: _emptyErrorAscent, twilightGiant: _emptyTwilightGiant, demoness: _emptyDemoness, ...historicalPublic } = actual;
  assertCapturedGlobal(historicalPublic as SliceProjection, action, side); assertGlobalPublic(actual, state);
}

function assertPolicyTransition(action: Action): void {
  const before = action.publicBefore, after = action.public, prior = action.policyBefore, next = structuredClone(prior);
  assert(action.lastIntent.type === 'DOOR'); const command = action.lastIntent.command;
  assert.equal(prior.reported, false);
  next.phase = !before.door.guidanceKnown ? 'DOOR_ENTRY' : before.door.promoted ? 'DOOR_EPILOGUE' : 'DOOR_SERVICES_MATERIALS_PROMOTION';
  next.week = after.week;
  if (command.type === 'CONSUME') {
    assert.equal(command.confirmed, true); assert(!next.consumedCompounds.includes(command.compoundId));
    next.consumedCompounds.push(command.compoundId); next.doses++; assert(next.doses <= 3);
  }
  if (command.type === 'MATERIAL' && command.command.type === 'BUY_COMPOUND') {
    const id = command.command.batchId; assert(['door-carrier-1', 'door-carrier-2', 'door-carrier-3'].includes(id));
    assert(!next.carriers.includes(id)); next.carriers.push(id); assert(next.carriers.length <= 3);
  }
  if (command.type === 'EPILOGUE') {
    const type = command.command.type;
    if (type === 'CONCEPTUAL_ESCAPE' || type === 'SEAL_EXIT') {
      assert(!next.epilogueAttempted.includes(type)); next.epilogueAttempted.push(type);
    }
    if (type === 'REPORT') next.reported = true;
  }
  const semantic = (view: CapturedPublic) => ({ phase: next.phase, sequence: view.progression.sequence,
    acting: view.progression.acting, mastery: view.progression.mastery,
    progress: view.door.sections.filter(section => !['clock', 'recent-action', 'finance', 'body'].includes(section.id)),
    intended: view.door.actions.filter(item => item.preferredAction).map(item => item.command) });
  const gained = after.cash > before.cash || after.health > before.health || after.mind > before.mind ||
    after.spirituality > before.spirituality || after.pollution < before.pollution || after.injuries.length < before.injuries.length;
  const key = hash(semantic(after)), cycle = hash({ ...semantic(after), cash: after.cash, actionsRemaining: after.actionsRemaining,
    health: after.health, mind: after.mind, spirituality: after.spirituality, pollution: after.pollution,
    injuries: after.injuries, injuryRisk: after.injuryRisk, debtTotal: after.debtTotal });
  const recent = [...prior.loop.recent, cycle].slice(-32);
  next.loop = { key, repetitions: hash(semantic(before)) === key && !gained ? prior.loop.repetitions + 1 : 0,
    recent, cycleRepeats: recent.filter(value => value === cycle).length - 1 };
  same(action.policyAfter, next, 'Exact independently derived public policy transition');
}
export function readAction(row: Row): Action {
  assert(Number.isSafeInteger(row.commandCount) && row.commandCount > PREFIX && row.commandCount <= FINAL_COMMAND);
  assert.equal(row.capture.file, `action-${row.commandCount}.json.gz`);
  exactKeys(row.capture, ['file', 'bytes', 'sha256']);
  assert.deepEqual({ bytes: row.capture.bytes, sha256: row.capture.sha256 }, FILE_PINS[row.capture.file]);
  const action = json<Action>(row.capture.file);
  exactKeys(action, ['commandCount', 'beforeLast', 'lastIntent', 'final', 'randomBefore', 'randomAfter', 'publicBefore', 'public',
    'globalPublicBefore', 'globalPublic', 'policyBefore', 'policyAfter', 'audit']);
  const { capture: _capture, ...audit } = row;
  same(action.audit, { ...audit, elapsedMilliseconds: null }); assert.equal(action.commandCount, row.commandCount); same(action.lastIntent, row.intent);
  for (const [value, expected] of [[action.beforeLast, row.beforeStateSha256], [action.final, row.afterStateSha256],
    [action.publicBefore, row.publicBeforeSha256], [action.public, row.publicAfterSha256],
    [action.globalPublicBefore, row.globalPublicBeforeSha256], [action.globalPublic, row.globalPublicAfterSha256],
    [action.policyBefore, row.policyBeforeSha256], [action.policyAfter, row.policyAfterSha256]] as const) assert.equal(hash(value), expected);
  for (const state of [action.beforeLast, action.final]) {
    assert.deepEqual([state.schemaVersion, state.contentVersion], [CAPTURE_SCHEMA, CAPTURE_CONTENT]);
    assert.equal(state.runId, 'apprentice-rebuild-natural');
  }
  assert.equal(action.beforeLast.revision, revisionAt(row.commandCount, 'before')); assert.equal(action.final.revision, revisionAt(row.commandCount, 'after'));
  same(action.randomBefore, row.randomBefore); same(action.randomAfter, row.randomAfter);
  same(action.beforeLast.random, row.randomBefore); same(action.final.random, row.randomAfter);
  assertCapturedGlobal(action.globalPublicBefore, action, 'before'); assertCapturedGlobal(action.globalPublic, action, 'after');
  same(actualReceipts(action.final, action.beforeLast), row.receipts); same(outcome(action.public), row.selectionOutcome);
  assertPublicAction(action.publicBefore, row);
  assert.equal(row.reason, 'Follow the exact enabled runtime-preferred public action; retain its actual costs and outcome');
  assertPolicyTransition(action); return action;
}
export function readActionAt(count: number): Action {
  assert(Number.isSafeInteger(count) && count > PREFIX && count <= FINAL_COMMAND);
  return readAction(readCheckpoint().rows[count - PREFIX - 1]!);
}

function selectedBoundaries(rows: Row[]): Array<{ kind: string; commandCount: number }> {
  const result: Array<{ kind: string; commandCount: number }> = [];
  for (const row of rows) {
    assert(row.intent.type === 'DOOR'); const command = row.intent.command; let kind: string | null = null;
    if (row.selectionOutcome.status !== 'ACTIVE') kind = 'door-actual-terminal';
    else {
      if (result.filter(item => item.kind !== 'door-actual-terminal').length >= 63) continue;
      if (['LEARN_GUIDANCE', 'WORK', 'REST', 'CLINIC', 'NEXT_WEEK', 'STABILIZE_PROMOTION', 'START_EPILOGUE', 'RETURN_ON_FOOT'].includes(command.type))
        kind = `door-${command.type.toLowerCase()}`;
      if (command.type === 'TRAVEL') kind = `door-travel-${command.to}`;
      if (command.type === 'SERVICE') kind = `service-${command.command.jobId}-${command.command.type.toLowerCase()}`;
      if (command.type === 'MATERIAL') {
        const c = command.command;
        const suffix = 'bottleId' in c ? c.bottleId : 'step' in c ? c.step : 'batchId' in c ? c.batchId : 'compoundId' in c ? c.compoundId : 'unique';
        kind = `material-${c.type.toLowerCase()}-${suffix}`;
      }
      if (command.type === 'CONSUME') kind = row.selectionOutcome.promoted ? 'door-actual-promotion' : `door-failed-dose-${command.compoundId}`;
      if (command.type === 'EPILOGUE') kind = `epilogue-${command.command.type.toLowerCase()}`;
    }
    if (kind && result.length < 64 && !result.some(item => item.kind === kind)) result.push({ kind, commandCount: row.commandCount });
  }
  return result;
}
/** Full metadata/chain authentication; no gameplay. Full actions are consumed
 * lazily by replay or the few backend/UI representatives. */
export function loadCapture(): LoadedCapture {
  authenticateInputs();
  const history = json<History>('archived-original196-natural.json.gz'), source = history.final;
  assert.equal(history.commands.length, PREFIX); assert.equal(compactHash(history.commands), PINS.prefixSha256);
  assert.equal(hash(source), PINS.originalStateSha256);
  assert.deepEqual([source.schemaVersion, source.contentVersion], [193, 'star-key-v193']);
  assert.equal(source.runId, 'apprentice-rebuild-natural'); assert.equal(source.revision, SOURCE_REVISION);
  assert.equal(source.status, 'ACTIVE'); assert.equal(source.week, 218); assert.equal(history.seed, source.random.seed);
  same(source.random, { seed: 'secrets-sorcerer-directed-24', cursor: 205 });
  const captured = json<Initial>('migration-initial.json.gz');
  exactKeys(captured, ['originalStateSha256', 'migratedStateSha256', 'publicSha256', 'globalPublicSha256', 'final', 'random', 'public', 'globalPublic']);
  assert.equal(captured.originalStateSha256, PINS.originalStateSha256); assert.equal(captured.migratedStateSha256, PINS.initialStateSha256);
  assert.equal(hash(captured.final), PINS.initialStateSha256); assert.equal(hash(captured.random), PINS.initialRandomSha256);
  assert.equal(hash(captured.public), PINS.initialPublicSha256); assert.equal(captured.publicSha256, PINS.initialPublicSha256);
  assert.equal(hash(captured.globalPublic), PINS.initialGlobalPublicSha256); assert.equal(captured.globalPublicSha256, PINS.initialGlobalPublicSha256);
  same(captured.random, source.random); same(captured.final.random, source.random);
  assert.deepEqual([captured.final.schemaVersion, captured.final.contentVersion], [CAPTURE_SCHEMA, CAPTURE_CONTENT]);
  exactKeys(captured.final, [...Object.keys(source), 'abomination', 'apocalypseDemoness', 'darkAngel', 'darkness', 'death',
    'divineHand', 'door', 'fool', 'handOfOrder', 'knowledgeEmperor', 'mercurySnake', 'moon', 'natureWalker', 'perfecter',
    'princeOfAbolition', 'redPriest', 'sun', 'timeWorm', 'tyrant', 'uncleanMonarch', 'visionary', 'whiteTower']);
  for (const [key, value] of Object.entries(source)) if (!['schemaVersion', 'contentVersion'].includes(key))
    same((captured.final as unknown as Record<string, unknown>)[key], value, `Original823 field ${key}`);
  same(capturePublic(captured.globalPublic), captured.public); assertGlobalPublic(captured.globalPublic, captured.final);
  const cp = readCheckpoint();
  exactKeys(cp, ['format', 'source', 'sourceSha256', 'prefixSha256', 'prefixHashEncoding', 'stateHashEncoding', 'inputFreezeSha256',
    'runtimeFreezeSha256', 'policyDefinition', 'policy', 'migration', 'createdAt', 'commandCount', 'commands', 'rows', 'boundaries', 'state',
    'initialStateSha256', 'finalStateSha256', 'initialPublicSha256', 'publicStateSha256', 'initialGlobalPublicSha256',
    'globalPublicStateSha256', 'initialRandomSha256', 'pending', 'terminal', 'predecessorSha256']);
  assert.equal(cp.format, FORMAT); assert.equal(cp.source, SOURCE); assert.equal(cp.sourceSha256, SOURCE_SHA);
  assert.equal(cp.prefixHashEncoding, PREFIX_ENCODING); assert.equal(cp.stateHashEncoding, STATE_ENCODING);
  for (const key of ['prefixSha256', 'inputFreezeSha256', 'runtimeFreezeSha256', 'initialStateSha256', 'finalStateSha256',
    'initialPublicSha256', 'initialGlobalPublicSha256', 'initialRandomSha256', 'predecessorSha256', 'createdAt'] as const)
    assert.equal(cp[key], PINS[key]);
  assert.equal(cp.publicStateSha256, PINS.finalPublicSha256); assert.equal(cp.globalPublicStateSha256, PINS.finalGlobalPublicSha256);
  assert.equal(hash(cp.state), PINS.finalStateSha256); assert.equal(hash(cp.state.random), PINS.finalRandomSha256);
  assert.equal(hash(cp.policy), PINS.finalPolicySha256); same(cp.policyDefinition, POLICY_DEFINITION);
  assert.equal(cp.commandCount, FINAL_COMMAND); assert.equal(cp.commands.length, NEW_COMMANDS); assert.equal(cp.rows.length, NEW_COMMANDS);
  assert.equal(cp.pending, null); same(cp.terminal, { stage: PINS.stage, reason: PINS.reason });
  same(cp.migration, { originalStateSha256: PINS.originalStateSha256, migratedStateSha256: PINS.initialStateSha256, fromSchema: 193, toSchema: 215 });
  let privateHash: string = PINS.initialStateSha256, publicHash: string = PINS.initialPublicSha256,
    globalHash: string = PINS.initialGlobalPublicSha256, randomHash: string = PINS.initialRandomSha256, policyHash: string = PINS.initialPolicySha256;
  for (const [index, row] of cp.rows.entries()) {
    exactKeys(row, ['commandCount', 'intent', 'commandSha256', 'reason', 'publicLabel', 'publicCost', 'startedAt', 'elapsedMilliseconds',
      'revision', 'week', 'beforeStateSha256', 'afterStateSha256', 'publicBeforeSha256', 'publicAfterSha256', 'globalPublicBeforeSha256',
      'globalPublicAfterSha256', 'selectionOutcome', 'randomBefore', 'randomAfter', 'randomBeforeSha256', 'randomAfterSha256',
      'policyBeforeSha256', 'policyAfterSha256', 'receipts', 'capture']);
    assert.equal(row.commandCount, PREFIX + index + 1); assert.equal(row.revision, revisionAt(row.commandCount, 'after')); same(row.intent, cp.commands[index]);
    assert.equal(row.intent.type, 'DOOR'); assert.equal(row.commandSha256, compactHash(row.intent));
    assert.equal(row.beforeStateSha256, privateHash); assert.equal(row.publicBeforeSha256, publicHash);
    assert.equal(row.globalPublicBeforeSha256, globalHash); assert.equal(row.randomBeforeSha256, randomHash); assert.equal(row.policyBeforeSha256, policyHash);
    assert.equal(hash(row.randomBefore), row.randomBeforeSha256); assert.equal(hash(row.randomAfter), row.randomAfterSha256);
    assert.equal(row.randomBefore.seed, history.seed); assert.equal(row.randomAfter.seed, history.seed);
    assert(row.randomAfter.cursor >= row.randomBefore.cursor); exactKeys(row.selectionOutcome, ['guidance', 'promoted', 'sequence', 'status']);
    assert.equal(row.selectionOutcome.status, 'ACTIVE');
    assert.equal(row.selectionOutcome.sequence, row.commandCount < 916 ? 1 : 0); assert.equal(row.selectionOutcome.promoted, row.commandCount >= 916);
    assert.equal(row.selectionOutcome.guidance, true);
    assert.equal(row.capture.file, `action-${row.commandCount}.json.gz`); exactKeys(row.capture, ['file', 'bytes', 'sha256']);
    assert.deepEqual({ bytes: row.capture.bytes, sha256: row.capture.sha256 }, FILE_PINS[row.capture.file]);
    assert(Number.isSafeInteger(row.elapsedMilliseconds) && row.elapsedMilliseconds >= 0); assert(Number.isFinite(Date.parse(row.startedAt)));
    privateHash = row.afterStateSha256; publicHash = row.publicAfterSha256; globalHash = row.globalPublicAfterSha256;
    randomHash = row.randomAfterSha256; policyHash = row.policyAfterSha256;
  }
  assert.equal(privateHash, PINS.finalStateSha256); assert.equal(publicHash, PINS.finalPublicSha256);
  assert.equal(globalHash, PINS.finalGlobalPublicSha256); assert.equal(randomHash, PINS.finalRandomSha256); assert.equal(policyHash, PINS.finalPolicySha256);
  same(cp.commands[0], { type: 'DOOR', command: { type: 'LEARN_GUIDANCE' } });
  assert.deepEqual(Object.keys(FILE_PINS).filter(name => /^action-.*\.json\.gz$/.test(name)).sort(), cp.rows.map(row => row.capture.file).sort());
  same(json<Boundary[]>('boundaries.index.json'), cp.boundaries);
  assert.deepEqual(cp.boundaries.map(row => row.commandCount), [...PINS.boundaryCommandCounts]); assert.equal(cp.boundaries.length, PINS.boundaryCommandCounts.length);
  same(cp.boundaries.map(({ kind, commandCount }) => ({ kind, commandCount })), selectedBoundaries(cp.rows));
  for (const boundary of cp.boundaries) {
    exactKeys(boundary, ['file', 'bytes', 'sha256', 'kind', 'commandCount']);
    const { kind: _kind, commandCount, ...pin } = boundary; same(pin, cp.rows[commandCount - PREFIX - 1]!.capture);
  }
  assert.equal(decoded('commands.ndjson.gz').toString('utf8'), cp.rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  const natural = json<Natural>('natural.json.gz');
  exactKeys(natural, ['provenance', 'creation', 'seed', 'prefixCount', 'commands', 'policy', 'stage', 'reason', 'pendingIntent', 'boundaries', 'final']);
  same(natural.final, cp.state); same(natural.creation, history.creation); assert.equal(natural.seed, history.seed);
  assert.equal(natural.prefixCount, PREFIX); same(natural.commands, [...history.commands, ...cp.commands]);
  same(natural.boundaries, cp.boundaries); same(natural.policy, cp.policyDefinition);
  assert.equal(natural.pendingIntent, null); assert.equal(natural.stage, PINS.stage); assert.equal(natural.reason, PINS.reason);
  same(natural.provenance, { kind: 'NEW218_FROM_RESTORED196_LIVING823_PUBLIC_DOOR_CONTINUATION', format: 'NEW218_REBUILD_PROVENANCE_V1',
    newNatural218: true, rebuiltFromRestoredVolume196: true, source: SOURCE, sourceSha256: SOURCE_SHA, sourceRoot: 'final',
    originalStateSha256: PINS.originalStateSha256, originalEvidence: ['archived-original196-natural.json.gz'],
    prefixCommandsSha256: PINS.prefixSha256, prefixCommandsHashEncoding: PREFIX_ENCODING, stateHashEncoding: STATE_ENCODING,
    inputFreezeSha256: PINS.inputFreezeSha256, runtimeFreezeSha256: PINS.runtimeFreezeSha256,
    historicalPrefixReplayedByThisProducer: false, originalPrefixRetainedExactly: true, completeOriginalSourceRetainedExactly: true,
    alternateSourceUsed: false, privateAudit: true, seedChanged: false, randomOverridden: false, futureDrawInspected: false,
    selectedFromEnabledPublicActionsOnly: true, everyActionEvidence: 'FULL_PRIVATE_RNG_CHAPTER_PUBLIC_AND_GLOBAL_PUBLIC_BEFORE_AND_AFTER_GZIP',
    selectedSQLiteBoundaries: 'CAPTURED_FOR_LATER_REOPEN_CHECKS_NOT_EXECUTED_BY_PRODUCER',
    globalPublicScope: 'WHOLE_SLICE_EXACT_SENSITIVE_FIELD_SCAN_AND_SEPARATE_HASH', projectionScope: 'POSITIVE_DOOR_AND_ORDINARY_PUBLIC_DASHBOARD' });
  const summary = json<Record<string, unknown> & { public: CapturedPublic }>('summary.json');
  same(summary, { stage: PINS.stage, reason: PINS.reason, commands: FINAL_COMMAND, originalCommands: PREFIX, newCommands: NEW_COMMANDS,
    rebuild: 'NEW218', newNatural218: true, controlledStop: false, week: 229, paused: false, diagnostic: false,
    strictFinalValidation: true, sqliteReopenValidation: 'NOT_RUN_BY_PRODUCER', packageReopenValidation: 'NOT_RUN_BY_PRODUCER',
    recoveryManifest: 'recovery-manifest.json', checkpoint: 'checkpoint.json.gz', public: summary.public });
  assert.equal(hash(summary.public), PINS.finalPublicSha256); assertPublicOnly(summary.public, cp.state);
  return { original: source, initial: captured.final, initialPublic: captured.globalPublic, checkpoint: cp, rows: cp.rows };
}
